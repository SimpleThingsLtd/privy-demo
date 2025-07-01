'use client'

// MEME COIN PURCHASE IMPLEMENTATION
// Uses Flaunch SDK for quotes and ethToMemecoin for Universal Router swaps

import React, { useEffect, useState, useCallback } from 'react'
import { usePrivy, useCrossAppAccounts } from '@privy-io/react-auth'
import { useAccount, useBalance } from 'wagmi'
import Link from 'next/link'
import type { CrossAppAccount } from '@privy-io/react-auth'
import { useNetwork } from '@/contexts/NetworkContext'
import { ReadFlaunchSDK, UniversalRouterAddress, ethToMemecoin } from '@flaunch/sdk'
import { type Address } from 'viem'

// Type for the REST API response
type TokenData = {
  tokenAddress: string
  symbol: string
  name: string
  marketCapETH: string
  createdAt: string
  fairLaunchActive: boolean
  image: string
  description: string
  positionManager?: string
}

type TokensApiResponse = {
  data: TokenData[]
  pagination: {
    limit: number
    offset: number
  }
  meta: {
    network: string
    timestamp: string
  }
}

export default function ListMemesPage() {
  const { user, authenticated } = usePrivy()
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount()
  const { sendTransaction } = useCrossAppAccounts()
  const { selectedNetwork } = useNetwork()
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flaunchSDK, setFlaunchSDK] = useState<ReadFlaunchSDK | null>(null)
  const [tokenPrices, setTokenPrices] = useState<{[key: string]: number}>({})

  // Initialize Flaunch SDK
  useEffect(() => {
    const sdk = new ReadFlaunchSDK(selectedNetwork.id)
    setFlaunchSDK(sdk)
  }, [selectedNetwork])

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

  // Get balance for the cross-app embedded wallet on selected network
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address: crossAppAccount?.embeddedWallets?.[0]?.address as `0x${string}` | undefined,
    chainId: selectedNetwork.id,
    query: {
      enabled: !!crossAppAccount?.embeddedWallets?.[0]?.address,
    },
  })

  // Check if wallet has sufficient balance (0.0001 ETH + gas fees, let's estimate 0.0002 ETH total)
  const requiredAmount = 0.0002 // ETH
  const currentBalance = balanceData ? parseFloat(balanceData.formatted) : 0
  const hasSufficientBalance = currentBalance >= requiredAmount

  // Fetch tokens from REST API
  useEffect(() => {
    const fetchTokens = async () => {
      if (!walletAddress) {
        setTokens([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Determine network string for API
        const networkName = selectedNetwork.id === 8453 ? 'base' : 'base-sepolia'
        const apiUrl = `https://dev-api.flayerlabs.xyz/v1/${networkName}/tokens?ownerAddress=${walletAddress}`
        
        const response = await fetch(apiUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch tokens: ${response.status}`)
        }

        const apiData: TokensApiResponse = await response.json()
        setTokens(apiData.data)

        // Fetch prices for each token with SDK
        if (flaunchSDK && apiData.data.length > 0) {
          apiData.data.forEach(async (token) => {
            try {
              // Get buy quote for 0.0001 ETH (converted to wei)
              const ethAmount = BigInt(Math.floor(0.0001 * 1e18)) // 0.0001 ETH in wei
              const tokensReceived = await flaunchSDK.getBuyQuoteExactInput(token.tokenAddress as `0x${string}`, ethAmount)
              const tokenPrice = Number(tokensReceived)
              setTokenPrices(prev => ({ ...prev, [token.tokenAddress]: tokenPrice }))
            } catch (priceError) {
              console.warn(`Could not fetch price for ${token.name}:`, priceError)
            }
          })
        }

      } catch (err) {
        console.error('Error fetching tokens:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch tokens')
        setTokens([])
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [walletAddress, selectedNetwork, flaunchSDK])

  // Buy function - actually purchases tokens using Universal Router
  const handleBuy = useCallback(async (token: TokenData) => {
    if (!flaunchSDK) {
      alert('SDK not ready, please try again')
      return
    }

    // Check if cross-app smart wallet is available
    const crossAppSmartWallet = crossAppAccount?.smartWallets?.[0]
    if (!crossAppSmartWallet?.address) {
      alert('Cross-app smart wallet not available')
      return
    }

    try {
      const ethAmount = BigInt(Math.floor(0.0001 * 1e18)) // 0.0001 ETH in wei
      
      console.log('🔧 Preparing token purchase...')
      console.log('Token:', token.name, token.tokenAddress)
      console.log('ETH amount:', ethAmount.toString(), 'wei')
      
      // Get expected tokens from SDK for slippage calculation
      const tokensExpected = await flaunchSDK.getBuyQuoteExactInput(
        token.tokenAddress as `0x${string}`, 
        ethAmount
      )
      
      console.log('Expected tokens from quote:', tokensExpected.toString())
      console.log('Expected tokens formatted:', (Number(tokensExpected) / 1e18).toLocaleString())
      
      // Calculate minimum tokens with 5% slippage
      const minTokensOut = (tokensExpected * BigInt(95)) / BigInt(100) // 95% of expected
      
      // Get Universal Router address for the current network
      const universalRouterAddress = UniversalRouterAddress[selectedNetwork.id]
      if (!universalRouterAddress) {
        throw new Error(`Universal Router not available on ${selectedNetwork.name}`)
      }
      
      console.log('Universal Router address:', universalRouterAddress)
      
      // For Flaunch memecoins, we need to check if a position manager is available
      if (!token.positionManager) {
        throw new Error('Token does not have a position manager configured')
      }
      
      // Use the SDK's ethToMemecoin function to get proper calldata
      const { calldata } = ethToMemecoin({
        sender: crossAppSmartWallet.address as Address,
        memecoin: token.tokenAddress as Address,
        chainId: selectedNetwork.id,
        referrer: null, // No referrer for now
        swapType: "EXACT_IN",
        amountIn: ethAmount,
        amountOutMin: minTokensOut,
        positionManagerAddress: token.positionManager as Address,
      })
      
      const tx = {
        to: universalRouterAddress as `0x${string}`,
        value: `0x${ethAmount.toString(16)}`, // ETH value as hex
        data: calldata,
        chainId: selectedNetwork.id,
      }

      console.log('🔄 Transaction Details:')
      console.log('- To (Universal Router):', universalRouterAddress)
      console.log('- Value:', ethAmount.toString(), 'wei')
      console.log('- Expected tokens:', (Number(tokensExpected) / 1e18).toLocaleString(), token.symbol)
      console.log('- Min tokens (5% slippage):', (Number(minTokensOut) / 1e18).toLocaleString(), token.symbol)
      console.log('- Recipient:', crossAppSmartWallet.address)
      console.log('- Position Manager:', token.positionManager)
      console.log('- Calldata from ethToMemecoin:', calldata)
      
      const hash = await sendTransaction(tx, { 
        address: crossAppSmartWallet.address as `0x${string}` 
      })

      console.log('✅ Transaction Hash:', hash)
      
      alert(`🎉 Purchase Successful!\n\nTransaction: ${hash}\n\nExpected: ~${(Number(tokensExpected) / 1e18).toLocaleString()} ${token.symbol}\n\nRefreshing in 3 seconds...`)
      
      // Refresh to show updated balances
      setTimeout(() => {
        window.location.reload()
      }, 3000)
      
    } catch (error) {
      console.error('Error during token purchase:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('insufficient funds')) {
        alert('Insufficient ETH balance. Please add more ETH to your wallet.')
      } else if (errorMessage.includes('slippage')) {
        alert('Price changed too much during transaction. Please try again.')
      } else if (errorMessage.includes('User rejected')) {
        alert('Transaction cancelled by user.')
      } else {
        alert(`Transaction failed: ${errorMessage}`)
      }
    }
  }, [flaunchSDK, sendTransaction, crossAppAccount, selectedNetwork])

  if (!isWalletConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-6">List Memes</h1>
        <div className="p-6 bg-gray-50 rounded-lg border">
          <p className="text-lg mb-4">Please connect your wallet to view your meme coins</p>
          <Link 
            href="/"
            className="inline-block px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Meme Coins</h1>
      <p className="text-gray-600 mb-4">Meme coins that have been created by <code>{walletAddress}</code></p>

      {/* Wallet Status Section */}
      {(crossAppAccount?.embeddedWallets?.[0]?.address || crossAppAccount?.smartWallets?.[0]?.address) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Wallet Status</h3>
          <p className="text-sm text-blue-800 mb-1">
            Network: <strong>{selectedNetwork.name}</strong>
          </p>
          {crossAppAccount?.smartWallets?.[0]?.address && (
            <p className="text-sm text-blue-800 mb-2">
              Cross-app smart wallet: <code>{crossAppAccount.smartWallets[0].address}</code>
            </p>
          )}
          {crossAppAccount?.embeddedWallets?.[0]?.address && (
            <p className="text-sm text-blue-800 mb-2">
              Cross-app embedded wallet: <code>{crossAppAccount.embeddedWallets[0].address}</code>
            </p>
          )}
          {balanceLoading ? (
            <p className="text-sm text-blue-700">Loading balance...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-blue-700">
                Current balance: <strong>{currentBalance.toFixed(6)} ETH</strong> on {selectedNetwork.name}
              </p>
              {!hasSufficientBalance && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ Insufficient Balance</p>
                  <p className="text-sm text-yellow-700">
                    You need at least 0.0002 ETH to complete transactions (including gas fees).
                    Please add funds to your cross-app wallet on the {selectedNetwork.name} network.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-lg">Loading meme coins...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg">
          <p>Error: {error}</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg">No meme coins found for this wallet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((token) => (
            <div key={token.tokenAddress} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-square relative">
                {token.image ? (
                  <img 
                    src={token.image} 
                    alt={token.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{token.name}</h3>
                <p className="text-gray-600 mb-2">{token.symbol}</p>
                {token.description && (
                  <p className="text-sm text-gray-500 mb-2">{token.description}</p>
                )}
                <p className="text-sm text-blue-600 mb-2">
                  Market Cap: {parseFloat(token.marketCapETH).toFixed(4)} ETH
                </p>
                {token.fairLaunchActive && (
                  <p className="text-sm text-orange-600 mb-2">🚀 Fair Launch Active</p>
                )}
                {tokenPrices[token.tokenAddress] && (
                  <p className="text-sm text-green-600 mb-3">
                    Price: {tokenPrices[token.tokenAddress].toLocaleString()} tokens for 0.0001 ETH
                  </p>
                )}
                
                {crossAppAccount?.smartWallets?.[0]?.address && hasSufficientBalance ? (
                  <button 
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    onClick={() => handleBuy(token)}
                  >
                    Buy 0.0001 ETH (~$0.25) 
                  </button>
                ) : (
                  <div className="space-y-1">
                    <button 
                      className="w-full px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                      disabled
                    >
                      Buy 0.0001 ETH (~$0.25) 
                    </button>
                    {!crossAppAccount?.smartWallets?.[0]?.address && (
                      <p className="text-xs text-red-500">
                        Cross-app smart wallet not available
                      </p>
                    )}
                    {!hasSufficientBalance && (
                      <p className="text-xs text-red-500">
                        Insufficient balance. Need ~0.0002 ETH (including gas)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}