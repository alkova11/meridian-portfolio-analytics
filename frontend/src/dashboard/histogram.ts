export function returnBins(returns: number[], n = 30) {
  const values = returns.filter(Number.isFinite);
  if (!values.length) return { centers: [], counts: [] };
  const min = Math.min(...values),
    max = Math.max(...values);
  if (min === max) return { centers: [min], counts: [values.length] };
  const count = Math.max(
    1,
    Math.min(100, Math.floor(Number.isFinite(n) ? n : 30)),
  );
  const width = (max - min) / count,
    counts = Array<number>(count).fill(0);
  values.forEach(
    (v) => counts[Math.min(count - 1, Math.floor((v - min) / width))]++,
  );
  return { centers: counts.map((_, i) => min + (i + 0.5) * width), counts };
}
