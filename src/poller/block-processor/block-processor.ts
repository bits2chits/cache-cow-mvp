import BlockEvents from '../../events/node/block-events';
import { BlockData, BlockEventListener, BlockEventsEnum, NewBlockListener } from '../../events/node/types';
import { RpcCollection } from '../../enums/rpcs';
import { Block, ethers, JsonRpcProvider, Log, TransactionReceipt } from 'ethers';
import { sleep } from '../../libs/sleep';

export class BlockProcessor implements BlockEventListener {
  observedTopics: Set<string>;
  rpcCollection: RpcCollection;
  event: BlockEventsEnum;
  listener: NewBlockListener;
  blockEvents: BlockEvents;

  constructor(blockEvents: BlockEvents, config: string[]) {
    this.rpcCollection = new RpcCollection();
    this.blockEvents = blockEvents;
    this.observedTopics = new Set(config.map(ethers.id));
  }

  initialize(): void {
    this.blockEvents.onNewBlock(this.onNewBlock.bind(this));
    this.blockEvents.onBlockData(this.onBlockData.bind(this));
  }

  async processLogs(chain: string, logs: readonly Log[]): Promise<void> {
    for (const log of logs) {
      const topic = log.topics?.[0];
      if (this.observedTopics.has(topic)) {
        this.blockEvents.logData(chain, log);
      }
    }
  }

  async onBlockData(chain: string, blockData: BlockData): Promise<void> {
    // TODO - We can eventually move this to our archival block storage processor. Let's see how that goes.
    console.info(`Received block data from ${chain} - ${JSON.stringify(blockData)}`);
  }

  async getTransactionReceipt(provider: JsonRpcProvider, transaction: string): Promise<TransactionReceipt> {
    try {
      return await provider.getTransactionReceipt(transaction);
    } catch (e) {
      console.error('Unable to fetch receipts', e);
      await sleep(1000);
      return await this.getTransactionReceipt(provider, transaction);
    }
  }

  async onNewBlock(chain: string, blockNumber: number): Promise<void> {
    const provider = this.rpcCollection.getEthersProvider(chain);
    const block: Block = await provider.getBlock(blockNumber);
    const transactionReceipts: TransactionReceipt[] = [];
    for (const transaction of block?.transactions || []) {
      const receipt = await this.getTransactionReceipt(provider, transaction);
      if (receipt?.logs?.length) {
        await this.processLogs(chain, receipt.logs);
      }
      await sleep(1000);
    }
    if (block) {
      console.log(block, transactionReceipts);
      this.blockEvents.blockData(chain, { block, transactionReceipts });
    }
  }
}
