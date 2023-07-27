import Web3 from "web3"
import { poll } from "../poller"
import { fetchBlockNumber } from "../main"
import BlockEvents from "../events/block-events"
import {Chain, RpcCollection} from "../enums/rpcs";

async function main(): Promise<void> {
  const chain = Chain.Polygon
  const rpcCollection = new RpcCollection()
  const web3 = new Web3(rpcCollection.getWeb3Provider(chain))
  const blockEvents = new BlockEvents()
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
