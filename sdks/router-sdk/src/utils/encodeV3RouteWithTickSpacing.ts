import { pack } from '@ethersproject/solidity'
import { Currency } from '@swyrlfi/sdk-core'
import { Route as RouteV3 } from '@swyrlfi/v3-sdk'

// V3 paths are encoded as alternating token addresses and tickSpacings
export function encodeV3RouteWithTickSpacing(route: RouteV3<Currency, Currency>): string {
  const firstInputToken = route.input.wrapped.address
  const { path, types } = route.pools.reduce(
    (
      {
        path,
        types,
        inputToken,
      }: {
        path: (string | number)[]
        types: string[]
        inputToken: string
      },
      pool,
      index
    ): {
      path: (string | number)[]
      types: string[]
      inputToken: string
    } => {
      const outputToken = pool.token0.address === inputToken ? pool.token1.address : pool.token0.address
      if (index === 0) {
        return {
          path: [inputToken, pool.tickSpacing, outputToken],
          types: ['address', 'int24', 'address'],
          inputToken: outputToken,
        }
      } else {
        return {
          path: [...path, pool.tickSpacing, outputToken],
          types: [...types, 'int24', 'address'],
          inputToken: outputToken,
        }
      }
    },
    {
      path: [],
      types: [],
      inputToken: firstInputToken,
    }
  )

  return pack(types, path)
}
