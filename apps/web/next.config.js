/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@little-chef/dsl'],
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
