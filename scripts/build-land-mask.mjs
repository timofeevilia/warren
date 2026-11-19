// Rasterises Natural Earth land polygons into an equirectangular greyscale PNG
// (white = land). The globe shader samples it as a texture.
// Run by hand when the resolution or source changes: node scripts/build-land-mask.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { feature } from 'topojson-client';

const W = 2048;
const H = 1024;
const SS = 2; // supersampling factor for smooth coastlines
const w = W * SS;
const h = H * SS;

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const polygons = land.features.flatMap((f) =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
);

const hi = new Uint8Array(w * h);
const toX = (lon) => ((lon + 180) / 360) * w;
const toY = (lat) => ((90 - lat) / 180) * h;

for (const rings of polygons) {
  // Collect every edge of the polygon (outer ring and holes) in pixel space.
  const edges = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const source of rings) {
    // Unwrap longitudes so a ring that crosses the antimeridian stays continuous
    // (it may then extend past ±180; the fill wraps x around the image).
    const ring = [source[0].slice()];
    for (let i = 1; i < source.length; i++) {
      let lon = source[i][0];
      const prev = ring[i - 1][0];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
      ring.push([lon, source[i][1]]);
    }
    // A ring that circles a pole (Antarctica) ends 360° away from where it began:
    // close it by running down to the pole and back.
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(last[0] - first[0]) > 180) {
      const pole = last[1] < 0 ? -90 : 90;
      ring.push([last[0], pole], [first[0], pole], first.slice());
    }
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = toX(ring[i][0]);
      const y0 = toY(ring[i][1]);
      const x1 = toX(ring[i + 1][0]);
      const y1 = toY(ring[i + 1][1]);
      if (y0 === y1) continue;
      edges.push(y0 < y1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0]);
      minY = Math.min(minY, y0, y1);
      maxY = Math.max(maxY, y0, y1);
    }
  }
  // Even-odd scanline fill.
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [x0, y0, x1, y1] of edges) {
      if (yc >= y0 && yc < y1) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.round(xs[k]);
      const to = Math.round(xs[k + 1]);
      for (let x = from; x < to; x++) hi[y * w + (((x % w) + w) % w)] = 1;
    }
  }
}

// Downsample to the final size, one filter byte per row for PNG.
const raw = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) sum += hi[(y * SS + dy) * w + x * SS + dx];
    raw[y * (W + 1) + 1 + x] = Math.round((sum / (SS * SS)) * 255);
  }
}

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const header = Buffer.alloc(13);
header.writeUInt32BE(W, 0);
header.writeUInt32BE(H, 4);
header[8] = 8; // bit depth
header[9] = 0; // greyscale
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync('public/pulse/land.png', png);
console.log(`land.png ${W}x${H}, ${(png.length / 1024).toFixed(1)} KB, ${polygons.length} polygons`);
