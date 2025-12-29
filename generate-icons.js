// Generate SVG icons for PWA
import fs from 'fs';

const iconsDir = './icons';

// Create simple SVG icon
function createSVGIcon(size) {
  const cornerRadius = size * 0.2;
  const strokeWidth = Math.max(2, Math.floor(size * 0.08));
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect fill="#e07a5f" width="${size}" height="${size}" rx="${cornerRadius}"/>
  <path fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" 
        d="M${size*0.25} ${size*0.50} L${size*0.40} ${size*0.65} L${size*0.75} ${size*0.35}"/>
</svg>`;
}

// Save SVG icons
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  const svg = createSVGIcon(size);
  const filename = size === 180 ? 'apple-touch-icon.svg' : `icon-${size}.svg`;
  fs.writeFileSync(`${iconsDir}/${filename}`, svg);
  console.log(`Created ${filename}`);
}

// Create maskable icons (with safe zone padding)
for (const size of [192, 512]) {
  const padding = size * 0.1;
  const innerSize = size - padding * 2;
  const cornerRadius = innerSize * 0.2;
  const strokeWidth = Math.max(2, Math.floor(innerSize * 0.08));
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect fill="#faf9f7" width="${size}" height="${size}"/>
  <rect fill="#e07a5f" x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${cornerRadius}"/>
  <path fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" 
        transform="translate(${padding}, ${padding})"
        d="M${innerSize*0.25} ${innerSize*0.50} L${innerSize*0.40} ${innerSize*0.65} L${innerSize*0.75} ${innerSize*0.35}"/>
</svg>`;
  
  fs.writeFileSync(`${iconsDir}/icon-maskable-${size}.svg`, svg);
  console.log(`Created icon-maskable-${size}.svg`);
}

console.log('Done!');
