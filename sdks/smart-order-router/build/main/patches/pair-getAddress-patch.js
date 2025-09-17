"use strict";
// Monkey patch to override Uniswap V2 SDK Pair.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pair
// instances are created.
Object.defineProperty(exports, "__esModule", { value: true });
const v2_sdk_1 = require("@swyrlfi/v2-sdk");
const pool_provider_1 = require("../providers/v2/pool-provider");
const addresses_1 = require("../util/addresses");
const chains_1 = require("../util/chains");
// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = v2_sdk_1.Pair.getAddress.bind(v2_sdk_1.Pair);
// Override Pair.getAddress with chain-aware implementation.
// @ts-ignore – Pair.getAddress is a static readonly fn in typings, we intentionally patch it.
v2_sdk_1.Pair.getAddress = function patchedGetAddress(tokenA, tokenB) {
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    switch (token0.chainId) {
        case chains_1.ChainId.SONIC:
            return (0, pool_provider_1.computeV2PoolAddress)({
                factoryAddress: addresses_1.SONIC_V2_PAIR_FACTORY_ADDRESS,
                tokenA: token0,
                tokenB: token1,
                stable: false,
                initCodeHashManualOverride: addresses_1.SONIC_PAIR_CODE_HASH,
            });
        case chains_1.ChainId.MONAD_TESTNET:
        case chains_1.ChainId.MONAD_DEVNET:
            return (0, pool_provider_1.computeV2PoolAddress)({
                factoryAddress: addresses_1.V2_PAIR_FACTORY_ADDRESS[token0.chainId],
                tokenA: token0,
                tokenB: token1,
                stable: false,
                initCodeHashManualOverride: addresses_1.V2_PAIR_CODE_HASH[token0.chainId],
            });
        default:
            return _originalGetAddress(token0, token1);
    }
};
// Log to confirm patching took place
console.info('[Patch] Pair.getAddress overridden for custom chains SONIC / MONAD_TESTNET');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFpci1nZXRBZGRyZXNzLXBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BhdGNoZXMvcGFpci1nZXRBZGRyZXNzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxrRUFBa0U7QUFDbEUseUVBQXlFO0FBQ3pFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YseUVBQXlFO0FBQ3pFLG9FQUFvRTtBQUNwRSx5QkFBeUI7O0FBR3pCLDRDQUF1QztBQUV2QyxpRUFBcUU7QUFDckUsaURBSzJCO0FBQzNCLDJDQUF5QztBQUV6Qyx3RUFBd0U7QUFDeEUsNEJBQTRCO0FBQzVCLE1BQU0sbUJBQW1CLEdBQUcsYUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBSSxDQUFDLENBQUM7QUFFdkQsNERBQTREO0FBQzVELDhGQUE4RjtBQUM5RixhQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsaUJBQWlCLENBQUMsTUFBYSxFQUFFLE1BQWE7SUFDdkUsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFMUYsUUFBUSxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ3RCLEtBQUssZ0JBQU8sQ0FBQyxLQUFLO1lBQ2hCLE9BQU8sSUFBQSxvQ0FBb0IsRUFBQztnQkFDMUIsY0FBYyxFQUFFLHlDQUE2QjtnQkFDN0MsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsMEJBQTBCLEVBQUUsZ0NBQW9CO2FBQ2pELENBQUMsQ0FBQztRQUVMLEtBQUssZ0JBQU8sQ0FBQyxhQUFhLENBQUM7UUFDM0IsS0FBSyxnQkFBTyxDQUFDLFlBQVk7WUFDdkIsT0FBTyxJQUFBLG9DQUFvQixFQUFDO2dCQUMxQixjQUFjLEVBQUUsbUNBQXVCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBRTtnQkFDeEQsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsMEJBQTBCLEVBQUUsNkJBQWlCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBRTthQUMvRCxDQUFDLENBQUM7UUFFTDtZQUNFLE9BQU8sbUJBQW1CLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0tBQzlDO0FBQ0gsQ0FBMkIsQ0FBQztBQUU1QixxQ0FBcUM7QUFDckMsT0FBTyxDQUFDLElBQUksQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDIn0=