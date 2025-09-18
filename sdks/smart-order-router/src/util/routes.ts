import { Protocol } from '@swyrlfi/router-sdk';
import { Percent } from '@swyrlfi/sdk-core';
import { Pair } from '@swyrlfi/v2-sdk';
import { FeeAmount, Pool } from '@swyrlfi/v3-sdk';
import _ from 'lodash';

import { computeV2PoolAddress } from '../providers/v2/pool-provider';
import { computeV3PoolAddress } from '../providers/v3/pool-provider';
import { RouteWithValidQuote } from '../routers/alpha-router';
import { MixedRoute, V2Route, V3Route } from '../routers/router';

import { SONIC_V2_PAIR_FACTORY_ADDRESS, V2_PAIR_FACTORY_ADDRESS, V3_CORE_FACTORY_ADDRESSES } from './addresses';
import { ChainId } from './chains';

import { CurrencyAmount } from '.';


// Extend the Pair interface to support Sonic V2 pairs
export interface SonicPair extends Pair { }

// 定义费用和tick spacing的映射关系
export const FeeAmountTickSpacing: { [key: number]: number } = {
  [FeeAmount.LOWEST]: 1,    // 0.01% fee -> 1 bps tickSpacing
  [FeeAmount.LOWEST_250]: 5,    // 0.025% fee -> 5 bps tickSpacing
  [FeeAmount.LOW]: 10,   // 0.05% fee -> 10 bps tickSpacing
  [FeeAmount.MEDIUM]: 50,  // 0.30% fee -> 50 bps tickSpacing
  [FeeAmount.HIGH]: 100, // 1.00% fee -> 100 bps tickSpacing
  [FeeAmount.HIGHEST]: 200  // 2.00% fee -> 200 bps tickSpacing
};

export function getTickSpacing(fee: number): number {
  // 检查给定的费用是否在映射中
  if (fee in FeeAmountTickSpacing) {
    return FeeAmountTickSpacing[fee] as number;
  }

  // 如果费用不在预定义的映射中，抛出错误
  throw new Error(
    `Fee amount ${fee} not supported. Supported fees are: 100 (0.01%), 250 (0.025%), 500 (0.05%), 3000 (0.30%), 10000 (1.00%), 20000 (2.00%)`
  );
}

export const routeToString = (
  route: V3Route | V2Route | MixedRoute
): string => {
  // Get tokens from the route
  const tokens = route.protocol === Protocol.V3 ? route.tokenPath : route.path;

  // Get pools/pairs from the route
  const pools = route.protocol === Protocol.V3 || route.protocol === Protocol.MIXED
    ? route.pools
    : route.pairs;

  // Convert tokens to symbols, using 'UNKNOWN' as fallback
  const tokenSymbols = tokens.map(token => token.symbol || 'UNKNOWN');

  // Convert pools to address strings
  const poolAddresses = pools.map((pool): string => {
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
        } catch (error) {
          return ` -- [V2_ADDRESS_ERROR] --> `;
        }
      } else if ([ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(pair.chainId)) {
        const factoryAddress = V2_PAIR_FACTORY_ADDRESS[pair.chainId]!;
        try {
          const address = computeV2PoolAddress({
            factoryAddress,
            tokenA: pair.token0,
            tokenB: pair.token1,
            stable: false,
          });
          return ` -- [${address}] --> `;
        } catch (error) {
          return ` -- [V2_ADDRESS_ERROR] --> `;
        }
      } else {
        // Use default Pair.getAddress() for all other chains
        try {
          const address = Pair.getAddress(pair.token0, pair.token1, false);
          return ` -- [${address}] --> `;
        } catch (error) {
          return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
        }
      }
    } else {
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
        } catch (error) {
          return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
        }
      } else if ([ChainId.MONAD_TESTNET, ChainId.MONAD_DEVNET].includes(pool.chainId)) {
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
        } catch (error) {
          return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
        }
      } else {
        // Use default Pair.getAddress() for all other chains
        try {
          const address = Pool.getAddress(
            pool.token0,
            pool.token1,
            pool.fee,
            undefined,
            V3_CORE_FACTORY_ADDRESSES[pool.chainId]
          )
          return ` -- [${address}] --> `;
        } catch (error) {
          return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
        }
      }
    }
  });

  // Build the route string by interleaving tokens and pools
  const routeParts: string[] = [];

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

export const routeAmountsToString = (
  routeAmounts: RouteWithValidQuote[]
): string => {
  const total = _.reduce(
    routeAmounts,
    (total: CurrencyAmount, cur: RouteWithValidQuote) => {
      return total.add(cur.amount);
    },
    CurrencyAmount.fromRawAmount(routeAmounts[0]!.amount.currency, 0)
  );

  const routeStrings = _.map(routeAmounts, ({ protocol, route, amount }) => {
    const portion = amount.divide(total);
    const percent = new Percent(portion.numerator, portion.denominator);
    /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
    return `[${protocol == Protocol.MIXED ? 'V2 + V3' : protocol
      }] ${percent.toFixed(2)}% = ${routeToString(route)}`;
  });

  return _.join(routeStrings, ', ');
};

export const routeAmountToString = (
  routeAmount: RouteWithValidQuote
): string => {
  const { route, amount } = routeAmount;
  return `${amount.toExact()} = ${routeToString(route)}`;
};

export const poolToString = (p: Pool | Pair): string => {
  return `${p.token0.symbol}/${p.token1.symbol}${p instanceof Pool ? `/${p.fee / 10000}%` : ``
    }`;
};
