import {Web3} from "web3"
import {RPCS} from "./enums/rpcs"
import {UniswapFactoryObserver} from "./historical"
import {KafkaAdminInstance} from "./kafka/admin"
import * as uniswapState from "../uniswapFactoryObserver.state.json"

async function processHistoricalEvents(): Promise<void> {
  const web3 = new Web3(RPCS.POLYGON)
  const blockNumber = await web3.eth.getBlockNumber()
  const uniswapFactoryObserver = new UniswapFactoryObserver(KafkaAdminInstance, web3, uniswapState.existingUniswapAddresses)
  await uniswapFactoryObserver.scanForUniswapFactories(uniswapState.lastBlockChecked, Number(blockNumber.toString()))
    .then(() => console.info("Done processing historical events"))
    .catch(console.error)
    .finally(() => uniswapFactoryObserver.shutdown())
}

async function main(): Promise<void> {
  await processHistoricalEvents()
}

main()
  .then(() => console.info("Process exited successfully"))
  .catch(console.error)
