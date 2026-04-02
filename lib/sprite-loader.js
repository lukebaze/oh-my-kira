import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export async function sliceSpritesheet(sheetPath, frameWidth, frameHeight, frameCount, upscale = 1) {
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    let frame = sharp(sheetPath).extract({
      left: i * frameWidth,
      top: 0,
      width: frameWidth,
      height: frameHeight,
    });
    if (upscale > 1) {
      frame = frame.resize(frameWidth * upscale, frameHeight * upscale, {
        kernel: sharp.kernel.nearest,
      });
    }
    const buffer = await frame.png().toBuffer();
    frames.push(buffer);
  }
  return frames;
}

async function removeBackground(frameSharp) {
  const { data, info } = await frameSharp
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const tolerance = 35;

  // Sample background color from top-left corner
  const bg = [data[0], data[1], data[2]];

  const match = (idx) => {
    return Math.abs(data[idx] - bg[0]) <= tolerance &&
           Math.abs(data[idx + 1] - bg[1]) <= tolerance &&
           Math.abs(data[idx + 2] - bg[2]) <= tolerance;
  };

  // Flood-fill from all 4 corners to find connected background pixels
  const visited = new Uint8Array(w * h);
  const bgMask = new Uint8Array(w * h);
  const queue = [];

  // Seed from all edge pixels that match background
  for (let x = 0; x < w; x++) {
    if (match(x * ch)) queue.push(x);
    const bottom = (h - 1) * w + x;
    if (match(bottom * ch)) queue.push(bottom);
  }
  for (let y = 1; y < h - 1; y++) {
    if (match(y * w * ch)) queue.push(y * w);
    const right = y * w + (w - 1);
    if (match(right * ch)) queue.push(right);
  }

  for (const idx of queue) {
    visited[idx] = 1;
  }

  while (queue.length > 0) {
    const pos = queue.pop();
    bgMask[pos] = 1;
    const x = pos % w;
    const y = (pos - x) / w;
    const neighbors = [];
    if (x > 0) neighbors.push(pos - 1);
    if (x < w - 1) neighbors.push(pos + 1);
    if (y > 0) neighbors.push(pos - w);
    if (y < h - 1) neighbors.push(pos + w);
    for (const n of neighbors) {
      if (!visited[n] && match(n * ch)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    const di = i * 4;
    out[di] = data[si];
    out[di + 1] = data[si + 1];
    out[di + 2] = data[si + 2];
    out[di + 3] = bgMask[i] ? 0 : (ch === 4 ? data[si + 3] : 255);
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } });
}

export async function sliceSpritesheetGrid(sheetPath, frameWidth, frameHeight, gridCols, frameCount, scale = 1) {
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    let frame = sharp(sheetPath).extract({
      left: col * frameWidth,
      top: row * frameHeight,
      width: frameWidth,
      height: frameHeight,
    });

    // Remove background color
    frame = await removeBackground(frame, frameWidth, frameHeight);

    if (scale !== 1) {
      const kernel = scale < 1 ? sharp.kernel.lanczos3 : sharp.kernel.nearest;
      frame = frame.resize(Math.round(frameWidth * scale), Math.round(frameHeight * scale), { kernel });
    }
    const buffer = await frame.png().toBuffer();
    frames.push(buffer);
  }
  return frames;
}

export async function loadArtPack(packDir) {
  const packJsonPath = path.join(packDir, "pack.json");
  const packJson = JSON.parse(fs.readFileSync(packJsonPath, "utf-8"));
  const { frame_size, state_map } = packJson;
  const scale = packJson.scale ?? packJson.upscale ?? 1;
  const isGrid = packJson.format === "spritesheet-grid" || packJson.grid_cols != null;
  const animations = {};

  for (const [stateName, config] of Object.entries(state_map)) {
    const sheetPath = path.join(packDir, "spritesheets", config.sheet);
    if (!fs.existsSync(sheetPath)) {
      console.warn(`Missing spritesheet: ${sheetPath}, skipping ${stateName}`);
      continue;
    }
    const frames = isGrid
      ? await sliceSpritesheetGrid(sheetPath, frame_size.width, frame_size.height, packJson.grid_cols, config.frames, scale)
      : await sliceSpritesheet(sheetPath, frame_size.width, frame_size.height, config.frames, scale);
    animations[stateName] = { frames, interval_ms: config.interval_ms };
  }

  return {
    name: packJson.name,
    author: packJson.author,
    version: packJson.version,
    frameSize: {
      width: Math.round(frame_size.width * scale),
      height: Math.round(frame_size.height * scale),
    },
    animations,
  };
}
