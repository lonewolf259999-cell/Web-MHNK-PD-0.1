/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Legacy Leaflet map + Challenge game are still served as static pages
      { source: '/MapMhnkPD', destination: '/map-module/map.html' },
      { source: '/Challenge', destination: '/map-module/Challenge/game.html' },
    ];
  },
};

export default nextConfig;
