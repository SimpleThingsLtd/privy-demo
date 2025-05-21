'use client'

import React, { useEffect, useState } from 'react'
import { usePrivy, useCrossAppAccounts } from '@privy-io/react-auth'
import type { CrossAppAccount } from '@privy-io/react-auth'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

export default function HomePage() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount()
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)

  // Find cross-app account when user is authenticated
  useEffect(() => {
    if (!user) {
      setCrossAppAccount(null)
      return
    }

    const foundAccount = user.linkedAccounts.find(
      (acct) =>
        acct.type === 'cross_app' &&
        acct.providerApp.id === process.env.NEXT_PUBLIC_PRIVY_PROVIDER_ID
    ) as CrossAppAccount | undefined

    setCrossAppAccount(foundAccount || null)
  }, [user])

  // Privy Login Handler
  const handlePrivyLogin = async () => {
    if (authenticated) {
      await logout()
    } else {
      await login()
    }
  }

  // Determine if any auth method is active
  const isAnyAuthActive = authenticated || wagmiIsConnected

  return (
    <main className="flex flex-col items-center gap-6 p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mt-4">Privy & RainbowKit Demo</h1>
      
      <div className="flex flex-col gap-6 w-full">
        {/* Login Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Privy Login Button */}
          <div className="p-6 border rounded-lg flex flex-col items-center">
            <h2 className="text-xl mb-4">Privy Login</h2>
            <button
              onClick={handlePrivyLogin}
              disabled={!ready || (isAnyAuthActive && !authenticated)}
              className="px-6 py-3 text-white bg-blue-600 rounded-lg disabled:bg-gray-400"
            >
              {authenticated ? 'Disconnect Privy' : 'Login with Privy'}
            </button>
          </div>

          {/* RainbowKit Login Button */}
          <div className="p-6 border rounded-lg flex flex-col items-center">
            <h2 className="text-xl mb-4">RainbowKit Login</h2>
            <div className={isAnyAuthActive && !wagmiIsConnected ? 'opacity-50 pointer-events-none' : ''}>
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Display Connected Details */}
        {isAnyAuthActive && (
          <div className="mt-6 p-6 border rounded-lg">
            <h2 className="text-xl mb-4">Connected Account Details</h2>
            
            {authenticated && (
              <div className="mb-4">
                <h3 className="font-semibold">Privy User:</h3>
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto mt-2">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            )}
            
            {crossAppAccount && (
              <div className="mb-4">
                <h3 className="font-semibold">Cross-App Account:</h3>
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto mt-2">
                  {JSON.stringify(crossAppAccount, null, 2)}
                </pre>
                
                {crossAppAccount.embeddedWallets?.[0]?.address && (
                  <div className="mt-3">
                    <h4 className="font-medium">Wallet Address:</h4>
                    <code className="p-2 bg-gray-100 rounded text-sm block mt-1">
                      {crossAppAccount.embeddedWallets[0].address}
                    </code>
                  </div>
                )}
              </div>
            )}
            
            {wagmiIsConnected && wagmiAddress && (
              <div>
                <h3 className="font-semibold">Wagmi Connected Address:</h3>
                <code className="p-2 bg-gray-100 rounded text-sm block mt-1">
                  {wagmiAddress}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}