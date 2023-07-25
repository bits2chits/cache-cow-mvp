import {Log} from "web3"

export type Chain = {
  chainId: string
}

export type LogAndChain = Log & Chain
