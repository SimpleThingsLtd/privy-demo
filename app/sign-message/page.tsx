'use client'

import React, { useState, useEffect } from 'react'
import { usePrivy, useCrossAppAccounts } from '@privy-io/react-auth'
import { useAccount, useSignMessage } from 'wagmi'
import type { CrossAppAccount } from '@privy-io/react-auth'

export default function SignMessagePage() {
  const { user, authenticated } = usePrivy()
  const { signMessage: privySignMessage } = useCrossAppAccounts()
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount()
  const { signMessage: wagmiSignMessage, isPending: isWagmiSigning } = useSignMessage({
    mutation: {
      onSuccess(data) {
        setWagmiSignature(data);
      }
    }
  })
  
  const [message, setMessage] = useState('Hello, Meme World!')
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)
  const [privySignature, setPrivySignature] = useState<string | null>(null)
  const [wagmiSignature, setWagmiSignature] = useState<string | null>(null)
  const [smartWalletSignature, setSmartWalletSignature] = useState<string | null>(null)
  const [isPrivySigning, setIsPrivySigning] = useState(false)
  const [isSmartWalletSigning, setIsSmartWalletSigning] = useState(false)
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

  // Get smart wallet address
  const getSmartWalletAddress = () => {
    if (authenticated && crossAppAccount?.smartWallets?.[0]?.address) {
      return crossAppAccount.smartWallets[0].address
    }
    return null
  }

  const walletAddress = getWalletAddress()
  const smartWalletAddress = getSmartWalletAddress()
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
    } catch (error) {
      console.error('Privy signing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSignError(`Privy signing error: ${errorMessage}`)
    } finally {
      setIsPrivySigning(false)
    }
  }

  // Handle Smart Wallet signing using cross-app accounts
  const handleSmartWalletSign = async () => {
    if (!smartWalletAddress) {
      setSignError('Smart wallet not available')
      return
    }
    
    setIsSmartWalletSigning(true)
    setSignError(null)
    setSmartWalletSignature(null)
    
    try {
      console.log('=== Cross-App Smart Wallet Signing Debug ===')
      console.log('Smart wallet address:', smartWalletAddress)
      console.log('Message:', message)
      console.log('===========================================')
      
      // Use the cross-app accounts API for smart wallet signing
      const signature = await privySignMessage(message, { 
        address: smartWalletAddress 
      })
      
      setSmartWalletSignature(signature)
      console.log('Smart wallet signature successful:', signature)
    } catch (error) {
      console.error('Smart wallet signing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSignError(`Smart wallet signing error: ${errorMessage}`)
    } finally {
      setIsSmartWalletSigning(false)
    }
  }

  // Handle RainbowKit/Wagmi signing
  const handleWagmiSign = async () => {
    setSignError(null)
    setWagmiSignature(null)
    
    try {
      wagmiSignMessage({ message })
    } catch (error) {
      console.error('Wagmi signing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSignError(`Wagmi signing error: ${errorMessage}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Sign a Message</h1>
      
      {!isWalletConnected ? (
        <div className="p-6 bg-gray-50 rounded-lg border text-center">
          <p className="text-lg mb-4">Connect a wallet first to sign messages</p>
          <p className="text-gray-600">Use the Privy login or RainbowKit button in the navigation bar</p>
        </div>
      ) : (
        <>
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-medium">Connected Embedded Wallet:</p>
              <code className="block mt-2 p-2 bg-white border rounded overflow-auto text-sm">{walletAddress}</code>
            </div>
            
            {smartWalletAddress && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="font-medium">Connected Smart Wallet:</p>
                <code className="block mt-2 p-2 bg-white border rounded overflow-auto text-sm">{smartWalletAddress}</code>
              </div>
            )}
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Privy Embedded Wallet Signing */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-3">Embedded Wallet</h3>
              <p className="text-sm text-gray-600 mb-3">Sign with your cross-app embedded wallet</p>
              <button
                onClick={handlePrivySign}
                disabled={!authenticated || isPrivySigning}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
              >
                {isPrivySigning ? 'Signing...' : 'Sign with Embedded Wallet'}
              </button>
              
              {privySignature && (
                <div>
                  <h4 className="font-medium text-sm">Signature:</h4>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto mt-1">
                    {privySignature}
                  </p>
                </div>
              )}
            </div>

            {/* Smart Wallet Signing */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-3">Smart Wallet</h3>
              <p className="text-sm text-gray-600 mb-3">Sign with your cross-app smart wallet</p>
              <button
                onClick={handleSmartWalletSign}
                disabled={!smartWalletAddress || isSmartWalletSigning}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
              >
                {isSmartWalletSigning ? 'Signing...' : 'Sign with Smart Wallet'}
              </button>
              
              {!smartWalletAddress && authenticated && (
                <p className="text-xs text-gray-500 mb-2">No smart wallet found</p>
              )}
              
              {smartWalletSignature && (
                <div>
                  <h4 className="font-medium text-sm">Signature:</h4>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto mt-1">
                    {smartWalletSignature}
                  </p>
                </div>
              )}
            </div>
            
            {/* RainbowKit/Wagmi Signing */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-3">RainbowKit</h3>
              <p className="text-sm text-gray-600 mb-3">Sign with connected RainbowKit wallet</p>
              <button
                onClick={handleWagmiSign}
                disabled={!wagmiIsConnected || isWagmiSigning}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
              >
                {isWagmiSigning ? 'Signing...' : 'Sign with RainbowKit'}
              </button>
              
              {wagmiSignature && (
                <div>
                  <h4 className="font-medium text-sm">Signature:</h4>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto mt-1">
                    {wagmiSignature}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Error Display */}
          {signError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-md mb-6">
              <p>{signError}</p>
            </div>
          )}

          {/* Wallet Types Explanation */}
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-semibold text-amber-900 mb-2">🔍 Wallet Types Explained</h3>
            <div className="text-sm text-amber-800 space-y-2">
              <div>
                <strong>Embedded Wallet:</strong> Your cross-app embedded wallet used for signing and basic operations.
              </div>
              <div>
                <strong>Smart Wallet:</strong> Your cross-app smart wallet that provides advanced features like gasless transactions and account abstraction.
              </div>
              <div>
                <strong>RainbowKit:</strong> External wallet connected through RainbowKit (MetaMask, WalletConnect, etc.).
              </div>
            </div>
          </div>
        </>
      )}

      {/* Simplified Example Section */}
      <div className="mt-12 pt-8 border-t">
        <h2 className="text-2xl font-bold mb-4">Simplified Example</h2>
        <div className="p-4 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-600 mb-4">Here&apos;s a simplified version of the message signing functionality:</p>
          <pre className="bg-white p-4 rounded border overflow-auto text-sm">
{`import {usePrivy, useCrossAppAccounts} from '@privy-io/react-auth';

function Button() {
  const {user} = usePrivy();
  const {signMessage} = useCrossAppAccounts();
  const crossAppAccount = user.linkedAccounts.find((account) => account.type === 'cross_app');
  const address = crossAppAccount.embeddedWallets[0].address;

  return (
    <button onClick={() => signMessage('Hello world', {address: address})} disabled={!address}>
      Sign a message with your cross-app wallet
    </button>
  );
}`}
          </pre>
          
          {/* Live Implementation of Simplified Example */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-3">Try the Simplified Version:</h3>
            <SimpleSignButton />
          </div>
        </div>
      </div>
    </div>
  )
}

// Simplified Example Implementation
function SimpleSignButton() {
  const { user } = usePrivy()
  const { signMessage } = useCrossAppAccounts()
  const [signature, setSignature] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crossAppAccount = user?.linkedAccounts.find(
    (account) => account.type === 'cross_app'
  )
  const address = crossAppAccount?.embeddedWallets?.[0]?.address

  const handleSign = async () => {
    if (!address) return
    
    setIsSigning(true)
    setError(null)
    setSignature(null)
    
    try {
      const result = await signMessage('Hello world', { address })
      setSignature(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign message')
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleSign}
        disabled={!address || isSigning}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSigning ? 'Signing...' : 'Sign with Simplified Example'}
      </button>

      {signature && (
        <div className="p-3 bg-gray-50 rounded border">
          <p className="font-medium mb-1">Signature:</p>
          <p className="text-xs font-mono bg-white p-2 rounded overflow-auto">
            {signature}
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-md">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}