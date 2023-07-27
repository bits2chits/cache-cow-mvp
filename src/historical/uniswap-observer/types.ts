import {Log} from "web3"
import {Chain} from "../../enums/rpcs"

export type ChainId = {
  chain: Chain
}

export type LogAndChain = Log & ChainId
