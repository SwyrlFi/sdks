"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainQuoteProvider = exports.encodeMixedRouteToPath = exports.encodeRouteToPath = exports.ProviderGasError = exports.ProviderTimeoutError = exports.ProviderBlockHeaderError = exports.SuccessRateError = exports.BlockConflictError = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const solidity_1 = require("@ethersproject/solidity");
const router_sdk_1 = require("@swyrlfi/router-sdk");
const v2_sdk_1 = require("@swyrlfi/v2-sdk");
const async_retry_1 = __importDefault(require("async-retry"));
const lodash_1 = __importDefault(require("lodash"));
const stats_lite_1 = __importDefault(require("stats-lite"));
const router_1 = require("../routers/router");
const IMixedRouteQuoterV1__factory_1 = require("../types/other/factories/IMixedRouteQuoterV1__factory");
const IQuoterV2__factory_1 = require("../types/v3/factories/IQuoterV2__factory");
const util_1 = require("../util");
const addresses_1 = require("../util/addresses");
const log_1 = require("../util/log");
const routes_1 = require("../util/routes");
class BlockConflictError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'BlockConflictError';
    }
}
exports.BlockConflictError = BlockConflictError;
class SuccessRateError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'SuccessRateError';
    }
}
exports.SuccessRateError = SuccessRateError;
class ProviderBlockHeaderError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderBlockHeaderError';
    }
}
exports.ProviderBlockHeaderError = ProviderBlockHeaderError;
class ProviderTimeoutError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderTimeoutError';
    }
}
exports.ProviderTimeoutError = ProviderTimeoutError;
/**
 * This error typically means that the gas used by the multicall has
 * exceeded the total call gas limit set by the node provider.
 *
 * This can be resolved by modifying BatchParams to request fewer
 * quotes per call, or to set a lower gas limit per quote.
 *
 * @export
 * @class ProviderGasError
 */
class ProviderGasError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderGasError';
    }
}
exports.ProviderGasError = ProviderGasError;
/**
 * Converts a route to a hex encoded path
 * @param route the v3 path to convert to an encoded path
 * @param exactOutput whether the route should be encoded in reverse, for making exact output swaps
 */
function encodeRouteToPath(route, exactOutput) {
    const firstInputToken = route.input.wrapped;
    const { path, types } = route.pools.reduce(({ inputToken, path, types }, pool, index) => {
        const outputToken = pool.token0.equals(inputToken) ? pool.token1 : pool.token0;
        const tickSpacing = (0, routes_1.getTickSpacing)(pool.fee);
        if (index === 0) {
            return {
                inputToken: outputToken,
                types: ['address', 'uint24', 'address'],
                path: [inputToken.address, tickSpacing, outputToken.address],
            };
        }
        else {
            return {
                inputToken: outputToken,
                types: [...types, 'uint24', 'address'],
                path: [...path, tickSpacing, outputToken.address],
            };
        }
    }, { inputToken: firstInputToken, path: [], types: [] });
    return exactOutput ? (0, solidity_1.pack)(types.reverse(), path.reverse()) : (0, solidity_1.pack)(types, path);
}
exports.encodeRouteToPath = encodeRouteToPath;
/**
 * Converts a route to a hex encoded path
 * @notice only supports exactIn route encodings
 * @param route the mixed path to convert to an encoded path
 * @returns the exactIn encoded path
 */
