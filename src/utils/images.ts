export interface ImagePlan {
  purpose: string;
  description: string;
  altText: string;
  caption: string;
  filename: string;
  placement: string;
}

const COLORS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc'],
  ['#0ba360', '#3cba92'],
  ['#667eea', '#764ba2'],
];

function hashColor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateSVG(image: ImagePlan): string {
  const colorIndex = hashColor(image.description) % COLORS.length;
  const [color1, color2] = COLORS[colorIndex];
  const lines = wrapText(image.altText || image.description, 40);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="bg-${colorIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="overlay-${colorIndex}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#000;stop-opacity:0" />
      <stop offset="100%" style="stop-color:#000;stop-opacity:0.3" />
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg-${colorIndex})" />
  <rect width="800" height="450" fill="url(#overlay-${colorIndex})" />
  ${generateIcons(image.purpose, colorIndex)}
  <g transform="translate(0, ${350 - lines.length * 14})">
    ${lines.map((line, i) => `
    <text x="400" y="${i * 30}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">${escapeXml(line)}</text>`).join('')}
  </g>
  <text x="400" y="430" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="12">${escapeXml(image.caption)}</text>
</svg>`;
}

function generateIcons(purpose: string, colorIndex: number): string {
  switch (purpose) {
    case 'featured':
      return `<circle cx="400" cy="120" r="50" fill="rgba(255,255,255,0.15)" />
<circle cx="400" cy="120" r="30" fill="rgba(255,255,255,0.2)" />`;
    case 'infographic':
      return `<rect x="300" y="80" width="40" height="40" rx="5" fill="rgba(255,255,255,0.2)" />
<rect x="360" y="100" width="40" height="40" rx="5" fill="rgba(255,255,255,0.15)" />
<rect x="420" y="120" width="40" height="40" rx="5" fill="rgba(255,255,255,0.1)" />`;
    default:
      return `<rect x="330" y="90" width="140" height="90" rx="8" fill="rgba(255,255,255,0.15)" />
<circle cx="380" cy="135" r="15" fill="rgba(255,255,255,0.2)" />
<rect x="405" y="125" width="40" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
<rect x="405" y="137" width="30" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
<rect x="405" y="149" width="35" height="6" rx="3" fill="rgba(255,255,255,0.1)" />`;
  }
}

function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 4);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function imageToHtml(image: ImagePlan): string {
  const svg = generateSVG(image);
  return `<figure style="margin:20px 0;text-align:center;">
  <img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${escapeXml(image.altText)}" style="max-width:100%;height:auto;border-radius:8px;" loading="lazy" />
  <figcaption style="font-style:italic;color:#666;margin-top:8px;">${escapeXml(image.caption)}</figcaption>
</figure>`;
}
