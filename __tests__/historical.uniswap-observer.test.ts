import {jest} from '@jest/globals'
import {UniswapFactoryObserver} from "../src/historical/uniswap-observer"
import {Filter, Log, Web3} from "web3"
import {AdminFactory, KafkaAdmin} from "../src/kafka/admin"
import {Chain, RpcCollection} from "../src/enums/rpcs"

describe('Tests Uniswap Observer', () => {
  const rpcCollection = new RpcCollection()
  const contractAddress = '0x123'
  const eventSignature = "Event(uint256)"
  let admin: KafkaAdmin
  let web3: Web3
  let eventSignatureHash: string
  beforeAll(async () => {
    admin = await AdminFactory.getAdmin()
    web3 = new Web3(rpcCollection.getWeb3Provider(Chain.Polygon))
    eventSignatureHash = web3.eth.abi.encodeEventSignature(eventSignature)
  })
  afterAll(async () => {
    await admin?.disconnect()
  })

  it('should create a topic for each new uniswap factory address', async () => {
    const observer = new UniswapFactoryObserver(Chain.Polygon, [eventSignature])
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
    await admin.deleteTopic(contractAddress)
    await observer.shutdown()
  })
  it('should add topics to observedTopics', async () => {
    const observer = new UniswapFactoryObserver(Chain.Polygon, [eventSignature])
    await expect(observer.logTopicIsObserved(eventSignatureHash)).resolves.toBeTruthy()
    await observer.shutdown()
  })
})
