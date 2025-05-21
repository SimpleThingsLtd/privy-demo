'use client'

import React, { useState, useEffect } from 'react'
import { usePrivy, useCrossAppAccounts } from '@privy-io/react-auth'
import { useAccount, useSignMessage } from 'wagmi'
import type { CrossAppAccount } from '@privy-io/react-auth'

export default function SignMessagePage() {
  const { user, authenticated } = usePrivy()
  const { signMessage: privySignMessage } = useCrossAppAccounts()
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount()
  const { signMessage: wagmiSignMessage, isPending: isWagmiSigning } = useSignMessage()
  
  const [message, setMessage] = useState('Hello, Meme World!')
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)
  const [privySignature, setPrivySignature] = useState<string | null>(null)
  const [wagmiSignature, setWagmiSignature] = useState<string | null>(null)
  const [isPrivySigning, setIsPrivySigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

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

  // Get wallet address based on connection type
  const getWalletAddress = () => {
    if (authenticated && crossAppAccount?.embeddedWallets?.[0]?.address) {
      return crossAppAccount.embeddedWallets[0].address
    }
    
    if (wagmiIsConnected && wagmiAddress) {
      return wagmiAddress
    }
    
    return null
  }

  const walletAddress = getWalletAddress()
  const isWalletConnected = authenticated || wagmiIsConnected

  // Handle Privy signing
  const handlePrivySign = async () => {
    if (!crossAppAccount?.embeddedWallets?.[0]?.address) return
    
    const address = crossAppAccount.embeddedWallets[0].address
    setIsPrivySigning(true)
    setSignError(null)
    setPrivySignature(null)
    
    try {
      const signature = await privySignMessage(message, { address })
      setPrivySignature(signature)
    } catch (error: any) {
      console.error('Privy signing error:', error)
      setSignError(`Privy signing error: ${error.message || 'Unknown error'}`)
    } finally {
      setIsPrivySigning(false)
    }
  }

  // Handle RainbowKit/Wagmi signing
  const handleWagmiSign = async () => {
    setSignError(null)
    setWagmiSignature(null)
    
    try {
      const result = await wagmiSignMessage({ message })
      setWagmiSignature(result)
    } catch (error: any) {
      console.error('Wagmi signing error:', error)
      setSignError(`Wagmi signing error: ${error.message || 'Unknown error'}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Sign a Message</h1>
      
      {!isWalletConnected ? (
        <div className="p-6 bg-gray-50 rounded-lg border text-center">
          <p className="text-lg mb-4">Connect a wallet first to sign messages</p>
          <p className="text-gray-600">Use the Privy login or RainbowKit button in the navigation bar</p>
        </div>
      ) : (
        <>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="font-medium">Connected Address:</p>
            <code className="block mt-2 p-2 bg-white border rounded overflow-auto text-sm">{walletAddress}</code>
          </div>
          
          <div className="mb-6">
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Message to Sign
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Privy Signing Button */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-3">Privy Signing</h3>
              <button
                onClick={handlePrivySign}
                disabled={!authenticated || isPrivySigning}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPrivySigning ? 'Signing...' : 'Sign with Privy'}
              </button>
              
              {privySignature && (
                <div className="mt-3">
                  <h4 className="font-medium">Signature:</h4>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto mt-1">
                    {privySignature}
                  </p>
                </div>
              )}
            </div>
            
            {/* Wagmi Signing Button */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-3">RainbowKit Signing</h3>
              <button
                onClick={handleWagmiSign}
                disabled={!wagmiIsConnected || isWagmiSigning}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isWagmiSigning ? 'Signing...' : 'Sign with RainbowKit'}
              </button>
              
              {wagmiSignature && (
                <div className="mt-3">
                  <h4 className="font-medium">Signature:</h4>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto mt-1">
                    {wagmiSignature}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Error Display */}
          {signError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-md">
              <p>{signError}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}