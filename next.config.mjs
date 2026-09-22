/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Emits .next/standalone — the app plus only the node_modules it actually
     uses, with its own server.js. Lets a host run the app without an install
     or a build step, which shared hosting rarely has the memory for.
     Vercel ignores this and builds its own output. */
  output: 'standalone',

  // /api/poi/categories reads this directory at runtime, so it has to be
  // traced into the bundle — public/ alone is CDN-only.
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
