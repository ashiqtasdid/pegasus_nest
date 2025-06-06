/** @type {import('next').NextConfig} */
const nextConfig = {
  // Custom server setup for integration with NestJS
  experimental: {
    externalDir: true,
  },
  // Disable Next.js default API routes since we're using NestJS
  async rewrites() {
    const nestPort = process.env.NEST_PORT || 3001;
    return [
      // Proxy API requests to NestJS backend
      {
        source: '/api/:path*',
        destination: `http://localhost:${nestPort}/api/:path*`,
      },
      // Proxy direct controller routes to NestJS backend
      {
        source: '/create/:path*',
        destination: `http://localhost:${nestPort}/create/:path*`,
      },
      {
        source: '/create',
        destination: `http://localhost:${nestPort}/create`,
      },
      {
        source: '/health/:path*',
        destination: `http://localhost:${nestPort}/health/:path*`,
      },
      {
        source: '/health',
        destination: `http://localhost:${nestPort}/health`,
      },
      {
        source: '/status/:path*',
        destination: `http://localhost:${nestPort}/status/:path*`,
      },
      {
        source: '/status',
        destination: `http://localhost:${nestPort}/status`,
      },
    ];
  },
  // Output directory for builds
  distDir: '.next',
  // Public asset handling
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  // Enable TypeScript
  typescript: {
    // Ignore TypeScript errors during build (since we have NestJS TypeScript setup)
    ignoreBuildErrors: true,
  },
  // ESLint configuration
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  // Webpack configuration to exclude certain files
  webpack: (config, { isServer }) => {
    // Exclude test files and NestJS source files from Next.js build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/test/**',
        '**/src/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
      ],
    };

    return config;
  },
};

module.exports = nextConfig;
