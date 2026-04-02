import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSpeechBubble, clearSpeechBubble } from "../lib/speech-bubble.js";

describe("renderSpeechBubble", () => {
  it("returns lines for a simple message", () => {
    const lines = renderSpeechBubble("Hello!", 30);
    assert.ok(lines.length >= 3);
    assert.ok(lines[0].includes("\u256d")); // ╭
    assert.ok(lines[1].includes("Hello!"));
    assert.ok(lines[2].includes("\u256e")); // ╮ in tail
  });
  it("constrains width to maxWidth", () => {
    const lines = renderSpeechBubble("Short", 20);
    for (const line of lines) {
      assert.ok(line.length <= 20, `Line too wide: "${line}" (${line.length})`);
    }
  });
  it("handles empty text", () => {
    const lines = renderSpeechBubble("", 30);
    assert.ok(lines.length >= 3);
  });
  it("handles long text by truncating", () => {
    const longText = "A".repeat(100);
    const lines = renderSpeechBubble(longText, 30);
    for (const line of lines) {
      assert.ok(line.length <= 30);
    }
  });
});

describe("clearSpeechBubble", () => {
  it("returns empty lines matching bubble height", () => {
    const bubble = renderSpeechBubble("Test", 30);
    const cleared = clearSpeechBubble(bubble.length, 30);
    assert.equal(cleared.length, bubble.length);
    for (const line of cleared) {
      assert.ok(line.trim() === "" || line.includes("\x1b[2K"));
    }
  });
});