function encodeMixedRouteToPath(route) {
    const firstInputToken = route.input.wrapped;
    const { path, types } = route.pools.reduce(({ inputToken, path, types }, pool, index) => {
        const outputToken = pool.token0.equals(inputToken) ? pool.token1 : pool.token0;
        if (pool instanceof v2_sdk_1.Pair) {
            return {
                inputToken: outputToken,
                types: ['address', 'uint24', 'address'],
                path: [inputToken.wrapped.address, router_sdk_1.V2_FEE_PATH_PLACEHOLDER + 1, outputToken.wrapped.address],
            };
        }
        const tickSpacing = (0, routes_1.getTickSpacing)(pool.fee);
        if (index === 0) {
            return {
                inputToken: outputToken,
                types: ['address', 'uint24', 'address'],
                path: [
                    inputToken.wrapped.address,
                    tickSpacing,
                    outputToken.wrapped.address,
                ],
            };
        }
        else {
            return {
                inputToken: outputToken,
                types: [...types, 'uint24', 'address'],
                path: [...path, tickSpacing, outputToken.wrapped.address],
            };
        }
    }, { inputToken: firstInputToken, path: [], types: [] });
    return (0, solidity_1.pack)(types, path);
}
exports.encodeMixedRouteToPath = encodeMixedRouteToPath;
const DEFAULT_BATCH_RETRIES = 2;
/**
 * Computes on chain quotes for swaps. For pure V3 routes, quotes are computed on-chain using
 * the 'QuoterV2' smart contract. For exactIn mixed and V2 routes, quotes are computed using the 'MixedRouteQuoterV1' contract
 * This is because computing quotes off-chain would require fetching all the tick data for each pool, which is a lot of data.
 *
 * To minimize the number of requests for quotes we use a Multicall contract. Generally
 * the number of quotes to fetch exceeds the maximum we can fit in a single multicall
 * while staying under gas limits, so we also batch these quotes across multiple multicalls.
 *
 * The biggest challenge with the quote provider is dealing with various gas limits.
 * Each provider sets a limit on the amount of gas a call can consume (on Infura this
 * is approximately 10x the block max size), so we must ensure each multicall does not
 * exceed this limit. Additionally, each quote on V3 can consume a large number of gas if
 * the pool lacks liquidity and the swap would cause all the ticks to be traversed.
 *
 * To ensure we don't exceed the node's call limit, we limit the gas used by each quote to
 * a specific value, and we limit the number of quotes in each multicall request. Users of this
 * class should set BatchParams such that multicallChunk * gasLimitPerCall is less than their node
 * providers total gas limit per call.
 *
 * @export
 * @class OnChainQuoteProvider
 */
