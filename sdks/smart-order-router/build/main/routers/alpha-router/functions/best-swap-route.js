"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestSwapRouteBy = exports.getBestSwapRoute = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const router_sdk_1 = require("@swyrlfi/router-sdk");
const sdk_core_1 = require("@swyrlfi/sdk-core");
const jsbi_1 = __importDefault(require("jsbi"));
const lodash_1 = __importDefault(require("lodash"));
const fixed_reverse_heap_1 = __importDefault(require("mnemonist/fixed-reverse-heap"));
const queue_1 = __importDefault(require("mnemonist/queue"));
const util_1 = require("../../../util");
const amounts_1 = require("../../../util/amounts");
const log_1 = require("../../../util/log");
const metric_1 = require("../../../util/metric");
const routes_1 = require("../../../util/routes");
const gas_models_1 = require("../gas-models");
async function getBestSwapRoute(amount, percents, routesWithValidQuotes, routeType, chainId, routingConfig, gasModel) {
    const now = Date.now();
    const { forceMixedRoutes } = routingConfig;
    /// Like with forceCrossProtocol, we apply that logic here when determining the bestSwapRoute
    if (forceMixedRoutes) {
        log_1.log.info({
            forceMixedRoutes: forceMixedRoutes,
        }, 'Forcing mixed routes by filtering out other route types');
        routesWithValidQuotes = lodash_1.default.filter(routesWithValidQuotes, (quotes) => {
            return quotes.protocol === router_sdk_1.Protocol.MIXED;
        });
        if (!routesWithValidQuotes) {
            return null;
        }
    }
    // Build a map of percentage of the input to list of valid quotes.
    // Quotes can be null for a variety of reasons (not enough liquidity etc), so we drop them here too.
    const percentToQuotes = {};
    for (const routeWithValidQuote of routesWithValidQuotes) {
        if (!percentToQuotes[routeWithValidQuote.percent]) {
            percentToQuotes[routeWithValidQuote.percent] = [];
        }
        percentToQuotes[routeWithValidQuote.percent].push(routeWithValidQuote);
    }
    metric_1.metric.putMetric('BuildRouteWithValidQuoteObjects', Date.now() - now, metric_1.MetricLoggerUnit.Milliseconds);
    // Given all the valid quotes for each percentage find the optimal route.
    const swapRoute = await getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, (rq) => rq.quoteAdjustedForGas, routingConfig, gasModel);
    // It is possible we were unable to find any valid route given the quotes.
    if (!swapRoute) {
        return null;
    }
    // Due to potential loss of precision when taking percentages of the input it is possible that the sum of the amounts of each
    // route of our optimal quote may not add up exactly to exactIn or exactOut.
    //
    // We check this here, and if there is a mismatch
    // add the missing amount to a random route. The missing amount size should be neglible so the quote should still be highly accurate.
    const { routes: routeAmounts } = swapRoute;
    const totalAmount = lodash_1.default.reduce(routeAmounts, (total, routeAmount) => total.add(routeAmount.amount), amounts_1.CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const missingAmount = amount.subtract(totalAmount);
    if (missingAmount.greaterThan(0)) {
        log_1.log.info({
            missingAmount: missingAmount.quotient.toString(),
        }, `Optimal route's amounts did not equal exactIn/exactOut total. Adding missing amount to last route in array.`);
        routeAmounts[routeAmounts.length - 1].amount =
            routeAmounts[routeAmounts.length - 1].amount.add(missingAmount);
    }
    log_1.log.info({
        routes: (0, routes_1.routeAmountsToString)(routeAmounts),
        numSplits: routeAmounts.length,
        amount: amount.toExact(),
        quote: swapRoute.quote.toExact(),
        quoteGasAdjusted: swapRoute.quoteGasAdjusted.toFixed(Math.min(swapRoute.quoteGasAdjusted.currency.decimals, 2)),
        estimatedGasUSD: swapRoute.estimatedGasUsedUSD.toFixed(Math.min(swapRoute.estimatedGasUsedUSD.currency.decimals, 2)),
        estimatedGasToken: swapRoute.estimatedGasUsedQuoteToken.toFixed(Math.min(swapRoute.estimatedGasUsedQuoteToken.currency.decimals, 2)),
    }, `Found best swap route. ${routeAmounts.length} split.`);
    return swapRoute;
}
exports.getBestSwapRoute = getBestSwapRoute;
async function getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, by, routingConfig, gasModel) {
    var _a;
    // Build a map of percentage to sorted list of quotes, with the biggest quote being first in the list.
    const percentToSortedQuotes = lodash_1.default.mapValues(percentToQuotes, (routeQuotes) => {
        return routeQuotes.sort((routeQuoteA, routeQuoteB) => {
            if (routeType == sdk_core_1.TradeType.EXACT_INPUT) {
                return by(routeQuoteA).greaterThan(by(routeQuoteB)) ? -1 : 1;
            }
            else {
                return by(routeQuoteA).lessThan(by(routeQuoteB)) ? -1 : 1;
            }
        });
    });
    const quoteCompFn = routeType == sdk_core_1.TradeType.EXACT_INPUT
        ? (a, b) => a.greaterThan(b)
        : (a, b) => a.lessThan(b);
    const sumFn = (currencyAmounts) => {
        let sum = currencyAmounts[0];
        for (let i = 1; i < currencyAmounts.length; i++) {
            sum = sum.add(currencyAmounts[i]);
        }
        return sum;
    };
    let bestQuote;
    let bestSwap;
    // Min-heap for tracking the 5 best swaps given some number of splits.
    const bestSwapsPerSplit = new fixed_reverse_heap_1.default(Array, (a, b) => {
        return quoteCompFn(a.quote, b.quote) ? -1 : 1;
    }, 3);
    const { minSplits, maxSplits, forceCrossProtocol } = routingConfig;
    if (!percentToSortedQuotes[100] || minSplits > 1 || forceCrossProtocol) {
        log_1.log.info({
            percentToSortedQuotes: lodash_1.default.mapValues(percentToSortedQuotes, (p) => p.length),
        }, 'Did not find a valid route without any splits. Continuing search anyway.');
    }
    else {
        bestQuote = by(percentToSortedQuotes[100][0]);
        bestSwap = [percentToSortedQuotes[100][0]];
        for (const routeWithQuote of percentToSortedQuotes[100].slice(0, 5)) {
            bestSwapsPerSplit.push({
                quote: by(routeWithQuote),
                routes: [routeWithQuote],
            });
        }
    }
    // We do a BFS. Each additional node in a path represents us adding an additional split to the route.
    const queue = new queue_1.default();
    // First we seed BFS queue with the best quotes for each percentage.
    // i.e. [best quote when sending 10% of amount, best quote when sending 20% of amount, ...]
    // We will explore the various combinations from each node.
    for (let i = percents.length; i >= 0; i--) {
        const percent = percents[i];
        if (!percentToSortedQuotes[percent]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][0]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: false,
        });
        if (!percentToSortedQuotes[percent] ||
            !percentToSortedQuotes[percent][1]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][1]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: true,
        });
    }
    let splits = 1;
    let startedSplit = Date.now();
    while (queue.size > 0) {
        metric_1.metric.putMetric(`Split${splits}Done`, Date.now() - startedSplit, metric_1.MetricLoggerUnit.Milliseconds);
        startedSplit = Date.now();
        log_1.log.info({
            top5: lodash_1.default.map(Array.from(bestSwapsPerSplit.consume()), (q) => `${q.quote.toExact()} (${(0, lodash_1.default)(q.routes)
                .map((r) => r.toString())
                .join(', ')})`),
            onQueue: queue.size,
        }, `Top 3 with ${splits} splits`);
        bestSwapsPerSplit.clear();
        // Size of the queue at this point is the number of potential routes we are investigating for the given number of splits.
        let layer = queue.size;
        splits++;
        // If we didn't improve our quote by adding another split, very unlikely to improve it by splitting more after that.
        if (splits >= 3 && bestSwap && bestSwap.length < splits - 1) {
            break;
        }
        if (splits > maxSplits) {
            log_1.log.info('Max splits reached. Stopping search.');
            metric_1.metric.putMetric(`MaxSplitsHitReached`, 1, metric_1.MetricLoggerUnit.Count);
            break;
        }
        while (layer > 0) {
            layer--;
            const { remainingPercent, curRoutes, percentIndex, special } = queue.dequeue();
            // For all other percentages, add a new potential route.
            // E.g. if our current aggregated route if missing 50%, we will create new nodes and add to the queue for:
            // 50% + new 10% route, 50% + new 20% route, etc.
            for (let i = percentIndex; i >= 0; i--) {
                const percentA = percents[i];
                if (percentA > remainingPercent) {
                    continue;
                }
                // At some point the amount * percentage is so small that the quoter is unable to get
                // a quote. In this case there could be no quotes for that percentage.
                if (!percentToSortedQuotes[percentA]) {
                    continue;
                }
                const candidateRoutesA = percentToSortedQuotes[percentA];
                // Find the best route in the complimentary percentage that doesn't re-use a pool already
                // used in the current route. Re-using pools is not allowed as each swap through a pool changes its liquidity,
                // so it would make the quotes inaccurate.
                const routeWithQuoteA = findFirstRouteNotUsingUsedPools(curRoutes, candidateRoutesA, forceCrossProtocol);
                if (!routeWithQuoteA) {
                    continue;
                }
                const remainingPercentNew = remainingPercent - percentA;
                const curRoutesNew = [...curRoutes, routeWithQuoteA];
                // If we've found a route combination that uses all 100%, and it has at least minSplits, update our best route.
                if (remainingPercentNew == 0 && splits >= minSplits) {
                    const quotesNew = lodash_1.default.map(curRoutesNew, (r) => by(r));
                    const quoteNew = sumFn(quotesNew);
                    let gasCostL1QuoteToken = amounts_1.CurrencyAmount.fromRawAmount(quoteNew.currency, 0);
                    if (util_1.HAS_L1_FEE.includes(chainId)) {
                        const onlyV3Routes = curRoutesNew.every((route) => route.protocol == router_sdk_1.Protocol.V3);
                        if (gasModel == undefined || !onlyV3Routes) {
                            throw new Error('Can\'t compute L1 gas fees.');
                        }
                        else {
                            const gasCostL1 = await gasModel.calculateL1GasFees(curRoutesNew);
                            gasCostL1QuoteToken = gasCostL1.gasCostL1QuoteToken;
                        }
                    }
                    const quoteAfterL1Adjust = routeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? quoteNew.subtract(gasCostL1QuoteToken)
                        : quoteNew.add(gasCostL1QuoteToken);
                    bestSwapsPerSplit.push({
                        quote: quoteAfterL1Adjust,
                        routes: curRoutesNew,
                    });
                    if (!bestQuote || quoteCompFn(quoteAfterL1Adjust, bestQuote)) {
                        bestQuote = quoteAfterL1Adjust;
                        bestSwap = curRoutesNew;
                        // Temporary experiment.
                        if (special) {
                            metric_1.metric.putMetric(`BestSwapNotPickingBestForPercent`, 1, metric_1.MetricLoggerUnit.Count);
                        }
                    }
                }
                else {
                    queue.enqueue({
                        curRoutes: curRoutesNew,
                        remainingPercent: remainingPercentNew,
                        percentIndex: i,
                        special,
                    });
                }
            }
        }
    }
    if (!bestSwap) {
        log_1.log.info(`Could not find a valid swap`);
        return undefined;
    }
    const postSplitNow = Date.now();
    let quoteGasAdjusted = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quoteAdjustedForGas));
    // this calculates the base gas used
    // if on L1, its the estimated gas used based on hops and ticks across all the routes
    // if on L2, its the gas used on the L2 based on hops and ticks across all the routes
    const estimatedGasUsed = (0, lodash_1.default)(bestSwap)
        .map((routeWithValidQuote) => routeWithValidQuote.gasEstimate)
        .reduce((sum, routeWithValidQuote) => sum.add(routeWithValidQuote), bignumber_1.BigNumber.from(0));
    // Determine the token to use when normalizing gas cost to "USD".
    // Some test / new chains may not yet have a stable-coin mapping in
    // `usdGasTokensByChain`.  In that case we fall back to the quote token of the
    // best swap and treat all USD gas costs as zero so the router can still run.
    const skipUsdGasCalc = [util_1.ChainId.MONAD_TESTNET, util_1.ChainId.MONAD_DEVNET].includes(chainId);
    const hasUsdToken = !!(gas_models_1.usdGasTokensByChain[chainId] && gas_models_1.usdGasTokensByChain[chainId][0]);
    const usdToken = hasUsdToken
        ? gas_models_1.usdGasTokensByChain[chainId][0]
        : bestSwap[0].quoteToken;
    const usdTokenDecimals = usdToken.decimals;
    // if on L2, calculate the L1 security fee
    let gasCostsL1ToL2 = {
        gasUsedL1: bignumber_1.BigNumber.from(0),
        gasCostL1USD: amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0),
        gasCostL1QuoteToken: amounts_1.CurrencyAmount.fromRawAmount(
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        (_a = bestSwap[0]) === null || _a === void 0 ? void 0 : _a.quoteToken, 0),
    };
    // If swapping on an L2 that includes a L1 security fee, calculate the fee and include it in the gas adjusted quotes
    if (util_1.HAS_L1_FEE.includes(chainId)) {
        // ensure the gasModel exists and that the swap route is a v3 only route
        const onlyV3Routes = bestSwap.every((route) => route.protocol == router_sdk_1.Protocol.V3);
        if (gasModel == undefined || !onlyV3Routes) {
            throw new Error('Can\'t compute L1 gas fees.');
        }
        else {
            gasCostsL1ToL2 = await gasModel.calculateL1GasFees(bestSwap);
        }
    }
    const { gasCostL1USD, gasCostL1QuoteToken } = gasCostsL1ToL2;
    // Compute USD gas costs only when a USD token mapping is available for the
    // current chain.  Otherwise set the value to zero and skip the expensive
    // normalization computation.
    let estimatedGasUsedUSD;
    if (!skipUsdGasCalc && hasUsdToken) {
        // For each gas estimate, normalize decimals to that of the chosen usd token.
        const estimatedGasUsedUSDs = (0, lodash_1.default)(bestSwap)
            .map((routeWithValidQuote) => {
            // TODO: will error if gasToken has decimals greater than usdToken
            const decimalsDiff = usdTokenDecimals -
                routeWithValidQuote.gasCostInUSD.currency.decimals;
            if (decimalsDiff == 0) {
                return amounts_1.CurrencyAmount.fromRawAmount(usdToken, routeWithValidQuote.gasCostInUSD.quotient);
            }
            return amounts_1.CurrencyAmount.fromRawAmount(usdToken, jsbi_1.default.multiply(routeWithValidQuote.gasCostInUSD.quotient, jsbi_1.default.exponentiate(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(decimalsDiff))));
        })
            .value();
        estimatedGasUsedUSD = sumFn(estimatedGasUsedUSDs);
        // if they are different usd pools, convert to the usdToken
        if (estimatedGasUsedUSD.currency != gasCostL1USD.currency) {
            const decimalsDiff = usdTokenDecimals - gasCostL1USD.currency.decimals;
            estimatedGasUsedUSD = estimatedGasUsedUSD.add(amounts_1.CurrencyAmount.fromRawAmount(usdToken, jsbi_1.default.multiply(gasCostL1USD.quotient, jsbi_1.default.exponentiate(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(decimalsDiff)))));
        }
        else {
            estimatedGasUsedUSD = estimatedGasUsedUSD.add(gasCostL1USD);
        }
        log_1.log.info({
            estimatedGasUsedUSD: estimatedGasUsedUSD.toExact(),
            normalizedUsdToken: usdToken,
            routeUSDGasEstimates: lodash_1.default.map(bestSwap, (b) => `${b.percent}% ${(0, routes_1.routeToString)(b.route)} ${b.gasCostInUSD.toExact()}`),
            flatL1GasCostUSD: gasCostL1USD.toExact(),
        }, 'USD gas estimates of best route');
    }
    else if (skipUsdGasCalc) {
        estimatedGasUsedUSD = amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0);
        log_1.log.info({ chainId, msg: 'MONAD_TESTNET: Skipping USD gas cost calculation' }, 'USD gas estimates of best route');
    }
    else {
        estimatedGasUsedUSD = amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0);
        log_1.log.info({ chainId, msg: 'No USD gas token configured; skipping USD gas cost calculation' }, 'USD gas estimates of best route');
    }
    log_1.log.info({
        estimatedGasUsedUSD: estimatedGasUsedUSD.toExact(),
        normalizedUsdToken: usdToken,
        routeUSDGasEstimates: lodash_1.default.map(bestSwap, (b) => `${b.percent}% ${(0, routes_1.routeToString)(b.route)} ${b.gasCostInUSD.toExact()}`),
        flatL1GasCostUSD: gasCostL1USD.toExact(),
    }, 'USD gas estimates of best route');
    const estimatedGasUsedQuoteToken = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.gasCostInToken)).add(gasCostL1QuoteToken);
    const quote = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quote));
    // Adjust the quoteGasAdjusted for the l1 fee
    if (routeType == sdk_core_1.TradeType.EXACT_INPUT) {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.subtract(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    else {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.add(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    const routeWithQuotes = bestSwap.sort((routeAmountA, routeAmountB) => routeAmountB.amount.greaterThan(routeAmountA.amount) ? 1 : -1);
    metric_1.metric.putMetric('PostSplitDone', Date.now() - postSplitNow, metric_1.MetricLoggerUnit.Milliseconds);
    return {
        quote,
        quoteGasAdjusted,
        estimatedGasUsed,
        estimatedGasUsedUSD,
        estimatedGasUsedQuoteToken,
        routes: routeWithQuotes,
    };
}
exports.getBestSwapRouteBy = getBestSwapRouteBy;
// We do not allow pools to be re-used across split routes, as swapping through a pool changes the pools state.
// Given a list of used routes, this function finds the first route in the list of candidate routes that does not re-use an already used pool.
const findFirstRouteNotUsingUsedPools = (usedRoutes, candidateRouteQuotes, forceCrossProtocol) => {
    const poolAddressSet = new Set();
    const usedPoolAddresses = (0, lodash_1.default)(usedRoutes)
        .flatMap((r) => r.poolAddresses)
        .value();
    for (const poolAddress of usedPoolAddresses) {
        poolAddressSet.add(poolAddress);
    }
    const protocolsSet = new Set();
    const usedProtocols = (0, lodash_1.default)(usedRoutes)
        .flatMap((r) => r.protocol)
        .uniq()
        .value();
    for (const protocol of usedProtocols) {
        protocolsSet.add(protocol);
    }
    for (const routeQuote of candidateRouteQuotes) {
        const { poolAddresses, protocol } = routeQuote;
        if (poolAddresses.some((poolAddress) => poolAddressSet.has(poolAddress))) {
            continue;
        }
        // This code is just for debugging. Allows us to force a cross-protocol split route by skipping
        // consideration of routes that come from the same protocol as a used route.
        const needToForce = forceCrossProtocol && protocolsSet.size == 1;
        if (needToForce && protocolsSet.has(protocol)) {
            continue;
        }
        return routeQuote;
    }
    return null;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVzdC1zd2FwLXJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9iZXN0LXN3YXAtcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXFEO0FBQ3JELG9EQUErQztBQUMvQyxnREFBOEM7QUFDOUMsZ0RBQXdCO0FBQ3hCLG9EQUF1QjtBQUN2QixzRkFBNEQ7QUFDNUQsNERBQW9DO0FBRXBDLHdDQUFvRDtBQUNwRCxtREFBdUQ7QUFDdkQsMkNBQXdDO0FBQ3hDLGlEQUFnRTtBQUNoRSxpREFBMkU7QUFFM0UsOENBQStFO0FBYXhFLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsTUFBc0IsRUFDdEIsUUFBa0IsRUFDbEIscUJBQTRDLEVBQzVDLFNBQW9CLEVBQ3BCLE9BQWdCLEVBQ2hCLGFBQWdDLEVBQ2hDLFFBQTJDO0lBRTNDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2QixNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxhQUFhLENBQUM7SUFFM0MsNkZBQTZGO0lBQzdGLElBQUksZ0JBQWdCLEVBQUU7UUFDcEIsU0FBRyxDQUFDLElBQUksQ0FDTjtZQUNFLGdCQUFnQixFQUFFLGdCQUFnQjtTQUNuQyxFQUNELHlEQUF5RCxDQUMxRCxDQUFDO1FBQ0YscUJBQXFCLEdBQUcsZ0JBQUMsQ0FBQyxNQUFNLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUNqRSxPQUFPLE1BQU0sQ0FBQyxRQUFRLEtBQUsscUJBQVEsQ0FBQyxLQUFLLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMscUJBQXFCLEVBQUU7WUFDMUIsT0FBTyxJQUFJLENBQUM7U0FDYjtLQUNGO0lBRUQsa0VBQWtFO0lBQ2xFLG9HQUFvRztJQUNwRyxNQUFNLGVBQWUsR0FBaUQsRUFB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