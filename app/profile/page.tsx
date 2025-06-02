'use client'

import { UserPill } from '@privy-io/react-auth/ui'
import { usePrivy, useWallets, useCrossAppAccounts } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'

type CrossAppWallet = {
    address: string
    type: 'embedded' | 'smart'
    isConnected: boolean
}

export default function ProfilePage() {
    const { user, authenticated } = usePrivy()
    const { wallets } = useWallets()
    const { sendTransaction } = useCrossAppAccounts()
    const { address: activeAddress } = useAccount()
    const [crossAppWallets, setCrossAppWallets] = useState<CrossAppWallet[]>([])
    const [selectedSmartWallet, setSelectedSmartWallet] = useState<string | null>(null)

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

    // Test transaction function to demonstrate proper usage
    const testTransaction = async () => {
        if (!selectedSmartWallet) {
            alert('Please select a smart wallet first')
            return
        }

        try {
            console.log('Sending test transaction from smart wallet:', selectedSmartWallet)
            
            // Send a simple test transaction (0 ETH transfer to self)
            const txHash = await sendTransaction({
                to: selectedSmartWallet, // Send to self as a test
                value: '0x0', // 0 ETH
                data: '0x', // No data
                chainId: 8453 // Base network chainId
            }, { address: selectedSmartWallet }) // Use smart wallet address
            
            console.log('Transaction sent! Hash:', txHash)
            alert(`Test transaction sent! Hash: ${txHash}`)
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
                    <UserPill 
                        action={{ type: 'connectWallet' }}
                        size={40}
                    />
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
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                            Test Transaction Setup
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
                        <li>• <strong>For Transactions:</strong> Use <code>sendTransaction(txData, {`{ address: smartWalletAddress }`})</code></li>
                        <li>• <strong>Privy handles:</strong> The embedded wallet signing automatically</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}