"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticV2SubgraphProvider = void 0;
const v2_sdk_1 = require("@swyrlfi/v2-sdk");
const lodash_1 = __importDefault(require("lodash"));
const addresses_1 = require("../../util/addresses");
const chains_1 = require("../../util/chains");
const log_1 = require("../../util/log");
const token_provider_1 = require("../token-provider");
const BASES_TO_CHECK_TRADES_AGAINST = {
    [chains_1.ChainId.MAINNET]: [
        chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.MAINNET],
        token_provider_1.DAI_MAINNET,
        token_provider_1.USDC_MAINNET,
        token_provider_1.USDT_MAINNET,
        token_provider_1.WBTC_MAINNET,
    ],
    [chains_1.ChainId.ROPSTEN]: [chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.ROPSTEN]],
    [chains_1.ChainId.RINKEBY]: [
        chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.RINKEBY],
        token_provider_1.DAI_RINKEBY_1,
        token_provider_1.DAI_RINKEBY_2,
    ],
    [chains_1.ChainId.GÖRLI]: [chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.GÖRLI]],
    [chains_1.ChainId.KOVAN]: [chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.KOVAN]],
    //v2 not deployed on [optimism, arbitrum, polygon, celo, gnosis, moonbeam] and their testnets
    [chains_1.ChainId.OPTIMISM]: [],
    [chains_1.ChainId.ARBITRUM_ONE]: [],
    [chains_1.ChainId.ARBITRUM_RINKEBY]: [],
    [chains_1.ChainId.ARBITRUM_GOERLI]: [],
    [chains_1.ChainId.OPTIMISM_GOERLI]: [],
    [chains_1.ChainId.OPTIMISTIC_KOVAN]: [],
    [chains_1.ChainId.POLYGON]: [],
    [chains_1.ChainId.POLYGON_MUMBAI]: [],
    [chains_1.ChainId.CELO]: [],
    [chains_1.ChainId.CELO_ALFAJORES]: [],
    [chains_1.ChainId.GNOSIS]: [],
    [chains_1.ChainId.MOONBEAM]: [],
    [chains_1.ChainId.BSC]: [],
    [chains_1.ChainId.SONIC]: [
        chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.SONIC],
        token_provider_1.USDC_SONIC,
        token_provider_1.USDT_SONIC,
        token_provider_1.WBTC_SONIC,
        token_provider_1.WETH_SONIC,
    ],
    [chains_1.ChainId.MONAD_TESTNET]: [
        chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.MONAD_TESTNET],
        token_provider_1.USDC_MONAD_TESTNET,
    ],
    [chains_1.ChainId.MONAD_DEVNET]: [
        chains_1.WRAPPED_NATIVE_CURRENCY[chains_1.ChainId.MONAD_DEVNET],
        token_provider_1.USDC_MONAD_DEVNET,
    ],
};
/**
 * Provider that does not get data from an external source and instead returns
 * a hardcoded list of Subgraph pools.
 *
 * Since the pools are hardcoded, the liquidity/price values are dummys and should not
 * be depended on.
 *
 * Useful for instances where other data sources are unavailable. E.g. subgraph not available.
 *
 * @export
 * @class StaticV2SubgraphProvider
 */
class StaticV2SubgraphProvider {
    constructor(chainId) {
        this.chainId = chainId;
    }
    async getPools(tokenIn, tokenOut) {
        log_1.log.info('In static subgraph provider for V2');
        const bases = BASES_TO_CHECK_TRADES_AGAINST[this.chainId];
        const basePairs = lodash_1.default.flatMap(bases, (base) => bases.map((otherBase) => [base, otherBase]));
        if (tokenIn && tokenOut) {
            basePairs.push([tokenIn, tokenOut], ...bases.map((base) => [tokenIn, base]), ...bases.map((base) => [tokenOut, base]));
        }
        const pairs = (0, lodash_1.default)(basePairs)
            .filter((tokens) => Boolean(tokens[0] && tokens[1]))
            .filter(([tokenA, tokenB]) => tokenA.address !== tokenB.address && !tokenA.equals(tokenB))
            .value();
        const poolAddressSet = new Set();
        const subgraphPools = (0, lodash_1.default)(pairs)
            .map(([tokenA, tokenB]) => {
            let poolAddress;
            if (this.chainId === chains_1.ChainId.SONIC) {
                poolAddress = (0, v2_sdk_1.computePairAddress)({
                    factoryAddress: addresses_1.SONIC_V2_PAIR_FACTORY_ADDRESS,
                    tokenA: tokenA,
                    tokenB: tokenB
                });
            }
            else if ([chains_1.ChainId.MONAD_TESTNET, chains_1.ChainId.MONAD_DEVNET].includes(this.chainId)) {
                poolAddress = (0, v2_sdk_1.computePairAddress)({
                    factoryAddress: addresses_1.V2_PAIR_FACTORY_ADDRESS[this.chainId],
                    tokenA: tokenA,
                    tokenB: tokenB
                });
            }
            else {
                poolAddress = v2_sdk_1.Pair.getAddress(tokenA, tokenB);
            }
            if (poolAddressSet.has(poolAddress)) {
                return undefined;
            }
            poolAddressSet.add(poolAddress);
            const [token0, token1] = tokenA.sortsBefore(tokenB)
                ? [tokenA, tokenB]
                : [tokenB, tokenA];
            return {
                id: poolAddress,
                liquidity: '100',
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                supply: 100,
                reserve: 100,
                reserveUSD: 100,
            };
        })
            .compact()
            .value();
        return subgraphPools;
    }
}
exports.StaticV2SubgraphProvider = StaticV2SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljLXN1YmdyYXBoLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy92Mi9zdGF0aWMtc3ViZ3JhcGgtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0EsNENBQTJEO0FBQzNELG9EQUF1QjtBQUV2QixvREFBOEY7QUFDOUYsOENBQXFFO0FBQ3JFLHdDQUFxQztBQUNyQyxzREFhMkI7QUFTM0IsTUFBTSw2QkFBNkIsR0FBbUI7SUFDcEQsQ0FBQyxnQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ2pCLGdDQUF1QixDQUFDLGdCQUFPLENBQUMsT0FBTyxDQUFFO1FBQ3pDLDRCQUFXO1FBQ1gsNkJBQVk7UUFDWiw2QkFBWTtRQUNaLDZCQUFZO0tBQ2I7SUFDRCxDQUFDLGdCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxnQ0FBdUIsQ0FBQyxnQkFBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDO0lBQzlELENBQUMsZ0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNqQixnQ0FBdUIsQ0FBQyxnQkFBTyxDQUFDLE9BQU8sQ0FBRTtRQUN6Qyw4QkFBYTtRQUNiLDhCQUFhO0tBQ2Q7SUFDRCxDQUFDLGdCQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxnQ0FBdUIsQ0FBQyxnQkFBTyxDQUFDLEtBQUssQ0FBRSxDQUFDO0lBQzFELENBQUMsZ0JBQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGdDQUF1QixDQUFDLGdCQUFPLENBQUMsS0FBSyxDQUFFLENBQUM7SUFDMUQsNkZBQTZGO0lBQzdGLENBQUMsZ0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFO0lBQ3RCLENBQUMsZ0JBQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFO0lBQzFCLENBQUMsZ0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUU7SUFDOUIsQ0FBQyxnQkFBTyxDQUFDLGVB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