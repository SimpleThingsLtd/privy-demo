'use client'

import { usePrivy, useWallets, useCrossAppAccounts } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { base } from 'viem/chains'

type CrossAppWallet = {
    address: string
    type: 'embedded' | 'smart'
    isConnected: boolean
}

export default function ProfilePage() {
    const { user, authenticated } = usePrivy()
    const { wallets } = useWallets()
    const smartWalletsHook = useSmartWallets()
    const { address: activeAddress } = useAccount()
    const [crossAppWallets, setCrossAppWallets] = useState<CrossAppWallet[]>([])
    const [selectedSmartWallet, setSelectedSmartWallet] = useState<string | null>(null)
    const { sendTransaction } = useCrossAppAccounts()

    // Comprehensive debug logging
    useEffect(() => {
        console.log('=== Comprehensive Smart Wallet Debug ===')
        console.log('authenticated:', authenticated)
        console.log('user:', user)
        console.log('user.smartWallet:', user?.smartWallet)
        console.log('user.linkedAccounts:', user?.linkedAccounts)
        
        // Check for regular smart wallet vs cross-app smart wallet
        const regularSmartWallet = user?.linkedAccounts?.find(account => account.type === 'smart_wallet')
        const crossAppAccount = user?.linkedAccounts?.find(account => account.type === 'cross_app')
        
        console.log('Regular smart wallet account:', regularSmartWallet)
        console.log('Cross-app account:', crossAppAccount)
        console.log('Cross-app smart wallets:', crossAppAccount?.smartWallets)
        
        console.log('smartWalletsHook:', smartWalletsHook)
        console.log('smartWalletsHook.client:', smartWalletsHook?.client)
        console.log('selectedSmartWallet:', selectedSmartWallet)
        console.log('crossAppWallets:', crossAppWallets)
        console.log('regular wallets:', wallets)
        console.log('=========================================')
    }, [authenticated, user, smartWalletsHook, selectedSmartWallet, crossAppWallets, wallets])

    // Process cross-app accounts and their wallets
    useEffect(() => {
        if (user?.linkedAccounts) {
            const crossAppAccount = user.linkedAccounts.find(account => account.type === 'cross_app')
            if (crossAppAccount) {
                // Create a Set to track unique addresses
                const uniqueAddresses = new Set<string>()
                
                // Process embedded wallets
                const embeddedWallets: CrossAppWallet[] = crossAppAccount.embeddedWallets
                    ?.filter(w => {
                        if (uniqueAddresses.has(w.address)) return false
                        uniqueAddresses.add(w.address)
                        return true
                    })
                    .map(w => ({ 
                        address: w.address, 
                        type: 'embedded' as const,
                        isConnected: true // Cross-app wallets are always "connected"
                    })) || []

                // Process smart wallets
                const smartWallets: CrossAppWallet[] = crossAppAccount.smartWallets
                    ?.filter(w => {
                        if (uniqueAddresses.has(w.address)) return false
                        uniqueAddresses.add(w.address)
                        return true
                    })
                    .map(w => ({ 
                        address: w.address, 
                        type: 'smart' as const,
                        isConnected: true // Cross-app wallets are always "connected"
                    })) || []

                const allWallets: CrossAppWallet[] = [...embeddedWallets, ...smartWallets]
                setCrossAppWallets(allWallets)

                // Auto-select the first smart wallet if available
                if (smartWallets.length > 0 && !selectedSmartWallet) {
                    setSelectedSmartWallet(smartWallets[0].address)
                }
            }
        }
    }, [user, selectedSmartWallet])

    const handleSmartWalletSelect = (address: string) => {
        setSelectedSmartWallet(address)
    }

    const getCrossAppAccount = () => {
        return user?.linkedAccounts.find(account => account.type === 'cross_app')
    }

    const getEmbeddedWalletAddress = () => {
        const crossAppAccount = getCrossAppAccount()
        return crossAppAccount?.embeddedWallets?.[0]?.address
    }

    const getSmartWallets = () => {
        const crossAppAccount = getCrossAppAccount()
        return crossAppAccount?.smartWallets || []
    }

    // Test transaction function using smart wallets
    const testTransaction = async () => {
        console.log('=== Test Transaction Debug ===')
        console.log('selectedSmartWallet:', selectedSmartWallet)
        console.log('authenticated:', authenticated)
        console.log('smartWalletsHook:', smartWalletsHook)
        console.log('smartWalletsHook.client:', smartWalletsHook?.client)
        console.log('smartWalletsHook.getClientForChain:', smartWalletsHook?.getClientForChain)
        console.log('user smart wallets:', getSmartWallets())
        console.log('base chain id:', base.id)
        console.log('============================')

        if (!selectedSmartWallet) {
            alert('Please select a smart wallet first')
            return
        }

        if (!authenticated) {
            alert('Please authenticate with Privy first')
            return
        }

        if (!smartWalletsHook?.getClientForChain) {
            const debugInfo = {
                authenticated,
                userExists: !!user,
                userSmartWallet: user?.smartWallet,
                hasLinkedAccounts: !!user?.linkedAccounts?.length,
                crossAppSmartWallets: user?.linkedAccounts?.find(acc => acc.type === 'cross_app')?.smartWallets?.length || 0,
                selectedWallet: selectedSmartWallet,
                smartWalletsHook: smartWalletsHook
            }
            
            console.error('Smart wallet client not available. Debug info:', debugInfo)
            
            alert(`Smart wallet client not available. This might be because:

1. Smart wallets are disabled in Privy Dashboard
2. The smart wallet needs to be deployed first  
3. Cross-app smart wallets need different configuration
4. Missing paymaster configuration

Debug info:
- Authenticated: ${authenticated}
- User exists: ${!!user}
- Cross-app smart wallets: ${debugInfo.crossAppSmartWallets}
- Smart wallets hook: ${JSON.stringify(smartWalletsHook, null, 2)}

Try enabling regular smart wallets in your Privy Dashboard, or configure a paymaster.`)
            return
        }

        try {
            console.log('Getting smart wallet client for Base chain:', base.id)
            console.log('Base chain details:', base)
            
            // Get the client for the specific chain (Base) using correct docs signature
            console.log('Calling getClientForChain with base.id:', base.id)
            const smartWalletClient = await smartWalletsHook.getClientForChain({ id: base.id })
            
            if (!smartWalletClient) {
                // Enhanced debugging for client creation failure
                console.error('Smart wallet client creation failed for Base chain')
                console.error('Chain ID:', base.id)
                console.error('Chain name:', base.name)
                console.error('User object:', JSON.stringify(user, null, 2))
                console.error('Smart wallets hook state:', JSON.stringify(smartWalletsHook, null, 2))
                
                alert(`Could not get smart wallet client for Base chain (${base.id}).

This error suggests one of these issues:

🔧 CONFIGURATION ISSUES:
1. Smart wallets not enabled for Base in Privy Dashboard
2. Missing bundler configuration for Base network
3. Missing paymaster configuration for Base network
4. Chain not supported in your smart wallet setup

🚀 DEPLOYMENT ISSUES:
5. Smart wallet not deployed on Base yet
6. Insufficient funds for deployment
7. Smart wallet factory not configured for Base

💡 DEBUG INFO:
- Chain ID: ${base.id} (Base)
- User authenticated: ${authenticated}
- Cross-app smart wallets: ${getSmartWallets().length}
- Selected wallet: ${selectedSmartWallet}

🛠️ NEXT STEPS:
1. Check Privy Dashboard → Smart Wallets → Network Configuration
2. Ensure Base is enabled with proper bundler/paymaster
3. Try deploying the smart wallet first
4. Contact Privy support with this error

Would you like to try the cross-app smart wallet method instead?`)
                return
            }
            
            console.log('Smart wallet client obtained successfully:', smartWalletClient)
            console.log('Sending test transaction via smart wallet client to:', selectedSmartWallet)
            
            // Use the chain-specific smart wallet client
            const txHash = await smartWalletClient.sendTransaction({
                chain: base,                              // Use chain object
                to: selectedSmartWallet as `0x${string}`, // Send to self as a test
                value: BigInt(0),                         // 0 ETH as bigint
                data: '0x',                              // No data
            })
            
            console.log('Transaction sent successfully! Hash:', txHash)
            alert(`✅ Test transaction sent successfully!
            
Hash: ${txHash}

🎉 This means your smart wallet is working correctly!`)
        } catch (error) {
            console.error('Transaction failed:', error)
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error('Full error object:', error)
            
            if (errorMessage.includes('Failed to create smart wallet client')) {
                alert(`❌ Smart Wallet Client Creation Failed

Error: ${errorMessage}

This usually means:

🔧 PRIVY DASHBOARD CONFIGURATION:
• Smart wallets not enabled for Base network
• Missing bundler URL for Base (required)
• Missing paymaster configuration for Base
• Wrong network settings in dashboard

💰 FUNDING/DEPLOYMENT ISSUES:
• Smart wallet not deployed on Base yet
• Insufficient ETH for deployment transaction
• Paymaster not configured to sponsor deployment

🌐 NETWORK ISSUES:
• Base RPC endpoint issues
• Network connectivity problems
• Bundler service unavailable

🛠️ HOW TO FIX:
1. Go to Privy Dashboard → Smart Wallets
2. Enable Base network with proper configuration
3. Add bundler URL (contact Privy for recommended bundler)
4. Configure paymaster for gas sponsorship
5. Ensure sufficient funding for deployment

💡 ALTERNATIVE: Try the "Cross-App Smart Wallet" button instead - it uses a different API that might work better for your setup.`)
            } else if (errorMessage.includes('allowlist') || errorMessage.includes('not in allowlist')) {
                alert(`❌ Paymaster Allowlist Error

Error: ${errorMessage}

The paymaster doesn't allow transactions to this address (${selectedSmartWallet}).

🛠️ SOLUTIONS:
1. Configure paymaster policy in Coinbase Developer Platform
2. Add destination addresses to allowlist
3. Use a different test address
4. Configure custom paymaster in SmartWalletsProvider
5. Try the null address for testing: 0x0000000000000000000000000000000000000000`)
            } else {
                alert(`❌ Transaction Failed

Error: ${errorMessage}

Full error details logged to console.`)
            }
        }
    }

    // Test transaction using cross-app smart wallet (different from useSmartWallets)
    const testTransactionWithCrossAppSmartWallet = async () => {
        if (!selectedSmartWallet) {
            alert('Please select a smart wallet first')
            return
        }

        if (!authenticated) {
            alert('Please authenticate with Privy first')
            return
        }

        const crossAppAccount = getCrossAppAccount()
        const smartWallet = crossAppAccount?.smartWallets?.find(sw => sw.address === selectedSmartWallet)
        
        if (!smartWallet) {
            alert('Cross-app smart wallet not found')
            return
        }

        try {
            console.log('=== Cross-App Smart Wallet Transaction Debug ===')
            console.log('Using cross-app smart wallet:', selectedSmartWallet)
            console.log('Cross-app account:', crossAppAccount)
            console.log('Smart wallet object:', smartWallet)
            console.log('================================================')
            
            // Use useCrossAppAccounts for cross-app smart wallets
            const txHash = await sendTransaction(
                {
                    to: selectedSmartWallet as `0x${string}`,  // Send to self as a test
                    value: '0x0',                             // 0 ETH
                    data: '0x',                               // No data
                    chainId: base.id,                         // Use chainId for cross-app
                },
                { 
                    address: selectedSmartWallet as `0x${string}` // Use smart wallet address
                }
            )
            
            console.log('Cross-app smart wallet transaction sent! Hash:', txHash)
            alert(`Cross-app smart wallet transaction sent! Hash: ${txHash}`)
        } catch (error) {
            console.error('Cross-app smart wallet transaction failed:', error)
            alert(`Cross-app smart wallet transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    // Alternative: Test transaction using embedded wallet (cross-app signer)
    const testTransactionWithEmbeddedWallet = async () => {
        const embeddedWalletAddress = getEmbeddedWalletAddress()
        
        console.log('=== Embedded Wallet Transaction Debug ===')
        console.log('embeddedWalletAddress:', embeddedWalletAddress)
        console.log('authenticated:', authenticated)
        console.log('==========================================')

        if (!embeddedWalletAddress) {
            alert('No embedded wallet found')
            return
        }

        if (!authenticated) {
            alert('Please authenticate with Privy first')
            return
        }

        try {
            console.log('Sending test transaction from embedded wallet:', embeddedWalletAddress)
            
            // Use embedded wallet for transaction (this should work without blank popup)
            const txHash = await sendTransaction(
                {
                    to: embeddedWalletAddress as `0x${string}`,  // Send to self as a test
                    value: '0x0',                               // 0 ETH
                    data: '0x',                                 // No data
                    chainId: base.id,                           // Use chainId for cross-app
                },
                { 
                    address: embeddedWalletAddress as `0x${string}` // Use embedded wallet address
                }
            )
            
            console.log('Transaction sent! Hash:', txHash)
            alert(`Embedded wallet transaction sent! Hash: ${txHash}`)
        } catch (error) {
            console.error('Transaction failed:', error)
            alert(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Profile</h1>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    {/* <UserPill 
                        action={{ type: 'connectWallet' }}
                        size={40}
                    /> */}
                    {activeAddress && (
                        <div className="text-sm text-gray-600">
                            Wagmi Active Address:
                            <br />
                            <span className="font-mono">{activeAddress}</span>
                        </div>
                    )}
                </div>
                
                <div className="mt-4">
                    <h2 className="text-xl font-semibold mb-2">Cross-App Wallets</h2>
                    <div className="space-y-2">
                        {crossAppWallets.map((wallet) => (
                            <div 
                                key={`${wallet.type}-${wallet.address}`}
                                className={`p-3 rounded-lg transition-colors ${
                                    wallet.type === 'smart'
                                        ? selectedSmartWallet === wallet.address 
                                            ? 'bg-blue-100 border-2 border-blue-500 cursor-pointer' 
                                            : 'bg-gray-100 hover:bg-gray-200 cursor-pointer'
                                        : 'bg-gray-50' // Embedded wallets are not selectable
                                }`}
                                onClick={() => wallet.type === 'smart' && handleSmartWalletSelect(wallet.address)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium">
                                            Type: {wallet.type}
                                            {wallet.type === 'embedded' && (
                                                <span className="text-xs text-gray-500 ml-2">(Used as signer)</span>
                                            )}
                                            {wallet.type === 'smart' && (
                                                <span className="text-xs text-gray-500 ml-2">(Transaction account)</span>
                                            )}
                                        </p>
                                        <p className="text-sm break-all">{wallet.address}</p>
                                    </div>
                                    {wallet.type === 'smart' && selectedSmartWallet === wallet.address && (
                                        <span className="text-blue-500 font-medium">Selected</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedSmartWallet && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Transaction Configuration</h3>
                        <p className="text-sm text-green-800 mb-2">
                            <strong>Smart Wallet (Transaction Account):</strong><br />
                            <code className="bg-green-100 px-2 py-1 rounded">{selectedSmartWallet}</code>
                        </p>
                        <p className="text-sm text-green-800 mb-3">
                            <strong>Embedded Wallet (Signer):</strong><br />
                            <code className="bg-green-100 px-2 py-1 rounded">{getEmbeddedWalletAddress()}</code>
                        </p>
                        <button 
                            onClick={testTransaction}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mr-2"
                        >
                            Test Smart Wallet (useSmartWallets)
                        </button>
                        <button 
                            onClick={testTransactionWithCrossAppSmartWallet}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 mr-2"
                        >
                            Test Cross-App Smart Wallet
                        </button>
                        <button 
                            onClick={testTransactionWithEmbeddedWallet}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Test Embedded Wallet
                        </button>
                    </div>
                )}

                {!authenticated && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800">
                            Please connect your wallet using the Privy pill above to enable signing functionality.
                        </p>
                    </div>
                )}

                <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                    <h3 className="font-semibold mb-2">Debug Info:</h3>
                    <p className="text-sm">Regular connected wallets: {wallets.length}</p>
                    <p className="text-sm">Wagmi active address: {activeAddress || 'None'}</p>
                    <p className="text-sm">Cross-app wallets: {crossAppWallets.length}</p>
                    <p className="text-sm">Smart wallets: {getSmartWallets().length}</p>
                    <p className="text-sm">Selected smart wallet: {selectedSmartWallet || 'None'}</p>
                    <p className="text-sm">Embedded wallet (signer): {getEmbeddedWalletAddress() || 'None'}</p>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">How Cross-App Wallets Work</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• <strong>Smart Wallets:</strong> Hold your funds and execute transactions</li>
                        <li>• <strong>Embedded Wallets:</strong> Used internally by Privy for signing/authorization</li>
                        <li>• <strong>For Transactions:</strong> Use <code>useSmartWallets().client.sendTransaction()</code></li>
                        <li>• <strong>Correct API:</strong> Pass <code>chain</code> object, not <code>chainId</code></li>
                        <li>• <strong>Value Format:</strong> Use <code>BigInt(0)</code> for 0 ETH</li>
                        <li>• <strong>Privy handles:</strong> The embedded wallet signing automatically</li>
                    </ul>
                </div>

                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 className="font-semibold text-amber-900 mb-2">🔍 Different Smart Wallet Types</h3>
                    <div className="text-sm text-amber-800 space-y-2">
                        <div>
                            <strong>1. Regular Smart Wallets (useSmartWallets):</strong>
                            <p>Created directly through Privy. Requires dashboard configuration with bundler/paymaster.</p>
                        </div>
                        <div>
                            <strong>2. Cross-App Smart Wallets:</strong>
                            <p>From external providers like Flaunch. Uses different APIs (useCrossAppAccounts).</p>
                        </div>
                        <div>
                            <strong>3. Embedded Wallets:</strong>
                            <p>Standard Privy wallets. Always work for basic transactions.</p>
                        </div>
                    </div>
                    <p className="text-sm text-amber-800 mt-2">
                        <strong>Try all three buttons above</strong> to see which type of wallet you have!
                    </p>
                </div>
            </div>
        </div>
    )
}