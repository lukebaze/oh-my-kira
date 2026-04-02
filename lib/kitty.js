const ESC = "\x1b";
const APC_START = `${ESC}_G`;
const ST = `${ESC}\\`;

export function buildTransmitSequence(pngBase64, { cols, rows, imageId } = {}) {
  const params = ["a=T", "f=100"];
  if (cols) params.push(`c=${cols}`);
  if (rows) params.push(`r=${rows}`);
  if (imageId) params.push(`i=${imageId}`);
  return `${APC_START}${params.join(",")};${pngBase64}${ST}`;
}

export function buildDeleteSequence(imageId) {
  const params = ["a=d"];
  if (imageId) params.push(`i=${imageId}`);
  return `${APC_START}${params.join(",")};${ST}`;
}

export function moveCursorTo(row, col) {
  return `${ESC}[${row};${col}H`;
}

export function clearScreen() {
  return `${ESC}[2J${ESC}[H`;
}

export function hideCursor() {
  return `${ESC}[?25l`;
}

export function showCursor() {
  return `${ESC}[?25h`;
}
