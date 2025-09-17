"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unparseFeeAmount = exports.parseFeeAmount = exports.parseAmount = exports.MAX_UINT160 = exports.CurrencyAmount = void 0;
const units_1 = require("@ethersproject/units");
const sdk_core_1 = require("@swyrlfi/sdk-core");
const v3_sdk_1 = require("@swyrlfi/v3-sdk");
const jsbi_1 = __importDefault(require("jsbi"));
class CurrencyAmount extends sdk_core_1.CurrencyAmount {
}
exports.CurrencyAmount = CurrencyAmount;
exports.MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
// Try to parse a user entered amount for a given token
function parseAmount(value, currency) {
    const typedValueParsed = (0, units_1.parseUnits)(value, currency.decimals).toString();
    return CurrencyAmount.fromRawAmount(currency, jsbi_1.default.BigInt(typedValueParsed));
}
exports.parseAmount = parseAmount;
function parseFeeAmount(feeAmountStr) {
    switch (feeAmountStr) {
        case '20000':
            return v3_sdk_1.FeeAmount.HIGHEST; // HIGHEST
        case '10000':
            return v3_sdk_1.FeeAmount.HIGH;
        case '3000':
            return v3_sdk_1.FeeAmount.MEDIUM;
        case '500':
            return v3_sdk_1.FeeAmount.LOW;
        case '250':
            return v3_sdk_1.FeeAmount.LOWEST_250; // LOWEST_250
        case '100':
            return v3_sdk_1.FeeAmount.LOWEST;
        default:
            throw new Error(`Fee amount ${feeAmountStr} not supported.`);
    }
}
exports.parseFeeAmount = parseFeeAmount;
function unparseFeeAmount(feeAmount) {
    switch (feeAmount) {
        case 20000: // HIGHEST
            return '20000';
        case v3_sdk_1.FeeAmount.HIGH:
            return '10000';
        case v3_sdk_1.FeeAmount.MEDIUM:
            return '3000';
        case v3_sdk_1.FeeAmount.LOW:
            return '500';
        case 250: // LOWEST_250
            return '250';
        case v3_sdk_1.FeeAmount.LOWEST:
            return '100';
        default:
            throw new Error(`Fee amount ${feeAmount} not supported.`);
    }
}
exports.unparseFeeAmount = unparseFeeAmount;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1vdW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2Ftb3VudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsZ0RBQWtEO0FBQ2xELGdEQUcyQjtBQUMzQiw0Q0FBNEM7QUFDNUMsZ0RBQXdCO0FBRXhCLE1BQWEsY0FBZSxTQUFRLHlCQUEyQjtDQUFHO0FBQWxFLHdDQUFrRTtBQUVyRCxRQUFBLFdBQVcsR0FBRyw0Q0FBNEMsQ0FBQztBQUV4RSx1REFBdUQ7QUFDdkQsU0FBZ0IsV0FBVyxDQUFDLEtBQWEsRUFBRSxRQUFrQjtJQUMzRCxNQUFNLGdCQUFnQixHQUFHLElBQUEsa0JBQVUsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3pFLE9BQU8sY0FBYyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsY0FBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLFlBQW9CO0lBQ2pELFFBQVEsWUFBWSxFQUFFO1FBQ3BCLEtBQUssT0FBTztZQUNWLE9BQU8sa0JBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVO1FBQ3RDLEtBQUssT0FBTztZQUNWLE9BQU8sa0JBQVMsQ0FBQyxJQUFJLENBQUM7UUFDeEIsS0FBSyxNQUFNO1lBQ1QsT0FBTyxrQkFBUyxDQUFDLE1BQU0sQ0FBQztRQUMxQixLQUFLLEtBQUs7WUFDUixPQUFPLGtCQUFTLENBQUMsR0FBRyxDQUFDO1FBQ3ZCLEtBQUssS0FBSztZQUNSLE9BQU8sa0JBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxhQUFhO1FBQzVDLEtBQUssS0FBSztZQUNSLE9BQU8sa0JBQVMsQ0FBQyxNQUFNLENBQUM7UUFDMUI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsWUFBWSxpQkFBaUIsQ0FBQyxDQUFDO0tBQ2hFO0FBQ0gsQ0FBQztBQWpCRCx3Q0FpQkM7QUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxTQUE2QjtJQUM1RCxRQUFRLFNBQVMsRUFBRTtRQUNqQixLQUFLLEtBQUssRUFBRSxVQUFVO1lBQ3BCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLEtBQUssa0JBQVMsQ0FBQyxJQUFJO1lBQ2pCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLEtBQUssa0JBQVMsQ0FBQyxNQUFNO1lBQ25CLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLEtBQUssa0JBQVMsQ0FBQyxHQUFHO1lBQ2hCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsS0FBSyxHQUFHLEVBQUUsYUFBYTtZQUNyQixPQUFPLEtBQUssQ0FBQztRQUNmLEtBQUssa0JBQVMsQ0FBQyxNQUFNO1lBQ25CLE9BQU8sS0FBSyxDQUFDO1FBQ2Y7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsU0FBUyxpQkFBaUIsQ0FBQyxDQUFDO0tBQzdEO0FBQ0gsQ0FBQztBQWpCRCw0Q0FpQkMifQ==