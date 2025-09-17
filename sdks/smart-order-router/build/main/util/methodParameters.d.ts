import { Trade } from '@swyrlfi/router-sdk';
import { Currency, TradeType } from '@swyrlfi/sdk-core';
import { ChainId, MethodParameters, RouteWithValidQuote, SwapOptions } from '../';
export declare function buildTrade<TTradeType extends TradeType>(tokenInCurrency: Currency, tokenOutCurrency: Currency, tradeType: TTradeType, routeAmounts: RouteWithValidQuote[]): Trade<Currency, Currency, TTradeType>;
export declare function buildSwapMethodParameters(trade: Trade<Currency, Currency, TradeType>, swapConfig: SwapOptions, chainId: ChainId): MethodParameters;
