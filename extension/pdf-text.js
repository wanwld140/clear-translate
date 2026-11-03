// 保留PDF文本项的顺序，按实际行距/字号分段；不把多栏内容猜成新排版。
export function extractParagraphs(items) {
  const lines = [];
  let line = null;
  const flush = () => {
    if (line?.text.trim()) lines.push(line);
    line = null;
  };
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const [, , , , x, y] = item.transform;
    const height = Math.max(
      1,
      Math.abs(item.height) || Math.hypot(item.transform[2], item.transform[3]),
    );
    if (
      line &&
      (Math.abs(y - line.y) > Math.max(height, line.height) * 0.3 ||
        x < line.lastX - 4)
    )
      flush();
    if (!line) line = { text: "", x, y, height, lastX: x, endX: x };
    const gap = x - line.endX;
    if (line.text && gap > height * 0.15) line.text += " ";
    line.text += item.str;
    line.lastX = x;
    line.endX = x + item.width;
    if (item.hasEOL) flush();
  }
  flush();
  const output = [];
  let block = null;
  for (const current of lines) {
    const separate =
      !block ||
      Math.abs(current.y - block.lastY) >
        Math.max(current.height, block.height) * 1.8 ||
      Math.abs(current.height - block.height) > block.height * 0.25 ||
      Math.abs(current.x - block.x) > 45 ||
      block.text.length + current.text.length > 700;
    if (separate) {
      if (block) output.push(block.text);
      block = { ...current, lastY: current.y };
    } else {
      block.text += " " + current.text;
      block.lastY = current.y;
    }
  }
  if (block) output.push(block.text);
  return output;
}
