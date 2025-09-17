import { Protocol } from '@swyrlfi/router-sdk';
import { Percent } from '@swyrlfi/sdk-core';
import { Pair } from '@swyrlfi/v2-sdk';
import { FeeAmount, Pool } from '@swyrlfi/v3-sdk';
import _ from 'lodash';
import { computeV2PoolAddress } from '../providers/v2/pool-provider';
import { computeV3PoolAddress } from '../providers/v3/pool-provider';
import { SONIC_V2_PAIR_FACTORY_ADDRESS, V2_PAIR_FACTORY_ADDRESS, V3_CORE_FACTORY_ADDRESSES } from './addresses';
import { ChainId } from './chains';
import { CurrencyAmount } from '.';
// 定义费用和tick spacing的映射关系
export const FeeAmountTickSpacing = {
    [FeeAmount.LOWEST]: 1,
    [FeeAmount.LOWEST_250]: 5,
    [FeeAmount.LOW]: 10,
    [FeeAmount.MEDIUM]: 50,
    [FeeAmount.HIGH]: 100,
    [FeeAmount.HIGHEST]: 200 // 2.00% fee -> 200 bps tickSpacing
};
export function getTickSpacing(fee) {
    // 检查给定的费用是否在映射中
    if (fee in FeeAmountTickSpacing) {
        return FeeAmountTickSpacing[fee];
    }
    // 如果费用不在预定义的映射中，抛出错误
    throw new Error(`Fee amount ${fee} not supported. Supported fees are: 100 (0.01%), 250 (0.025%), 500 (0.05%), 3000 (0.30%), 10000 (1.00%), 20000 (2.00%)`);
}
export const routeToString = (route) => {
    // Get tokens from the route
    const tokens = route.protocol === Protocol.V3 ? route.tokenPath : route.path;
    // Get pools/pairs from the route
    const pools = route.protocol === Protocol.V3 || route.protocol === Protocol.MIXED
        ? route.pools
        : route.pairs;
    // Convert tokens to symbols, using 'UNKNOWN' as fallback
    const tokenSymbols = tokens.map(token => token.symbol || 'UNKNOWN');
    // Convert pools to address strings
    const poolAddresses = pools.map((pool) => {
        if (pool instanceof Pair) {
            const pair = pool;
            // Only use special address computation for Sonic chain
            if (pair.chainId === ChainId.SONIC) {
                const factoryAddress = SONIC_V2_PAIR_FACTORY_ADDRESS;
                try {
                    const address = computeV2PoolAddress({
                        factoryAddress,
                        tokenA: pair.token0,
                        tokenB: pair.token1,
                        stable: false,
                    });
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_ADDRESS_ERROR] --> `;
                }
            }
            else if ([ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(pair.chainId)) {
                const factoryAddress = V2_PAIR_FACTORY_ADDRESS[pair.chainId];
                try {
                    const address = computeV2PoolAddress({
                        factoryAddress,
                        tokenA: pair.token0,
                        tokenB: pair.token1,
                        stable: false,
                    });
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_ADDRESS_ERROR] --> `;
                }
            }
            else {
                // Use default Pair.getAddress() for all other chains
                try {
                    const address = Pair.getAddress(pair.token0, pair.token1);
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
                }
            }
        }
        else {
            if (pool.chainId === ChainId.SONIC) {
                const factoryAddress = V3_CORE_FACTORY_ADDRESSES[pool.chainId];
                if (!factoryAddress) {
                    return ` -- ${pool.fee / 10000}% [V3_FACTORY_NOT_FOUND] --> `;
                }
                try {
                    const address = computeV3PoolAddress({
                        factoryAddress,
                        tokenA: pool.token0,
                        tokenB: pool.token1,
                        tickSpacing: pool.tickSpacing,
                    });
                    return ` -- ${pool.fee / 10000}% [${address}] --> `;
                }
                catch (error) {
                    return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
                }
            }
            else if ([ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(pool.chainId)) {
                const factoryAddress = V3_CORE_FACTORY_ADDRESSES[pool.chainId];
                if (!factoryAddress) {
                    return ` -- ${pool.fee / 10000}% [V3_FACTORY_NOT_FOUND] --> `;
                }
                try {
                    const address = computeV3PoolAddress({
                        factoryAddress,
                        tokenA: pool.token0,
                        tokenB: pool.token1,
                        tickSpacing: pool.tickSpacing,
                    });
                    return ` -- ${pool.fee / 10000}% [${address}] --> `;
                }
                catch (error) {
                    return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
                }
            }
            else {
                // Use default Pair.getAddress() for all other chains
                try {
                    const address = Pool.getAddress(pool.token0, pool.token1, pool.fee, undefined, V3_CORE_FACTORY_ADDRESSES[pool.chainId]);
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
                }
            }
        }
    });
    // Build the route string by interleaving tokens and pools
    const routeParts = [];
    // Ensure both arrays have valid elements
    if (tokenSymbols.length === 0) {
        return '';
    }
    // Build the path string
    for (let i = 0; i < tokenSymbols.length; i++) {
        const symbol = tokenSymbols[i];
        if (symbol) {
            routeParts.push(symbol);
            const poolAddress = i < poolAddresses.length ? poolAddresses[i] : undefined;
            if (poolAddress) {
                routeParts.push(poolAddress);
            }
        }
    }
    return routeParts.join('');
};
export const routeAmountsToString = (routeAmounts) => {
    const total = _.reduce(routeAmounts, (total, cur) => {
        return total.add(cur.amount);
    }, CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const routeStrings = _.map(routeAmounts, ({ protocol, route, amount }) => {
        const portion = amount.divide(total);
        const percent = new Percent(portion.numerator, portion.denominator);
        /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
        return `[${protocol == Protocol.MIXED ? 'V2 + V3' : protocol}] ${percent.toFixed(2)}% = ${routeToString(route)}`;
    });
    return _.join(routeStrings, ', ');
};
export const routeAmountToString = (routeAmount) => {
    const { route, amount } = routeAmount;
    return `${amount.toExact()} = ${routeToString(route)}`;
};
export const poolToString = (p) => {
    return `${p.token0.symbol}/${p.token1.symbol}${p instanceof Pool ? `/${p.fee / 10000}%` : ``}`;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDNUMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDbEQsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSXJFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUNoSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRW5DLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxHQUFHLENBQUM7QUFTbkMseUJBQXlCO0FBQ3pCLE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUE4QjtJQUMzRCxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQ3JCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7SUFDekIsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtJQUNuQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO0lBQ3RCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUc7SUFDckIsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxDQUFFLG1DQUFtQztDQUNoRSxDQUFDO0FBRUYsTUFBTSxVQUFVLGNBQWMs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