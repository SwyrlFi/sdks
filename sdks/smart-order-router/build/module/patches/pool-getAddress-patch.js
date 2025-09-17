// Monkey patch to override Uniswap V3 SDK Pool.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pool
// instances are created.
import { Pool } from '@swyrlfi/v3-sdk';
import { computeV3PoolAddress } from '../providers/v3/pool-provider';
import { SONIC_V3_INIT_CODE_HASH, V3_CORE_FACTORY_ADDRESSES, V3_CORE_INIT_CODE_HASH, } from '../util/addresses';
import { ChainId } from '../util/chains';
import { getTickSpacing } from '../util/routes';
// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = Pool.getAddress.bind(Pool);
// Override Pool.getAddress with chain-aware implementation.
// @ts-ignore – Pool.getAddress is a static readonly fn in typings, we intentionally patch it.
Pool.getAddress = function patchedGetAddress(tokenA, tokenB, fee, initCodeHashManualOverride, factoryAddressOverride) {
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    switch (token0.chainId) {
        case ChainId.SONIC: {
            const tickSpacing = getTickSpacing(fee);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const factoryAddress = factoryAddressOverride !== null && factoryAddressOverride !== void 0 ? factoryAddressOverride : V3_CORE_FACTORY_ADDRESSES[token0.chainId];
            return computeV3PoolAddress({
                factoryAddress,
                tokenA: token0,
                tokenB: token1,
                tickSpacing,
                initCodeHashManualOverride: initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : SONIC_V3_INIT_CODE_HASH,
            });
        }
        case ChainId.MONAD_DEVNET:
        case ChainId.MONAD_TESTNET: {
            const tickSpacing = getTickSpacing(fee);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const factoryAddress = factoryAddressOverride !== null && factoryAddressOverride !== void 0 ? factoryAddressOverride : V3_CORE_FACTORY_ADDRESSES[token0.chainId];
            return computeV3PoolAddress({
                factoryAddress,
                tokenA: token0,
                tokenB: token1,
                tickSpacing,
                initCodeHashManualOverride: initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : V3_CORE_INIT_CODE_HASH[token0.chainId],
            });
        }
        default:
            // Fall back to the original implementation for all other chains
            // and preserve support for optional overrides.
            return _originalGetAddress(token0, token1, fee, initCodeHashManualOverride, factoryAddressOverride);
    }
};
// Log to confirm patching took place
console.info('[Patch] Pool.getAddress overridden for custom chains SONIC / MONAD_TESTNET');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1nZXRBZGRyZXNzLXBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BhdGNoZXMvcG9vbC1nZXRBZGRyZXNzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtFQUFrRTtBQUNsRSx5RUFBeUU7QUFDekUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRix5RUFBeUU7QUFDekUsb0VBQW9FO0FBQ3BFLHlCQUF5QjtBQUd6QixPQUFPLEVBQWEsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFbEQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDckUsT0FBTyxFQUNMLHVCQUF1QixFQUN2Qix5QkFBeUIsRUFDekIsc0JBQXNCLEdBQ3ZCLE1BQU0sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3pDLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVoRCx3RUFBd0U7QUFDeEUsNEJBQTRCO0FBQzVCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFdkQsNERBQTREO0FBQzVELDhGQUE4RjtBQUM5RixJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsaUJBQWlCLENBQzFDLE1BQWEsRUFDYixNQUFhLEVBQ2IsR0FBYyxFQUNkLDBCQUFtQyxFQUNuQyxzQkFBK0I7SUFFL0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFMUYsUUFBUSxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ3RCLEtBQUssT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xCLE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxvRUFBb0U7WUFDcEUsTUFBTSxjQUFjLEdBQUcsc0JBQXNCLGFBQXRCLHNCQUFzQixjQUF0QixzQkFBc0IsR0FBSSx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFFLENBQUM7WUFDNUYsT0FBTyxvQkFBb0IsQ0FBQztnQkFDMUIsY0FBYztnQkFDZCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxXQUFXO2dCQUNYLDBCQUEwQixFQUFFLDBCQUEwQixhQUExQiwwQkFBMEIsY0FBMUIsMEJBQTBCLEdBQUksdUJBQXVCO2FBQ2xGLENBQUMsQ0FBQztTQUNKO1FBRUQsS0FBSyxPQUFPLENBQUMsWUFBWSxDQUFDO1FBQzFCLEtBQUssT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxvRUFBb0U7WUFDcEUsTUFBTSxjQUFjLEdBQUcsc0JBQXNCLGFBQXRCLHNCQUFzQixjQUF0QixzQkFBc0IsR0FBSSx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFFLENBQUM7WUFDNUYsT0FBTyxvQkFBb0IsQ0FBQztnQkFDMUIsY0FBYztnQkFDZCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxXQUFXO2dCQUNYLDBCQUEwQixFQUN4QiwwQkFBMEIsYUFBMUIsMEJBQTBCLGNBQTFCLDBCQUEwQixHQUFJLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUU7YUFDeEUsQ0FBQyxDQUFDO1NBQ0o7UUFFRDtZQUNFLGdFQUFnRTtZQUNoRSwrQ0FBK0M7WUFDL0MsT0FBTyxtQkFBbUIsQ0FDeEIsTUFBTSxFQUNOLE1BQU0sRUFDTixHQUFHLEVBQ0gsMEJBQTBCLEVBQzFCLHNCQUFzQixDQUN2QixDQUFDO0tBQ0w7QUFDSCxDQUEyQixDQUFDO0FBRTVCLHFDQUFxQztBQUNyQyxPQUFPLENBQUMsSUFBSSxDQUFDLDRFQUE0RSxDQUFDLENBQUMifQ==