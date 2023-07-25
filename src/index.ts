
import {RPCS} from "./enums/rpcs"
import {UniswapFactoryObserver} from "./historical"
import * as uniswapState from "../uniswapFactoryObserver.state.json"

async function processHistoricalEvents(): Promise<void> {
  const uniswapFactoryObserver = new UniswapFactoryObserver(RPCS.POLYGON, uniswapState.existingUniswapAddresses)
  const blockNumber = await uniswapFactoryObserver.web3.eth.getBlockNumber()
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
