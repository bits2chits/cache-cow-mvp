import {Block, Log, TransactionReceipt, Web3} from "web3"
import BlockEvents from "../../events/block-events"
import {BlockEventListener, BlockEventsEnum, NewBlockListener} from "../../events/types"
import { Chain, RpcCollection } from '../../enums/rpcs';
import {BlockData} from "./types";
import { autoInjectable, container } from "tsyringe";
import { Web3Wrapper } from '../../libs/web3-wrapper';
import UniswapObserverState from "../../../uniswapFactoryObserver.state.json"
// export this type somewhere else


@autoInjectable()
export class BlockProcessor implements BlockEventListener {
  web3: Web3
  observedTopics: Set<string>
  event: BlockEventsEnum
  listener: NewBlockListener

  constructor(private web3Wrapper: Web3Wrapper, private rpcCollection: RpcCollection, private blockEvents: BlockEvents) {
    this.web3 = this.web3Wrapper.getWeb3(Chain.Polygon)
    const uniswapState = container.resolve<typeof UniswapObserverState>('UniswapObserverState')
    this.observedTopics = new Set(uniswapState.observedEventSignatures.map(this.web3.eth.abi.encodeEventSignature))
  }

  initialize(): void {
    this.blockEvents.onNewBlock(this.onNewBlock.bind(this))
    this.blockEvents.onBlockData(this.onBlockData.bind(this))
  }

  async processLogs(chain: string, logs: Log[]): Promise<void> {
    for (const log of logs) {
      const topic = log?.topics?.[0].toString()
      if (topic && this.observedTopics.has(topic)) {
        this.blockEvents.logData(chain, log)
      }
    }
  }

  async onBlockData(chain: string, blockData: BlockData): Promise<void> {
    // TODO - We can eventually move this to our archival block storage processor. Let's see how that goes.
    console.info(`Received block data from ${chain} - ${blockData.block.number}`)
  }

  async onNewBlock(chain: Chain, blockNumber: number): Promise<void> {
    const web3 = this.web3Wrapper.getWeb3(chain)
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
