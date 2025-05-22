'use client'

import React, { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { 
  RainbowKitProvider, 
  connectorsForWallets,
  lightTheme
} from '@rainbow-me/rainbowkit'
import { toPrivyWallet } from '@privy-io/cross-app-connect/rainbow-kit'
import '@rainbow-me/rainbowkit/styles.css'
import type { Chain } from 'wagmi/chains'

// Create a new QueryClient
const queryClient = new QueryClient()

// Limit to Base and Base Sepolia chains
const supportedChains: readonly [Chain, ...Chain[]] = [base, baseSepolia]

// Configure RainbowKit with the Privy wallet
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Privy Wallets',
      wallets: [
        toPrivyWallet({
          id: process.env.NEXT_PUBLIC_PRIVY_PROVIDER_ID!,
          name: 'Flaunch',
          iconUrl: 'https://flaunch.gg/icon.png'
        })
      ]
    }
  ],
  { 
    appName: 'Privy NextJS Demo',
    // projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '34357d3c125c2bcf2ce2bc3309d98715'
    projectId: 'demo'
  }
)

// Create wagmi config with the connectors
const config = createConfig({
  chains: supportedChains,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http()
  },
  connectors,
  ssr: true
})

type ProvidersProps = { children: ReactNode }

export function Providers({ children }: ProvidersProps) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'light'
        },
        // Add Flaunch as a login option in Privy
        loginMethodsAndOrder: {
          primary: [`privy:${process.env.NEXT_PUBLIC_PRIVY_PROVIDER_ID}`]
        },
        // Base network configuration
        defaultChain: base,
        supportedChains: [...supportedChains]
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider 
            theme={lightTheme()}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
}