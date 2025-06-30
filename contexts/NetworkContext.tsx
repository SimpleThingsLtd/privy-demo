'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { base, baseSepolia } from 'wagmi/chains'
import type { Chain } from 'wagmi/chains'

type NetworkContextType = {
  selectedNetwork: Chain
  setSelectedNetwork: (network: Chain) => void
  availableNetworks: Chain[]
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}

type NetworkProviderProps = {
  children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const availableNetworks = [base, baseSepolia]
  const [selectedNetwork, setSelectedNetwork] = useState<Chain>(base)

  return (
    <NetworkContext.Provider value={{
      selectedNetwork,
      setSelectedNetwork,
      availableNetworks
    }}>
      {children}
    </NetworkContext.Provider>
  )
}