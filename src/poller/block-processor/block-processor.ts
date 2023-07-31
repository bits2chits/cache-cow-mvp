import BlockEvents from '../../events/node/block-events';
import { BlockData, BlockEventListener, BlockEventsEnum, NewBlockListener } from '../../events/node/types';
import { RpcCollection } from '../../enums/rpcs';
import { Block, ethers, Log, TransactionReceipt } from 'ethers';

export class BlockProcessor implements BlockEventListener {
  observedTopics: Set<string>;
  rpcCollection: RpcCollection;
  event: BlockEventsEnum;
  listener: NewBlockListener;
  blockEvents: BlockEvents;

  constructor(config: string[]) {
    this.rpcCollection = new RpcCollection();
    this.blockEvents = new BlockEvents();
    this.observedTopics = new Set(config.map(ethers.id));
  }

  initialize(): void {
    this.blockEvents.onNewBlock(this.onNewBlock.bind(this));
    this.blockEvents.onBlockData(this.onBlockData.bind(this));
  }

  async processLogs(chain: string, logs: readonly Log[]): Promise<void> {
    for (const log of logs) {
      const topic = log.topics[0].toString();
      if (this.observedTopics.has(topic)) {
        this.blockEvents.logData(chain, log);
      }
    }
  }

  async onBlockData(chain: string, blockData: BlockData): Promise<void> {
    // TODO - We can eventually move this to our archival block storage processor. Let's see how that goes.
    console.info(`Received block data from ${chain} - ${blockData.block.number}`);
  }

  async onNewBlock(chain: string, blockNumber: number): Promise<void> {
    const block: Block = await this.rpcCollection.getEthersProvider(chain).getBlock(blockNumber);
    const transactionReceipts: TransactionReceipt[] = [];
    for (const transaction of block.transactions) {
      const receipt: TransactionReceipt = await this.rpcCollection.getEthersProvider(chain)
        .getTransactionReceipt(transaction as string);
      transactionReceipts.push(receipt);
      await this.processLogs(chain, receipt.logs);
    }
    this.blockEvents.blockData(chain, { block, transactionReceipts });
  }
}
