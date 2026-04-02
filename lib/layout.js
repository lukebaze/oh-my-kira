// Layout calculator for responsive terminal rendering.
// All positions are 1-based (terminal cursor coordinates).

const BORDER_WIDTH = 2; // left + right border chars
const PADDING = 2;      // 1 char padding each side
const MIN_SPRITE_ROWS = 3;
const MIN_STATS_ROWS = 6;
const STATS_CONTENT_ROWS = 10; // divider + 9 lines of stats

// Terminal cells are roughly 2:1 height:width ratio (each cell is ~twice as tall as wide)
const CELL_ASPECT = 2.0;

export function calculateLayout(cols, rows, bubbleLines = 0, imageAspect = 1.714) {
  const innerWidth = cols - BORDER_WIDTH - PADDING;

  const spriteCols = innerWidth;

  // Estimate how many rows the image actually occupies when displayed at spriteCols width
  // imageAspect = width/height of the source image
  // spriteRows = spriteCols / imageAspect / CELL_ASPECT (cells are taller than wide)
  const estimatedSpriteRows = Math.max(MIN_SPRITE_ROWS, Math.round(spriteCols / imageAspect / CELL_ASPECT));

  // Clamp to available space
  const maxSpriteRows = rows - 2 - STATS_CONTENT_ROWS - bubbleLines;
  const spriteRows = Math.min(estimatedSpriteRows, Math.max(MIN_SPRITE_ROWS, maxSpriteRows));

  // Positions (1-based)
  const bubbleStartRow = 2; // row after top border
  const spriteStartRow = bubbleStartRow + bubbleLines;
  const dividerRow = spriteStartRow + spriteRows;
  const statsStartRow = dividerRow + 1;
  const statsRows = Math.max(MIN_STATS_ROWS, rows - dividerRow - 1);

  return {
    cols,
    rows,
    innerWidth,
    bubbleStartRow,
    spriteStartRow,
    spriteRows,
    spriteCols,
    dividerRow,
    statsStartRow,
    statsRows,
  };
}
