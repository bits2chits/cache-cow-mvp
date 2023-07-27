import {Block, Log, TransactionReceipt, Web3} from "web3"
import BlockEvents from "../../events/block-events"
import {BlockEventListener, BlockEventsEnum, NewBlockListener} from "../../events/types"
import {RpcCollection} from "../../enums/rpcs"
import {BlockData} from "./types";

export class BlockProcessor implements BlockEventListener {
  web3: Web3
  observedTopics: Set<string>
  rpcCollection: RpcCollection
  event: BlockEventsEnum
  listener: NewBlockListener
  blockEvents: BlockEvents

  constructor(web3: Web3, config: string[]) {
    this.web3 = web3
    this.observedTopics = new Set(config.map(this.web3.eth.abi.encodeEventSignature))
    this.rpcCollection = new RpcCollection()
    this.blockEvents = new BlockEvents()
    this.web3.eth.abi.encodeEventSignature
  }

  initialize(): void {
    this.blockEvents.onNewBlock(this.onNewBlock.bind(this))
    this.blockEvents.onBlockData(this.onBlockData.bind(this))
  }

  async processLogs(chain: string, logs: Log[]): Promise<void> {
    for (const log of logs) {
      const topic = log.topics[0].toString()
      if (this.observedTopics.has(topic)) {
        this.blockEvents.logData(chain, log)
      }
    }
  }

  async onBlockData(chain: string, blockData: BlockData): Promise<void> {
    // TODO - We can eventually move this to our archival block storage processor. Let's see how that goes.
    console.info(`Received block data from ${chain} - ${blockData.block.number}`)
  }

  async onNewBlock(chain: string, blockNumber: number): Promise<void> {
    const web3 = new Web3(this.rpcCollection.getWeb3Provider(chain))
    const block: Block = await web3.eth.getBlock(blockNumber)
    const transactionReceipts: TransactionReceipt[] = []
    for (const transaction of block.transactions) {
      const receipt: TransactionReceipt = await this.web3.eth.getTransactionReceipt(transaction as string)
      transactionReceipts.push(receipt)
      await this.processLogs(chain, receipt.logs)
    }
    this.blockEvents.blockData(chain, {block, transactionReceipts})
  }
}
