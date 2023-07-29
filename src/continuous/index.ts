import 'reflect-metadata'
import { poll } from "../poller"
import { fetchBlockNumber } from "../main"
import BlockEvents from "../events/block-events"
import {Chain} from "../enums/rpcs";
import {BlockProcessor} from "../poller/block-processor/block-processor"
import UniswapObserverState from "../../uniswapFactoryObserver.state.json"
import { container } from "tsyringe";
import { Web3Wrapper } from '../libs/web3-wrapper';

container.register<typeof UniswapObserverState>("UniswapObserverState", { useValue: UniswapObserverState })

async function main(
  chain = Chain.Polygon
): Promise<void> {
  const blockProcessor = container.resolve<BlockProcessor>(BlockProcessor)
  const web3Wrapper = container.resolve<Web3Wrapper>(Web3Wrapper)
  const web3 = web3Wrapper.getWeb3(chain)
  const blockEvents = container.resolve<BlockEvents>(BlockEvents)

  blockProcessor.initialize()
  let blockNumber = await fetchBlockNumber(web3)
  // @TODO register pair event listeners
  await poll(web3, {
    interval: 500,
    startAtBlock: blockNumber,
    shouldStop: async (block) => {
      if (block > blockNumber) {
        blockNumber = block
        blockEvents.newBlock(chain, block)
      }
      return false
    },
    onAbort: async () => {
      blockEvents.cleanup()
    }
  })
}

main()
  .then(() => console.info("Process exited successfully"))
  .catch(console.error)