class OnChainQuoteProvider {
    /**
     * Creates an instance of OnChainQuoteProvider.
     *
     * @param chainId The chain to get quotes for.
     * @param provider The web 3 provider.
     * @param multicall2Provider The multicall provider to use to get the quotes on-chain.
     * Only supports the Uniswap Multicall contract as it needs the gas limitting functionality.
     * @param retryOptions The retry options for each call to the multicall.
     * @param batchParams The parameters for each batched call to the multicall.
     * @param gasErrorFailureOverride The gas and chunk parameters to use when retrying a batch that failed due to out of gas.
     * @param successRateFailureOverrides The parameters for retries when we fail to get quotes.
     * @param blockNumberConfig Parameters for adjusting which block we get quotes from, and how to handle block header not found errors.
     * @param [quoterAddressOverride] Overrides the address of the quoter contract to use.
     */
    constructor(chainId, provider, 
    // Only supports Uniswap Multicall as it needs the gas limitting functionality.
    multicall2Provider, retryOptions = {
        retries: DEFAULT_BATCH_RETRIES,
        minTimeout: 25,
        maxTimeout: 250,
    }, batchParams = {
        multicallChunk: 150,
        gasLimitPerCall: 1000000,
        quoteMinSuccessRate: 0.2,
    }, gasErrorFailureOverride = {
        gasLimitOverride: 1500000,
        multicallChunk: 100,
    }, successRateFailureOverrides = {
        gasLimitOverride: 1300000,
        multicallChunk: 110,
    }, blockNumberConfig = {
        baseBlockOffset: 0,
        rollback: { enabled: false },
    }, quoterAddressOverride) {
        this.chainId = chainId;
        this.provider = provider;
        this.multicall2Provider = multicall2Provider;
        this.retryOptions = retryOptions;
        this.batchParams = batchParams;
        this.gasErrorFailureOverride = gasErrorFailureOverride;
        this.successRateFailureOverrides = successRateFailureOverrides;
        this.blockNumberConfig = blockNumberConfig;
        this.quoterAddressOverride = quoterAddressOverride;
    }
    getQuoterAddress(useMixedRouteQuoter) {
        if (this.quoterAddressOverride) {
            return this.quoterAddressOverride;
        }
        const quoterAddress = useMixedRouteQuoter
            ? addresses_1.MIXED_ROUTE_QUOTER_V1_ADDRESSES[this.chainId]
            : addresses_1.QUOTER_V2_ADDRESSES[this.chainId];
        if (!quoterAddress) {
            throw new Error(`No address for the quoter contract on chain id: ${this.chainId}`);
        }
        return quoterAddress;
    }
    async getQuotesManyExactIn(amountIns, routes, providerConfig) {
        return this.getQuotesManyData(amountIns, routes, 'quoteExactInput', providerConfig);
    }
    async getQuotesManyExactOut(amountOuts, routes, providerConfig) {
        return this.getQuotesManyData(amountOuts, routes, 'quoteExactOutput', providerConfig);
    }
    async getQuotesManyData(amounts, routes, functionName, _providerConfig) {
        var _a;
        const useMixedRouteQuoter = routes.some((route) => route.protocol === router_sdk_1.Protocol.V2) ||
            routes.some((route) => route.protocol === router_sdk_1.Protocol.MIXED);
        /// Validate that there are no incorrect routes / function combinations
        this.validateRoutes(routes, functionName, useMixedRouteQuoter);
        let multicallChunk = this.batchParams.multicallChunk;
        let gasLimitOverride = this.batchParams.gasLimitPerCall;
        const { baseBlockOffset, rollback } = this.blockNumberConfig;
        // Apply the base block offset if provided
        const originalBlockNumber = await this.provider.getBlockNumber();
        const providerConfig = Object.assign(Object.assign({}, _providerConfig), { blockNumber: (_a = _providerConfig === null || _providerConfig === void 0 ? void 0 : _providerConfig.blockNumber) !== null && _a !== void 0 ? _a : originalBlockNumber + baseBlockOffset });
        const inputs = (0, lodash_1.default)(routes)
            .flatMap((route) => {
            const encodedRoute = route.protocol === router_sdk_1.Protocol.V3
                ? encodeRouteToPath(route, functionName == 'quoteExactOutput' // For exactOut must be true to ensure the routes are reversed.
                )
                : encodeMixedRouteToPath(route instanceof router_1.V2Route
                    ? new router_sdk_1.MixedRouteSDK(route.pairs, route.input, route.output)
                    : route);
            const routeInputs = amounts.map((amount) => [
                encodedRoute,
                `0x${amount.quotient.toString(16)}`,
            ]);
            return routeInputs;
        })
            .value();
        const normalizedChunk = Math.ceil(inputs.length / Math.ceil(inputs.length / multicallChunk));
        const inputsChunked = lodash_1.default.chunk(inputs, normalizedChunk);
        let quoteStates = lodash_1.default.map(inputsChunked, (inputChunk) => {
            return {
                status: 'pending',
                inputs: inputChunk,
            };
        });
        log_1.log.info(`About to get ${inputs.length} quotes in chunks of ${normalizedChunk} [${lodash_1.default.map(inputsChunked, (i) => i.length).join(',')}] ${gasLimitOverride
            ? `with a gas limit override of ${gasLimitOverride}`
            : ''} and block number: ${await providerConfig.blockNumber} [Original before offset: ${originalBlockNumber}].`);
        let haveRetriedForSuccessRate = false;
        let haveRetriedForBlockHeader = false;
        let blockHeaderRetryAttemptNumber = 0;
        let haveIncrementedBlockHeaderFailureCounter = false;
        let blockHeaderRolledBack = false;
        let haveRetriedForBlockConflictError = false;
        let haveRetriedForOutOfGas = false;
        let haveRetriedForTimeout = false;
        let haveRetriedForUnknownReason = false;
        let finalAttemptNumber = 1;
        const expectedCallsMade = quoteStates.length;
        let totalCallsMade = 0;
        const { results: quoteResults, blockNumber, approxGasUsedPerSuccessCall, } = await (0, async_retry_1.default)(async (_bail, attemptNumber) => {
            haveIncrementedBlockHeaderFailureCounter = false;
            finalAttemptNumber = attemptNumber;
            const [success, failed, pending] = this.partitionQuotes(quoteStates);
            log_1.log.info(`Starting attempt: ${attemptNumber}.
          Currently ${success.length} success, ${failed.length} failed, ${pending.length} pending.
          Gas limit override: ${gasLimitOverride} Block number override: ${providerConfig.blockNumber}.`);
            quoteStates = await Promise.all(lodash_1.default.map(quoteStates, async (quoteState, idx) => {
                if (quoteState.status == 'success') {
                    return quoteState;
                }
                // QuoteChunk is pending or failed, so we try again
                const { inputs } = quoteState;
                try {
                    totalCallsMade = totalCallsMade + 1;
                    const results = await this.multicall2Provider.callSameFunctionOnContractWithMultipleParams({
                        address: this.getQuoterAddress(useMixedRouteQuoter),
                        contractInterface: useMixedRouteQuoter
                            ? IMixedRouteQuoterV1__factory_1.IMixedRouteQuoterV1__factory.createInterface()
                            : IQuoterV2__factory_1.IQuoterV2__factory.createInterface(),
                        functionName,
                        functionParams: inputs,
                        providerConfig,
                        additionalConfig: {
                            gasLimitPerCallOverride: gasLimitOverride,
                        },
                    });
                    const successRateError = this.validateSuccessRate(results.results, haveRetriedForSuccessRate);
                    if (successRateError) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: successRateError,
                            results,
                        };
                    }
                    return {
                        status: 'success',
                        inputs,
                        results,
                    };
                }
                catch (err) {
                    // Error from providers have huge messages that include all the calldata and fill the logs.
                    // Catch them and rethrow with shorter message.
                    if (err.message.includes('header not found')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderBlockHeaderError(err.message.slice(0, 500)),
                        };
                    }
                    if (err.message.includes('timeout')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderTimeoutError(`Req ${idx}/${quoteStates.length}. Request had ${inputs.length} inputs. ${err.message.slice(0, 500)}`),
                        };
                    }
                    if (err.message.includes('out of gas')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderGasError(err.message.slice(0, 500)),
                        };
                    }
                    return {
                        status: 'failed',
                        inputs,
                        reason: new Error(`Unknown error from provider: ${err.message.slice(0, 500)}`),
                    };
                }
            }));
            const [successfulQuoteStates, failedQuoteStates, pendingQuoteStates] = this.partitionQuotes(quoteStates);
            if (pendingQuoteStates.length > 0) {
                throw new Error('Pending quote after waiting for all promises.');
            }
            let retryAll = false;
            const blockNumberError = this.validateBlockNumbers(successfulQuoteStates, inputsChunked.length, gasLimitOverride);
            // If there is a block number conflict we retry all the quotes.
            if (blockNumberError) {
                retryAll = true;
            }
            const reasonForFailureStr = lodash_1.default.map(failedQuoteStates, (failedQuoteState) => failedQuoteState.reason.name).join(', ');
            if (failedQuoteStates.length > 0) {
                log_1.log.info(`On attempt ${attemptNumber}: ${failedQuoteStates.length}/${quoteStates.length} quotes failed. Reasons: ${reasonForFailureStr}`);
                for (const failedQuoteState of failedQuoteStates) {
                    const { reason: error } = failedQuoteState;
                    log_1.log.info({ error }, `[QuoteFetchError] Attempt ${attemptNumber}. ${error.message}`);
                    if (error instanceof BlockConflictError) {
                        if (!haveRetriedForBlockConflictError) {
                            util_1.metric.putMetric('QuoteBlockConflictErrorRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForBlockConflictError = true;
                        }
                        retryAll = true;
                    }
                    else if (error instanceof ProviderBlockHeaderError) {
                        if (!haveRetriedForBlockHeader) {
                            util_1.metric.putMetric('QuoteBlockHeaderNotFoundRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForBlockHeader = true;
                        }
                        // Ensure that if multiple calls fail due to block header in the current pending batch,
                        // we only count once.
                        if (!haveIncrementedBlockHeaderFailureCounter) {
                            blockHeaderRetryAttemptNumber =
                                blockHeaderRetryAttemptNumber + 1;
                            haveIncrementedBlockHeaderFailureCounter = true;
                        }
                        if (rollback.enabled) {
                            const { rollbackBlockOffset, attemptsBeforeRollback } = rollback;
                            if (blockHeaderRetryAttemptNumber >= attemptsBeforeRollback &&
                                !blockHeaderRolledBack) {
                                log_1.log.info(`Attempt ${attemptNumber}. Have failed due to block header ${blockHeaderRetryAttemptNumber - 1} times. Rolling back block number by ${rollbackBlockOffset} for next retry`);
                                providerConfig.blockNumber = providerConfig.blockNumber
                                    ? (await providerConfig.blockNumber) + rollbackBlockOffset
                                    : (await this.provider.getBlockNumber()) +
                                        rollbackBlockOffset;
                                retryAll = true;
                                blockHeaderRolledBack = true;
                            }
                        }
                    }
                    else if (error instanceof ProviderTimeoutError) {
                        if (!haveRetriedForTimeout) {
                            util_1.metric.putMetric('QuoteTimeoutRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForTimeout = true;
                        }
                    }
                    else if (error instanceof ProviderGasError) {
                        if (!haveRetriedForOutOfGas) {
                            util_1.metric.putMetric('QuoteOutOfGasExceptionRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForOutOfGas = true;
                        }
                        gasLimitOverride = this.gasErrorFailureOverride.gasLimitOverride;
                        multicallChunk = this.gasErrorFailureOverride.multicallChunk;
                        retryAll = true;
                    }
                    else if (error instanceof SuccessRateError) {
                        if (!haveRetriedForSuccessRate) {
                            util_1.metric.putMetric('QuoteSuccessRateRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForSuccessRate = true;
                            // Low success rate can indicate too little gas given to each call.
                            gasLimitOverride =
                                this.successRateFailureOverrides.gasLimitOverride;
                            multicallChunk =
                                this.successRateFailureOverrides.multicallChunk;
                            retryAll = true;
                        }
                    }
                    else {
                        if (!haveRetriedForUnknownReason) {
                            util_1.metric.putMetric('QuoteUnknownReasonRetry', 1, util_1.MetricLoggerUnit.Count);
                            haveRetriedForUnknownReason = true;
                        }
                    }
                }
            }
            if (retryAll) {
                log_1.log.info(`Attempt ${attemptNumber}. Resetting all requests to pending for next attempt.`);
                const normalizedChunk = Math.ceil(inputs.length / Math.ceil(inputs.length / multicallChunk));
                const inputsChunked = lodash_1.default.chunk(inputs, normalizedChunk);
                quoteStates = lodash_1.default.map(inputsChunked, (inputChunk) => {
                    return {
                        status: 'pending',
                        inputs: inputChunk,
                    };
                });
            }
            if (failedQuoteStates.length > 0) {
                // TODO: Work with Arbitrum to find a solution for making large multicalls with gas limits that always
                // successfully.
                //
                // On Arbitrum we can not set a gas limit for every call in the multicall and guarantee that
                // we will not run out of gas on the node. This is because they have a different way of accounting
                // for gas, that seperates storage and compute gas costs, and we can not cover both in a single limit.
                //
                // To work around this and avoid throwing errors when really we just couldn't get a quote, we catch this
                // case and return 0 quotes found.
                if ((this.chainId == util_1.ChainId.ARBITRUM_ONE ||
                    this.chainId == util_1.ChainId.ARBITRUM_RINKEBY ||
                    this.chainId == util_1.ChainId.ARBITRUM_GOERLI) &&
                    lodash_1.default.every(failedQuoteStates, (failedQuoteState) => failedQuoteState.reason instanceof ProviderGasError) &&
                    attemptNumber == this.retryOptions.retries) {
                    log_1.log.error(`Failed to get quotes on Arbitrum due to provider gas error issue. Overriding error to return 0 quotes.`);
                    return {
                        results: [],
                        blockNumber: bignumber_1.BigNumber.from(0),
                        approxGasUsedPerSuccessCall: 0,
                    };
                }
                throw new Error(`Failed to get ${failedQuoteStates.length} quotes. Reasons: ${reasonForFailureStr}`);
            }
            const callResults = lodash_1.default.map(successfulQuoteStates, (quoteState) => quoteState.results);
            return {
                results: lodash_1.default.flatMap(callResults, (result) => result.results),
                blockNumber: bignumber_1.BigNumber.from(callResults[0].blockNumber),
                approxGasUsedPerSuccessCall: stats_lite_1.default.percentile(lodash_1.default.map(callResults, (result) => result.approxGasUsedPerSuccessCall), 100),
            };
        }, Object.assign({ retries: DEFAULT_BATCH_RETRIES }, this.retryOptions));
        const routesQuotes = this.processQuoteResults(quoteResults, routes, amounts);
        util_1.metric.putMetric('QuoteApproxGasUsedPerSuccessfulCall', approxGasUsedPerSuccessCall, util_1.MetricLoggerUnit.Count);
        util_1.metric.putMetric('QuoteNumRetryLoops', finalAttemptNumber - 1, util_1.MetricLoggerUnit.Count);
        util_1.metric.putMetric('QuoteTotalCallsToProvider', totalCallsMade, util_1.MetricLoggerUnit.Count);
        util_1.metric.putMetric('QuoteExpectedCallsToProvider', expectedCallsMade, util_1.MetricLoggerUnit.Count);
        util_1.metric.putMetric('QuoteNumRetriedCalls', totalCallsMade - expectedCallsMade, util_1.MetricLoggerUnit.Count);
        const [successfulQuotes, failedQuotes] = (0, lodash_1.default)(routesQuotes)
            .flatMap((routeWithQuotes) => routeWithQuotes[1])
            .partition((quote) => quote.quote != null)
            .value();
        log_1.log.info(`Got ${successfulQuotes.length} successful quotes, ${failedQuotes.length} failed quotes. Took ${finalAttemptNumber - 1} attempt loops. Total calls made to provider: ${totalCallsMade}. Have retried for timeout: ${haveRetriedForTimeout}`);
        return { routesWithQuotes: routesQuotes, blockNumber };
    }
    partitionQuotes(quoteStates) {
        const successfulQuoteStates = lodash_1.default.filter(quoteStates, (quoteState) => quoteState.status == 'success');
        const failedQuoteStates = lodash_1.default.filter(quoteStates, (quoteState) => quoteState.status == 'failed');
        const pendingQuoteStates = lodash_1.default.filter(quoteStates, (quoteState) => quoteState.status == 'pending');
        return [successfulQuoteStates, failedQuoteStates, pendingQuoteStates];
    }
    processQuoteResults(quoteResults, routes, amounts) {
        const routesQuotes = [];
        const quotesResultsByRoute = lodash_1.default.chunk(quoteResults, amounts.length);
        const debugFailedQuotes = [];
        for (let i = 0; i < quotesResultsByRoute.length; i++) {
            const route = routes[i];
            const quoteResults = quotesResultsByRoute[i];
            const quotes = lodash_1.default.map(quoteResults, (quoteResult, index) => {
                const amount = amounts[index];
                if (!quoteResult.success) {
                    const percent = (100 / amounts.length) * (index + 1);
                    const amountStr = amount.toFixed(Math.min(amount.currency.decimals, 2));
                    const routeStr = (0, routes_1.routeToString)(route);
                    debugFailedQuotes.push({
                        route: routeStr,
                        percent,
                        amount: amountStr,
                    });
                    return {
                        amount,
                        quote: null,
                        sqrtPriceX96AfterList: null,
                        gasEstimate: null,
                        initializedTicksCrossedList: null,
                    };
                }
                return {
                    amount,
                    quote: quoteResult.result[0],
                    sqrtPriceX96AfterList: quoteResult.result[1],
                    initializedTicksCrossedList: quoteResult.result[2],
                    gasEstimate: quoteResult.result[3],
                };
            });
            routesQuotes.push([route, quotes]);
        }
        // For routes and amounts that we failed to get a quote for, group them by route
        // and batch them together before logging to minimize number of logs.
        const debugChunk = 80;
        lodash_1.default.forEach(lodash_1.default.chunk(debugFailedQuotes, debugChunk), (quotes, idx) => {
            const failedQuotesByRoute = lodash_1.default.groupBy(quotes, (q) => q.route);
            const failedFlat = lodash_1.default.mapValues(failedQuotesByRoute, (f) => (0, lodash_1.default)(f)
                .map((f) => `${f.percent}%[${f.amount}]`)
                .join(','));
            log_1.log.info({
                failedQuotes: lodash_1.default.map(failedFlat, (amounts, routeStr) => `${routeStr} : ${amounts}`),
            }, `Failed on chain quotes for routes Part ${idx}/${Math.ceil(debugFailedQuotes.length / debugChunk)}`);
        });
        return routesQuotes;
    }
    validateBlockNumbers(successfulQuoteStates, totalCalls, gasLimitOverride) {
        if (successfulQuoteStates.length <= 1) {
            return null;
        }
        const results = lodash_1.default.map(successfulQuoteStates, (quoteState) => quoteState.results);
        const blockNumbers = lodash_1.default.map(results, (result) => result.blockNumber);
        const uniqBlocks = (0, lodash_1.default)(blockNumbers)
            .map((blockNumber) => blockNumber.toNumber())
            .uniq()
            .value();
        if (uniqBlocks.length == 1) {
            return null;
        }
        /* if (
          uniqBlocks.length == 2 &&
          Math.abs(uniqBlocks[0]! - uniqBlocks[1]!) <= 1
        ) {
          return null;
        } */
        return new BlockConflictError(`Quotes returned from different blocks. ${uniqBlocks}. ${totalCalls} calls were made with gas limit ${gasLimitOverride}`);
    }
    validateSuccessRate(allResults, haveRetriedForSuccessRate) {
        const numResults = allResults.length;
        const numSuccessResults = allResults.filter((result) => result.success).length;
        const successRate = (1.0 * numSuccessResults) / numResults;
        const { quoteMinSuccessRate } = this.batchParams;
        if (successRate < quoteMinSuccessRate) {
            if (haveRetriedForSuccessRate) {
                log_1.log.info(`Quote success rate still below threshold despite retry. Continuing. ${quoteMinSuccessRate}: ${successRate}`);
                return;
            }
            return new SuccessRateError(`Quote success rate below threshold of ${quoteMinSuccessRate}: ${successRate}`);
        }
    }
    /**
     * Throw an error for incorrect routes / function combinations
     * @param routes Any combination of V3, V2, and Mixed routes.
     * @param functionName
     * @param useMixedRouteQuoter true if there are ANY V2Routes or MixedRoutes in the routes parameter
     */
    validateRoutes(routes, functionName, useMixedRouteQuoter) {
        /// We do not send any V3Routes to new qutoer becuase it is not deployed on chains besides mainnet
        if (routes.some((route) => route.protocol === router_sdk_1.Protocol.V3) &&
            useMixedRouteQuoter) {
            throw new Error(`Cannot use mixed route quoter with V3 routes`);
        }
        /// We cannot call quoteExactOutput with V2 or Mixed routes
        if (functionName === 'quoteExactOutput' && useMixedRouteQuoter) {
            throw new Error('Cannot call quoteExactOutput with V2 or Mixed routes');
        }
    }
}
exports.OnChainQuoteProvider = OnChainQuoteProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib24tY2hhaW4tcXVvdGUtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL29uLWNoYWluLXF1b3RlLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHdEQUFxRDtBQUVyRCxzREFBOEM7QUFDOUMsb0RBSTZCO0FBRTdCLDRDQUF1QztBQUV2Qyw4REFBNkQ7QUFDN0Qsb0RBQXVCO0FBQ3ZCLDREQUErQjtBQUUvQiw4Q0FBaUU7QUFDakUsd0dBQXFHO0FBQ3JHLGlGQUE4RTtBQUM5RSxrQ0FBNEQ7QUFDNUQsaURBRzJCO0FBRTNCLHFDQUFrQztBQUNsQywyQ0FBK0Q7QUErQi9ELE1BQWEsa0JBQW1CLFNBQVEsS0FBSztJQUE3Qzs7UUFDUyxTQUFJLEdBQUcsb0JBQW9CLENBQUM7SUFDckMsQ0FBQztDQUFBO0FBRkQsZ0RBRUM7QUFDRCxNQUFhLGdCQUFpQixTQUFRLEtBQUs7SUFBM0M7O1FBQ1MsU0FBSSxHQUFHLGtCQUFrQixDQUFDO0lBQ25DLENBQUM7Q0FBQTtBQUZELDRDQUVDO0FBRUQsTUFBYSx3QkFBeUIsU0FBUSxLQUFLO0lBQW5EOztRQUNTLFNBQUksR0FBRywwQkFBMEIsQ0FBQztJQUMzQyxDQUFDO0NBQUE7QUFGRCw0REFFQztBQUVELE1BQWEsb0JBQXFCLFNBQVEsS0FBSztJQUEvQzs7UUFDUyxTQUFJLEdBQUcsc0JBQXNCLENBQUM7SUFDdkMsQ0FBQztDQUFBO0FBRkQsb0RBRUM7QUFFRDs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFhLGdCQUFpQixTQUFRLEtBQUs7SUFBM0M7O1FBQ1MsU0FBSSxHQUFHLGtCQUFrQixDQUFDO0lBQ25DLENBQUM7Q0FBQTtBQUZELDRDQUVDO0FBd0NEOzs7O0dBSUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFnQyxFQUFFLFdBQW9CO0lBQ3RGLE1BQU0sZUFBZSxHQUFVLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxD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