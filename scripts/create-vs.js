const fs = require('fs');
// Create a simple 40x40 SVG with white "VS" text
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect width="40" height="40" fill="none"/>
  <text x="20" y="29" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">VS</text>
</svg>`;
fs.writeFileSync('public/vs.svg', svgContent);
console.log('Created public/vs.svg');