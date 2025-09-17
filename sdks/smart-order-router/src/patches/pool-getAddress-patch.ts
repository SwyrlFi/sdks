// Monkey patch to override Uniswap V3 SDK Pool.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pool
// instances are created.

import { Token } from '@swyrlfi/sdk-core';
import { FeeAmount, Pool } from '@swyrlfi/v3-sdk';

import { computeV3PoolAddress } from '../providers/v3/pool-provider';
import {
  SONIC_V3_INIT_CODE_HASH,
  V3_CORE_FACTORY_ADDRESSES,
  V3_CORE_INIT_CODE_HASH,
} from '../util/addresses';
import { ChainId } from '../util/chains';
import { getTickSpacing } from '../util/routes';

// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = Pool.getAddress.bind(Pool);

// Override Pool.getAddress with chain-aware implementation.
// @ts-ignore – Pool.getAddress is a static readonly fn in typings, we intentionally patch it.
Pool.getAddress = function patchedGetAddress(
  tokenA: Token,
  tokenB: Token,
  fee: FeeAmount,
  initCodeHashManualOverride?: string,
  factoryAddressOverride?: string
): string {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

  switch (token0.chainId) {
    case ChainId.SONIC: {
      const tickSpacing = getTickSpacing(fee);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const factoryAddress = factoryAddressOverride ?? V3_CORE_FACTORY_ADDRESSES[token0.chainId]!;
      return computeV3PoolAddress({
        factoryAddress,
        tokenA: token0,
        tokenB: token1,
        tickSpacing,
        initCodeHashManualOverride: initCodeHashManualOverride ?? SONIC_V3_INIT_CODE_HASH,
      });
    }

    case ChainId.MONAD_DEVNET:
    case ChainId.MONAD_TESTNET: {
      const tickSpacing = getTickSpacing(fee);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const factoryAddress = factoryAddressOverride ?? V3_CORE_FACTORY_ADDRESSES[token0.chainId]!;
      return computeV3PoolAddress({
        factoryAddress,
        tokenA: token0,
        tokenB: token1,
        tickSpacing,
        initCodeHashManualOverride:
          initCodeHashManualOverride ?? V3_CORE_INIT_CODE_HASH[token0.chainId]!,
      });
    }

    default:
      // Fall back to the original implementation for all other chains
      // and preserve support for optional overrides.
      return _originalGetAddress(
        token0,
        token1,
        fee,
        initCodeHashManualOverride,
        factoryAddressOverride
      );
  }
} as typeof Pool.getAddress;

// Log to confirm patching took place
console.info('[Patch] Pool.getAddress overridden for custom chains SONIC / MONAD_TESTNET');

// Optionally export something to make sure file is treated as a module.
export {};

