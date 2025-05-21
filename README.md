# Privy NextJS Demo

This is a demo Next.js app that showcases authentication and wallet connection using [Privy](https://privy.io/) and [RainbowKit](https://rainbowkit.com/). It demonstrates how to let users log in with Privy (including Flaunch wallets) and connect their wallets via RainbowKit, supporting the Base and Base Sepolia networks.

## Features
- **Privy Authentication:** Login and manage users with Privy, including Flaunch wallet support.
- **RainbowKit Integration:** Connect EVM wallets using RainbowKit UI.
- **Base & Base Sepolia Support:** Only these chains are enabled for wallet connection.
- **User Details:** View connected account details, including wallet addresses and cross-app accounts.

## How it Works
- The app uses a `Providers` component to wrap the app with Privy, Wagmi, RainbowKit, and React Query providers.
- Only the Privy wallet (Flaunch) is available for connection in RainbowKit.
- Users can log in with Privy, connect their wallet, and view their account details.

## Setup

### 1. Clone the repository
```sh
git clone https://github.com/YOUR_GITHUB_USERNAME/privy-demo.git
cd privy-demo
```

### 2. Install dependencies
```sh
npm install
# or
yarn install
```

### 3. Configure environment variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_PRIVY_PROVIDER_ID=your-privy-provider-id
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-walletconnect-project-id
```

### 4. Run the development server
```sh
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Example: Providers Setup
```tsx
// app/providers.tsx
'use client'
import React, { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit'
import { toPrivyWallet } from '@privy-io/cross-app-connect/rainbow-kit'
import '@rainbow-me/rainbowkit/styles.css'
import type { Chain } from 'wagmi/chains'

const queryClient = new QueryClient()
const supportedChains: readonly [Chain, ...Chain[]] = [base, baseSepolia]
const connectors = connectorsForWallets([
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
], { appName: 'Privy NextJS Demo', projectId: 'demo' })
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
        appearance: { theme: 'light' },
        loginMethodsAndOrder: {
          primary: ['email', 'google', `privy:${process.env.NEXT_PUBLIC_PRIVY_PROVIDER_ID}`]
        },
        defaultChain: base,
        supportedChains: [...supportedChains]
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={lightTheme()}>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
}
```

## Example: Privy Login Button
```tsx
<button
  onClick={handlePrivyLogin}
  disabled={!ready || (isAnyAuthActive && !authenticated)}
  className="px-6 py-3 text-white bg-blue-600 rounded-lg disabled:bg-gray-400"
>
  {authenticated ? 'Disconnect Privy' : 'Login with Privy'}
</button>
```

## License
MIT
