import JSBI from 'jsbi'

import {
  ChainId,
  Percent,
  V2_FACTORY_ADDRESSES,
} from '@uniswap/sdk-core'

/**
 * @deprecated use FACTORY_ADDRESS_MAP instead
 */
export const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

export const FACTORY_ADDRESS_MAP: { [chainId: number]: string } = V2_FACTORY_ADDRESSES

export const INIT_CODE_HASH = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'
export const MONAD_TESTNET_INIT_CODE_HASH = '0x28f057eb10da72aade0047686c8d43fc740a89cfc1ac1453aaf4e184c78d4627'

export function initCodeHash(chainId: number): string {
  switch (chainId) {
    case ChainId.MONAD_TESTNET:
      return MONAD_TESTNET_INIT_CODE_HASH
    default:
      return INIT_CODE_HASH
  }
}

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
export const BASIS_POINTS = JSBI.BigInt(10000)

export const ZERO_PERCENT = new Percent(ZERO)
export const ONE_HUNDRED_PERCENT = new Percent(ONE)
