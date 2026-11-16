export interface SheepFormationResult {
  points: Array<{ x: number; z: number }>;
  recommendedScale: number;
}

function wrapTextBalanced(text: string, maxLines = 3): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  if (cleaned.length <= 10) return [cleaned];

  const words = cleaned.split(' ');
  const targetLines = cleaned.length <= 22 ? 2 : maxLines;

  if (words.length <= 1) {
    // Single very long word: split evenly
    const chunk = Math.ceil(cleaned.length / targetLines);
    const lines: string[] = [];
    for (let i = 0; i < cleaned.length; i += chunk) {
      lines.push(cleaned.slice(i, i + chunk));
    }
    return lines.slice(0, maxLines);
  }

  const totalChars = cleaned.length;
  const approxPerLine = totalChars / targetLines;
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    const remainingLines = targetLines - lines.length;
    if (
      current &&
      remainingLines > 1 &&
      candidate.length > approxPerLine * 1.12
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // If wrapping spilled past maxLines, merge shortest adjacent pair
  while (lines.length > maxLines) {
    let bestIdx = 0;
    let bestLen = Infinity;
    for (let i = 0; i < lines.length - 1; i++) {
      const mergedLen = lines[i].length + lines[i + 1].length + 1;
      if (mergedLen < bestLen) {
        bestLen = mergedLen;
        bestIdx = i;
      }
    }
    lines.splice(bestIdx, 2, `${lines[bestIdx]} ${lines[bestIdx + 1]}`);
  }

  return lines;
}

export function generateSheepTargetsFromText(
  text: string,
  maxSheep: number
): SheepFormationResult {
  const lines = wrapTextBalanced(text, 3);
  if (lines.length === 0) {
    return { points: [], recommendedScale: 0.85 };
  }

  const canvasW = 640;
  const canvasH = 280;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { points: [], recommendedScale: 0.85 };
  }

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit font size cleanly to canvas width & line count
  let fontSize = lines.length === 1 ? 132 : lines.length === 2 ? 96 : 74;
  const maxAllowedW = canvasW * 0.9;
  const maxAllowedH = canvasH * 0.86;

  while (fontSize > 26) {
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const totalH = lines.length * fontSize * 1.18;
    if (widest <= maxAllowedW && totalH <= maxAllowedH) {
      break;
    }
    fontSize -= 3;
  }

  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
  const lineHeight = fontSize * 1.18;
  const startY = canvasH / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, idx) => {
    ctx.fillText(line, canvasW / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH).data;

  // Map canvas coordinates to central meadow plateau (width ~ 27, depth ~ 12.2)
  const worldW = 27.5;
  const worldD = 12.2;

  const isPixelSolid = (px: number, py: number): boolean => {
    const ix = Math.max(0, Math.min(canvasW - 1, Math.round(px)));
    const iy = Math.max(0, Math.min(canvasH - 1, Math.round(py)));
    return imgData[(iy * canvasW + ix) * 4 + 3] > 115;
  };

  // Sample on a fine grid first, then select spacing with binary search so sheep fill strokes cleanly
  const sampleAtSpacing = (stepWorld: number): Array<{ x: number; z: number }> => {
    const stepPxX = (stepWorld / worldW) * canvasW;
    const stepPxY = (stepWorld / worldD) * canvasH;
    const pts: Array<{ x: number; z: number }> = [];

    let row = 0;
    for (let py = stepPxY * 0.5; py < canvasH; py += stepPxY) {
      const offsetX = (row % 2) * (stepPxX * 0.35);
      for (let px = stepPxX * 0.5 + offsetX; px < canvasW; px += stepPxX) {
        if (isPixelSolid(px, py)) {
          const jx = (Math.sin(px * 12.9898 + py * 78.233) * 0.5) * stepWorld * 0.14;
          const jz = (Math.cos(px * 39.346 + py * 11.135) * 0.5) * stepWorld * 0.14;
          const x = ((px / canvasW) - 0.5) * worldW + jx;
          const z = ((py / canvasH) - 0.5) * worldD + jz;
          pts.push({ x, z });
        }
      }
      row++;
    }
    return pts;
  };

  let lo = 0.28;
  let hi = 1.15;
  let bestPoints: Array<{ x: number; z: number }> = [];
  let bestStep = 0.55;

  for (let iter = 0; iter < 14; iter++) {
    const mid = (lo + hi) * 0.5;
    const pts = sampleAtSpacing(mid);
    if (pts.length <= maxSheep) {
      bestPoints = pts;
      bestStep = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }

  if (bestPoints.length === 0) {
    bestPoints = sampleAtSpacing(hi).slice(0, maxSheep);
    bestStep = hi;
  }

  // Scale sheep proportionally to spacing so dense long texts remain super legible
  const recommendedScale = Math.max(0.46, Math.min(0.88, bestStep * 1.18));

  return {
    points: bestPoints,
    recommendedScale,
  };
}
