export function renderSpeechBubble(text, maxWidth) {
  if (!text) text = "...";
  const padding = 2;
  const borderWidth = 2;
  const innerMax = maxWidth - borderWidth - padding;
  const displayText = text.length > innerMax ? text.slice(0, innerMax - 1) + "\u2026" : text;
  const innerWidth = Math.max(displayText.length, 3);
  const totalInner = innerWidth + padding;

  const top = "  \u256d" + "\u2500".repeat(totalInner) + "\u256e";
  const content = "  \u2502 " + displayText + " ".repeat(innerWidth - displayText.length) + " \u2502";
  const bottomLeft = totalInner - Math.floor(totalInner / 2) - 1;
  const bottomRight = totalInner - bottomLeft - 1;
  const bottom = "  \u2570" + "\u2500".repeat(bottomLeft) + "\u256e" + "\u2500".repeat(bottomRight) + "\u256f";
  const tail = " ".repeat(bottomLeft + 3) + "\u25DC";

  const lines = [top, content, bottom, tail];
  return lines.map((line) => (line.length > maxWidth ? line.slice(0, maxWidth) : line));
}

export function clearSpeechBubble(lineCount, maxWidth) {
  return Array.from({ length: lineCount }, () => "\x1b[2K" + " ".repeat(maxWidth));
}
