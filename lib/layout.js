// Layout calculator for responsive terminal rendering.
// All positions are 1-based (terminal cursor coordinates).

const BORDER_WIDTH = 2; // left + right border chars
const PADDING = 2;      // 1 char padding each side
const MIN_SPRITE_ROWS = 3;
const MIN_STATS_ROWS = 6;
const STATS_CONTENT_ROWS = 10; // divider + 9 lines of stats

export function calculateLayout(cols, rows, bubbleLines = 0) {
  const innerWidth = cols - BORDER_WIDTH - PADDING;

  // Fixed areas: top border (1), bottom border (1), stats area
  const fixedRows = 2 + STATS_CONTENT_ROWS; // borders + stats
  const availableForSprite = rows - fixedRows - bubbleLines;

  // Sprite gets whatever is left, with minimums
  const spriteRows = Math.max(MIN_SPRITE_ROWS, availableForSprite);

  // Sprite fills the inner width
  const spriteCols = innerWidth;

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
