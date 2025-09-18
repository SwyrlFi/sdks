// Monkey patch to override Uniswap V2 SDK Pair.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pair
// instances are created.

import { Token } from '@swyrlfi/sdk-core';
import { Pair } from '@swyrlfi/v2-sdk';

import { computeV2PoolAddress } from '../providers/v2/pool-provider';
import {
  SONIC_PAIR_CODE_HASH,
  SONIC_V2_PAIR_FACTORY_ADDRESS,
  V2_PAIR_CODE_HASH,
  V2_PAIR_FACTORY_ADDRESS,
} from '../util/addresses';
import { ChainId } from '../util/chains';

// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = Pair.getAddress.bind(Pair);

// Override Pair.getAddress with chain-aware implementation.
// @ts-ignore – Pair.getAddress is a static readonly fn in typings, we intentionally patch it.
Pair.getAddress = function patchedGetAddress(tokenA: Token, tokenB: Token): string {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

  switch (token0.chainId) {
    case ChainId.SONIC:
      return computeV2PoolAddress({
        factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
        tokenA: token0,
        tokenB: token1,
        stable: false,
        initCodeHashManualOverride: SONIC_PAIR_CODE_HASH,
      });

    case ChainId.MONAD_TESTNET:
    case ChainId.MONAD_DEVNET:
      return computeV2PoolAddress({
        factoryAddress: V2_PAIR_FACTORY_ADDRESS[token0.chainId]!,
        tokenA: token0,
        tokenB: token1,
        stable: false,
        initCodeHashManualOverride: V2_PAIR_CODE_HASH[token0.chainId]!,
      });

    default:
      return _originalGetAddress(token0, token1, false);
  }
} as typeof Pair.getAddress;

// Log to confirm patching took place
console.info('[Patch] Pair.getAddress overridden for custom chains SONIC / MONAD_TESTNET');

// Optionally export something to make sure file is treated as a module.
export { };
