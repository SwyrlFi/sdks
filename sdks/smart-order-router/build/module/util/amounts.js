import { parseUnits } from '@ethersproject/units';
import { CurrencyAmount as CurrencyAmountRaw, } from '@swyrlfi/sdk-core';
import { FeeAmount } from '@swyrlfi/v3-sdk';
import JSBI from 'jsbi';
export class CurrencyAmount extends CurrencyAmountRaw {
}
export const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
// Try to parse a user entered amount for a given token
export function parseAmount(value, currency) {
    const typedValueParsed = parseUnits(value, currency.decimals).toString();
    return CurrencyAmount.fromRawAmount(currency, JSBI.BigInt(typedValueParsed));
}
export function parseFeeAmount(feeAmountStr) {
    switch (feeAmountStr) {
        case '20000':
            return FeeAmount.HIGHEST; // HIGHEST
        case '10000':
            return FeeAmount.HIGH;
        case '3000':
            return FeeAmount.MEDIUM;
        case '500':
            return FeeAmount.LOW;
        case '250':
            return FeeAmount.LOWEST_250; // LOWEST_250
        case '100':
            return FeeAmount.LOWEST;
        default:
            throw new Error(`Fee amount ${feeAmountStr} not supported.`);
    }
}
export function unparseFeeAmount(feeAmount) {
    switch (feeAmount) {
        case 20000: // HIGHEST
            return '20000';
        case FeeAmount.HIGH:
            return '10000';
        case FeeAmount.MEDIUM:
            return '3000';
        case FeeAmount.LOW:
            return '500';
        case 250: // LOWEST_250
            return '250';
        case FeeAmount.LOWEST:
            return '100';
        default:
            throw new Error(`Fee amount ${feeAmount} not supported.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1vdW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2Ftb3VudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2xELE9BQU8sRUFFTCxjQUFjLElBQUksaUJBQWlCLEdBQ3BDLE1BQU0sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzVDLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUV4QixNQUFNLE9BQU8sY0FBZSxTQUFRLGlCQUEyQjtDQUFHO0FBRWxFLE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRyw0Q0FBNEMsQ0FBQztBQUV4RSx1REFBdUQ7QUFDdkQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxLQUFhLEVBQUUsUUFBa0I7SUFDM0QsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN6RSxPQUFPLGNBQWMsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO0FBQy9FLENBQUM7QUFFRCxNQUFNLFVBQVUsY0FBYyxDQUFDLFlBQW9CO0lBQ2pELFFBQVEsWUFBWSxFQUFFO1FBQ3BCLEtBQUssT0FBTztZQUNWLE9BQU8sU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVU7UUFDdEMsS0FBSyxPQUFPO1lBQ1YsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3hCLEtBQUssTUFBTTtZQUNULE9BQU8sU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUMxQixLQUFLLEtBQUs7WUFDUixPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUM7UUFDdkIsS0FBSyxLQUFLO1lBQ1IsT0FBTyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsYUFBYTtRQUM1QyxLQUFLLEtBQUs7WUFDUixPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDMUI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsWUFBWSxpQkFBaUIsQ0FBQyxDQUFDO0tBQ2hFO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxTQUE2QjtJQUM1RCxRQUFRLFNBQVMsRUFBRTtRQUNqQixLQUFLLEtBQUssRUFBRSxVQUFVO1lBQ3BCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLEtBQUssU0FBUyxDQUFDLElBQUk7WUFDakIsT0FBTyxPQUFPLENBQUM7UUFDakIsS0FBSyxTQUFTLENBQUMsTUFBTTtZQUNuQixPQUFPLE1BQU0sQ0FBQztRQUNoQixLQUFLLFNBQVMsQ0FBQyxHQUFHO1lBQ2hCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsS0FBSyxHQUFHLEVBQUUsYUFBYTtZQUNyQixPQUFPLEtBQUssQ0FBQztRQUNmLEtBQUssU0FBUyxDQUFDLE1BQU07WUFDbkIsT0FBTyxLQUFLLENBQUM7UUFDZjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxTQUFTLGlCQUFpQixDQUFDLENBQUM7S0FDN0Q7QUFDSCxDQUFDIn0=