
import UniswapFactoryAbi from "../../abis/uniswap-factory.json"
import {AbstractEvent} from "./abstract-event"
import {LogDescription} from "ethers"

export class PairCreated extends AbstractEvent {

  constructor(log: LogDescription) {
    super(UniswapFactoryAbi, log)
    this.set("key", `${this.get("token0")}:${this.get("token1")}:${this.get("pair")}:${this.get("3")}`)
  }

  override toJSON(): object {
    return {
      token0: this.get("token0"),
      token0Symbol: this.get("token0Symbol"),
      token0Decimals: this.get("token0Decimals"),
      token1: this.get("token1"),
      token1Symbol: this.get("token1Symbol"),
      token1Decimals: this.get("token1Decimals"),
      pair: this.get("pair"),
      pairIndex: this.get("3")
    }
  }
}
