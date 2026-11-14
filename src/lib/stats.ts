// Small, dependency-free statistics toolkit used by the forecasting engines. Every function is pure and unit-tested.

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}
export const stdev = (xs: number[]) => Math.sqrt(variance(xs));

/** Linear-interpolated quantile of an unsorted array (type 7, same as numpy default). */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = clamp(q, 0, 1) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const median = (xs: number[]) => quantile(xs, 0.5);

/** Weighted quantile: the smallest value whose cumulative weight share reaches q (interpolated between neighbors). */
export function weightedQuantile(values: number[], weights: number[], q: number): number {
  const pairs = values
    .map((v, i) => [v, Math.max(0, weights[i] ?? 0)] as const)
    .filter(([v, w]) => Number.isFinite(v) && w > 0)
    .sort((a, b) => a[0] - b[0]);
  if (!pairs.length) return NaN;
  const total = sum(pairs.map((p) => p[1]));
  // Midpoint rule: each point sits at the center of its weight mass.
  let cum = 0;
  const centers = pairs.map(([, w]) => {
    const c = (cum + w / 2) / total;
    cum += w;
    return c;
  });
  const target = clamp(q, 0, 1);
  if (target <= centers[0]) return pairs[0][0];
  if (target >= centers[centers.length - 1]) return pairs[pairs.length - 1][0];
  for (let i = 1; i < centers.length; i++) {
    if (centers[i] >= target) {
      const t = (target - centers[i - 1]) / (centers[i] - centers[i - 1] || 1);
      return pairs[i - 1][0] + t * (pairs[i][0] - pairs[i - 1][0]);
    }
  }
  return pairs[pairs.length - 1][0];
}

/** Kish effective sample size: how many equally-weighted observations the weights are worth. */
export function effectiveSampleSize(weights: number[]): number {
  const s = sum(weights);
  const s2 = sum(weights.map((w) => w * w));
  return s2 > 0 ? (s * s) / s2 : 0;
}

export interface Regression {
  slope: number;
  intercept: number;
  r2: number;
  /** Residual standard error. */
  se: number;
  n: number;
  predict: (x: number) => number;
}

export function linearRegression(xs: number[], ys: number[]): Regression {
  const n = Math.min(xs.length, ys.length);
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const predict = (x: number) => intercept + slope * x;
  let ssr = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    ssr += (ys[i] - predict(xs[i])) ** 2;
    sst += (ys[i] - my) ** 2;
  }
  return {
    slope,
    intercept,
    r2: sst === 0 ? 1 : 1 - ssr / sst,
    se: n > 2 ? Math.sqrt(ssr / (n - 2)) : 0,
    n,
    predict,
  };
}

/**
 * Damped-trend Holt smoothing for short annual series.
 * Returns point forecasts for `horizon` steps and an approximate 80% band from in-sample one-step errors.
 */
export function holtForecast(
  series: number[],
  horizon: number,
  { alpha = 0.6, beta = 0.3, phi = 0.9 }: { alpha?: number; beta?: number; phi?: number } = {},
): { point: number[]; low: number[]; high: number[]; fitted: number[] } {
  const ys = series.filter((v) => Number.isFinite(v));
  if (ys.length === 0) return { point: [], low: [], high: [], fitted: [] };
  if (ys.length === 1) {
    const v = ys[0];
    return { point: Array(horizon).fill(v), low: Array(horizon).fill(v * 0.85), high: Array(horizon).fill(v * 1.15), fitted: [v] };
  }
  let level = ys[0];
  let trend = ys[1] - ys[0];
  const fitted: number[] = [ys[0]];
  const errors: number[] = [];
  for (let t = 1; t < ys.length; t++) {
    const forecast = level + phi * trend;
    fitted.push(forecast);
    errors.push(ys[t] - forecast);
    const newLevel = alpha * ys[t] + (1 - alpha) * (level + phi * trend);
    trend = beta * (newLevel - level) + (1 - beta) * phi * trend;
    level = newLevel;
  }
  const sigma = Math.sqrt(mean(errors.map((e) => e * e)) || 0);
  const point: number[] = [];
  const low: number[] = [];
  const high: number[] = [];
  let damp = 0;
  for (let h = 1; h <= horizon; h++) {
    damp += phi ** h;
    const p = level + damp * trend;
    const band = 1.2816 * sigma * Math.sqrt(h); // 80% normal interval, widening with horizon
    point.push(p);
    low.push(p - band);
    high.push(p + band);
  }
  return { point, low, high, fitted };
}

