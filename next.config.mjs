/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'mongoose',
      'bullmq',
      'ioredis',
      'nodemailer',
      'bcryptjs',
      'jose',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'rtautobot.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/topup/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
