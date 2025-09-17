import retry from 'async-retry';
import JSBI from 'jsbi';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider, } from '@ethersproject/providers';
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Protocol, SwapRouter, } from '@swyrlfi/router-sdk';
import { Fraction, TradeType, } from '@swyrlfi/sdk-core';
import { Pool, Position, SqrtPriceMath, TickMath, } from '@swyrlfi/v3-sdk';
import { CachedRoutes, CacheMode, CachingGasStationProvider, CachingTokenProviderWithFallback, CachingV2PoolProvider, CachingV2SubgraphProvider, CachingV3PoolProvider, CachingV3SubgraphProvider, EIP1559GasPriceProvider, ETHGasStationInfoProvider, LegacyGasPriceProvider, NodeJSCache, OnChainGasPriceProvider, OnChainQuoteProvider, StaticV2SubgraphProvider, StaticV3SubgraphProvider, SwapRouterProvider, UniswapMulticallProvider, URISubgraphProvider, V2QuoteProvider, V2SubgraphProviderWithFallBacks, V3SubgraphProviderWithFallBacks, } from '../../providers';
import { CachingTokenListProvider, } from '../../providers/caching-token-list-provider';
import { TokenProvider, } from '../../providers/token-provider';
import { TokenValidatorProvider, } from '../../providers/token-validator-provider';
import { V2PoolProvider, } from '../../providers/v2/pool-provider';
import { ArbitrumGasDataProvider, OptimismGasDataProvider, } from '../../providers/v3/gas-data-provider';
import { V3PoolProvider, } from '../../providers/v3/pool-provider';
import { Erc20__factory } from '../../types/other/factories/Erc20__factory';
import { SWAP_ROUTER_02_ADDRESSES } from '../../util';
import { CurrencyAmount } from '../../util/amounts';
import { ChainId, ID_TO_CHAIN_ID, ID_TO_NETWORK_NAME, V2_SUPPORTED, } from '../../util/chains';
import { log } from '../../util/log';
import { buildSwapMethodParameters, buildTrade, } from '../../util/methodParameters';
import { metric, MetricLoggerUnit, } from '../../util/metric';
import { UNSUPPORTED_TOKENS } from '../../util/unsupported-tokens';
import { SwapToRatioStatus, } from '../router';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN, ETH_GAS_STATION_API_URL, } from './config';
import { getBestSwapRoute, } from './functions/best-swap-route';
import { calculateRatioAmountIn } from './functions/calculate-ratio-amount-in';
import { MixedRouteHeuristicGasModelFactory, } from './gas-models/mixedRoute/mixed-route-heuristic-gas-model';
import { V2HeuristicGasModelFactory, } from './gas-models/v2/v2-heuristic-gas-model';
import { V3HeuristicGasModelFactory, } from './gas-models/v3/v3-heuristic-gas-model';
import { MixedQuoter, V2Quoter, V3Quoter, } from './quoters';
export class MapWithLowerCaseKey extends Map {
    set(key, value) {
        return super.set(key.toLowerCase(), value);
    }
}
export class AlphaRouter {
    constructor({ chainId, provider, multicall2Provider, v3PoolProvider, onChainQuoteProvider, v2PoolProvider, v2QuoteProvider, v2SubgraphProvider, tokenProvider, blockedTokenListProvider, v3SubgraphProvider, gasPriceProvider, v3GasModelFactory, v2GasModelFactory, mixedRouteGasModelFactory, swapRouterProvider, optimismGasDataProvider, tokenValidatorProvider, arbitrumGasDataProvider, simulator, routeCachingProvider, }) {
        this.chainId = chainId;
        this.provider = provider;
        this.multicall2Provider =
            multicall2Provider !== null && multicall2Provider !== void 0 ? multicall2Provider : new UniswapMulticallProvider(chainId, provider, 375000);
        this.v3PoolProvider =
            v3PoolProvider !== null && v3PoolProvider !== void 0 ? v3PoolProvider : new CachingV3PoolProvider(this.chainId, new V3PoolProvider(ID_TO_CHAIN_ID(chainId), this.multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
        this.simulator = simulator;
        this.routeCachingProvider = routeCachingProvider;
        if (onChainQuoteProvider) {
            this.onChainQuoteProvider = onChainQuoteProvider;
        }
        else {
            switch (chainId) {
                case ChainId.OPTIMISM:
                case ChainId.OPTIMISM_GOERLI:
                case ChainId.OPTIMISTIC_KOVAN:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        multicallChunk: 110,
                        gasLimitPerCall: 1200000,
                        quoteMinSuccessRate: 0.1,
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        baseBlockOffset: -10,
                        rollback: {
                            enabled: true,
                            attemptsBeforeRollback: 1,
                            rollbackBlockOffset: -10,
                        },
                    });
                    break;
                case ChainId.ARBITRUM_ONE:
                case ChainId.ARBITRUM_RINKEBY:
                case ChainId.ARBITRUM_GOERLI:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        multicallChunk: 10,
                        gasLimitPerCall: 12000000,
                        quoteMinSuccessRate: 0.1,
                    }, {
                        gasLimitOverride: 30000000,
                        multicallChunk: 6,
                    }, {
                        gasLimitOverride: 30000000,
                        multicallChunk: 6,
                    });
                    break;
                case ChainId.CELO:
                case ChainId.CELO_ALFAJORES:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        multicallChunk: 10,
                        gasLimitPerCall: 5000000,
                        quoteMinSuccessRate: 0.1,
                    }, {
                        gasLimitOverride: 5000000,
                        multicallChunk: 5,
                    }, {
                        gasLimitOverride: 6250000,
                        multicallChunk: 4,
                    });
                    break;
                case ChainId.SONIC:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 3,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        // Conservative settings for Sonic to avoid gas issues
                        multicallChunk: 5,
                        gasLimitPerCall: 5000000,
                        quoteMinSuccessRate: 0.05,
                    }, {
                        gasLimitOverride: 8000000,
                        multicallChunk: 3,
                    }, {
                        gasLimitOverride: 8000000,
                        multicallChunk: 3,
                    });
                    break;
                case ChainId.MONAD_TESTNET:
                case ChainId.MONAD_DEVNET:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 3,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        // Conservative settings for Sonic to avoid gas issues
                        multicallChunk: 5,
                        gasLimitPerCall: 5000000,
                        quoteMinSuccessRate: 0.05,
                    }, {
                        gasLimitOverride: 8000000,
                        multicallChunk: 3,
                    }, {
                        gasLimitOverride: 8000000,
                        multicallChunk: 3,
                    });
                    break;
                default:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, {
                        multicallChunk: 210,
                        gasLimitPerCall: 705000,
                        quoteMinSuccessRate: 0.15,
                    }, {
                        gasLimitOverride: 2000000,
                        multicallChunk: 70,
                    });
                    break;
            }
        }
        this.v2PoolProvider =
            v2PoolProvider !== null && v2PoolProvider !== void 0 ? v2PoolProvider : new CachingV2PoolProvider(chainId, new V2PoolProvider(chainId, this.multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 60, useClones: false })));
        this.v2QuoteProvider = v2QuoteProvider !== null && v2QuoteProvider !== void 0 ? v2QuoteProvider : new V2QuoteProvider();
        this.blockedTokenListProvider =
            blockedTokenListProvider !== null && blockedTokenListProvider !== void 0 ? blockedTokenListProvider : new CachingTokenListProvider(chainId, UNSUPPORTED_TOKENS, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })));
        this.tokenProvider =
            tokenProvider !== null && tokenProvider !== void 0 ? tokenProvider : new CachingTokenProviderWithFallback(chainId, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })), new CachingTokenListProvider(chainId, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))), new TokenProvider(chainId, this.multicall2Provider));
        const chainName = ID_TO_NETWORK_NAME(chainId);
        // ipfs urls in the following format: `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/${protocol}/${chainName}.json`;
        if (v2SubgraphProvider) {
            this.v2SubgraphProvider = v2SubgraphProvider;
        }
        else {
            this.v2SubgraphProvider = new V2SubgraphProviderWithFallBacks([
                new CachingV2SubgraphProvider(chainId, new URISubgraphProvider(chainId, `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/v2/${chainName}.json`, undefined, 0), new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))),
                new StaticV2SubgraphProvider(chainId),
            ]);
        }
        if (v3SubgraphProvider) {
            this.v3SubgraphProvider = v3SubgraphProvider;
        }
        else {
            this.v3SubgraphProvider = new V3SubgraphProviderWithFallBacks([
                new CachingV3SubgraphProvider(chainId, new URISubgraphProvider(chainId, `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/v3/${chainName}.json`, undefined, 0), new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))),
                new StaticV3SubgraphProvider(chainId, this.v3PoolProvider),
            ]);
        }
        let gasPriceProviderInstance;
        if (JsonRpcProvider.isProvider(this.provider)) {
            gasPriceProviderInstance = new OnChainGasPriceProvider(chainId, new EIP1559GasPriceProvider(this.provider), new LegacyGasPriceProvider(this.provider));
        }
        else {
            gasPriceProviderInstance = new ETHGasStationInfoProvider(ETH_GAS_STATION_API_URL);
        }
        this.gasPriceProvider =
            gasPriceProvider !== null && gasPriceProvider !== void 0 ? gasPriceProvider : new CachingGasStationProvider(chainId, gasPriceProviderInstance, new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false })));
        this.v3GasModelFactory =
            v3GasModelFactory !== null && v3GasModelFactory !== void 0 ? v3GasModelFactory : new V3HeuristicGasModelFactory();
        this.v2GasModelFactory =
            v2GasModelFactory !== null && v2GasModelFactory !== void 0 ? v2GasModelFactory : new V2HeuristicGasModelFactory();
        this.mixedRouteGasModelFactory =
            mixedRouteGasModelFactory !== null && mixedRouteGasModelFactory !== void 0 ? mixedRouteGasModelFactory : new MixedRouteHeuristicGasModelFactory();
        this.swapRouterProvider =
            swapRouterProvider !== null && swapRouterProvider !== void 0 ? swapRouterProvider : new SwapRouterProvider(this.multicall2Provider, this.chainId);
        if (chainId === ChainId.OPTIMISM || chainId === ChainId.OPTIMISTIC_KOVAN) {
            this.l2GasDataProvider =
                optimismGasDataProvider !== null && optimismGasDataProvider !== void 0 ? optimismGasDataProvider : new OptimismGasDataProvider(chainId, this.multicall2Provider);
        }
        if (chainId === ChainId.ARBITRUM_ONE ||
            chainId === ChainId.ARBITRUM_RINKEBY ||
            chainId === ChainId.ARBITRUM_GOERLI) {
            this.l2GasDataProvider =
                arbitrumGasDataProvider !== null && arbitrumGasDataProvider !== void 0 ? arbitrumGasDataProvider : new ArbitrumGasDataProvider(chainId, this.provider);
        }
        if (tokenValidatorProvider) {
            this.tokenValidatorProvider = tokenValidatorProvider;
        }
        else if (this.chainId === ChainId.MAINNET) {
            this.tokenValidatorProvider = new TokenValidatorProvider(this.chainId, this.multicall2Provider, new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false })));
        }
        // Initialize the Quoters.
        // Quoters are an abstraction encapsulating the business logic of fetching routes and quotes.
        this.v2Quoter = new V2Quoter(this.v2SubgraphProvider, this.v2PoolProvider, this.v2QuoteProvider, this.v2GasModelFactory, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
        this.v3Quoter = new V3Quoter(this.v3SubgraphProvider, this.v3PoolProvider, this.onChainQuoteProvider, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
        this.mixedQuoter = new MixedQuoter(this.v3SubgraphProvider, this.v3PoolProvider, this.v2SubgraphProvider, this.v2PoolProvider, this.onChainQuoteProvider, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
    }
    async routeToRatio(token0Balance, token1Balance, position, swapAndAddConfig, swapAndAddOptions, routingConfig = DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId)) {
        if (token1Balance.currency.wrapped.sortsBefore(token0Balance.currency.wrapped)) {
            [token0Balance, token1Balance] = [token1Balance, token0Balance];
        }
        let preSwapOptimalRatio = this.calculateOptimalRatio(position, position.pool.sqrtRatioX96, true);
        // set up parameters according to which token will be swapped
        let zeroForOne;
        if (position.pool.tickCurrent > position.tickUpper) {
            zeroForOne = true;
        }
        else if (position.pool.tickCurrent < position.tickLower) {
            zeroForOne = false;
        }
        else {
            zeroForOne = new Fraction(token0Balance.quotient, token1Balance.quotient).greaterThan(preSwapOptimalRatio);
            if (!zeroForOne)
                preSwapOptimalRatio = preSwapOptimalRatio.invert();
        }
        const [inputBalance, outputBalance] = zeroForOne
            ? [token0Balance, token1Balance]
            : [token1Balance, token0Balance];
        let optimalRatio = preSwapOptimalRatio;
        let postSwapTargetPool = position.pool;
        let exchangeRate = zeroForOne
            ? position.pool.token0Price
            : position.pool.token1Price;
        let swap = null;
        let ratioAchieved = false;
        let n = 0;
        // iterate until we find a swap with a sufficient ratio or return null
        while (!ratioAchieved) {
            n++;
            if (n > swapAndAddConfig.maxIterations) {
                log.info('max iterations exceeded');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'max iterations exceeded',
                };
            }
            const amountToSwap = calculateRatioAmountIn(optimalRatio, exchangeRate, inputBalance, outputBalance);
            if (amountToSwap.equalTo(0)) {
                log.info(`no swap needed: amountToSwap = 0`);
                return {
                    status: SwapToRatioStatus.NO_SWAP_NEEDED,
                };
            }
            swap = await this.route(amountToSwap, outputBalance.currency, TradeType.EXACT_INPUT, undefined, {
                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId),
                ...routingConfig,
                /// @dev We do not want to query for mixedRoutes for routeToRatio as they are not supported
                /// [Protocol.V3, Protocol.V2] will make sure we only query for V3 and V2
                protocols: [Protocol.V3, Protocol.V2],
            });
            if (!swap) {
                log.info('no route found from this.route()');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'no route found',
                };
            }
            const inputBalanceUpdated = inputBalance.subtract(swap.trade.inputAmount);
            const outputBalanceUpdated = outputBalance.add(swap.trade.outputAmount);
            const newRatio = inputBalanceUpdated.divide(outputBalanceUpdated);
            let targetPoolPriceUpdate;
            swap.route.forEach((route) => {
                if (route.protocol === Protocol.V3) {
                    const v3Route = route;
                    v3Route.route.pools.forEach((pool, i) => {
                        if (pool.token0.equals(position.pool.token0) &&
                            pool.token1.equals(position.pool.token1) &&
                            pool.fee === position.pool.fee) {
                            targetPoolPriceUpdate = JSBI.BigInt(v3Route.sqrtPriceX96AfterList[i].toString());
                            optimalRatio = this.calculateOptimalRatio(position, JSBI.BigInt(targetPoolPriceUpdate.toString()), zeroForOne);
                        }
                    });
                }
            });
            if (!targetPoolPriceUpdate) {
                optimalRatio = preSwapOptimalRatio;
            }
            ratioAchieved =
                newRatio.equalTo(optimalRatio) ||
                    this.absoluteValue(newRatio.asFraction.divide(optimalRatio).subtract(1)).lessThan(swapAndAddConfig.ratioErrorTolerance);
            if (ratioAchieved && targetPoolPriceUpdate) {
                postSwapTargetPool = new Pool(position.pool.token0, position.pool.token1, position.pool.fee, targetPoolPriceUpdate, position.pool.liquidity, TickMath.getTickAtSqrtRatio(targetPoolPriceUpdate), position.pool.tickDataProvider);
            }
            exchangeRate = swap.trade.outputAmount.divide(swap.trade.inputAmount);
            log.info({
                exchangeRate: exchangeRate.asFraction.toFixed(18),
                optimalRatio: optimalRatio.asFraction.toFixed(18),
                newRatio: newRatio.asFraction.toFixed(18),
                inputBalanceUpdated: inputBalanceUpdated.asFraction.toFixed(18),
                outputBalanceUpdated: outputBalanceUpdated.asFraction.toFixed(18),
                ratioErrorTolerance: swapAndAddConfig.ratioErrorTolerance.toFixed(18),
                iterationN: n.toString(),
            }, 'QuoteToRatio Iteration Parameters');
            if (exchangeRate.equalTo(0)) {
                log.info('exchangeRate to 0');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'insufficient liquidity to swap to optimal ratio',
                };
            }
        }
        if (!swap) {
            return {
                status: SwapToRatioStatus.NO_ROUTE_FOUND,
                error: 'no route found',
            };
        }
        let methodParameters;
        if (swapAndAddOptions) {
            methodParameters = await this.buildSwapAndAddMethodParameters(swap.trade, swapAndAddOptions, {
                initialBalanceTokenIn: inputBalance,
                initialBalanceTokenOut: outputBalance,
                preLiquidityPosition: position,
            });
        }
        return {
            status: SwapToRatioStatus.SUCCESS,
            result: { ...swap, methodParameters, optimalRatio, postSwapTargetPool },
        };
    }
    /**
     * @inheritdoc IRouter
     */
    async route(amount, quoteCurrency, tradeType, swapConfig, partialRoutingConfig = {}) {
        var _a, _c, _d, _e;
        console.log('routing started');
        const { currencyIn, currencyOut } = this.determineCurrencyInOutFromTradeType(tradeType, amount, quoteCurrency);
        console.log('currency in', currencyIn);
        console.log('currency out', currencyOut);
        const tokenIn = currencyIn.wrapped;
        const tokenOut = currencyOut.wrapped;
        metric.setProperty('chainId', this.chainId);
        metric.setProperty('pair', `${tokenIn.symbol}/${tokenOut.symbol}`);
        metric.setProperty('tokenIn', tokenIn.address);
        metric.setProperty('tokenOut', tokenOut.address);
        metric.setProperty('tradeType', tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut');
        console.log('trade type', tradeType);
        metric.putMetric(`QuoteRequestedForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        // Get a block number to specify in all our calls. Ensures data we fetch from chain is
        // from the same block.
        const blockNumber = (_a = partialRoutingConfig.blockNumber) !== null && _a !== void 0 ? _a : this.getBlockNumberPromise();
        const routingConfig = _.merge({}, DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId), partialRoutingConfig, { blockNumber });
        console.log('routingConfig', routingConfig);
        const gasPriceWei = await this.getGasPriceWei();
        const quoteToken = quoteCurrency.wrapped;
        console.log('quote currency', quoteCurrency);
        let v3GasModel;
        let mixedRouteGasModel;
        if (![ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(this.chainId)) {
            [v3GasModel, mixedRouteGasModel] = await this.getGasModels(gasPriceWei, amount.currency.wrapped, quoteToken);
            console.log('v3GasModel', v3GasModel);
            console.log('mixedRouteGasModel', mixedRouteGasModel);
        }
        // Create a Set to sanitize the protocols input, a Set of undefined becomes an empty set,
        // Then create an Array from the values of that Set.
        const protocols = Array.from(new Set(routingConfig.protocols).values());
        console.log('protocols', protocols);
        const cacheMode = await ((_c = this.routeCachingProvider) === null || _c === void 0 ? void 0 : _c.getCacheMode(this.chainId, amount, quoteToken, tradeType, protocols));
        console.log('route caching provider', this.routeCachingProvider);
        console.log('cache mode', cacheMode);
        // Fetch CachedRoutes
        let cachedRoutes;
        if (cacheMode !== CacheMode.Darkmode) {
            cachedRoutes = await ((_d = this.routeCachingProvider) === null || _d === void 0 ? void 0 : _d.getCachedRoute(this.chainId, amount, quoteToken, tradeType, protocols, await blockNumber));
        }
        if (cacheMode && cacheMode !== CacheMode.Darkmode && !cachedRoutes) {
            metric.putMetric(`GetCachedRoute_miss_${cacheMode}`, 1, MetricLoggerUnit.Count);
            log.info({
                tokenIn: tokenIn.symbol,
                tokenInAddress: tokenIn.address,
                tokenOut: tokenOut.symbol,
                tokenOutAddress: tokenOut.address,
                cacheMode,
                amount: amount.toExact(),
                chainId: this.chainId,
                tradeType: this.tradeTypeStr(tradeType),
            }, `GetCachedRoute miss ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
        }
        else if (cachedRoutes) {
            metric.putMetric(`GetCachedRoute_hit_${cacheMode}`, 1, MetricLoggerUnit.Count);
            log.info({
                tokenIn: tokenIn.symbol,
                tokenInAddress: tokenIn.address,
                tokenOut: tokenOut.symbol,
                tokenOutAddress: tokenOut.address,
                cacheMode,
                amount: amount.toExact(),
                chainId: this.chainId,
                tradeType: this.tradeTypeStr(tradeType),
            }, `GetCachedRoute hit ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
        }
        let swapRouteFromCachePromise = Promise.resolve(null);
        if (cachedRoutes) {
            swapRouteFromCachePromise = this.getSwapRouteFromCache(cachedRoutes, await blockNumber, amount, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei);
        }
        let swapRouteFromChainPromise = Promise.resolve(null);
        if (!cachedRoutes || cacheMode !== CacheMode.Livemode) {
            swapRouteFromChainPromise = this.getSwapRouteFromChain(amount, tokenIn, tokenOut, protocols, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei);
        }
        const [swapRouteFromCache, swapRouteFromChain] = await Promise.all([
            swapRouteFromCachePromise,
            swapRouteFromChainPromise,
        ]);
        // console.log('swapRouteFromChain:', {
        //   quote: swapRouteFromChain?.quote?.toExact(),
        //   quoteGasAdjusted: swapRouteFromChain?.quoteGasAdjusted?.toExact(),
        //   estimatedGasUsed: swapRouteFromChain?.estimatedGasUsed?.toString(),
        //   estimatedGasUsedUSD: swapRouteFromChain?.estimatedGasUsedUSD?.toExact(),
        //   estimatedGasUsedQuoteToken: swapRouteFromChain?.estimatedGasUsedQuoteToken?.toExact(),
        //   routesCount: swapRouteFromChain?.routes?.length || 0,
        //   routes: swapRouteFromChain?.routes?.map((route, index) => ({
        //     routeIndex: index,
        //     protocol: route.protocol,
        //     percent: route.percent,
        //     quote: route.quote.toExact(),
        //     quoteAdjustedForGas: route.quoteAdjustedForGas.toExact(),
        //     gasEstimate: route.gasEstimate.toString(),
        //     gasCostInToken: route.gasCostInToken.toExact(),
        //     gasCostInUSD: route.gasCostInUSD.toExact(),
        //     poolAddresses: route.poolAddresses.join(','),
        //     tokenPath: route.tokenPath.map(token => token.symbol || token.address).join(','),
        //     routeString: route.toString()
        //   })) || []
        // });
        let swapRouteRaw;
        if (cacheMode === CacheMode.Livemode && swapRouteFromCache) {
            log.info(`CacheMode is ${cacheMode}, and we are using swapRoute from cache`);
            swapRouteRaw = swapRouteFromCache;
        }
        else {
            log.info(`CacheMode is ${cacheMode}, and we are using materialized swapRoute`);
            swapRouteRaw = swapRouteFromChain;
        }
        if (cacheMode === CacheMode.Tapcompare &&
            swapRouteFromCache &&
            swapRouteFromChain) {
            const quoteDiff = swapRouteFromChain.quote.subtract(swapRouteFromCache.quote);
            const quoteGasAdjustedDiff = swapRouteFromChain.quoteGasAdjusted.subtract(swapRouteFromCache.quoteGasAdjusted);
            const gasUsedDiff = swapRouteFromChain.estimatedGasUsed.sub(swapRouteFromCache.estimatedGasUsed);
            // Only log if quoteDiff is different from 0, or if quoteGasAdjustedDiff and gasUsedDiff are both different from 0
            if (!quoteDiff.equalTo(0) ||
                !(quoteGasAdjustedDiff.equalTo(0) || gasUsedDiff.eq(0))) {
                // Calculates the percentage of the difference with respect to the quoteFromChain (not from cache)
                const misquotePercent = quoteGasAdjustedDiff
                    .divide(swapRouteFromChain.quoteGasAdjusted)
                    .multiply(100);
                metric.putMetric(`TapcompareCachedRoute_quoteGasAdjustedDiffPercent`, Number(misquotePercent.toExact()), MetricLoggerUnit.Percent);
                log.warn({
                    quoteFromChain: swapRouteFromChain.quote.toExact(),
                    quoteFromCache: swapRouteFromCache.quote.toExact(),
                    quoteDiff: quoteDiff.toExact(),
                    quoteGasAdjustedFromChain: swapRouteFromChain.quoteGasAdjusted.toExact(),
                    quoteGasAdjustedFromCache: swapRouteFromCache.quoteGasAdjusted.toExact(),
                    quoteGasAdjustedDiff: quoteGasAdjustedDiff.toExact(),
                    gasUsedFromChain: swapRouteFromChain.estimatedGasUsed.toString(),
                    gasUsedFromCache: swapRouteFromCache.estimatedGasUsed.toString(),
                    gasUsedDiff: gasUsedDiff.toString(),
                    routesFromChain: swapRouteFromChain.routes.toString(),
                    routesFromCache: swapRouteFromCache.routes.toString(),
                    amount: amount.toExact(),
                    originalAmount: cachedRoutes === null || cachedRoutes === void 0 ? void 0 : cachedRoutes.originalAmount,
                    pair: this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType),
                    blockNumber,
                }, `Comparing quotes between Chain and Cache for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
            }
        }
        if (!swapRouteRaw) {
            return null;
        }
        const { quote, quoteGasAdjusted, estimatedGasUsed, routes: routeAmounts, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, } = swapRouteRaw;
        if (this.routeCachingProvider &&
            cacheMode !== CacheMode.Darkmode &&
            swapRouteFromChain) {
            // Generate the object to be cached
            const routesToCache = CachedRoutes.fromRoutesWithValidQuotes(swapRouteFromChain.routes, this.chainId, tokenIn, tokenOut, protocols.sort(), // sort it for consistency in the order of the protocols.
            await blockNumber, tradeType, amount.toExact());
            if (routesToCache) {
                // Attempt to insert the entry in cache. This is fire and forget promise.
                // The catch method will prevent any exception from blocking the normal code execution.
                this.routeCachingProvider
                    .setCachedRoute(routesToCache, amount)
                    .then((success) => {
                    const status = success ? 'success' : 'rejected';
                    metric.putMetric(`SetCachedRoute_${status}`, 1, MetricLoggerUnit.Count);
                })
                    .catch((reason) => {
                    log.error({
                        reason: reason,
                        tokenPair: this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType),
                    }, `SetCachedRoute failure`);
                    metric.putMetric(`SetCachedRoute_failure`, 1, MetricLoggerUnit.Count);
                });
            }
        }
        metric.putMetric(`QuoteFoundForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        // Build Trade object that represents the optimal swap.
        const trade = buildTrade(currencyIn, currencyOut, tradeType, routeAmounts);
        let methodParameters;
        // If user provided recipient, deadline etc. we also generate the calldata required to execute
        // the swap and return it too.
        if (swapConfig) {
            methodParameters = buildSwapMethodParameters(trade, swapConfig, this.chainId);
        }
        const swapRoute = {
            quote,
            quoteGasAdjusted,
            estimatedGasUsed,
            estimatedGasUsedQuoteToken,
            estimatedGasUsedUSD,
            gasPriceWei,
            route: routeAmounts,
            trade,
            methodParameters,
            blockNumber: BigNumber.from(await blockNumber),
        };
        if (swapConfig &&
            swapConfig.simulate &&
            methodParameters &&
            methodParameters.calldata) {
            if (!this.simulator) {
                throw new Error('Simulator not initialized!');
            }
            log.info({ swapConfig, methodParameters }, 'Starting simulation');
            const fromAddress = swapConfig.simulate.fromAddress;
            const beforeSimulate = Date.now();
            const swapRouteWithSimulation = await this.simulator.simulate(fromAddress, swapConfig, swapRoute, amount, 
            // Quote will be in WETH even if quoteCurrency is ETH
            // So we init a new CurrencyAmount object here
            CurrencyAmount.fromRawAmount(quoteCurrency, quote.quotient.toString()), this.l2GasDataProvider
                ? await ((_e = this.l2GasDataProvider) === null || _e === void 0 ? void 0 : _e.getGasData())
                : undefined, { blockNumber });
            metric.putMetric('SimulateTransaction', Date.now() - beforeSimulate, MetricLoggerUnit.Milliseconds);
            return swapRouteWithSimulation;
        }
        return swapRoute;
    }
    async getSwapRouteFromCache(cachedRoutes, blockNumber, amount, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei) {
        log.info({
            protocols: cachedRoutes.protocolsCovered,
            tradeType: cachedRoutes.tradeType,
            cachedBlockNumber: cachedRoutes.blockNumber,
            quoteBlockNumber: blockNumber,
        }, 'Routing across CachedRoute');
        const quotePromises = [];
        const v3Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V3);
        const v2Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V2);
        const mixedRoutes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.MIXED);
        // Calculate percents from all routes, we will fetch quotes for each percent in case we had stale data when the route was cached
        const percentsSet = new Set(cachedRoutes.routes.map((route) => route.percent));
        // Add some percents that could be helpful
        percentsSet.add(100);
        percentsSet.add(50);
        // Convert set to array
        const percents = Array.from(percentsSet.values());
        // calculate amounts based on the percents
        const amounts = percents.map((percent) => amount.multiply(new Fraction(percent, 100)));
        if (v3Routes.length > 0) {
            const v3RoutesFromCache = v3Routes.map((cachedRoute) => cachedRoute.route);
            quotePromises.push(this.v3Quoter.getQuotes(v3RoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, undefined, v3GasModel));
        }
        if (v2Routes.length > 0) {
            quotePromises.push(
            // When we fetch the quotes in V2, we are not calling the `onChainProvider` like on v3Routes and mixedRoutes
            // Instead we are using the reserves in the Pool object, so we need to re-load the current reserves.
            this.v2Quoter.getRoutesThenQuotes(v2Routes[0].tokenIn, v2Routes[0].tokenOut, amounts, percents, quoteToken, tradeType, routingConfig, undefined, gasPriceWei));
        }
        if (mixedRoutes.length > 0) {
            const mixedRoutesFromCache = mixedRoutes.map((cachedRoute) => cachedRoute.route);
            quotePromises.push(this.mixedQuoter.getQuotes(mixedRoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, undefined, mixedRouteGasModel));
        }
        const getQuotesResults = await Promise.all(quotePromises);
        const allRoutesWithValidQuotes = [];
        const allCandidatePools = [];
        getQuotesResults.forEach((getQuoteResult) => {
            allRoutesWithValidQuotes.push(...getQuoteResult.routesWithValidQuotes);
            if (getQuoteResult.candidatePools) {
                allCandidatePools.push(getQuoteResult.candidatePools);
            }
        });
        if (allRoutesWithValidQuotes.length === 0) {
            log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
            return null;
        }
        return getBestSwapRoute(amount, percents, allRoutesWithValidQuotes, tradeType, this.chainId, routingConfig, v3GasModel);
    }
    async getSwapRouteFromChain(amount, tokenIn, tokenOut, protocols, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei) {
        // Generate our distribution of amounts, i.e. fractions of the input amount.
        // We will get quotes for fractions of the input amount for different routes, then
        // combine to generate split routes.
        const [percents, amounts] = this.getAmountDistribution(amount, routingConfig);
        const noProtocolsSpecified = protocols.length === 0;
        const v3ProtocolSpecified = protocols.includes(Protocol.V3);
        const v2ProtocolSpecified = protocols.includes(Protocol.V2);
        const v2SupportedInChain = V2_SUPPORTED.includes(this.chainId);
        const shouldQueryMixedProtocol = protocols.includes(Protocol.MIXED) ||
            (noProtocolsSpecified && v2SupportedInChain);
        const mixedProtocolAllowed = [ChainId.MAINNET, ChainId.GÖRLI, ChainId.SONIC, ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(this.chainId) &&
            tradeType === TradeType.EXACT_INPUT;
        const quotePromises = [];
        // Maybe Quote V3 - if V3 is specified, or no protocol is specified
        if (v3ProtocolSpecified || noProtocolsSpecified) {
            log.info({ protocols, tradeType }, 'Routing across V3');
            quotePromises.push(this.v3Quoter.getRoutesThenQuotes(tokenIn, tokenOut, amounts, percents, quoteToken, tradeType, routingConfig, v3GasModel));
        }
        // Maybe Quote V2 - if V2 is specified, or no protocol is specified AND v2 is supported in this chain
        if (v2SupportedInChain && (v2ProtocolSpecified || noProtocolsSpecified)) {
            log.info({ protocols, tradeType }, 'Routing across V2');
            quotePromises.push(this.v2Quoter.getRoutesThenQuotes(tokenIn, tokenOut, amounts, percents, quoteToken, tradeType, routingConfig, undefined, gasPriceWei));
        }
        // Maybe Quote mixed routes
        // if MixedProtocol is specified or no protocol is specified and v2 is supported AND tradeType is ExactIn
        // AND is Mainnet or Gorli
        if (shouldQueryMixedProtocol && mixedProtocolAllowed) {
            log.info({ protocols, tradeType }, 'Routing across MixedRoutes');
            quotePromises.push(this.mixedQuoter.getRoutesThenQuotes(tokenIn, tokenOut, amounts, percents, quoteToken, tradeType, routingConfig, mixedRouteGasModel));
        }
        const getQuotesResults = await Promise.all(quotePromises);
        console.log('getQuotesResults', getQuotesResults);
        const allRoutesWithValidQuotes = [];
        const allCandidatePools = [];
        getQuotesResults.forEach((getQuoteResult) => {
            allRoutesWithValidQuotes.push(...getQuoteResult.routesWithValidQuotes);
            if (getQuoteResult.candidatePools) {
                allCandidatePools.push(getQuoteResult.candidatePools);
            }
        });
        if (allRoutesWithValidQuotes.length === 0) {
            log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
            return null;
        }
        // Given all the quotes for all the amounts for all the routes, find the best combination.
        const bestSwapRoute = await getBestSwapRoute(amount, percents, allRoutesWithValidQuotes, tradeType, this.chainId, routingConfig, v3GasModel);
        if (bestSwapRoute) {
            this.emitPoolSelectionMetrics(bestSwapRoute, allCandidatePools);
        }
        return bestSwapRoute;
    }
    tradeTypeStr(tradeType) {
        return tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut';
    }
    tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType) {
        return `${tokenIn.symbol}/${tokenOut.symbol}/${this.tradeTypeStr(tradeType)}/${this.chainId}`;
    }
    determineCurrencyInOutFromTradeType(tradeType, amount, quoteCurrency) {
        if (tradeType === TradeType.EXACT_INPUT) {
            return {
                currencyIn: amount.currency,
                currencyOut: quoteCurrency,
            };
        }
        else {
            return {
                currencyIn: quoteCurrency,
                currencyOut: amount.currency,
            };
        }
    }
    async getGasPriceWei() {
        // Track how long it takes to resolve this async call.
        const beforeGasTimestamp = Date.now();
        // Get an estimate of the gas price to use when estimating gas cost of different routes.
        const { gasPriceWei } = await this.gasPriceProvider.getGasPrice();
        metric.putMetric('GasPriceLoad', Date.now() - beforeGasTimestamp, MetricLoggerUnit.Milliseconds);
        return gasPriceWei;
    }
    async getGasModels(gasPriceWei, amountToken, quoteToken) {
        const beforeGasModel = Date.now();
        const v3GasModelPromise = this.v3GasModelFactory.buildGasModel({
            chainId: this.chainId,
            gasPriceWei,
            v3poolProvider: this.v3PoolProvider,
            amountToken,
            quoteToken,
            v2poolProvider: this.v2PoolProvider,
            l2GasDataProvider: this.l2GasDataProvider,
        });
        const mixedRouteGasModelPromise = this.mixedRouteGasModelFactory.buildGasModel({
            chainId: this.chainId,
            gasPriceWei,
            v3poolProvider: this.v3PoolProvider,
            amountToken,
            quoteToken,
            v2poolProvider: this.v2PoolProvider,
        });
        const [v3GasModel, mixedRouteGasModel] = await Promise.all([
            v3GasModelPromise,
            mixedRouteGasModelPromise,
        ]);
        metric.putMetric('GasModelCreation', Date.now() - beforeGasModel, MetricLoggerUnit.Milliseconds);
        return [v3GasModel, mixedRouteGasModel];
    }
    // Note multiplications here can result in a loss of precision in the amounts (e.g. taking 50% of 101)
    // This is reconcilled at the end of the algorithm by adding any lost precision to one of
    // the splits in the route.
    getAmountDistribution(amount, routingConfig) {
        const { distributionPercent } = routingConfig;
        const percents = [];
        const amounts = [];
        for (let i = 1; i <= 100 / distributionPercent; i++) {
            percents.push(i * distributionPercent);
            amounts.push(amount.multiply(new Fraction(i * distributionPercent, 100)));
        }
        return [percents, amounts];
    }
    async buildSwapAndAddMethodParameters(trade, swapAndAddOptions, swapAndAddParameters) {
        const { swapOptions: { recipient, slippageTolerance, deadline, inputTokenPermit }, addLiquidityOptions: addLiquidityConfig, } = swapAndAddOptions;
        const preLiquidityPosition = swapAndAddParameters.preLiquidityPosition;
        const finalBalanceTokenIn = swapAndAddParameters.initialBalanceTokenIn.subtract(trade.inputAmount);
        const finalBalanceTokenOut = swapAndAddParameters.initialBalanceTokenOut.add(trade.outputAmount);
        const approvalTypes = await this.swapRouterProvider.getApprovalType(finalBalanceTokenIn, finalBalanceTokenOut);
        const zeroForOne = finalBalanceTokenIn.currency.wrapped.sortsBefore(finalBalanceTokenOut.currency.wrapped);
        return {
            ...SwapRouter.swapAndAddCallParameters(trade, {
                recipient,
                slippageTolerance,
                deadlineOrPreviousBlockhash: deadline,
                inputTokenPermit,
            }, Position.fromAmounts({
                pool: preLiquidityPosition.pool,
                tickLower: preLiquidityPosition.tickLower,
                tickUpper: preLiquidityPosition.tickUpper,
                amount0: zeroForOne
                    ? finalBalanceTokenIn.quotient.toString()
                    : finalBalanceTokenOut.quotient.toString(),
                amount1: zeroForOne
                    ? finalBalanceTokenOut.quotient.toString()
                    : finalBalanceTokenIn.quotient.toString(),
                useFullPrecision: false,
            }), addLiquidityConfig, approvalTypes.approvalTokenIn, approvalTypes.approvalTokenOut),
            to: SWAP_ROUTER_02_ADDRESSES(this.chainId),
        };
    }
    emitPoolSelectionMetrics(swapRouteRaw, allPoolsBySelection) {
        const poolAddressesUsed = new Set();
        const { routes: routeAmounts } = swapRouteRaw;
        _(routeAmounts)
            .flatMap((routeAmount) => {
            const { poolAddresses } = routeAmount;
            return poolAddresses;
        })
            .forEach((address) => {
            poolAddressesUsed.add(address.toLowerCase());
        });
        for (const poolsBySelection of allPoolsBySelection) {
            const { protocol } = poolsBySelection;
            _.forIn(poolsBySelection.selections, (pools, topNSelection) => {
                const topNUsed = _.findLastIndex(pools, (pool) => poolAddressesUsed.has(pool.id.toLowerCase())) + 1;
                metric.putMetric(_.capitalize(`${protocol}${topNSelection}`), topNUsed, MetricLoggerUnit.Count);
            });
        }
        let hasV3Route = false;
        let hasV2Route = false;
        let hasMixedRoute = false;
        for (const routeAmount of routeAmounts) {
            if (routeAmount.protocol === Protocol.V3) {
                hasV3Route = true;
            }
            if (routeAmount.protocol === Protocol.V2) {
                hasV2Route = true;
            }
            if (routeAmount.protocol === Protocol.MIXED) {
                hasMixedRoute = true;
            }
        }
        if (hasMixedRoute && (hasV3Route || hasV2Route)) {
            if (hasV3Route && hasV2Route) {
                metric.putMetric(`MixedAndV3AndV2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV3AndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else if (hasV3Route) {
                metric.putMetric(`MixedAndV3SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV3SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else if (hasV2Route) {
                metric.putMetric(`MixedAndV2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV3Route && hasV2Route) {
            metric.putMetric(`V3AndV2SplitRoute`, 1, MetricLoggerUnit.Count);
            metric.putMetric(`V3AndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        }
        else if (hasMixedRoute) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`MixedSplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedSplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`MixedRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV3Route) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`V3SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V3SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`V3Route`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V3RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV2Route) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`V2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`V2Route`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V2RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
    }
    calculateOptimalRatio(position, sqrtRatioX96, zeroForOne) {
        const upperSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickUpper);
        const lowerSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickLower);
        // returns Fraction(0, 1) for any out of range position regardless of zeroForOne. Implication: function
        // cannot be used to determine the trading direction of out of range positions.
        if (JSBI.greaterThan(sqrtRatioX96, upperSqrtRatioX96) ||
            JSBI.lessThan(sqrtRatioX96, lowerSqrtRatioX96)) {
            return new Fraction(0, 1);
        }
        const precision = JSBI.BigInt('1' + '0'.repeat(18));
        let optimalRatio = new Fraction(SqrtPriceMath.getAmount0Delta(sqrtRatioX96, upperSqrtRatioX96, precision, true), SqrtPriceMath.getAmount1Delta(sqrtRatioX96, lowerSqrtRatioX96, precision, true));
        if (!zeroForOne)
            optimalRatio = optimalRatio.invert();
        return optimalRatio;
    }
    async userHasSufficientBalance(fromAddress, tradeType, amount, quote) {
        try {
            const neededBalance = tradeType === TradeType.EXACT_INPUT ? amount : quote;
            let balance;
            if (neededBalance.currency.isNative) {
                balance = await this.provider.getBalance(fromAddress);
            }
            else {
                const tokenContract = Erc20__factory.connect(neededBalance.currency.address, this.provider);
                balance = await tokenContract.balanceOf(fromAddress);
            }
            return balance.gte(BigNumber.from(neededBalance.quotient.toString()));
        }
        catch (e) {
            log.error(e, 'Error while checking user balance');
            return false;
        }
    }
    absoluteValue(fraction) {
        const numeratorAbs = JSBI.lessThan(fraction.numerator, JSBI.BigInt(0))
            ? JSBI.unaryMinus(fraction.numerator)
            : fraction.numerator;
        const denominatorAbs = JSBI.lessThan(fraction.denominator, JSBI.BigInt(0))
            ? JSBI.unaryMinus(fraction.denominator)
            : fraction.denominator;
        return new Fraction(numeratorAbs, denominatorAbs);
    }
    getBlockNumberPromise() {
        return retry(async (_b, attempt) => {
            if (attempt > 1) {
                log.info(`Get block number attempt ${attempt}`);
            }
            return this.provider.getBlockNumber();
        }, {
            retries: 2,
            minTimeout: 100,
            maxTimeout: 1000,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2FscGhhLXJvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEtBQUssTUFBTSxhQUFhLENBQUM7QUFDaEMsT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQ3hCLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLFNBQVMsTUFBTSxZQUFZLENBQUM7QUFFbkMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFFTCxlQUFlLEdBQ2hCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxrQkFBa0IsTUFBTSw2QkFBNkIsQ0FBQztBQUM3RCxPQUFPLEVBQ0wsUUFBUSxFQUNSLFVBQVUsR0FFWCxNQUFNLHFCQUFxQixDQUFDO0FBQzdCLE9BQU8sRUFFTCxRQUFRLEVBRVIsU0FBUyxHQUNWLE1BQU0sbUJBQW1CLENBQUM7QUFFM0IsT0FBTyxFQUNMLElBQUksRUFDSixRQUFRLEVBQ1IsYUFBYSxFQUNiLFFBQVEsR0FDVCxNQUFNLGlCQUFpQixDQUFDO0FBRXpCLE9BQU8sRUFDTCxZQUFZLEVBQ1osU0FBUyxFQUNULHlCQUF5QixFQUN6QixnQ0FBZ0MsRUFDaEMscUJBQXFCLEVBQ3JCLHlCQUF5QixFQUN6QixxQkFBcUIsRUFDckIseUJBQXlCLEVBQ3pCLHVCQUF1QixFQUN2Qix5QkFBeUIsRUFNekIsc0JBQXNCLEVBQ3RCLFdBQVcsRUFDWCx1QkFBdUIsRUFDdkIsb0JBQW9CLEVBRXBCLHdCQUF3QixFQUN4Qix3QkFBd0IsRUFDeEIsa0JBQWtCLEVBQ2xCLHdCQUF3QixFQUN4QixtQkFBbUIsRUFDbkIsZUFBZSxFQUNmLCtCQUErQixFQUMvQiwrQkFBK0IsR0FDaEMsTUFBTSxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQ0wsd0JBQXdCLEdB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