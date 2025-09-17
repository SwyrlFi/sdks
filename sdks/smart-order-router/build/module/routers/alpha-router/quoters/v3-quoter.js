import { TradeType } from '@swyrlfi/sdk-core';
import _ from 'lodash';
import { TokenValidationResult, } from '../../../providers';
import { ChainId, log, metric, MetricLoggerUnit, routeToString, } from '../../../util';
import { V3RouteWithValidQuote } from '../entities';
import { computeAllV3Routes } from '../functions/compute-all-routes';
import { getV3CandidatePools, } from '../functions/get-candidate-pools';
import { BaseQuoter } from './base-quoter';
export class V3Quoter extends BaseQuoter {
    constructor(v3SubgraphProvider, v3PoolProvider, onChainQuoteProvider, tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider) {
        super(tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider);
        this.v3SubgraphProvider = v3SubgraphProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.onChainQuoteProvider = onChainQuoteProvider;
    }
    async getRoutes(tokenIn, tokenOut, tradeType, routingConfig) {
        // Fetch all the pools that we will consider routing via. There are thousands
        // of pools, so we filter them to a set of candidate pools that we expect will
        // result in good prices.
        const { poolAccessor, candidatePools } = await getV3CandidatePools({
            tokenIn,
            tokenOut,
            tokenProvider: this.tokenProvider,
            blockedTokenListProvider: this.blockedTokenListProvider,
            poolProvider: this.v3PoolProvider,
            routeType: tradeType,
            subgraphProvider: this.v3SubgraphProvider,
            routingConfig,
            chainId: this.chainId,
        });
        const poolsRaw = poolAccessor.getAllPools();
        // Drop any pools that contain fee on transfer tokens (not supported by v3) or have issues with being transferred.
        const pools = await this.applyTokenValidatorToPools(poolsRaw, (token, tokenValidation) => {
            // If there is no available validation result we assume the token is fine.
            if (!tokenValidation) {
                return false;
            }
            // Only filters out *intermediate* pools that involve tokens that we detect
            // cant be transferred. This prevents us trying to route through tokens that may
            // not be transferrable, but allows users to still swap those tokens if they
            // specify.
            //
            if (tokenValidation == TokenValidationResult.STF &&
                (token.equals(tokenIn) || token.equals(tokenOut))) {
                return false;
            }
            return (tokenValidation == TokenValidationResult.FOT ||
                tokenValidation == TokenValidationResult.STF);
        });
        // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
        const { maxSwapsPerPath } = routingConfig;
        const routes = computeAllV3Routes(tokenIn, tokenOut, pools, maxSwapsPerPath);
        return {
            routes,
            candidatePools,
        };
    }
    async getQuotes(routes, amounts, percents, quoteToken, tradeType, routingConfig, candidatePools, gasModel) {
        log.info('Starting to get V3 quotes');
        if (gasModel === undefined && ![ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(this.chainId)) {
            throw new Error('GasModel for V3RouteWithValidQuote is required to getQuotes');
        }
        if (routes.length == 0) {
            return { routesWithValidQuotes: [], candidatePools };
        }
        // For all our routes, and all the fractional amounts, fetch quotes on-chain.
        const quoteFn = tradeType == TradeType.EXACT_INPUT
            ? this.onChainQuoteProvider.getQuotesManyExactIn.bind(this.onChainQuoteProvider)
            : this.onChainQuoteProvider.getQuotesManyExactOut.bind(this.onChainQuoteProvider);
        const beforeQuotes = Date.now();
        log.info(`Getting quotes for V3 for ${routes.length} routes with ${amounts.length} amounts per route.`);
        const { routesWithQuotes } = await quoteFn(amounts, routes, {
            blockNumber: routingConfig.blockNumber,
        });
        metric.putMetric('V3QuotesLoad', Date.now() - beforeQuotes, MetricLoggerUnit.Milliseconds);
        metric.putMetric('V3QuotesFetched', _(routesWithQuotes)
            .map(([, quotes]) => quotes.length)
            .sum(), MetricLoggerUnit.Count);
        const routesWithValidQuotes = [];
        for (const routeWithQuote of routesWithQuotes) {
            const [route, quotes] = routeWithQuote;
            for (let i = 0; i < quotes.length; i++) {
                const percent = percents[i];
                const amountQuote = quotes[i];
                const { quote, amount, sqrtPriceX96AfterList, initializedTicksCrossedList, gasEstimate, } = amountQuote;
                if (!quote ||
                    !sqrtPriceX96AfterList ||
                    !initializedTicksCrossedList ||
                    !gasEstimate) {
                    log.debug({
                        route: routeToString(route),
                        amountQuote,
                    }, 'Dropping a null V3 quote for route.');
                    continue;
                }
                const routeWithValidQuote = new V3RouteWithValidQuote({
                    route,
                    rawQuote: quote,
                    amount,
                    percent,
                    sqrtPriceX96AfterList,
                    initializedTicksCrossedList,
                    quoterGasEstimate: gasEstimate,
                    gasModel: gasModel,
                    quoteToken,
                    tradeType,
                    v3PoolProvider: this.v3PoolProvider,
                });
                routesWithValidQuotes.push(routeWithValidQuote);
            }
        }
        return {
            routesWithValidQuotes,
            candidatePools,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjMtcXVvdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL3F1b3RlcnMvdjMtcXVvdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBbUIsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDL0QsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFPTCxxQkFBcUIsR0FDdEIsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QixPQUFPLEVBQ0wsT0FBTyxFQUVQLEdBQUcsRUFDSCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGFBQWEsR0FDZCxNQUFNLGVBQWUsQ0FBQztBQUd2QixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDcEQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDckUsT0FBTyxFQUVMLG1CQUFtQixHQUNwQixNQUFNLGtDQUFrQyxDQUFDO0FBRzFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFJM0MsTUFBTSxPQUFPLFFBQVMsU0FBUSxVQUFtQjtJQUsvQyxZQUNFLGtCQUF1QyxFQUN2QyxjQUErQixFQUMvQixvQkFBMkMsRUFDM0MsYUFBNkIsRUFDN0IsT0FBZ0IsRUFDaEIsd0JBQTZDLEVBQzdDLHNCQUFnRDtRQUVoRCxLQUFLLENBQ0gsYUFBYSxFQUNiLE9BQU8sRUFDUCx3QkFBd0IsRUFDeEIsc0JBQXNCLENBQ3ZCLENBQUM7UUFDRixJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7UUFDN0MsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLG9CQUFvQixDQUFDO0lBQ25ELENBQUM7SUFFUyxLQUFLLENBQUMsU0FBUyxDQUN2QixPQUFjLEVBQ2QsUUFBZSxFQUNmLFNBQW9CLEVB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