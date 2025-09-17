import { defaultAbiCoder } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'
import {
  ChainId,
  computeZksyncCreate2Address,
  Token,
} from '@swyrlfi/sdk-core'

import {
  FeeAmount,
  poolInitCodeHash,
  TICK_SPACINGS,
} from '../constants'

/**
 * Computes a pool address
 * @param factoryAddress The Uniswap V3 factory address
 * @param tokenA The first token of the pair, irrespective of sort order
 * @param tokenB The second token of the pair, irrespective of sort order
 * @param fee The fee tier of the pool
 * @param initCodeHashManualOverride Override the init code hash used to compute the pool address if necessary
 * @param chainId
 * @returns The pool address
 */
export function computePoolAddress({
  factoryAddress,
  tokenA,
  tokenB,
  fee,
  initCodeHashManualOverride,
  chainId,
}: {
  factoryAddress: string
  tokenA: Token
  tokenB: Token
  fee: FeeAmount
  initCodeHashManualOverride?: string
  chainId?: ChainId
}): string {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

  let salt = ''
  if (chainId === ChainId.MONAD_TESTNET || chainId === ChainId.MONAD_DEVNET) {
    const tickSpacing = TICK_SPACINGS[fee]
    // 修改 salt 计算方式以匹配合约
    salt = keccak256(
      ['bytes'],
      [
        defaultAbiCoder.encode(
          ['address', 'address', 'int24'],
          [token0.address.toLowerCase(), token1.address.toLowerCase(), tickSpacing]
        ),
      ]
    )
    if (chainId === ChainId.MONAD_TESTNET) {
      factoryAddress = '0xCd07Ba03917c8806a0ecfc0783246288B62360b4'
    } else if (chainId === ChainId.MONAD_DEVNET) {
      factoryAddress = '0xF3A43f6416321715772341081CcF63921be431fc' // MONAD_DEVNET_V3_POOL_DEPLOYER_ADDRESS
    }
  } else {
    salt = keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    )
  }

  const initCodeHash = initCodeHashManualOverride ?? poolInitCodeHash(chainId)

  // ZKSync uses a different create2 address computation
  // Most likely all ZKEVM chains will use the different computation from standard create2
  switch (chainId) {
    case ChainId.ZKSYNC:
      return computeZksyncCreate2Address(factoryAddress, initCodeHash, salt)
    case ChainId.MONAD_TESTNET:
    case ChainId.MONAD_DEVNET:
      return getCreate2Address(factoryAddress, salt, initCodeHash)
    default:
      return getCreate2Address(factoryAddress, salt, initCodeHash)
  }
}
