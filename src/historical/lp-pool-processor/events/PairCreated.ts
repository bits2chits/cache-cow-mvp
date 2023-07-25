import {LogDescription} from "ethers"
import * as UniswapFactoryAbi from "../../../abis/uniswap-factory.json"
import {AbstractEvent} from "./AbstractEvent"

export class PairCreated extends AbstractEvent {
  key: string
  token0: string
  token0Symbol: string
  token0Decimals: number
  token1: string
  token1Symbol: string
  token1Decimals: number
  pair: string
  3: string

  constructor(log: LogDescription) {
    super(UniswapFactoryAbi, log)
    this.key = `${this.token0}:${this.token1}:${this.pair}:${this["3"]}`
  }

  toJSON() {
    return {
      token0: this.token0,
      token0Symbol: this.token0Symbol,
      token0Decimals: this.token0Decimals,
      token1: this.token1,
      token1Symbol: this.token1Symbol,
      token1Decimals: this.token1Decimals,
      pair: this.pair,
      pairIndex: this["3"]
    }
  }
}
