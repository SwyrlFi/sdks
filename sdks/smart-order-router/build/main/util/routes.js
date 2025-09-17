"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolToString = exports.routeAmountToString = exports.routeAmountsToString = exports.routeToString = exports.getTickSpacing = exports.FeeAmountTickSpacing = void 0;
const router_sdk_1 = require("@swyrlfi/router-sdk");
const sdk_core_1 = require("@swyrlfi/sdk-core");
const v2_sdk_1 = require("@swyrlfi/v2-sdk");
const v3_sdk_1 = require("@swyrlfi/v3-sdk");
const lodash_1 = __importDefault(require("lodash"));
const pool_provider_1 = require("../providers/v2/pool-provider");
const pool_provider_2 = require("../providers/v3/pool-provider");
const addresses_1 = require("./addresses");
const chains_1 = require("./chains");
const _1 = require(".");
// 定义费用和tick spacing的映射关系
exports.FeeAmountTickSpacing = {
    [v3_sdk_1.FeeAmount.LOWEST]: 1,
    [v3_sdk_1.FeeAmount.LOWEST_250]: 5,
    [v3_sdk_1.FeeAmount.LOW]: 10,
    [v3_sdk_1.FeeAmount.MEDIUM]: 50,
    [v3_sdk_1.FeeAmount.HIGH]: 100,
    [v3_sdk_1.FeeAmount.HIGHEST]: 200 // 2.00% fee -> 200 bps tickSpacing
};
function getTickSpacing(fee) {
    // 检查给定的费用是否在映射中
    if (fee in exports.FeeAmountTickSpacing) {
        return exports.FeeAmountTickSpacing[fee];
    }
    // 如果费用不在预定义的映射中，抛出错误
    throw new Error(`Fee amount ${fee} not supported. Supported fees are: 100 (0.01%), 250 (0.025%), 500 (0.05%), 3000 (0.30%), 10000 (1.00%), 20000 (2.00%)`);
}
exports.getTickSpacing = getTickSpacing;
const routeToString = (route) => {
    // Get tokens from the route
    const tokens = route.protocol === router_sdk_1.Protocol.V3 ? route.tokenPath : route.path;
    // Get pools/pairs from the route
    const pools = route.protocol === router_sdk_1.Protocol.V3 || route.protocol === router_sdk_1.Protocol.MIXED
        ? route.pools
        : route.pairs;
    // Convert tokens to symbols, using 'UNKNOWN' as fallback
    const tokenSymbols = tokens.map(token => token.symbol || 'UNKNOWN');
    // Convert pools to address strings
    const poolAddresses = pools.map((pool) => {
        if (pool instanceof v2_sdk_1.Pair) {
            const pair = pool;
            // Only use special address computation for Sonic chain
            if (pair.chainId === chains_1.ChainId.SONIC) {
                const factoryAddress = addresses_1.SONIC_V2_PAIR_FACTORY_ADDRESS;
                try {
                    const address = (0, pool_provider_1.computeV2PoolAddress)({
                        factoryAddress,
                        tokenA: pair.token0,
                        tokenB: pair.token1,
                        stable: false,
                    });
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_ADDRESS_ERROR] --> `;
                }
            }
            else if ([chains_1.ChainId.MONAD_TESTNET, chains_1.ChainId.MONAD_DEVNET].includes(pair.chainId)) {
                const factoryAddress = addresses_1.V2_PAIR_FACTORY_ADDRESS[pair.chainId];
                try {
                    const address = (0, pool_provider_1.computeV2PoolAddress)({
                        factoryAddress,
                        tokenA: pair.token0,
                        tokenB: pair.token1,
                        stable: false,
                    });
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_ADDRESS_ERROR] --> `;
                }
            }
            else {
                // Use default Pair.getAddress() for all other chains
                try {
                    const address = v2_sdk_1.Pair.getAddress(pair.token0, pair.token1);
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
                }
            }
        }
        else {
            if (pool.chainId === chains_1.ChainId.SONIC) {
                const factoryAddress = addresses_1.V3_CORE_FACTORY_ADDRESSES[pool.chainId];
                if (!factoryAddress) {
                    return ` -- ${pool.fee / 10000}% [V3_FACTORY_NOT_FOUND] --> `;
                }
                try {
                    const address = (0, pool_provider_2.computeV3PoolAddress)({
                        factoryAddress,
                        tokenA: pool.token0,
                        tokenB: pool.token1,
                        tickSpacing: pool.tickSpacing,
                    });
                    return ` -- ${pool.fee / 10000}% [${address}] --> `;
                }
                catch (error) {
                    return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
                }
            }
            else if ([chains_1.ChainId.MONAD_TESTNET, chains_1.ChainId.MONAD_DEVNET].includes(pool.chainId)) {
                const factoryAddress = addresses_1.V3_CORE_FACTORY_ADDRESSES[pool.chainId];
                if (!factoryAddress) {
                    return ` -- ${pool.fee / 10000}% [V3_FACTORY_NOT_FOUND] --> `;
                }
                try {
                    const address = (0, pool_provider_2.computeV3PoolAddress)({
                        factoryAddress,
                        tokenA: pool.token0,
                        tokenB: pool.token1,
                        tickSpacing: pool.tickSpacing,
                    });
                    return ` -- ${pool.fee / 10000}% [${address}] --> `;
                }
                catch (error) {
                    return ` -- ${pool.fee / 10000}% [V3_ADDRESS_ERROR] --> `;
                }
            }
            else {
                // Use default Pair.getAddress() for all other chains
                try {
                    const address = v3_sdk_1.Pool.getAddress(pool.token0, pool.token1, pool.fee, undefined, addresses_1.V3_CORE_FACTORY_ADDRESSES[pool.chainId]);
                    return ` -- [${address}] --> `;
                }
                catch (error) {
                    return ` -- [V2_DEFAULT_ADDRESS_ERROR] --> `;
                }
            }
        }
    });
    // Build the route string by interleaving tokens and pools
    const routeParts = [];
    // Ensure both arrays have valid elements
    if (tokenSymbols.length === 0) {
        return '';
    }
    // Build the path string
    for (let i = 0; i < tokenSymbols.length; i++) {
        const symbol = tokenSymbols[i];
        if (symbol) {
            routeParts.push(symbol);
            const poolAddress = i < poolAddresses.length ? poolAddresses[i] : undefined;
            if (poolAddress) {
                routeParts.push(poolAddress);
            }
        }
    }
    return routeParts.join('');
};
exports.routeToString = routeToString;
const routeAmountsToString = (routeAmounts) => {
    const total = lodash_1.default.reduce(routeAmounts, (total, cur) => {
        return total.add(cur.amount);
    }, _1.CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const routeStrings = lodash_1.default.map(routeAmounts, ({ protocol, route, amount }) => {
        const portion = amount.divide(total);
        const percent = new sdk_core_1.Percent(portion.numerator, portion.denominator);
        /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
        return `[${protocol == router_sdk_1.Protocol.MIXED ? 'V2 + V3' : protocol}] ${percent.toFixed(2)}% = ${(0, exports.routeToString)(route)}`;
    });
    return lodash_1.default.join(routeStrings, ', ');
};
exports.routeAmountsToString = routeAmountsToString;
const routeAmountToString = (routeAmount) => {
    const { route, amount } = routeAmount;
    return `${amount.toExact()} = ${(0, exports.routeToString)(route)}`;
};
exports.routeAmountToString = routeAmountToString;
const poolToString = (p) => {
    return `${p.token0.symbol}/${p.token1.symbol}${p instanceof v3_sdk_1.Pool ? `/${p.fee / 10000}%` : ``}`;
};
exports.poolToString = poolToString;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLG9EQUErQztBQUMvQyxnREFBNEM7QUFDNUMsNENBQXVDO0FBQ3ZDLDRDQUFrRDtBQUNsRCxvREFBdUI7QUFFdkIsaUVBQXFFO0FBQ3JFLGlFQUFxRTtBQUlyRSwyQ0FBZ0g7QUFDaEgscUNBQW1DO0FBRW5DLHdCQUFtQztBQVNuQyx5QkFBeUI7QUFDWixRQUFBLG9CQUFvQixHQUE4QjtJQUMzRCxDQUFDLGtCQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUNyQixDQUFDLGtCQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUN6QixDQUFDLGtCQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtJQUNuQixDQUFDLGtCQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRTtJQUN0QixDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRztJQUNyQixDQUFDLGtCQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxDQUFFLG1DQUFtQztDQUNoRSxDQUFDO0FBRUYsU0FBZ0IsY0FBYyxDQUFDLEdBQVc7SUFDeEMsZ0JBQWdCO0lBQ2hCLElBQUksR0FBRyxJQUFJLDRCQUFvQixFQUFFO1FBQzdCLE9BQU8sNEJBQW9CLENBQUMsR0FBRyxDQUFXLENBQUM7S0FDOUM7SUFFRCxxQkFBcUI7SUFDckIsTUFBTSxJQUFJLEtBQUssQ0FDWCxjQUFjLEdBQUcsd0hBQXdILENBQzVJLENBQUM7QUFDSixDQUFDO0FBVkQsd0NBVUM7QUFFTSxNQUFNLGFBQWEsR0FBRyxDQUMzQixLQUFxQyxFQUM3QixFQUFFO0lBQ1YsNEJBQTRCO0lBQzVCLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxRQUFRLEtBQUsscUJBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFFN0UsaUNBQWlDO0lBQ2pDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLEtBQUsscUJBQVEsQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxxQkFBUSxDQUFDLEtBQUs7UUFDL0UsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLO1FBQ2IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFFaEIseURBQXlEO0lBQ3pELE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxDQUFDO0lBRXBFLG1DQUFtQztJQUNuQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFVLEVBQUU7UUFDL0MsSUFBSSxJQUFJLFlBQVksYUFBSSxFQUFFO1lBQ3hCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztZQUVsQix1REFBdUQ7WUFDdkQsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLGdCQUFPLENBQUMsS0FBSyxFQUFFO2dCQUNsQyxNQUFNLGNBQWMsR0FBRyx5Q0FBNkIsQ0FBQztnQkFDckQsSUFBSTtvQkFDRixNQUFNLE9BQU8sR0FBRyxJQUFBLG9DQUFvQixFQUFDO3dCQUNuQyxjQUFjO3dCQUNkLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTt3QkFDbkIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO3dCQUNuQixNQUFNLEVBQUUsS0FBSztxQkFDZCxDQUFDLENBQUM7b0JBQ0gsT0FBTyxRQUFRLE9BQU8sUUFBUSxDQUFDO2lCQUNoQztnQkFBQyxPQUFPLEtBQUssRUFBRTtvQkFDZCxPQUFPLDZCQUE2QixDQUFDO2lCQUN0QzthQUNGO2lCQUFNLElBQUksQ0FBQyxnQkFBTyxDQUFDLGFBQWEsRUFBRSxnQkFBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQy9FLE1BQU0sY0FBYyxHQUFHLG1DQUF1QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUUsQ0FBQztnQkFDOUQsSUFBSTtvQkFDRixNQUFNLE9BQU8sR0FBRyxJQUFBLG9DQUFvQixFQUFDO3dCQUNuQyxjQUFjO3dCQUNkLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTt3QkFDbkIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO3dCQUNuQixNQUFNLEVBQUUsS0FBSztxQkFDZCxDQUFDLENBQUM7b0JBQ0gsT0FBTyxRQUFRLE9BQU8sUUFBUSxDQUFDO2lCQUNoQztnQkFBQyxPQUFPLEtBQUssRUFBRTtvQkFDZCxPQUFPLDZCQUE2QixDQUFDO2lCQUN0QzthQUNGO2lCQUFNO2dCQUNMLHFEQUFxRDtnQkFDckQsSUFBSTtvQkFDRixNQUFNLE9BQU8sR0FBRyxhQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMxRCxPQUFPLFFBQVEsT0FBTyxRQUFRLENBQUM7aUJBQ2hDO2dCQUFDLE9BQU8sS0FBSyxFQUFFO29CQUNkLE9BQU8scUNBQXFDLENBQUM7aUJBQzlDO2FBQ0Y7U0FDRjthQUFNO1lBQ0wsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLGdCQUFPLENBQUMsS0FBSyxFQUFFO2dCQUNsQyxNQUFNLGNBQWMsR0FBRyxxQ0FBeUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQy9ELElBQUksQ0FBQyxjQUFjLEVBQUU7b0JBQ25CLE9BQU8sT0FBTyxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssK0JBQStCLENBQUM7aUJBQy9EO2dCQUNELElBQUk7b0JBQ0YsTUFBTSxPQUFPLEdBQUcsSUFBQSxvQ0FBb0IsRUFBQzt3QkFDbkMsY0FBYzt3QkFDZCxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07d0JBQ25CLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTt3QkFDbkIsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO3FCQUM5QixDQUFDLENBQUM7b0JBQ0gsT0FBTyxPQUFPLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSyxNQUFNLE9BQU8sUUFBUSxDQUFDO2lCQUNyRDtnQkFBQyxPQUFPLEtBQUssRUFBRTtvQkFDZCxPQUFPLE9BQU8sSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLDJCQUEyQixDQUFDO2lCQUMzRDthQUNGO2lCQUFNLElBQUksQ0FBQyxnQkFBTyxDQUFDLGFBQWEsRUFBRSxnQkFBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUk7Z0JBQ2pGLE1BQU0sY0FBYyxHQUFHLHFDQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDL0QsSUFBSSxDQUFDLGNBQWMsRUFBRTtvQkFDbkIsT0FBTyxPQUFPLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSywrQkFBK0IsQ0FBQztpQkFDL0Q7Z0JBQ0QsSUFBSTtvQkFDRixNQUFNLE9BQU8sR0FBRyxJQUFBLG9DQUFvQixFQUFDO3dCQUNuQyxjQUFjO3dCQUNkLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTt3QkFDbkIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO3dCQUNuQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7cUJBQzlCLENBQUMsQ0FBQztvQkFDSCxPQUFPLE9BQU8sSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLE1BQU0sT0FBTyxRQUFRLENBQUM7aUJBQ3JEO2dCQUFDLE9BQU8sS0FBSyxFQUFFO29CQUNkLE9BQU8sT0FBTyxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssMkJBQTJCLENBQUM7aUJBQzNEO2FBQ0Y7aUJBQU07Z0JBQ0MscURBQXFEO2dCQUNyRCxJQUFJO29CQUNGLE1BQU0sT0FBTyxHQUFHLGFBQUksQ0FBQyxVQUFVLENBQzdCLElBQUksQ0FBQyxNQUFNLEVBQ1gsSUFBSSxDQUFDLE1BQU0sRUFDWCxJQUFJLENBQUMsR0FBRyxFQUNSLFNBQVMsRUFDVCxxQ0FBeUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQ3hDLENBQUE7b0JBQ0QsT0FBTyxRQUFRLE9BQU8sUUFBUSxDQUFDO2lCQUNoQztnQkFBQyxPQUFPLEtBQUssRUFBRTtvQkFDZCxPQUFPLHFDQUFxQyxDQUFDO2lCQUM5QzthQUNSO1NBQ0Y7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILDBEQUEwRDtJQUMxRCxNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFFaEMseUNBQXlDO0lBQ3pDLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDN0IsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELHdCQUF3QjtJQUN4QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM1QyxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsSUFBSSxNQUFNLEVBQUU7WUFDVixVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3hCLE1BQU0sV0FBVyxHQUFHLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUM1RSxJQUFJLFdBQVcsRUFBRTtnQkFDZixVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQzlCO1NBQ0Y7S0FDRjtJQUVELE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUM7QUEvSFcsUUFBQSxhQUFhLGlCQStIeEI7QUFFSyxNQUFNLG9CQUFvQixHQUFHLENBQ2xDLFlBQW1DLEVBQzNCLEVBQUU7SUFDVixNQUFNLEtBQUssR0FBRyxnQkFBQyxDQUFDLE1BQU0sQ0FDcEIsWUFBWSxFQUNaLENBQUMsS0FBcUIsRUFBRSxHQUF3QixFQUFFLEVBQUU7UUFDbEQsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvQixDQUFDLEVBQ0QsaUJBQWMsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQ2xFLENBQUM7SUFFRixNQUFNLFlBQVksR0FBRyxnQkFBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtRQUN2RSxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRSxrRkFBa0Y7UUFDbEYsT0FBTyxJQUNMLFFBQVEsSUFBSSxxQkFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUMzQyxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7SUFDdkQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLGdCQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNwQyxDQUFDLENBQUM7QUFyQlcsUUFBQSxvQkFBb0Isd0JBcUIvQjtBQUVLLE1BQU0sbUJBQW1CLEdBQUcsQ0FDakMsV0FBZ0MsRUFDeEIsRUFBRTtJQUNWLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsV0FBVyxDQUFDO0lBQ3RDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sSUFBQSxxQkFBYSxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFDekQsQ0FBQyxDQUFDO0FBTFcsUUFBQSxtQkFBbUIsdUJBSzlCO0FBRUssTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFjLEVBQVUsRUFBRTtJQUNyRCxPQUFPLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQzFDLENBQUMsWUFBWSxhQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFDN0MsRUFBRSxDQUFDO0FBQ0wsQ0FBQyxDQUFDO0FBSlcsUUFBQSxZQUFZLGdCQUl2QiJ9