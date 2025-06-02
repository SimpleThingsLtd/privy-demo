export interface MemeCoin {
  id: string
  symbol: string
  baseURI: string
  name: string
  image?: string
  pool?: {
    positionManager: string
  }
}

export interface CollectionTokensResponse {
  collectionTokens: MemeCoin[]
}

export interface Config {
  id: string
  locked: boolean
  lockerPaused: boolean
  collectionCount: string
}

export interface ConfigsResponse {
  configs: Config[]
}

export interface User {
  id: string
  aggregates: Array<{ id: string }>
  holdings: Array<{ id: string }>
  ownedNFTs: Array<{ id: string }>
}

export interface UsersResponse {
  users: User[]
} 