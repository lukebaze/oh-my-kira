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
