'use client'

import React from 'react'
import { Provider } from 'urql'
import { graphqlClient } from '@/lib/graphql-client'

interface GraphQLProviderProps {
  children: React.ReactNode
}

export function GraphQLProvider({ children }: GraphQLProviderProps) {
  return <Provider value={graphqlClient}>{children}</Provider>
} 