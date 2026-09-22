/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/poi/categories reads this directory at runtime, so it has to be
  // traced into the serverless bundle — public/ alone is CDN-only.
  outputFileTracingIncludes: {
    '/api/[[...slugs]]': ['./public/map-module/blips/custom/**'],
  },

  async rewrites() {
    return [
      // Legacy Leaflet map + Challenge game are still served as static pages
      { source: '/MapMhnkPD', destination: '/map-module/map.html' },
      { source: '/Challenge', destination: '/map-module/Challenge/game.html' },
    ];
  },
};

export default nextConfig;
