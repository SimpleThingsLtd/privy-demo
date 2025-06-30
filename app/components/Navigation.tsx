'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNetwork } from '@/contexts/NetworkContext'

export const Navigation = () => {
  const pathname = usePathname()
  const { selectedNetwork, setSelectedNetwork, availableNetworks } = useNetwork()

  // Define navigation links
  const links = [
    { href: '/', label: 'Home' },
    { href: '/sign-message', label: 'Sign' },
    { href: '/list-memes', label: 'MyMemes' },
    { href: '/profile', label: 'Profile' },
  ]

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo and main navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Privy Demo
            </Link>
            
            <nav className="flex gap-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 py-1 rounded transition-colors ${
                    pathname === link.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Network Selection Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Network:</span>
            <select
              value={selectedNetwork.name}
              onChange={(e) => {
                const network = availableNetworks.find(n => n.name === e.target.value)
                if (network) setSelectedNetwork(network)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableNetworks.map((network) => (
                <option key={network.id} value={network.name}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  )
}