/**
 * Monthly forecast with a multiplicative seasonal index and a linear trend on the deseasonalized series.
 * `months` are values in chronological order; `startMonth` is the calendar month (1-12) of the first value.
 */
export function seasonalForecast(
  months: number[],
  startMonth: number,
  horizon: number,
): { point: number[]; low: number[]; high: number[]; seasonal: number[]; trendPerYear: number } {
  const n = months.length;
  if (n < 13) {
    const m = mean(months);
    return { point: Array(horizon).fill(m), low: Array(horizon).fill(m * 0.8), high: Array(horizon).fill(m * 1.2), seasonal: Array(12).fill(1), trendPerYear: 0 };
  }
  // Seasonal index per calendar month: ratio of each value to its centered 12-month average.
  const ratios: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 6; i < n - 6; i++) {
    const window = months.slice(i - 6, i + 6);
    const avg = mean(window);
    if (avg > 0) ratios[(startMonth - 1 + i) % 12].push(months[i] / avg);
  }
  let seasonal = ratios.map((r) => (r.length ? median(r) : 1));
  const norm = mean(seasonal) || 1;
  seasonal = seasonal.map((s) => s / norm);
  const deseason = months.map((v, i) => v / (seasonal[(startMonth - 1 + i) % 12] || 1));
  // Fit the trend on the most recent 36 months so old regimes don't dominate.
  const recent = Math.min(36, n);
  const xs = Array.from({ length: recent }, (_, i) => n - recent + i);
  const reg = linearRegression(xs, deseason.slice(n - recent));
  const residuals = xs.map((x, i) => deseason[n - recent + i] - reg.predict(x));
  const sigma = stdev(residuals);
  const point: number[] = [];
  const low: number[] = [];
  const high: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = n - 1 + h;
    const s = seasonal[(startMonth - 1 + idx) % 12];
    const base = Math.max(0, reg.predict(idx));
    const band = 1.2816 * sigma * Math.sqrt(1 + h / recent);
    point.push(base * s);
    low.push(Math.max(0, (base - band) * s));
    high.push((base + band) * s);
  }
  return { point, low, high, seasonal, trendPerYear: reg.slope * 12 };
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
  weight: number;
}

export function histogram(values: number[], { bins = 20, min, max, weights }: { bins?: number; min?: number; max?: number; weights?: number[] } = {}): Bin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [];
  const lo = min ?? Math.min(...finite);
  const hi = max ?? Math.max(...finite);
  const width = (hi - lo) / bins || 1;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({ x0: lo + i * width, x1: lo + (i + 1) * width, count: 0, weight: 0 }));
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const idx = clamp(Math.floor((v - lo) / width), 0, bins - 1);
    out[idx].count += 1;
    out[idx].weight += weights?.[i] ?? 1;
  });
  return out;
}

/** Compound annual growth rate between two positive values over `years`. */
export function cagr(first: number, last: number, years: number): number {
  if (first <= 0 || last <= 0 || years <= 0) return NaN;
  return (last / first) ** (1 / years) - 1;
}

/** Deterministic pseudo-random generator (mulberry32) so sample data is identical on every load. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Annuity payment for a level-debt-service bond: principal P, annual rate r, n years. */
export function annuityPayment(principal: number, rate: number, years: number): number {
  if (years <= 0) return principal;
  if (rate === 0) return principal / years;
  return (principal * rate) / (1 - (1 + rate) ** -years);
}
