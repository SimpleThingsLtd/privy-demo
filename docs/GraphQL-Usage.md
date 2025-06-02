# GraphQL Client Usage Guide

This document explains how to use the reusable GraphQL client structure in this application.

## Overview

The GraphQL client is built using `urql` and provides a clean, reusable way to make GraphQL queries throughout the application. The structure includes:

- **GraphQL Client**: Centralized configuration with authentication
- **Custom Hook**: Simplified interface for making queries
- **Query Definitions**: Organized GraphQL queries
- **Type Definitions**: TypeScript interfaces for type safety

## File Structure

```
lib/
├── graphql-client.ts          # GraphQL client configuration
├── hooks/
│   └── useGraphQL.ts         # Custom hook for queries
├── queries/
│   └── meme-coins.ts         # GraphQL query definitions
└── types/
    └── graphql.ts            # TypeScript interfaces

components/
└── GraphQLProvider.tsx       # Provider component
```

## Configuration

The GraphQL client is configured in `lib/graphql-client.ts`:

```typescript
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
```

## Usage

### 1. Basic Query Usage

```typescript
import { useGraphQL } from '@/lib/hooks/useGraphQL'
import { GET_COLLECTION_TOKENS } from '@/lib/queries/meme-coins'
import type { CollectionTokensResponse } from '@/lib/types/graphql'

function MyComponent() {
  const { data, loading, error } = useGraphQL<CollectionTokensResponse>(
    GET_COLLECTION_TOKENS,
    {
      variables: { owner: walletAddress },
      pause: !walletAddress, // Pause query if no wallet address
    }
  )

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      {data?.collectionTokens.map(token => (
        <div key={token.id}>{token.name}</div>
      ))}
    </div>
  )
}
```

### 2. Adding New Queries

To add a new query:

1. **Define the query** in `lib/queries/meme-coins.ts`:
```typescript
export const GET_NEW_DATA = gql`
  query GetNewData($param: String!) {
    newData(where: { param: $param }) {
      id
      name
      value
    }
  }
`
```

2. **Add TypeScript types** in `lib/types/graphql.ts`:
```typescript
export interface NewData {
  id: string
  name: string
  value: string
}

export interface NewDataResponse {
  newData: NewData[]
}
```

3. **Use in your component**:
```typescript
const { data, loading, error } = useGraphQL<NewDataResponse>(
  GET_NEW_DATA,
  { variables: { param: 'some-value' } }
)
```

### 3. Query Options

The `useGraphQL` hook accepts these options:

- `variables`: Variables to pass to the query
- `pause`: Boolean to pause/resume the query

```typescript
const { data, loading, error } = useGraphQL(QUERY, {
  variables: { id: '123' },
  pause: !shouldFetch,
})
```

### 4. Error Handling

The hook returns error information that you can use for user feedback:

```typescript
if (error) {
  return (
    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg">
      <p>Error: {error.message}</p>
    </div>
  )
}
```

## Examples

See the following files for complete examples:

- `app/list-memes/page.tsx` - Real-world usage with wallet integration
- `app/example-queries/page.tsx` - Multiple queries demonstration

## Benefits

1. **Reusability**: Same hook works for all GraphQL queries
2. **Type Safety**: Full TypeScript support with proper interfaces
3. **Caching**: Built-in caching with urql
4. **Error Handling**: Consistent error handling across the app
5. **Authentication**: Centralized API key management
6. **Performance**: Automatic query pausing and optimization

## Migration from Fetch

If you have existing `fetch` calls, you can migrate them:

**Before:**
```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '...' })
})
const data = await response.json()
```

**After:**
```typescript
const { data, loading, error } = useGraphQL(QUERY, { variables })
```

This provides better error handling, caching, and type safety. 