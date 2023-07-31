import {Chain} from "../../enums/rpcs"



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

