import { useQuery } from 'urql'
import type { DocumentNode } from 'graphql'

interface UseGraphQLOptions {
  variables?: Record<string, unknown>
  pause?: boolean
}

export function useGraphQL<T = unknown>(
  query: string | DocumentNode,
  options: UseGraphQLOptions = {}
) {
  const [result] = useQuery<T>({
    query,
    variables: options.variables,
    pause: options.pause,
  })

  return {
    data: result.data,
    loading: result.fetching,
    error: result.error,
    stale: result.stale,
  }
} 