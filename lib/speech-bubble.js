function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines;
}

export function renderSpeechBubble(text, maxWidth) {
  if (!text) text = "...";
  const padding = 2;
  const borderWidth = 2;
  const innerMax = maxWidth - borderWidth - padding;

  const wrappedLines = wrapText(text, innerMax);
  const innerWidth = Math.max(3, ...wrappedLines.map((l) => l.length));
  const totalInner = innerWidth + padding;

  const top = "  \u256d" + "\u2500".repeat(totalInner) + "\u256e";
  const contentLines = wrappedLines.map(
    (line) => "  \u2502 " + line + " ".repeat(innerWidth - line.length) + " \u2502"
  );
  const bottomLeft = totalInner - Math.floor(totalInner / 2) - 1;
  const bottomRight = totalInner - bottomLeft - 1;
  const bottom = "  \u2570" + "\u2500".repeat(bottomLeft) + "\u256e" + "\u2500".repeat(bottomRight) + "\u256f";
  const tail = " ".repeat(bottomLeft + 3) + "\u25DC";

  const lines = [top, ...contentLines, bottom, tail];
  return lines.map((line) => (line.length > maxWidth ? line.slice(0, maxWidth) : line));
}

export function clearSpeechBubble(lineCount, maxWidth) {
  return Array.from({ length: lineCount }, () => "\x1b[2K" + " ".repeat(maxWidth));
}
