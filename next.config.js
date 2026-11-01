/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    // Leaflet marker icon assets & demo images are served locally or from OSM.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep builds fast.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Types are checked via `npm run typecheck`; keep builds resilient.
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
