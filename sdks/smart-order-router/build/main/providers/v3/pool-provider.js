"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeV3PoolAddress = exports.V3PoolProvider = void 0;
const abi_1 = require("@ethersproject/abi");
const solidity_1 = require("@ethersproject/solidity");
const v3_sdk_1 = require("@swyrlfi/v3-sdk");
const async_retry_1 = __importDefault(require("async-retry"));
const utils_1 = require("ethers/lib/utils");
const lodash_1 = __importDefault(require("lodash"));
const IUniswapV3PoolState__factory_1 = require("../../types/v3/factories/IUniswapV3PoolState__factory");
const util_1 = require("../../util");
const addresses_1 = require("../../util/addresses");
const log_1 = require("../../util/log");
const routes_1 = require("../../util/routes");
class V3PoolProvider {
    /**
     * Creates an instance of V3PoolProvider.
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId, multicall2Provider, retryOptions = {
        retries: 2,
        minTimeout: 50,
        maxTimeout: 500,
    }) {
        this.chainId = chainId;
        this.multicall2Provider = multicall2Provider;
        this.retryOptions = retryOptions;
        // Computing pool addresses is slow as it requires hashing, encoding etc.
        // Addresses never change so can always be cached.
        this.POOL_ADDRESS_CACHE = {};
    }
    async getPools(tokenPairs, providerConfig) {
        const poolAddressSet = new Set();
        const sortedTokenPairs = [];
        const sortedPoolAddresses = [];
        for (const tokenPair of tokenPairs) {
            const [tokenA, tokenB, feeAmount] = tokenPair;
            const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB, feeAmount);
            if (poolAddressSet.has(poolAddress)) {
                continue;
            }
            poolAddressSet.add(poolAddress);
            sortedTokenPairs.push([token0, token1, feeAmount]);
            sortedPoolAddresses.push(poolAddress);
        }
        log_1.log.debug(`getPools called with ${tokenPairs.length} token pairs. Deduped down to ${poolAddressSet.size}`);
        const [slot0Results, liquidityResults] = await Promise.all([
            this.getPoolsData(sortedPoolAddresses, 'slot0', providerConfig),
            this.getPoolsData(sortedPoolAddresses, 'liquidity', providerConfig),
        ]);
        log_1.log.info(`Got liquidity and slot0s for ${poolAddressSet.size} pools ${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? `as of block: ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}.`
            : ``}`);
        const poolAddressToPool = {};
        const invalidPools = [];
        for (let i = 0; i < sortedPoolAddresses.length; i++) {
            const slot0Result = slot0Results[i];
            const liquidityResult = liquidityResults[i];
            // These properties tell us if a pool is valid and initialized or not.
            if (!(slot0Result === null || slot0Result === void 0 ? void 0 : slot0Result.success) ||
                !(liquidityResult === null || liquidityResult === void 0 ? void 0 : liquidityResult.success) ||
                slot0Result.result.sqrtPriceX96.eq(0)) {
                const [token0, token1, fee] = sortedTokenPairs[i];
                invalidPools.push([token0, token1, fee]);
                continue;
            }
            const [token0, token1, fee] = sortedTokenPairs[i];
            const slot0 = slot0Result.result;
            const liquidity = liquidityResult.result[0];
            const pool = new v3_sdk_1.Pool(token0, token1, fee, slot0.sqrtPriceX96.toString(), liquidity.toString(), slot0.tick);
            const poolAddress = sortedPoolAddresses[i];
            poolAddressToPool[poolAddress] = pool;
        }
        if (invalidPools.length > 0) {
            log_1.log.info({
                invalidPools: lodash_1.default.map(invalidPools, ([token0, token1, fee]) => `${token0.symbol}/${token1.symbol}/${fee / 10000}%`),
            }, `${invalidPools.length} pools invalid after checking their slot0 and liquidity results. Dropping.`);
        }
        const poolStrs = lodash_1.default.map(Object.values(poolAddressToPool), routes_1.poolToString);
        log_1.log.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`);
        return {
            getPool: (tokenA, tokenB, feeAmount) => {
                const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount);
                return poolAddressToPool[poolAddress];
            },
            getPoolByAddress: (address) => poolAddressToPool[address],
            getAllPools: () => Object.values(poolAddressToPool),
        };
    }
    getPoolAddress(tokenA, tokenB, feeAmount) {
        const [token0, token1] = tokenA.sortsBefore(tokenB)
            ? [tokenA, tokenB]
            : [tokenB, tokenA];
        const cacheKey = `${this.chainId}/${token0.address}/${token1.address}/${feeAmount}`;
        const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey];
        if (cachedAddress) {
            return { poolAddress: cachedAddress, token0, token1 };
        }
        let poolAddress;
        if (this.chainId === util_1.ChainId.SONIC) {
            const tickSpacing = (0, routes_1.getTickSpacing)(feeAmount);
            poolAddress = computeV3PoolAddress({
                factoryAddress: addresses_1.V3_CORE_FACTORY_ADDRESSES[this.chainId],
                tokenA: token0,
                tokenB: token1,
                tickSpacing: tickSpacing,
                initCodeHashManualOverride: addresses_1.SONIC_V3_INIT_CODE_HASH,
            });
        }
        else if ([util_1.ChainId.MONAD_TESTNET, util_1.ChainId.MONAD_DEVNET].includes(this.chainId)) {
            const tickSpacing = (0, routes_1.getTickSpacing)(feeAmount);
            poolAddress = computeV3PoolAddress({
                factoryAddress: addresses_1.V3_CORE_FACTORY_ADDRESSES[this.chainId],
                tokenA: token0,
                tokenB: token1,
                tickSpacing: tickSpacing,
                initCodeHashManualOverride: addresses_1.V3_CORE_INIT_CODE_HASH[this.chainId]
            });
        }
        else {
            // Use standard Uniswap V3 pool address calculation for other chains
            poolAddress = v3_sdk_1.Pool.getAddress(token0, token1, feeAmount);
        }
        this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;
        return { poolAddress, token0, token1 };
    }
    async getPoolsData(poolAddresses, functionName, providerConfig) {
        const { results, blockNumber } = await (0, async_retry_1.default)(async () => {
            return this.multicall2Provider.callSameFunctionOnMultipleContracts({
                addresses: poolAddresses,
                contractInterface: IUniswapV3PoolState__factory_1.IUniswapV3PoolState__factory.createInterface(),
                functionName: functionName,
                providerConfig,
            });
        }, this.retryOptions);
        log_1.log.debug(`Pool data fetched as of block ${blockNumber}`);
        return results;
    }
}
exports.V3PoolProvider = V3PoolProvider;
/**
 * Computes a pool address
 * @param factoryAddress The Ramses V3 factory address
 * @param tokenA The first token of the pair, irrespective of sort order
 * @param tokenB The second token of the pair, irrespective of sort order
 * @param tickSpacing The tick spacing of the pool
 * @param initCodeHashManualOverride Override the init code hash used to compute the pool address if necessary
 * @returns The pool address
 */
function computeV3PoolAddress({ factoryAddress, tokenA, tokenB, tickSpacing, initCodeHashManualOverride, }) {
    // Sort tokens by address
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    // 修改 salt 计算方式以匹配合约
    const salt = (0, solidity_1.keccak256)(['bytes'], [abi_1.defaultAbiCoder.encode(['address', 'address', 'int24'], [token0.address.toLowerCase(), token1.address.toLowerCase(), tickSpacing])]);
    // Get init code hash, using override if provided
    const initCodeHash = initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : addresses_1.SONIC_V3_INIT_CODE_HASH;
    // 使用标准的 create2 地址计算，与合约保持一致
    return (0, utils_1.getCreate2Address)(factoryAddress, salt, initCodeHash);
}
exports.computeV3PoolAddress = computeV3PoolAddress;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjMvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw0Q0FBcUQ7QUFFckQsc0RBQW1EO0FBRW5ELDRDQUFrRDtBQUNsRCw4REFBNkQ7QUFDN0QsNENBQXFEO0FBQ3JELG9EQUF1QjtBQUV2Qix3R0FBcUc7QUFDckcscUNBQXFDO0FBQ3JDLG9EQUk4QjtBQUM5Qix3Q0FBcUM7QUFDckMsOENBQWlFO0FBOERqRSxNQUFhLGNBQWM7SUFLekI7Ozs7O09BS0c7SUFDSCxZQUNZLE9BQWdCLEVBQ2hCLGtCQUFzQyxFQUN0QyxlQUFtQztRQUMzQyxPQUFPLEVBQUUsQ0FBQztRQUNWLFVBQVUsRUFBRSxFQUFFO1FBQ2QsVUFBVSxFQUFFLEdBQUc7S0FDaEI7UUFOUyxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDdEMsaUJBQVksR0FBWixZQUFZLENBSXJCO1FBakJILHlFQUF5RTtRQUN6RSxrREFBa0Q7UUFDMUMsdUJBQWtCLEdBQThCLEVBQUUsQ0FBQztJQWdCeEQsQ0FBQztJQUVHLEtBQUssQ0FBQyxRQUFRLENBQ25CLFVBQXVDLEVBQ3ZDLGNBQStCO1FBRS9CLE1BQU0sY0FBYyxHQUFnQixJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3RELE1BQU0sZ0JBQWdCLEdBQXFDLEVBQUUsQ0FBQztRQUM5RCxNQUFNLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztRQUV6QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtZQUNsQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUM7WUFFOUMsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FDekQs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