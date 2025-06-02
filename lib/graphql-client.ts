import { createClient, cacheExchange, fetchExchange } from 'urql'

const GRAPH_API_URL = 'https://gateway.thegraph.com/api/subgraphs/id/bbWLZuPrmoskDaU64xycxZFE6EvSkMQALKkDpsz5ifF'
const API_KEY = '8df065bb8b436c77ebbde2962e54db23'

export const graphqlClient = createClient({
  url: GRAPH_API_URL,
  fetchOptions: {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  },
  exchanges: [cacheExchange, fetchExchange],
})

export { gql } from 'urql' 