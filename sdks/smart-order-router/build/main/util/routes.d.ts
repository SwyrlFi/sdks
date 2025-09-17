import { Pair } from '@swyrlfi/v2-sdk';
import { Pool } from '@swyrlfi/v3-sdk';
import { RouteWithValidQuote } from '../routers/alpha-router';
import { MixedRoute, V2Route, V3Route } from '../routers/router';
export interface SonicPair extends Pair {
    stable?: boolean;
}
export declare const FeeAmountTickSpacing: {
    [key: number]: number;
};
export declare function getTickSpacing(fee: number): number;
export declare const routeToString: (route: V3Route | V2Route | MixedRoute) => string;
export declare const routeAmountsToString: (routeAmounts: RouteWithValidQuote[]) => string;
export declare const routeAmountToString: (routeAmount: RouteWithValidQuote) => string;
export declare const poolToString: (p: Pool | Pair) => string;
