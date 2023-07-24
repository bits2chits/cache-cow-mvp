
import {Web3} from "web3"
import {RPCS} from "./enums/rpcs"
import {UniswapFactoryObserver} from "./historical"
import {KafkaAdminInstance} from "./kafka/admin"
import * as uniswapState from "../uniswapFactoryObserver.state.json"
import {ProducerFactory} from "./kafka/producer"
import {ConsumerFactory} from "./kafka/consumer"
import {uuidV4} from "web3-utils";
import {SYSTEM_EVENT_TOPICS} from "./kafka"
import {ethers, JsonRpcProvider} from "ethers"

async function processHistoricalEvents(): Promise<void> {
  const web3 = new Web3(RPCS.POLYGON)
  const blockNumber = await web3.eth.getBlockNumber()
  const uniswapFactoryObserver = new UniswapFactoryObserver(
    await ProducerFactory.getProducer(),
    KafkaAdminInstance,
    web3,
    uniswapState.existingUniswapAddresses
  )
  await uniswapFactoryObserver.scanForUniswapFactories(uniswapState.lastBlockChecked, Number(blockNumber.toString()))
    .then(() => console.info("Done processing historical events"))
    .catch(console.error)
    .finally(() => uniswapFactoryObserver.shutdown())
}

const type = "processor"
async function main(): Promise<void> {
  if (type === "processor") {
    const consumer = await ConsumerFactory.getConsumer({
      topics: [SYSTEM_EVENT_TOPICS.UNISWAP_LP_POOL_ADDED],
      fromBeginning: true
    }, {groupId: uuidV4() })
    await consumer.run({
      eachMessage: async ({message}): Promise<void> => {
        const parsed = JSON.parse(message.value.toString())
        console.log(parsed)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ifc = new ethers.Interface(require("./abis/uniswap-factory.json"))
        const parsedLog = ifc.parseLog(parsed)
        const event = {
          token0: parsedLog.args[0],
          token1: parsedLog.args[1],
          pair: parsedLog.args[2],
          pairIndex: parsedLog.args[3]
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const erc20Interface = new ethers.Interface(require("./abis/erc20.json"))
        const provider = new JsonRpcProvider(RPCS.POLYGON)
        const token0Contract = new ethers.Contract(event.token0, erc20Interface, provider)
        const token1Contract = new ethers.Contract(event.token1, erc20Interface, provider)
        const token0Symbol = await token0Contract.symbol()
        const token0Decimals = await token0Contract.decimals()
        const token1Symbol = await token1Contract.symbol()
        const token1Decimals = await token1Contract.decimals()
        const eventWithMetadata = {
          ...event,
          token0Symbol,
          token0Decimals,
          token1Symbol,
          token1Decimals
        }
        console.log(eventWithMetadata)
      }
    })
  } else {
      await processHistoricalEvents()
  }
}

main()
  .then(() => console.info("Process exited successfully"))
  .catch(console.error)
