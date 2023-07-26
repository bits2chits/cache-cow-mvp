import {LogDescription} from "ethers"
import {AbstractEvent} from "./AbstractEvent"
import UniswapFactoryAbi from "../../../abis/uniswap-factory.json"

export class PairCreated extends AbstractEvent {

  constructor(log: LogDescription) {
    super(UniswapFactoryAbi, log)
    // TypeScript seems to take away everything good from JS. Dynamic assignation of key value pairs in a class
    // is gone, even with typed inference it seems a bit like drinking dirty water from a pond and calling it Voss.
    this["key"] = `${this?.["token0"]}:${this?.["token1"]}:${this?.["pair"]}:${this?.["3"]}`
  }

  get<T>(key: string): T {
    return this?.[key]
  }

  set<T>(key: string, value: T): void {
    this[key] = value
  }

  toJSON() {
    return {
      token0: this?.["token0"],
      token0Symbol: this?.["token0Symbol"],
      token0Decimals: this?.["token0Decimals"],
      token1: this?.["token1"],
      token1Symbol: this?.["token1Symbol"],
      token1Decimals: this?.["token1Decimals"],
      pair: this?.["pair"],
      pairIndex: this?.["3"]
    }
  }
}
