// Monkey patch to override Uniswap V2 SDK Pair.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pair
// instances are created.
import { Pair } from '@swyrlfi/v2-sdk';
import { computeV2PoolAddress } from '../providers/v2/pool-provider';
import { SONIC_PAIR_CODE_HASH, SONIC_V2_PAIR_FACTORY_ADDRESS, V2_PAIR_CODE_HASH, V2_PAIR_FACTORY_ADDRESS, } from '../util/addresses';
import { ChainId } from '../util/chains';
// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = Pair.getAddress.bind(Pair);
// Override Pair.getAddress with chain-aware implementation.
// @ts-ignore – Pair.getAddress is a static readonly fn in typings, we intentionally patch it.
Pair.getAddress = function patchedGetAddress(tokenA, tokenB) {
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
                factoryAddress: V2_PAIR_FACTORY_ADDRESS[token0.chainId],
                tokenA: token0,
                tokenB: token1,
                stable: false,
                initCodeHashManualOverride: V2_PAIR_CODE_HASH[token0.chainId],
            });
        default:
            return _originalGetAddress(token0, token1);
    }
};
// Log to confirm patching took place
console.info('[Patch] Pair.getAddress overridden for custom chains SONIC / MONAD_TESTNET');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFpci1nZXRBZGRyZXNzLXBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BhdGNoZXMvcGFpci1nZXRBZGRyZXNzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtFQUFrRTtBQUNsRSx5RUFBeUU7QUFDekUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRix5RUFBeUU7QUFDekUsb0VBQW9FO0FBQ3BFLHlCQUF5QjtBQUd6QixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFdkMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDckUsT0FBTyxFQUNMLG9CQUFvQixFQUNwQiw2QkFBNkIsRUFDN0IsaUJBQWlCLEVBQ2pCLHVCQUF1QixHQUN4QixNQUFNLG1CQUFtQixDQUFDO0FBQzNCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUV6Qyx3RUFBd0U7QUFDeEUsNEJBQTRCO0FBQzVCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFdkQsNERBQTREO0FBQzVELDhGQUE4RjtBQUM5RixJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsaUJBQWlCLENBQUMsTUFBYSxFQUFFLE1BQWE7SUFDdkUsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFMUYsUUFBUSxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ3RCLEtBQUssT0FBTyxDQUFDLEtBQUs7WUFDaEIsT0FBTyxvQkFBb0IsQ0FBQztnQkFDMUIsY0FBYyxFQUFFLDZCQUE2QjtnQkFDN0MsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsMEJBQTBCLEVBQUUsb0JBQW9CO2FBQ2pELENBQUMsQ0FBQztRQUVMLEtBQUssT0FBTyxDQUFDLGFBQWEsQ0FBQztRQUMzQixLQUFLLE9BQU8sQ0FBQyxZQUFZO1lBQ3ZCLE9BQU8sb0JBQW9CLENBQUM7Z0JBQzFCLGNBQWMsRUFBRSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFFO2dCQUN4RCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxNQUFNLEVBQUUsS0FBSztnQkFDYiwwQkFBMEIsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFFO2FBQy9ELENBQUMsQ0FBQztRQUVMO1lBQ0UsT0FBTyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7S0FDOUM7QUFDSCxDQUEyQixDQUFDO0FBRTVCLHFDQUFxQztBQUNyQyxPQUFPLENBQUMsSUFBSSxDQUFDLDRFQUE0RSxDQUFDLENBQUMifQ==