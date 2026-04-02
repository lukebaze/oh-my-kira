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

export async function loadArtPack(packDir) {
  const packJsonPath = path.join(packDir, "pack.json");
  const packJson = JSON.parse(fs.readFileSync(packJsonPath, "utf-8"));
  const { frame_size, upscale, state_map } = packJson;
  const animations = {};

  for (const [stateName, config] of Object.entries(state_map)) {
    const sheetPath = path.join(packDir, "spritesheets", config.sheet);
    if (!fs.existsSync(sheetPath)) {
      console.warn(`Missing spritesheet: ${sheetPath}, skipping ${stateName}`);
      continue;
    }
    const frames = await sliceSpritesheet(
      sheetPath, frame_size.width, frame_size.height, config.frames, upscale || 1
    );
    animations[stateName] = { frames, interval_ms: config.interval_ms };
  }

  return {
    name: packJson.name,
    author: packJson.author,
    version: packJson.version,
    frameSize: {
      width: (frame_size.width) * (upscale || 1),
      height: (frame_size.height) * (upscale || 1),
    },
    animations,
  };
}
