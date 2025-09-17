import { defaultAbiCoder } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/solidity';
import { Pool } from '@swyrlfi/v3-sdk';
import retry from 'async-retry';
import { getCreate2Address } from 'ethers/lib/utils';
import _ from 'lodash';
import { IUniswapV3PoolState__factory } from '../../types/v3/factories/IUniswapV3PoolState__factory';
import { ChainId } from '../../util';
import { SONIC_V3_INIT_CODE_HASH, V3_CORE_FACTORY_ADDRESSES, V3_CORE_INIT_CODE_HASH, } from '../../util/addresses';
import { log } from '../../util/log';
import { getTickSpacing, poolToString } from '../../util/routes';
export class V3PoolProvider {
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
        log.debug(`getPools called with ${tokenPairs.length} token pairs. Deduped down to ${poolAddressSet.size}`);
        const [slot0Results, liquidityResults] = await Promise.all([
            this.getPoolsData(sortedPoolAddresses, 'slot0', providerConfig),
            this.getPoolsData(sortedPoolAddresses, 'liquidity', providerConfig),
        ]);
        log.info(`Got liquidity and slot0s for ${poolAddressSet.size} pools ${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
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
            const pool = new Pool(token0, token1, fee, slot0.sqrtPriceX96.toString(), liquidity.toString(), slot0.tick);
            const poolAddress = sortedPoolAddresses[i];
            poolAddressToPool[poolAddress] = pool;
        }
        if (invalidPools.length > 0) {
            log.info({
                invalidPools: _.map(invalidPools, ([token0, token1, fee]) => `${token0.symbol}/${token1.symbol}/${fee / 10000}%`),
            }, `${invalidPools.length} pools invalid after checking their slot0 and liquidity results. Dropping.`);
        }
        const poolStrs = _.map(Object.values(poolAddressToPool), poolToString);
        log.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`);
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
        if (this.chainId === ChainId.SONIC) {
            const tickSpacing = getTickSpacing(feeAmount);
            poolAddress = computeV3PoolAddress({
                factoryAddress: V3_CORE_FACTORY_ADDRESSES[this.chainId],
                tokenA: token0,
                tokenB: token1,
                tickSpacing: tickSpacing,
                initCodeHashManualOverride: SONIC_V3_INIT_CODE_HASH,
            });
        }
        else if ([ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(this.chainId)) {
            const tickSpacing = getTickSpacing(feeAmount);
            poolAddress = computeV3PoolAddress({
                factoryAddress: V3_CORE_FACTORY_ADDRESSES[this.chainId],
                tokenA: token0,
                tokenB: token1,
                tickSpacing: tickSpacing,
                initCodeHashManualOverride: V3_CORE_INIT_CODE_HASH[this.chainId]
            });
        }
        else {
            // Use standard Uniswap V3 pool address calculation for other chains
            poolAddress = Pool.getAddress(token0, token1, feeAmount);
        }
        this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;
        return { poolAddress, token0, token1 };
    }
    async getPoolsData(poolAddresses, functionName, providerConfig) {
        const { results, blockNumber } = await retry(async () => {
            return this.multicall2Provider.callSameFunctionOnMultipleContracts({
                addresses: poolAddresses,
                contractInterface: IUniswapV3PoolState__factory.createInterface(),
                functionName: functionName,
                providerConfig,
            });
        }, this.retryOptions);
        log.debug(`Pool data fetched as of block ${blockNumber}`);
        return results;
    }
}
/**
 * Computes a pool address
 * @param factoryAddress The Ramses V3 factory address
 * @param tokenA The first token of the pair, irrespective of sort order
 * @param tokenB The second token of the pair, irrespective of sort order
 * @param tickSpacing The tick spacing of the pool
 * @param initCodeHashManualOverride Override the init code hash used to compute the pool address if necessary
 * @returns The pool address
 */
export function computeV3PoolAddress({ factoryAddress, tokenA, tokenB, tickSpacing, initCodeHashManualOverride, }) {
    // Sort tokens by address
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    // 修改 salt 计算方式以匹配合约
    const salt = keccak256(['bytes'], [defaultAbiCoder.encode(['address', 'address', 'int24'], [token0.address.toLowerCase(), token1.address.toLowerCase(), tickSpacing])]);
    // Get init code hash, using override if provided
    const initCodeHash = initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : SONIC_V3_INIT_CODE_HASH;
    // 使用标准的 create2 地址计算，与合约保持一致
    return getCreate2Address(factoryAddress, salt, initCodeHash);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjMvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFckQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlCQUF5QixDQUFBO0FBRW5ELE9BQU8sRUFBYSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRCxPQUFPLEtBQWtDLE1BQU0sYUFBYSxDQUFDO0FBQzdELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3JELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUV2QixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3JDLE9BQU8sRUFDTCx1QkFBdUIsRUFDdkIseUJBQXlCLEVBQ3pCLHNCQUFzQixHQUN2QixNQUFNLHNCQUFzQixDQUFDO0FBQzlCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNyQyxPQUFPLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBOERqRSxNQUFNLE9BQU8sY0FBYztJQUt6Qjs7Ozs7T0FLRztJQUNILFlBQ1ksT0FBZ0IsRUFDaEIsa0JBQXNDLEVBQ3RDLGVBQW1DO1FBQzNDLE9BQU8sRUFBRSxDQUFDO1FBQ1YsVUFBVSxFQUFFLEVBQUU7UUFDZCxVQUFVLEVBQUUsR0FBRztLQUNoQjtRQU5TLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUN0QyxpQkFBWSxHQUFaLFlBQVksQ0FJckI7UUFqQkgseUVBQXlFO1FBQ3pFLGtEQUFrRDtRQUMxQyx1QkFBa0IsR0FB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