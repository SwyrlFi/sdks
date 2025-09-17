"use strict";
// Monkey patch to override Uniswap V3 SDK Pool.getAddress so that
// it is compatible with Sonic and Monad Testnet custom factory addresses
// and init code hashes.
//
// IMPORTANT: this file must be imported **once** at application start-up
// (e.g. in src/index.ts) so the patch is registered before any Pool
// instances are created.
Object.defineProperty(exports, "__esModule", { value: true });
const v3_sdk_1 = require("@swyrlfi/v3-sdk");
const pool_provider_1 = require("../providers/v3/pool-provider");
const addresses_1 = require("../util/addresses");
const chains_1 = require("../util/chains");
const routes_1 = require("../util/routes");
// Keep a reference to the original method so we can fall back to it for
// chains we don't override.
const _originalGetAddress = v3_sdk_1.Pool.getAddress.bind(v3_sdk_1.Pool);
// Override Pool.getAddress with chain-aware implementation.
// @ts-ignore – Pool.getAddress is a static readonly fn in typings, we intentionally patch it.
v3_sdk_1.Pool.getAddress = function patchedGetAddress(tokenA, tokenB, fee, initCodeHashManualOverride, factoryAddressOverride) {
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    switch (token0.chainId) {
        case chains_1.ChainId.SONIC: {
            const tickSpacing = (0, routes_1.getTickSpacing)(fee);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const factoryAddress = factoryAddressOverride !== null && factoryAddressOverride !== void 0 ? factoryAddressOverride : addresses_1.V3_CORE_FACTORY_ADDRESSES[token0.chainId];
            return (0, pool_provider_1.computeV3PoolAddress)({
                factoryAddress,
                tokenA: token0,
                tokenB: token1,
                tickSpacing,
                initCodeHashManualOverride: initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : addresses_1.SONIC_V3_INIT_CODE_HASH,
            });
        }
        case chains_1.ChainId.MONAD_DEVNET:
        case chains_1.ChainId.MONAD_TESTNET: {
            const tickSpacing = (0, routes_1.getTickSpacing)(fee);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const factoryAddress = factoryAddressOverride !== null && factoryAddressOverride !== void 0 ? factoryAddressOverride : addresses_1.V3_CORE_FACTORY_ADDRESSES[token0.chainId];
            return (0, pool_provider_1.computeV3PoolAddress)({
                factoryAddress,
                tokenA: token0,
                tokenB: token1,
                tickSpacing,
                initCodeHashManualOverride: initCodeHashManualOverride !== null && initCodeHashManualOverride !== void 0 ? initCodeHashManualOverride : addresses_1.V3_CORE_INIT_CODE_HASH[token0.chainId],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1nZXRBZGRyZXNzLXBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BhdGNoZXMvcG9vbC1nZXRBZGRyZXNzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxrRUFBa0U7QUFDbEUseUVBQXlFO0FBQ3pFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YseUVBQXlFO0FBQ3pFLG9FQUFvRTtBQUNwRSx5QkFBeUI7O0FBR3pCLDRDQUFrRDtBQUVsRCxpRUFBcUU7QUFDckUsaURBSTJCO0FBQzNCLDJDQUF5QztBQUN6QywyQ0FBZ0Q7QUFFaEQsd0VBQXdFO0FBQ3hFLDRCQUE0QjtBQUM1QixNQUFNLG1CQUFtQixHQUFHLGFBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGFBQUksQ0FBQyxDQUFDO0FBRXZELDREQUE0RDtBQUM1RCw4RkFBOEY7QUFDOUYsYUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLGlCQUFpQixDQUMxQyxNQUFhLEVBQ2IsTUFBYSxFQUNiLEdBQWMsRUFDZCwwQkFBbUMsRUFDbkMsc0JBQStCO0lBRS9CLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRTFGLFFBQVEsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUN0QixLQUFLLGdCQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEIsTUFBTSxXQUFXLEdBQUcsSUFBQSx1QkFBYyxFQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hDLG9FQUFvRTtZQUNwRSxNQUFNLGNBQWMsR0FBRyxzQkFBc0IsYUFBdEIsc0JBQXNCLGNBQXRCLHNCQUFzQixHQUFJLHFDQUF5QixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUUsQ0FBQztZQUM1RixPQUFPLElBQUEsb0NBQW9CLEVBQUM7Z0JBQzFCLGNBQWM7Z0JBQ2QsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsV0FBVztnQkFDWCwwQkFBMEIsRUFBRSwwQkFBMEIsYUFBMUIsMEJBQTBCLGNBQTFCLDBCQUEwQixHQUFJLG1DQUF1QjthQUNsRixDQUFDLENBQUM7U0FDSjtRQUVELEtBQUssZ0JBQU8sQ0FBQyxZQUFZLENBQUM7UUFDMUIsS0FBSyxnQkFBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sV0FBVyxHQUFHLElBQUEsdUJBQWMsRUFBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxvRUFBb0U7WUFDcEUsTUFBTSxjQUFjLEdBQUcsc0JBQXNCLGFBQXRCLHNCQUFzQixjQUF0QixzQkFBc0IsR0FBSSxxQ0FBeUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFFLENBQUM7WUFDNUYsT0FBTyxJQUFBLG9DQUFvQixFQUFDO2dCQUMxQixjQUFjO2dCQUNkLE1BQU0sRUFBRSxNQUFNO2dCQUNkLE1BQU0sRUFBRSxNQUFNO2dCQUNkLFdBQVc7Z0JBQ1gsMEJBQTBCLEVBQ3hCLDBCQUEwQixhQUExQiwwQkFBMEIsY0FBMUIsMEJBQTBCLEdBQUksa0NBQXNCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBRTthQUN4RSxDQUFDLENBQUM7U0FDSjtRQUVEO1lBQ0UsZ0VBQWdFO1lBQ2hFLCtDQUErQztZQUMvQyxPQUFPLG1CQUFtQixDQUN4QixNQUFNLEVBQ04sTUFBTSxFQUNOLEdBQUcsRUFDSCwwQkFBMEIsRUFDMUIsc0JBQXNCLENBQ3ZCLENBQUM7S0FDTDtBQUNILENBQTJCLENBQUM7QUFFNUIscUNBQXFDO0FBQ3JDLE9BQU8sQ0FBQyxJQUFJLENBQUMsNEVBQTRFLENBQUMsQ0FBQyJ9