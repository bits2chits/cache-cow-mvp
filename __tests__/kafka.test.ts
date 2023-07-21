import {jest} from '@jest/globals'
import {uuidV4} from "web3-utils"
import {Web3} from "web3"
import {Message, KafkaMessage} from "kafkajs"
import {KafkaAdminInstance} from "../src/kafka/admin"
import {sleep} from "../src/libs/sleep"
import {ConsumerFactory} from "../src/kafka/consumer"
import {ProducerFactory} from "../src/kafka/producer"
import {RPCS} from "../src/enums/rpcs"

jest.setTimeout(100000)

function messageToString(m: Message | KafkaMessage): string {
  return m.value.toString()
}
describe('Tests Kafka', () => {
  let testTopic: string

  beforeAll(async () => {
    testTopic = uuidV4()
    await KafkaAdminInstance.createTopic(testTopic)
  })
  afterAll(async () => {
    await KafkaAdminInstance.deleteTopic(testTopic)
    await KafkaAdminInstance.disconnect()
  })
  it('should produce a kafka message', async () => {
    const messageValue = uuidV4()
    const consumedMessages: KafkaMessage[] = []
    const consumer = await ConsumerFactory.getConsumer({topics: [testTopic]}, {groupId: uuidV4()})
    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    const producer = await ProducerFactory.getProducer()
    await producer.send({
      topic: testTopic,
      messages: [{
        key: uuidV4(),
        value: messageValue
      }]
    })

    while (consumedMessages.length < 1) {
      await sleep(100)
    }
    expect(consumedMessages.map(({value}) => value.toString())).toContain(messageValue)
    await consumer.disconnect()
    await producer.disconnect()
  })
  it('should produce many kafka messages', async () => {
    const numberOfMessages = Math.floor(Math.random() * 100)
    const producedMessages: Message[] = new Array(numberOfMessages).fill({}).map(() => ({key: uuidV4(), value: uuidV4()}))
    const consumedMessages: KafkaMessage[] = []
    const consumer = await ConsumerFactory.getConsumer({topics: [testTopic]}, {groupId: uuidV4()})
    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    const producer = await ProducerFactory.getProducer()
    await producer.sendBatch({
      topicMessages: [{
        topic: testTopic,
        messages: producedMessages
      }]
    })

    while (consumedMessages.length < producedMessages.length) {
      await sleep(100)
    }
    expect(consumedMessages.length).toEqual(numberOfMessages)
    expect(producedMessages.map(messageToString)).toStrictEqual(consumedMessages.map(messageToString))
    await consumer.disconnect()
    await producer.disconnect()
  })
  it('should crate a topic from event signature', async () => {
    const eventSignature = 'Event(uint256)'
    const eventHash = (new Web3(RPCS.POLYGON)).eth.abi.encodeEventSignature(eventSignature)
    await KafkaAdminInstance.createTopicFromEventSignature(eventSignature)
    const topics = await KafkaAdminInstance.listTopics()
    expect(topics).toContain(eventHash)
    await KafkaAdminInstance.deleteTopic(eventHash)
  })
});
