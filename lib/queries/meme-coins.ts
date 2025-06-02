import { gql } from '@/lib/graphql-client'

export const GET_COLLECTION_TOKENS = gql`
  query GetCollectionTokens($owner: String!, $first: Int = 500) {
    collectionTokens(
      orderBy: createdAt
      orderDirection: desc
      first: $first
      where: { owner: $owner }
    ) {
      id
      symbol
      baseURI
      name
      pool {
        positionManager
      }
    }
  }
`