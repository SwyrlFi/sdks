"use strict";
// // Monkey patch to extend Uniswap V3 SDK FeeAmount enum so that
// // additional fee tiers (0.025% and 2.00%) are supported at runtime
// // and at compile-time.
// //
// // IMPORTANT: this file must be imported **once** before any FeeAmount
// // constants are referenced (e.g. in src/index.ts).
// import { FeeAmount, TICK_SPACINGS } from '@swyrlfi/v3-sdk';
// // ---------------------------------------------------------------------------
// // Runtime augmentation
// // ---------------------------------------------------------------------------
// // The enum emitted by TypeScript is an object in JavaScript, so we can simply
// // add new keys. We also add the reverse numeric-to-string mapping to preserve
// // the bidirectional behaviour of enums.
// // 0.025 % fee tier (2.5 bps)
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// (FeeAmount as any).LOWEST_250 = 250;
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// (FeeAmount as any)[250] = 'LOWEST_250';
// // 2.00 % fee tier (200 bps)
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// (FeeAmount as any).HIGHEST = 20000;
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// (FeeAmount as any)[20000] = 'HIGHEST';
// // ---------------------------------------------------------------------------
// // Patch tick spacing mapping so that helpers relying on TICK_SPACINGS can
// // work with the newly added fee tiers, and align existing tiers with
// // project-specific values.
// // ---------------------------------------------------------------------------
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.LOWEST] = 1;   // unchanged
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.LOWEST_250] = 5;                // LOWEST_250 → 5
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.LOW] = 10;     // unchanged
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.MEDIUM] = 50;  // override 60 → 50
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.HIGH] = 100;   // override 200 → 100
// (TICK_SPACINGS as Record<number, number>)[FeeAmount.HIGHEST] = 200;            // HIGHEST  → 200
// // ---------------------------------------------------------------------------
// // TypeScript type augmentation
// // ---------------------------------------------------------------------------
// // Re-open the module and merge new members into the existing enum so that
// // references like FeeAmount.LOWEST_250 compile without error.
// // NOTE: enum merging is allowed for **ambient** enums declared in the same
// // module, so this is safe and preserves original values.
// declare module '@uniswap/v3-sdk/dist/constants' {
//   export enum FeeAmount {
//     LOWEST_250 = 250,
//     HIGHEST = 20000,
//   }
// }
// // Log to confirm patching took place
// console.info('[Patch] FeeAmount enum extended with LOWEST_250 / HIGHEST tiers');
// // Ensure treated as a module
// export {};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmVlLWFtb3VudC1wYXRjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wYXRjaGVzL2ZlZS1hbW91bnQtcGF0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGtFQUFrRTtBQUNsRSxzRUFBc0U7QUFDdEUsMEJBQTBCO0FBQzFCLEtBQUs7QUFDTCx5RUFBeUU7QUFDekUsc0RBQXNEO0FBRXRELDhEQUE4RDtBQUU5RCxpRkFBaUY7QUFDakYsMEJBQTBCO0FBQzFCLGlGQUFpRjtBQUNqRixpRkFBaUY7QUFDakYsaUZBQWlGO0FBQ2pGLDJDQUEyQztBQUMzQyxnQ0FBZ0M7QUFDaEMsaUVBQWlFO0FBQ2pFLHVDQUF1QztBQUN2QyxpRUFBaUU7QUFDakUsMENBQTBDO0FBQzFDLCtCQUErQjtBQUMvQixpRUFBaUU7QUFDakUsc0NBQXNDO0FBQ3RDLGlFQUFpRTtBQUNqRSx5Q0FBeUM7QUFFekMsaUZBQWlGO0FBQ2pGLDZFQUE2RTtBQUM3RSx3RUFBd0U7QUFDeEUsOEJBQThCO0FBQzlCLGlGQUFpRjtBQUNqRixrRkFBa0Y7QUFDbEYsd0dBQXdHO0FBQ3hHLGtGQUFrRjtBQUNsRix5RkFBeUY7QUFDekYsMkZBQTJGO0FBQzNGLG1HQUFtRztBQUVuRyxpRkFBaUY7QUFDakYsa0NBQWtDO0FBQ2xDLGlGQUFpRjtBQUNqRiw2RUFBNkU7QUFDN0UsaUVBQWlFO0FBQ2pFLDhFQUE4RTtBQUM5RSw0REFBNEQ7QUFFNUQsb0RBQW9EO0FBQ3BELDRCQUE0QjtBQUM1Qix3QkFBd0I7QUFDeEIsdUJBQXVCO0FBQ3ZCLE1BQU07QUFDTixJQUFJO0FBRUosd0NBQXdDO0FBQ3hDLG1GQUFtRjtBQUVuRixnQ0FBZ0M7QUFDaEMsYUFBYSJ9