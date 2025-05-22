// app/layout.tsx
import React from 'react'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from './components/Navigation'

export const metadata = {
  title: 'Privy NextJS Demo',
  description: 'Demo app for Privy global wallet login'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Providers> <div className="min-h-screen">
            <Navigation />
            <main className="max-w-5xl mx-auto px-4 py-8">
              {children}
            </main>
          </div>
          </Providers>
      </body>
    </html>
  )
}