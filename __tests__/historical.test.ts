
import {jest} from '@jest/globals'
import {UniswapFactoryObserver} from "../src/historical"
import {Filter, Log, Web3} from "web3"
import {KafkaAdminInstance} from "../src/kafka/admin"
import {Admin} from "kafkajs"
import {RPCS} from "../src/enums/rpcs"
import {ProducerFactory} from "../src/kafka/producer";

describe('Tests Historical Data Collection', () => {
  const contractAddress = '0x123'
  const eventSignature = "Event(uint256)"
  let admin: Admin
  let web3: Web3
  let eventSignatureHash: string
  beforeAll(async () => {
    admin = await KafkaAdminInstance.getInstance()
    web3 = new Web3(RPCS.POLYGON)
    eventSignatureHash = web3.eth.abi.encodeEventSignature(eventSignature)
  })
  afterAll(async () => {
    await admin?.disconnect()
  })

  it('should create a topic for each new uniswap factory address', async () => {
    const observer = new UniswapFactoryObserver(await ProducerFactory.getProducer(), KafkaAdminInstance, web3, [eventSignature])
    const addAddressSpy = jest.spyOn(observer, 'addAddress')
    const getPastLogsSpy = jest.spyOn(observer, 'getPastLogs')
    getPastLogsSpy.mockImplementation((_: Filter) => {
      return Promise.resolve([{
        address: contractAddress
      }] as Log[])
    })
    await observer.scanForUniswapFactories(1, 2)
    const topics = await admin.listTopics()
    expect(addAddressSpy).toHaveBeenCalledTimes(1)
    expect(getPastLogsSpy).toHaveBeenCalledTimes(1)
    expect(topics).toContain(contractAddress)
    await admin.deleteTopics({topics: [contractAddress]})
  })
  it('should add topics to observedTopics', async () => {
    const observer = new UniswapFactoryObserver(await ProducerFactory.getProducer(), KafkaAdminInstance, web3, [eventSignature])
    await expect(observer.logTopicIsObserved(eventSignatureHash)).resolves.toBeTruthy()
  })
})
