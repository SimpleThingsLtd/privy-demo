/** @type {import('next').NextConfig} */
const nextConfig = {
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io",
              "script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss: data:",
              "frame-src 'self' https: blob:",
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