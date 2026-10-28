/** QR modules as an RGBA raster, `scale` px each, as a phone camera would get them. */
export function qrRaster(modules: boolean[][], scale = 6) {
  const width = modules.length * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy += 1)
        for (let dx = 0; dx < scale; dx += 1) {
          const at = ((y * scale + dy) * width + x * scale + dx) * 4;
          data.fill(0, at, at + 3);
        }
    }),
  );
  return { data, width, height: width };
}
