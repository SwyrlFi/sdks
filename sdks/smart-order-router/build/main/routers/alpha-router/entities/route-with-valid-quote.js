"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixedRouteWithValidQuote = exports.V3RouteWithValidQuote = exports.V2RouteWithValidQuote = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const router_sdk_1 = require("@swyrlfi/router-sdk");
const sdk_core_1 = require("@swyrlfi/sdk-core");
const v3_sdk_1 = require("@swyrlfi/v3-sdk");
const lodash_1 = __importDefault(require("lodash"));
const amounts_1 = require("../../../util/amounts");
const routes_1 = require("../../../util/routes");
/**
 * Represents a quote for swapping on a V2 only route. Contains all information
 * such as the route used, the amount specified by the user, the type of quote
 * (exact in or exact out), the quote itself, and gas estimates.
 *
 * @export
 * @class V2RouteWithValidQuote
 */
class V2RouteWithValidQuote {
    toString() {
        return `${this.percent.toFixed(2)}% QuoteGasAdj[${this.quoteAdjustedForGas.toExact()}] Quote[${this.quote.toExact()}] Gas[${this.gasEstimate.toString()}] = ${(0, routes_1.routeToString)(this.route)}`;
    }
    constructor({ amount, rawQuote, percent, route, gasModel, quoteToken, tradeType, v2PoolProvider, }) {
        this.protocol = router_sdk_1.Protocol.V2;
        this.amount = amount;
        this.rawQuote = rawQuote;
        this.quote = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
        this.percent = percent;
        this.route = route;
        this.gasModel = gasModel;
        this.quoteToken = quoteToken;
        this.tradeType = tradeType;
        if (this.gasModel != undefined) {
            const { gasEstimate, gasCostInToken, gasCostInUSD } = this.gasModel.estimateGasCost(this);
            this.gasCostInToken = gasCostInToken;
            this.gasCostInUSD = gasCostInUSD;
            this.gasEstimate = gasEstimate;
            // If its exact out, we need to request *more* of the input token to account for the gas.
            if (this.tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                const quoteGasAdjusted = this.quote.subtract(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
            else {
                const quoteGasAdjusted = this.quote.add(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
        }
        else {
            this.gasEstimate = bignumber_1.BigNumber.from(0);
            this.gasCostInToken = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.gasCostInUSD = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.quoteAdjustedForGas = this.quote;
        }
        this.poolAddresses = lodash_1.default.map(route.pairs, (p) => v2PoolProvider.getPoolAddress(p.token0, p.token1).poolAddress);
        this.tokenPath = this.route.path;
    }
}
exports.V2RouteWithValidQuote = V2RouteWithValidQuote;
/**
 * Represents a quote for swapping on a V3 only route. Contains all information
 * such as the route used, the amount specified by the user, the type of quote
 * (exact in or exact out), the quote itself, and gas estimates.
 *
 * @export
 * @class V3RouteWithValidQuote
 */
class V3RouteWithValidQuote {
    toString() {
        return `${this.percent.toFixed(2)}% QuoteGasAdj[${this.quoteAdjustedForGas.toExact()}] Quote[${this.quote.toExact()}] Gas[${this.gasEstimate.toString()}] = ${(0, routes_1.routeToString)(this.route)}`;
    }
    constructor({ amount, rawQuote, sqrtPriceX96AfterList, initializedTicksCrossedList, quoterGasEstimate, percent, route, gasModel, quoteToken, tradeType, v3PoolProvider, }) {
        this.protocol = router_sdk_1.Protocol.V3;
        this.amount = amount;
        this.rawQuote = rawQuote;
        this.sqrtPriceX96AfterList = sqrtPriceX96AfterList;
        this.initializedTicksCrossedList = initializedTicksCrossedList;
        this.quoterGasEstimate = quoterGasEstimate;
        this.quote = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
        this.percent = percent;
        this.route = route;
        this.gasModel = gasModel;
        this.quoteToken = quoteToken;
        this.tradeType = tradeType;
        if (this.gasModel != undefined) {
            const { gasEstimate, gasCostInToken, gasCostInUSD } = this.gasModel.estimateGasCost(this);
            this.gasCostInToken = gasCostInToken;
            this.gasCostInUSD = gasCostInUSD;
            this.gasEstimate = gasEstimate;
            // If its exact out, we need to request *more* of the input token to account for the gas.
            if (this.tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                const quoteGasAdjusted = this.quote.subtract(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
            else {
                const quoteGasAdjusted = this.quote.add(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
        }
        else {
            this.gasEstimate = bignumber_1.BigNumber.from(0);
            this.gasCostInToken = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.gasCostInUSD = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.quoteAdjustedForGas = this.quote;
        }
        this.poolAddresses = lodash_1.default.map(route.pools, (p) => v3PoolProvider.getPoolAddress(p.token0, p.token1, p.fee).poolAddress);
        this.tokenPath = this.route.tokenPath;
    }
}
exports.V3RouteWithValidQuote = V3RouteWithValidQuote;
/**
 * Represents a quote for swapping on a Mixed Route. Contains all information
 * such as the route used, the amount specified by the user, the type of quote
 * (exact in or exact out), the quote itself, and gas estimates.
 *
 * @export
 * @class MixedRouteWithValidQuote
 */
class MixedRouteWithValidQuote {
    toString() {
        return `${this.percent.toFixed(2)}% QuoteGasAdj[${this.quoteAdjustedForGas.toExact()}] Quote[${this.quote.toExact()}] Gas[${this.gasEstimate.toString()}] = ${(0, routes_1.routeToString)(this.route)}`;
    }
    constructor({ amount, rawQuote, sqrtPriceX96AfterList, initializedTicksCrossedList, quoterGasEstimate, percent, route, mixedRouteGasModel, quoteToken, tradeType, v3PoolProvider, v2PoolProvider, }) {
        this.protocol = router_sdk_1.Protocol.MIXED;
        this.amount = amount;
        this.rawQuote = rawQuote;
        this.sqrtPriceX96AfterList = sqrtPriceX96AfterList;
        this.initializedTicksCrossedList = initializedTicksCrossedList;
        this.quoterGasEstimate = quoterGasEstimate;
        this.quote = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
        this.percent = percent;
        this.route = route;
        this.gasModel = mixedRouteGasModel;
        this.quoteToken = quoteToken;
        this.tradeType = tradeType;
        if (this.gasModel != undefined) {
            const { gasEstimate, gasCostInToken, gasCostInUSD } = this.gasModel.estimateGasCost(this);
            this.gasCostInToken = gasCostInToken;
            this.gasCostInUSD = gasCostInUSD;
            this.gasEstimate = gasEstimate;
            // If its exact out, we need to request *more* of the input token to account for the gas.
            if (this.tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                const quoteGasAdjusted = this.quote.subtract(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
            else {
                const quoteGasAdjusted = this.quote.add(gasCostInToken);
                this.quoteAdjustedForGas = quoteGasAdjusted;
            }
        }
        else {
            this.gasEstimate = bignumber_1.BigNumber.from(0);
            this.gasCostInToken = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.gasCostInUSD = amounts_1.CurrencyAmount.fromRawAmount(quoteToken, '0');
            this.quoteAdjustedForGas = this.quote;
        }
        this.poolAddresses = lodash_1.default.map(route.pools, (p) => {
            return p instanceof v3_sdk_1.Pool
                ? v3PoolProvider.getPoolAddress(p.token0, p.token1, p.fee).poolAddress
                : v2PoolProvider.getPoolAddress(p.token0, p.token1).poolAddress;
        });
        this.tokenPath = this.route.path;
    }
}
exports.MixedRouteWithValidQuote = MixedRouteWithValidQuote;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUtd2l0aC12YWxpZC1xdW90ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9lbnRpdGllcy9yb3V0ZS13aXRoLXZhbGlkLXF1b3RlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHdEQUFxRDtBQUNyRCxvREFBK0M7QUFDL0MsZ0RBQXFEO0FBQ3JELDRDQUF1QztBQUN2QyxvREFBdUI7QUFJdkIsbURBQXVEO0FBQ3ZELGlEQUFxRDtBQTBEckQ7Ozs7Ozs7R0FPRztBQUNILE1BQWEscUJBQXFCO0lBa0J6QixRQUFRO1FBQ2IsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUM1QixDQUFDLENBQ0YsaUJBQWlCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsV0FBVyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLE9BQU8sSUFBQSxzQkFBYSxFQUN6SSxJQUFJLENBQUMsS0FBSyxDQUNYLEVBQUUsQ0FBQztJQUNOLENBQUM7SUFFRCxZQUFZLEVBQ1YsTUFBTSxFQUNOLFFBQVEsRUFDUixPQUFPLEVBQ1AsS0FBSyxFQUNMLFFBQVEsRUFDUixVQUFVLEVBQ1YsU0FBUyxFQUNULGNBQWMsR0FDYztRQWxDZCxhQUFRLEdBQUcscUJBQVEsQ0FBQyxFQUFFLENBQUM7UUFtQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxLQUFLLEdBQUcsd0JBQWMsQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzNFLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLEdBQUcs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