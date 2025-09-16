import { Pool as V4Pool } from '@swyrlfi/v4-sdk'
import { Pair } from '@swyrlfi/v2-sdk'
import { Pool as V3Pool } from '@swyrlfi/v3-sdk'

export type TPool = Pair | V3Pool | V4Pool
