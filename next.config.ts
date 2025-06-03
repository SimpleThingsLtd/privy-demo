/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io https://challenges.cloudflare.com",
              "script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              "connect-src 'self' https: wss: data:  https://pulse.walletconnect.org https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com",
              "frame-src 'self' https: blob: https://privy.flaunch.gg https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com",
              "media-src 'self' https: blob:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;