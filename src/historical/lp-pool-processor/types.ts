import {Chain} from "../../enums/rpcs"

export interface AbiInputsElement {
  indexed?: boolean
  internalType: string
  name: string
  type: string
}

export interface AbiElement {

  inputs: AbiInputsElement[],
  payable?: boolean
  stateMutability?: string
  type: string
  anonymous?: boolean
  name?: string
  constant?: boolean
  outputs?: AbiInputsElement[]
}

export interface LpPoolAddedMessage {
  chain: Chain
  id?: string;
  removed?: boolean;
  logIndex?: number;
  transactionIndex?: number;
  transactionHash?: string;
  blockHash?: string;
  blockNumber?: number;
  address?: string;
  data: string;
  topics: string[];
}

