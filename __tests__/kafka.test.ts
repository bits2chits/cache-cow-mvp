import {jest} from '@jest/globals'
import {uuidV4} from "web3-utils"
import {createAdmin, createConsumer, createProducer} from "../src/kafka"
import {Admin, Consumer, Producer, Message, KafkaMessage} from "kafkajs"
import {sleep} from "../src/libs/sleep"

jest.setTimeout(100000)

describe('Tests Kafka', () => {
  let producer: Producer
  let consumer: Consumer
  let admin: Admin
  let testTopic: string

  beforeAll(async () => {
    testTopic = uuidV4()
    // initialize admin
    admin = await createAdmin()
    await admin.connect()
    await admin.createTopics({
      topics: [{topic: testTopic}],
      waitForLeaders: false
    })
    // initialize producer
    producer = await createProducer()
    await producer.connect()
    // initialize consumer
    consumer = await createConsumer({groupId: uuidV4()})
    await consumer.connect()
    await consumer.subscribe({topic: testTopic, fromBeginning: true})
  })
  afterAll(async () => {
    await producer?.disconnect()
    await consumer?.disconnect()
    await admin.deleteTopics({topics: [testTopic]})
    await admin.disconnect()
  })
  afterEach(async () => {
    await consumer.stop()
  })
  it('should produce a kafka message', async () => {
    const messageValue = uuidV4()
    const consumedMessages: KafkaMessage[] = []
    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    await producer.send({
      topic: testTopic,
      messages: [{
        value: messageValue
      }]
    })

    while (consumedMessages.length < 1) {
      await sleep(100)
    }
    expect(consumedMessages.map(({value}) => value.toString())).toContain(messageValue)
  })
  it('should produce many kafka messages', async () => {
    const numberOfMessages = Math.floor(Math.random() * 100)
    const producedMessages: Message[] = new Array(numberOfMessages).fill({}).map(() => ({value: uuidV4()}))
    const consumedMessages: KafkaMessage[] = []

    await consumer.run({
      eachMessage: async ({message}) => {
        consumedMessages.push(message)
      }
    })
    await producer.send({
      topic: testTopic,
      messages: producedMessages
    })

    while (consumedMessages.length < producedMessages.length) {
      await sleep(100)
    }
    expect(consumedMessages.length).toBeGreaterThanOrEqual(numberOfMessages)
    expect(producedMessages.map(({value}) => value))
      .toStrictEqual(consumedMessages.map(({value}) => value.toString()))
  })
});
