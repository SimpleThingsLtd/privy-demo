'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { usePrivy, useCrossAppAccounts } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount, useBalance, useWalletClient } from 'wagmi'
import Link from 'next/link'
import type { CrossAppAccount } from '@privy-io/react-auth'
import { useNetwork } from '@/contexts/NetworkContext'
import { ReadFlaunchSDK, ReadWriteFlaunchSDK, createFlaunch } from '@flaunch/sdk'
import { 
  createPublicClient, 
  http, 
  encodeFunctionData, 
  parseAbi, 
  decodeFunctionData,
  createWalletClient,
  custom 
} from 'viem'

// ABI for decoding the hack calldata
const encodedCallAbi = parseAbi([
  "function call(address to, uint256 value, bytes cdata)",
])

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
  positionManager?: string // Add position manager address from API
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
  const { data: walletClient } = useWalletClient()
  const { client: smartWalletClient } = useSmartWallets()
  const { selectedNetwork } = useNetwork()
  const [crossAppAccount, setCrossAppAccount] = useState<CrossAppAccount | null>(null)
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flaunchSDK, setFlaunchSDK] = useState<ReadFlaunchSDK | null>(null)
  const [tokenPrices, setTokenPrices] = useState<{[key: string]: number}>({})

  // Create the hacked write SDK for extracting calldata (following dev's exact pattern)
  const flaunchWrite = useMemo(() => {
    if (!walletClient) return null;
    
    // Note: overwrites the default viem adapter writeContract method
    // to return the encoded call for supporting batching
    const _walletClient = walletClient.extend((client) => ({
      async writeContract(args: any) {
        const to = args.address;
        const value = args.value ?? BigInt(0);

        // @ts-ignore
        const calldata = encodeFunctionData({
          abi: args.abi,
          functionName: args.functionName,
          args: args.args,
        });

        const encodedCall = encodeFunctionData({
          abi: encodedCallAbi,
          functionName: "call",
          args: [to, value, calldata],
        });

        return encodedCall;
      },
    }));

    return createFlaunch({
      publicClient: createPublicClient({
        chain: selectedNetwork,
        transport: http(),
      }),
      walletClient: _walletClient,
    }) as ReadWriteFlaunchSDK;
  }, [selectedNetwork, walletClient])

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

  // Transaction validation function
  const validateTransaction = async (token: TokenData, ethAmount: bigint) => {
    // Check if token has position manager
    if (!token.positionManager) {
      throw new Error('This token does not have a position manager configured')
    }

    // Check wallet balance
    if (!hasSufficientBalance) {
      throw new Error('Insufficient ETH balance. Need at least 0.0002 ETH including gas fees.')
    }

    // Check if token is valid using SDK
    try {
      const isValid = await flaunchSDK!.isValidCoin(token.tokenAddress as `0x${string}`)
      if (!isValid) {
        throw new Error('This token is not a valid Flaunch coin')
      }
    } catch (error) {
      console.warn('Could not validate token:', error)
      // Continue anyway - validation might fail for network reasons
    }

    // Check if fair launch is still active (might affect trading)
    if (token.fairLaunchActive) {
      console.log('Token is in fair launch mode - trading might have restrictions')
    }

    return true
  }

  // Emergency function to recover ETH from position manager
  const handleRecoverETH = async (token: TokenData) => {
    const crossAppSmartWallet = crossAppAccount?.smartWallets?.[0]
    if (!crossAppSmartWallet?.address) {
      alert('Cross-app smart wallet not found')
      return
    }

    try {
      console.log('🚨 ATTEMPTING ETH RECOVERY FROM POSITION MANAGER')
      console.log('Position Manager:', token.positionManager)
      console.log('Smart Wallet:', crossAppSmartWallet.address)
      
      // Call refundETH() function (selector 0x12210e8a)
      const refundTx = {
        to: token.positionManager as `0x${string}`,
        value: '0x0', // No ETH needed
        data: '0x12210e8a', // refundETH() selector
        chainId: selectedNetwork.id,
      }
      
      console.log('Calling refundETH() on position manager...')
      const hash = await sendTransaction(refundTx, { 
        address: crossAppSmartWallet.address as `0x${string}` 
      })
      
      console.log('Recovery transaction hash:', hash)
      alert(`Recovery transaction submitted!\n\nHash: ${hash}\n\nThis should return any ETH stuck in the position manager.`)
      
    } catch (error) {
      console.error('Recovery failed:', error)
      alert(`Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou may need to contact Flaunch support.`)
    }
  }

  const handleBuy = async (token: TokenData) => {
    if (!flaunchSDK) {
      console.error('Flaunch SDK not initialized')
      alert('SDK not ready, please try again')
      return
    }

    // Use Cross-App Smart Wallet instead of embedded wallet
    const crossAppSmartWallet = crossAppAccount?.smartWallets?.[0]
    if (!crossAppSmartWallet?.address) {
      console.error('Cross-app smart wallet not found')
      alert('Please ensure you have a cross-app smart wallet connected')
      return
    }

    const smartWalletAddress = crossAppSmartWallet.address
    console.log('Using cross-app smart wallet:', smartWalletAddress)

    try {
      const ethAmount = BigInt(Math.floor(0.0001 * 1e18)) // 0.0001 ETH in wei
      
      // Validate transaction before proceeding
      await validateTransaction(token, ethAmount)
      
      // The flaunchWrite SDK should always be available now with our dummy wallet
      if (!flaunchWrite) {
        throw new Error('Failed to initialize SDK for calldata generation')
      }
      
      // Get quote data from the SDK for pricing info
      let tokensExpected = 0
      let amountOutMin = BigInt(0)
      
      try {
        const rawTokensExpected = await flaunchSDK.getBuyQuoteExactInput(token.tokenAddress as `0x${string}`, ethAmount)
        console.log('Raw tokens from SDK:', rawTokensExpected.toString())
        
        // The SDK returns the raw amount (in token's smallest unit)
        // For display, we need to format it (assuming 18 decimals)
        tokensExpected = Number(rawTokensExpected) / 1e18
        console.log('Formatted tokens expected:', tokensExpected.toLocaleString())
        
        // For slippage calculation, use the raw amount
        amountOutMin = BigInt(Math.floor(Number(rawTokensExpected) * 0.995))
        console.log('Amount out min (with slippage):', amountOutMin.toString())
      } catch (quoteError) {
        console.warn('Could not get quote:', quoteError)
        throw new Error('Unable to get price quote for this token')
      }

      console.log('🔧 Extracting calldata using SDK hack...')
      console.log('🔍 SDK Debug Info:')
      console.log('- Embedded wallet (signer):', crossAppAccount?.embeddedWallets?.[0]?.address)
      console.log('- Smart wallet (executor):', smartWalletAddress)
      console.log('- flaunchWrite available:', !!flaunchWrite)
      
      // Try the SDK hack with a simpler wallet client setup
      try {
        console.log('🔧 Attempting SDK hack with smart wallet as signer...')
        
        // Create a simple wallet client using the smart wallet directly
        const smartWalletClient = createWalletClient({
          account: smartWalletAddress as `0x${string}`,
          chain: selectedNetwork,
          transport: http(),
        }).extend((client) => ({
          async writeContract(args: any) {
            const to = args.address;
            const value = args.value ?? BigInt(0);

            const calldata = encodeFunctionData({
              abi: args.abi,
              functionName: args.functionName,
              args: args.args,
            });

            const encodedCall = encodeFunctionData({
              abi: encodedCallAbi,
              functionName: "call",
              args: [to, value, calldata],
            });

            return encodedCall;
          },
        }));

        // Create a fresh SDK instance with the smart wallet client
        const smartWalletSDK = createFlaunch({
          publicClient: createPublicClient({
            chain: selectedNetwork,
            transport: http(),
          }),
          walletClient: smartWalletClient,
        }) as ReadWriteFlaunchSDK;
        
        // Use the hack to extract calldata from the SDK's buyCoin method
        const encodedCall = await smartWalletSDK.buyCoin({
          coinAddress: token.tokenAddress as `0x${string}`,
          slippagePercent: 0.5, // 0.5% slippage
          swapType: "EXACT_IN" as const,
          amountIn: ethAmount,
          referrer: undefined,
        })
        
        console.log('✅ SDK hack successful, got encoded call')
        
        // Decode the call to get the actual transaction data
        const call = decodeFunctionData({
          abi: encodedCallAbi,
          data: encodedCall as `0x${string}`,
        })

        const tx = {
          to: call.args[0], // Contract address from SDK
          value: `0x${call.args[1].toString(16)}`, // ETH value from SDK as hex string
          data: call.args[2], // Proper calldata from SDK
          chainId: selectedNetwork.id,
        }

        console.log('🔄 Transaction Details:')
        console.log('- Smart Wallet:', smartWalletAddress)
        console.log('- Token:', token.symbol, token.tokenAddress)
        console.log('- Contract To:', call.args[0])
        console.log('- ETH Value:', call.args[1].toString())
        console.log('- Expected Tokens:', tokensExpected.toLocaleString())
        console.log('- Min Tokens (with slippage):', amountOutMin.toString())
        console.log('\n\ud83d\udd0d FULL SDK HACK CALLDATA FOR TENDERLY:')
        console.log('Contract Address:', call.args[0])
        console.log('Value (hex):', `0x${call.args[1].toString(16)}`)
        console.log('Calldata:')
        console.log(call.args[2])
        console.log('\n\ud83d\udccb TENDERLY SIMULATION PARAMS:')
        console.log(`{
  "to": "${call.args[0]}",
  "value": "0x${call.args[1].toString(16)}",
  "data": "${call.args[2]}",
  "from": "${smartWalletAddress}"
}`)
        console.log('\n')
        
        // Execute transaction with smart wallet (paymaster covers gas, smart wallet provides swap ETH)
        // This follows the same pattern as /profile page
        const hash = await sendTransaction(tx, { 
          address: smartWalletAddress as `0x${string}` 
        })
        
        console.log('✅ Transaction Hash:', hash)
        
        // Show success message without blocking UI
        const successMessage = `🎉 Purchase Successful!\n\nTransaction: ${hash}\nExpected: ${tokensExpected.toLocaleString()} ${token.symbol}\n\nRefreshing in 3 seconds...`
        alert(successMessage)
        
        // Refresh to show updated balances
        setTimeout(() => {
          window.location.reload()
        }, 3000)
        
        return; // Exit successfully
        
      } catch (sdkError) {
        console.warn('SDK hack failed, trying manual approach:', sdkError)
        
        // Manual fallback: construct Universal Router transaction manually using SDK utilities
        console.log('🔨 Building Universal Router transaction manually...')
        
        try {
          // Get the position manager address for this token
          if (!token.positionManager) {
            throw new Error('Position manager address not available for manual construction')
          }
          
          // Since the Universal Router utilities aren't exported, let's build the transaction manually
          // We need to construct the Universal Router transaction ourselves
          
          // Universal Router uses commands and inputs pattern
          // Command 0x0c is V4_SWAP (swap on Uniswap V4)
          const commands = '0x0c'
          
          // For now, let's use a simpler approach - call the position manager directly
          // This mimics what the SDK would do but without the complex Universal Router
          
          // The position manager doesn't have direct swap functions - we need Universal Router
          // Flaunch uses Universal Router for all swaps, not direct position manager calls
          console.log('Building Universal Router transaction for Flaunch...')
          
          // Universal Router ABI for execute function
          const universalRouterAbi = parseAbi([
            'function execute(bytes commands, bytes[] inputs) external payable',
            'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable'
          ])
          
          // Build Universal Router transaction for Uniswap V4 swap
          let routerData: { calldata: string, targetContract: string } = { 
            calldata: '0x', 
            targetContract: token.positionManager as string
          }
          let strategy = 'Empty calldata fallback'
          
          try {
            // Get correct Flaunch Universal Router address for the selected network
            const flaunchUniversalRouterAddresses: { [key: number]: string } = {
              8453: "0x6fF5693b99212Da76ad316178A184AB56D299b43", // Base
              84532: "0x492E6456D9528771018DeB9E87ef7750EF184104", // Base Sepolia
            }
            const universalRouterAddress = flaunchUniversalRouterAddresses[selectedNetwork.id]
            
            if (!universalRouterAddress) {
              throw new Error(`Flaunch Universal Router not available for network ${selectedNetwork.name}`)
            }
            
            // Use ETH directly - Universal Router will handle ETH→flETH conversion
            // Command 0x0c = V4_SWAP
            const commands = '0x0c'
            
            // Simple V4 swap - let the contracts handle ETH conversion
            const swapInputData = encodeFunctionData({
              abi: parseAbi([
                'function v4Swap(uint256 amountIn, uint256 amountOutMin, address tokenOut, address recipient)'
              ]),
              functionName: 'v4Swap', 
              args: [
                ethAmount, // ETH amount to swap
                amountOutMin, // minimum tokens to receive
                token.tokenAddress as `0x${string}`, // token to receive
                smartWalletAddress as `0x${string}` // recipient
              ]
            })
            
            const swapInputs = [swapInputData]
            
            // Create the Universal Router execute call
            const calldata = encodeFunctionData({
              abi: universalRouterAbi,
              functionName: 'execute',
              args: [
                commands,
                swapInputs
              ]
            })
            
            console.log('Generated Universal Router V4 swap calldata:', calldata)
            
            routerData = {
              calldata: calldata,
              targetContract: universalRouterAddress
            }
            strategy = 'Universal Router V4 swap'
            
          } catch (universalRouterError) {
            console.warn('Universal Router encoding failed, trying fallback to position manager unlock:', universalRouterError)
            
            // Fallback: Use position manager's unlock callback pattern
            try {
              // Position managers in V4 use unlock/callback pattern
              const unlockAbi = parseAbi([
                'function unlock(bytes calldata data) external returns (bytes memory result)'
              ])
              
              // Create unlock data for swap
              const unlockData = encodeFunctionData({
                abi: parseAbi([
                  'function swap(address tokenOut, uint256 amountOutMin, address recipient)'
                ]),
                functionName: 'swap',
                args: [
                  token.tokenAddress as `0x${string}`,
                  amountOutMin,
                  smartWalletAddress as `0x${string}`
                ]
              })
              
              const calldata = encodeFunctionData({
                abi: unlockAbi,
                functionName: 'unlock',
                args: [unlockData]
              })
              
              console.log('Generated position manager unlock calldata:', calldata)
              
              routerData = {
                calldata: calldata,
                targetContract: token.positionManager as string
              }
              strategy = 'Position manager unlock callback'
              
            } catch (unlockError) {
              console.warn('All encoding approaches failed, using empty calldata as final fallback:', unlockError)
              // routerData remains with empty calldata to position manager
              strategy = 'Empty calldata fallback (all encoding failed)'
            }
          }
          
          console.log('\ud83d\udcdd Manual transaction parameters:')
          console.log('- Token address:', token.tokenAddress)
          console.log('- Amount out min (raw):', amountOutMin.toString())
          console.log('- Amount out min (formatted):', (Number(amountOutMin) / 1e18).toLocaleString())
          console.log('- Strategy:', strategy)
          
          console.log('✅ Manual transaction constructed')
          console.log('- Calldata length:', routerData.calldata.length)
          console.log('- Target contract:', routerData.targetContract)
          
          // Use either Universal Router or Position Manager based on strategy
          const targetContract = routerData.targetContract as `0x${string}`
          
          const tx = {
            to: targetContract,
            value: `0x${ethAmount.toString(16)}`, // ETH amount as hex
            data: routerData.calldata,
            chainId: selectedNetwork.id,
          }

          console.log('🔄 Manual Transaction Details:')
          console.log('- Smart Wallet:', smartWalletAddress)
          console.log('- Token:', token.symbol, token.tokenAddress)
          console.log('- Target Contract:', targetContract)
          console.log('- ETH Value (wei):', ethAmount.toString())
          console.log('- ETH Value (ETH):', (Number(ethAmount) / 1e18).toFixed(6))
          console.log('- Expected Tokens (formatted):', tokensExpected.toLocaleString())
          console.log('- Min Tokens (with slippage):', amountOutMin.toString())
          console.log('\n\ud83d\udd0d FULL CALLDATA FOR TENDERLY:')
          console.log('Contract Address:', targetContract)
          console.log('Value (hex):', `0x${ethAmount.toString(16)}`)
          console.log('Calldata:')
          console.log(routerData.calldata)
          console.log('\n\ud83d\udccb TENDERLY SIMULATION PARAMS:')
          console.log(`{
  "to": "${targetContract}",
  "value": "0x${ethAmount.toString(16)}",
  "data": "${routerData.calldata}",
  "from": "${smartWalletAddress}"
}`)
          console.log('\n')
          
          // Execute transaction with smart wallet (paymaster covers gas, smart wallet provides swap ETH)
          const hash = await sendTransaction(tx, { 
            address: smartWalletAddress as `0x${string}` 
          })
          
          console.log('✅ Manual Transaction Hash:', hash)
          
          // Show success message without blocking UI
          const successMessage = `🎉 Purchase Successful!\n\nTransaction: ${hash}\nExpected: ~${tokensExpected.toLocaleString()} ${token.symbol}\n\nRefreshing in 3 seconds...`
          alert(successMessage)
          
          // Refresh to show updated balances
          setTimeout(() => {
            window.location.reload()
          }, 3000)
          
        } catch (manualError) {
          console.error('Manual position manager transaction failed:', manualError)
          const manualErrorMessage = manualError instanceof Error ? manualError.message : 'Unknown manual error'
          
          // Handle specific error cases
          if (manualErrorMessage.includes('User rejected request') || manualErrorMessage.includes('rejected')) {
            throw new Error('Transaction was cancelled by user. Please try again and approve the transaction when prompted.')
          }
          
          const sdkErrorMessage = sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
          throw new Error(`Both SDK hack and manual construction failed. SDK Error: ${sdkErrorMessage}. Manual Error: ${manualErrorMessage}`)
        }
      }

      
    } catch (error) {
      console.error('Error during token purchase:', error)
      
      // Provide more helpful error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('insufficient funds')) {
        alert('Insufficient ETH balance. Please add more ETH to your wallet.')
      } else if (errorMessage.includes('slippage')) {
        alert('Price changed too much during transaction. Please try again.')
      } else {
        alert(`Transaction failed: ${errorMessage}`)
      }
    }
  }

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
                {(crossAppAccount?.smartWallets?.[0]?.address || crossAppAccount?.embeddedWallets?.[0]?.address) ? (
                  <div className="space-y-2">
                    {crossAppAccount?.smartWallets?.[0]?.address && (
                      <p className="text-xs text-gray-500">
                        Smart wallet: {crossAppAccount.smartWallets[0].address.slice(0, 6)}...{crossAppAccount.smartWallets[0].address.slice(-4)}
                      </p>
                    )}
                    {crossAppAccount?.embeddedWallets?.[0]?.address && (
                      <p className="text-xs text-gray-500">
                        Embedded wallet: {crossAppAccount.embeddedWallets[0].address.slice(0, 6)}...{crossAppAccount.embeddedWallets[0].address.slice(-4)}
                      </p>
                    )}
                    {balanceLoading ? (
                      <p className="text-xs text-gray-500">Loading balance...</p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Balance: {currentBalance.toFixed(6)} ETH on {selectedNetwork.name}
                      </p>
                    )}
                    {token.positionManager && (
                      <p className="text-xs text-green-600">
                        ✅ Position Manager: {token.positionManager.slice(0, 6)}...{token.positionManager.slice(-4)}
                      </p>
                    )}
                    {!token.positionManager && (
                      <p className="text-xs text-red-500">
                        ❌ No position manager configured
                      </p>
                    )}
                    {hasSufficientBalance && token.positionManager ? (
                      <div className="space-y-2">
                        <button 
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          onClick={() => handleBuy(token)}
                        >
                          Buy 0.0001 ETH (~$0.25) 
                        </button>
                        <button 
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                          onClick={() => handleRecoverETH(token)}
                        >
                          🚨 Recover Stuck ETH
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <button 
                          className="w-full px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                          disabled
                        >
                          Buy 0.0001 ETH (~$0.25) 
                        </button>
                        {!hasSufficientBalance && (
                          <p className="text-xs text-red-500">
                            Insufficient balance. Need ~0.0002 ETH (including gas)
                          </p>
                        )}
                        {!token.positionManager && (
                          <p className="text-xs text-red-500">
                            Position manager not configured
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-500">Cross-app wallet not available</p>
                    <button 
                      className="w-full px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                      disabled
                    >
                      Buy 0.0001 ETH (~$0.25) 
                    </button>
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