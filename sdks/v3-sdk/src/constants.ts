import { ChainId } from '@swyrlfi/sdk-core'

export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

// @deprecated please use poolInitCodeHash(chainId: ChainId)
export const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54'

export function factoryAddress(chainId?: ChainId): string {
  switch (chainId) {
    case ChainId.MONAD_TESTNET:
      return '0xCd07Ba03917c8806a0ecfc0783246288B62360b4'
    case ChainId.MONAD_DEVNET:
      return '0xF3A43f6416321715772341081CcF63921be431fc' // MONAD_DEVNET_V3_POOL_DEPLOYER_ADDRESS
    case ChainId.MONAD_MAINNET:
      return '0x66ae3f94EB3Ab532cC4F8fC8700f6d7488E40A4f' // SWYRL_V3_POOL_DEPLOYER
    default:
      return FACTORY_ADDRESS
  }
}

export function poolInitCodeHash(chainId?: ChainId): string {
  switch (chainId) {
    case ChainId.ZKSYNC:
      return '0x010013f177ea1fcbc4520f9a3ca7cd2d1d77959e05aa66484027cb38e712aeed'
    case ChainId.MONAD_TESTNET:
      return '0x96fa0c0344e6345992578dc7aa796e013cc8936d915bdab22970e6589186d66e'
    case ChainId.MONAD_DEVNET:
      return '0x9c0dcbe0f8215e47692e186e3307ee853768f2bdce8680e3cc6fcfe1ca1dfe7a'
    case ChainId.MONAD_MAINNET:
      return '0x7e6dcaf163badb2918dfe51971699b6a44b70f0cb9104f86f911fd3b3e8b3bcd'
    default:
      return POOL_INIT_CODE_HASH
  }
}

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
export enum FeeAmount {
  LOWEST = 100,
  LOWEST_250 = 250,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
  HIGHEST = 20000,
}

// 定义费用和tick spacing的映射关系
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOWEST]: 1, // 0.01% fee -> 1 bps tickSpacing
  [FeeAmount.LOWEST_250]: 5, // 0.025% fee -> 5 bps tickSpacing
  [FeeAmount.LOW]: 10, // 0.05% fee -> 10 bps tickSpacing
  [FeeAmount.MEDIUM]: 50, // 0.30% fee -> 50 bps tickSpacing
  [FeeAmount.HIGH]: 100, // 1.00% fee -> 100 bps tickSpacing
  [FeeAmount.HIGHEST]: 200, // 2.00% fee -> 200 bps tickSpacing
}
