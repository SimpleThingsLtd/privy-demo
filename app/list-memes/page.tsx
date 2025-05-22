'use client'

import React, { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import type { CrossAppAccount } from '@privy-io/react-auth'

interface MemeCoin {
  id: string
  symbol: string
  baseURI: string
  name: string
  image?: string
}

export default function ListMemesPage() {
  const { user, authenticated } = usePrivy()
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount()
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)
  const [memeCoins, setMemeCoins] = useState<MemeCoin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Fetch meme coins
  useEffect(() => {
    const fetchMemeCoins = async () => {
      if (!walletAddress) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch('https://g.flayerlabs.xyz/flaunch/base-mainnet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query {
                collectionTokens(
                  orderBy: createdAt
                  orderDirection: desc
                  first: 500
                  where: { owner: "${walletAddress}" }
                ) {
                  id
                  symbol
                  baseURI
                  name
                }
              }
            `
          })
        })

        const data = await response.json()
        
        if (data.errors) {
          throw new Error(data.errors[0].message)
        }

        // Fetch metadata for each meme coin
        const coinsWithMetadata = await Promise.all(
          data.data.collectionTokens.map(async (coin: MemeCoin) => {
            try {
              const metadataResponse = await fetch(coin.baseURI.replace('ipfs://', 'https://ipfs.flaunch.gg/ipfs/'))
              const metadata = await metadataResponse.json()
              return {
                ...coin,
                image: metadata.image?.replace('ipfs://', 'https://images.flaunch.gg/cdn-cgi/image/width=300,height=300,anim=true,format=auto/https://ipfs.flaunch.gg/ipfs/')
              }
            } catch (error) {
              console.error(`Error fetching metadata for ${coin.name}:`, error)
              return coin
            }
          })
        )

        setMemeCoins(coinsWithMetadata)
      } catch (error: unknown) {
        console.error('Error fetching meme coins:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch meme coins')
      } finally {
        setLoading(false)
      }
    }

    fetchMemeCoins()
  }, [walletAddress])

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
      <p className="text-gray-600 mb-6">Meme coins that have been created by <code>{walletAddress}</code></p>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-lg">Loading meme coins...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg">
          <p>{error}</p>
        </div>
      ) : memeCoins.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg">No meme coins found for this wallet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memeCoins.map((coin) => (
            <div key={coin.id} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-square relative">
                {coin.image ? (
                  <img 
                    src={coin.image} 
                    alt={coin.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{coin.name}</h3>
                <p className="text-gray-600 mb-3">{coin.symbol}</p>
                <button 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  onClick={() => {/* Buy functionality to be implemented */}}
                >
                  Buy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}