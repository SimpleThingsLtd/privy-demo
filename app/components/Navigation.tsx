'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const Navigation = () => {
  const pathname = usePathname()

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
        </div>
      </div>
    </header>
  )
}