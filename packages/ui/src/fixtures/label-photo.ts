const bars = Array.from({ length: 46 }, (_, i) => {
  const width = [3, 1, 2, 1, 4, 1, 2, 3][i % 8]!;
  return `<rect x="${150 + i * 14}" y="560" width="${width * 2}" height="150" fill="#1c1c1e"/>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<rect width="1200" height="900" fill="#b89a74"/>
<rect x="110" y="120" width="980" height="660" rx="6" fill="#f7f5ef" transform="rotate(-2 600 450)"/>
<g transform="rotate(-2 600 450)" font-family="Helvetica, Arial, sans-serif" fill="#1c1c1e">
<text x="150" y="200" font-size="34" font-weight="700">SHIP TO:</text>
<text x="150" y="250" font-size="40">CAMILLE MOREL</text>
<text x="150" y="295" font-size="30">STUDIO, 2E ETAGE</text>
<text x="150" y="335" font-size="30">75007 PARIS FR</text>
<text x="700" y="200" font-size="28">1 OF 1</text>
<text x="700" y="240" font-size="28">2,4 KG</text>
<text x="150" y="420" font-size="60" font-weight="700">UPS STANDARD</text>
<text x="150" y="520" font-size="34" font-family="Courier New, monospace">TRACKING #: 1Z E63 44W 04 9923 0622</text>
${bars}
</g>
</svg>`;

/** A stand-in for a label photo taken at the scan, for the stories. */
export const LABEL_PHOTO_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
