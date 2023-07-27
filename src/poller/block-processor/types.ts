import {Block, TransactionReceipt} from "web3"

export interface BlockData {
  block: Block
  transactionReceipts: TransactionReceipt[]
}
