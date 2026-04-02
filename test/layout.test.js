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

  it("allocates ~70% of rows to sprite in tall terminal", () => {
    const layout = calculateLayout(40, 40);
    const spriteRatio = layout.spriteRows / 40;
    assert.ok(spriteRatio >= 0.55, `Sprite ratio ${spriteRatio} too low`);
    assert.ok(spriteRatio <= 0.80, `Sprite ratio ${spriteRatio} too high`);
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

  it("bubble area reduces sprite area when active", () => {
    const withoutBubble = calculateLayout(40, 30, 0);
    const withBubble = calculateLayout(40, 30, 4);
    assert.ok(withBubble.spriteRows < withoutBubble.spriteRows);
    assert.equal(withBubble.spriteStartRow, withoutBubble.spriteStartRow + 4);
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
