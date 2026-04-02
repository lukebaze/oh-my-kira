import fs from "node:fs";
import chokidar from "chokidar";

export function createWatcher(statePath, onChange) {
  let lastContent = "";

  const watcher = chokidar.watch(statePath, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  function readAndEmit() {
    try {
      const content = fs.readFileSync(statePath, "utf-8");
      if (content === lastContent) return;
      lastContent = content;
      const state = JSON.parse(content);
      onChange(state);
    } catch {
      // File may be mid-write, ignore and wait for next event
    }
  }

  watcher.on("add", readAndEmit);
  watcher.on("change", readAndEmit);

  return {
    close() {
      watcher.close();
    },
  };
}
