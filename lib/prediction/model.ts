/** Small deterministic L2 logistic regression. No pretrained/synthetic weights. */
export interface Example { x: number[]; y: number; at: number; knownAt: number }
export interface Model { weights: number[]; intercept: number; means: number[] }
const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
export function probability(model: Model, x: number[]): number {
  return sigmoid(model.intercept + model.weights.reduce((s, w, j) => s + w * (x[j] - model.means[j]), 0));
}
export function fit(rows: Example[]): Model {
  if (!rows.length || rows.some(r => r.x.length !== rows[0].x.length || r.x.some(v => !Number.isFinite(v)) || ![0, 1].includes(r.y))) {
    throw new Error('Training requires finite, equally sized features and binary labels.');
  }
  const means = rows[0].x.map((_, j) => rows.reduce((s, r) => s + r.x[j], 0) / rows.length);
  const rate = (rows.reduce((s, r) => s + r.y, 0) + 1) / (rows.length + 2);
  const model: Model = { weights: means.map(() => 0), means, intercept: Math.log(rate / (1 - rate)) };
  // Unweighted log loss preserves observed prevalence. Do not oversample classes
  // and then present the shifted probabilities as calibrated estimates.
  for (let iteration = 0; iteration < 600; iteration++) {
    const gradient = means.map(() => 0);
    let bias = 0;
    for (const row of rows) {
      const error = probability(model, row.x) - row.y;
      bias += error;
      row.x.forEach((value, j) => { gradient[j] += error * (value - means[j]); });
    }
    model.intercept -= 0.3 * bias / rows.length;
    model.weights = model.weights.map((w, j) => w - 0.3 * (gradient[j] / rows.length + 0.02 * w));
  }
  return model;
}
export function metrics(labels: number[], probabilities: number[], threshold = 0.6) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  labels.forEach((y, i) => {
    if (probabilities[i] >= threshold) { if (y) tp++; else fp++; }
    else if (y) fn++; else tn++;
  });
  const positives = tp + fn, negatives = tn + fp;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = positives ? tp / positives : null;
  const specificity = negatives ? tn / negatives : null;
  let pairs = 0, wins = 0;
  labels.forEach((y, i) => {
    if (!y) return;
    labels.forEach((other, j) => {
      if (other) return;
      pairs++;
      wins += probabilities[i] > probabilities[j] ? 1 : probabilities[i] === probabilities[j] ? 0.5 : 0;
    });
  });
  return {
    count: labels.length, positives, negatives, threshold, tp, tn, fp, fn,
    precision, recall, specificity,
    f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null,
    balancedAccuracy: recall !== null && specificity !== null ? (recall + specificity) / 2 : null,
    rocAuc: pairs ? wins / pairs : null,
    brier: labels.reduce((s, y, i) => s + (probabilities[i] - y) ** 2, 0) / labels.length,
    logLoss: -labels.reduce((s, y, i) => {
      const p = Math.max(1e-9, Math.min(1 - 1e-9, probabilities[i]));
      return s + y * Math.log(p) + (1 - y) * Math.log(1 - p);
    }, 0) / labels.length,
  };
}