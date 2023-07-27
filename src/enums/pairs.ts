import {Chain} from "./rpcs"

// I guess these will be retired soon since we will be storing this data in a topic.
export enum MATIC_USDC {
  WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  USDC = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  CHAIN = Chain.Polygon,
  QuickSwap_Address = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32'
}

export enum ETH_AAVE {
  ETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  AAVE = "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
  CHAIN = Chain.Polygon,
  QuickSwap_Address = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32'
}
