import Web3 from "web3"
import { MATIC_USDC } from "../enums/pairs"
import { poll } from "../poller"
import { fetchBlockNumber } from "../main"
import BlockEvents from "../events/block-events"

async function main(): Promise<void> {
  const web3 = new Web3(MATIC_USDC.RPC)
  const blockEvents = new BlockEvents()
  let blockNumber = await fetchBlockNumber(web3)

  await poll(web3, {
    interval: 500,
    startAtBlock: blockNumber,
    shouldStop: async (block) => {
      if (block > blockNumber) {
        blockNumber = block
        blockEvents.newBlock(MATIC_USDC.CHAIN, block)
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