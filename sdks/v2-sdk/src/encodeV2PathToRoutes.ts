import { Token } from '@swyrlfi/sdk-core'

import { V2RouteStruct } from './entities/V2RouteStruct'

export function encodeV2PathToRoutes(path: Token[], stable: boolean = false): V2RouteStruct[] {
  const routes: V2RouteStruct[] = []
  for (let i = 0; i < path.length - 1; i++) {
    routes.push({
      from: path[i].address,
      to: path[i + 1].address,
      stable: stable,
    })
  }
  return routes
}
