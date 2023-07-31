
import UniswapV2Abi from "../../abis/uniswap-v2.json"
import {AbstractEvent} from "./abstract-event"
import {LogDescription} from "ethers"

export class Sync extends AbstractEvent {
  constructor(log: LogDescription) {
    super(UniswapV2Abi, log)
    this.set("key", `${log.topic}:${this.get("reserve0")}:${this.get("reserve1")}`)
  }

  toJSON(): object {
    return {
      reserve0: this.get("reserve0"),
      reserve1: this.get("reserve1")
    }
  }

}
