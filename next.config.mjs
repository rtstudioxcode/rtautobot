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
  webpack(config, { isServer }) {
    if (!isServer && config.optimization?.runtimeChunk && typeof config.optimization.runtimeChunk === 'object') {
      config.optimization.runtimeChunk = {
        ...config.optimization.runtimeChunk,
        name: 'runtime',
      };
    }
    return config;
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
