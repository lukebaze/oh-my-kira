import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateLayout } from "../lib/layout.js";

describe("calculateLayout", () => {
  it("calculates layout for a standard terminal (40x30)", () => {
    const layout = calculateLayout(40, 30);
    assert.ok(layout.spriteRows > 0);
    assert.ok(layout.spriteCols > 0);
    assert.ok(layout.statsStartRow > layout.spriteStartRow);
    assert.ok(layout.dividerRow > 0);
    assert.equal(layout.innerWidth, 36); // 40 - 4 (2 border + 2 padding)
  });

  it("sprite rows are based on image aspect ratio", () => {
    // With default aspect 1.714 and 36 inner cols, sprite ≈ 36/1.714/2 ≈ 11 rows
    const layout = calculateLayout(40, 40);
    assert.ok(layout.spriteRows >= 8, `Sprite rows ${layout.spriteRows} too low`);
    assert.ok(layout.spriteRows <= 20, `Sprite rows ${layout.spriteRows} too high`);
    // Stats should start right after sprite
    assert.equal(layout.statsStartRow, layout.dividerRow + 1);
  });

  it("allocates more to stats in short terminal (<20 rows)", () => {
    const layout = calculateLayout(40, 15);
    assert.ok(layout.spriteRows >= 3, "Need at least 3 rows for sprite");
    assert.ok(layout.statsRows >= 6, "Need at least 6 rows for minimal stats");
  });

  it("handles very narrow terminal (20 cols)", () => {
    const layout = calculateLayout(20, 30);
    assert.equal(layout.innerWidth, 16); // 20 - 4
    assert.ok(layout.spriteCols > 0);
  });

  it("handles very wide terminal (120 cols)", () => {
    const layout = calculateLayout(120, 30);
    assert.equal(layout.innerWidth, 116);
    assert.ok(layout.spriteCols <= 116);
  });

  it("bubble area shifts sprite start row down", () => {
    const withoutBubble = calculateLayout(40, 30, 0);
    const withBubble = calculateLayout(40, 30, 4);
    // Sprite start row shifts down by bubble lines
    assert.equal(withBubble.spriteStartRow, withoutBubble.spriteStartRow + 4);
    // Sprite rows may be clamped by available space
    assert.ok(withBubble.spriteRows >= 3, "Sprite needs at least 3 rows");
  });

  it("returns all required layout properties", () => {
    const layout = calculateLayout(40, 30);
    const required = [
      "cols", "rows", "innerWidth",
      "bubbleStartRow", "spriteStartRow", "spriteRows", "spriteCols",
      "dividerRow", "statsStartRow", "statsRows",
    ];
    for (const prop of required) {
      assert.ok(prop in layout, `Missing property: ${prop}`);
    }
  });

  it("sprite display dimensions scale to fill available width", () => {
    const narrow = calculateLayout(30, 30);
    const wide = calculateLayout(80, 30);
    assert.ok(wide.spriteCols > narrow.spriteCols);
  });
});
