/**
 * 按模型记录最近 N 次请求的延迟（毫秒），用于自动选择“最快”的免费模型
 */
const DEFAULT_MAX_SAMPLES = 20;

export function createLatencyTracker(maxSamples = DEFAULT_MAX_SAMPLES, defaultLatency = 3000) {
  const byModel = new Map(); // modelId -> number[]

  function record(modelId, latencyMs) {
    if (!modelId || latencyMs == null) return;
    let arr = byModel.get(modelId);
    if (!arr) {
      arr = [];
      byModel.set(modelId, arr);
    }
    arr.push(latencyMs);
    if (arr.length > maxSamples) arr.shift();
  }

  /**
   * 在候选模型列表中，选出近期平均延迟最低的模型；可排除部分模型（如已超时的）
   * @param {string[]} candidateModels
   * @param {Set<string>} [exclude] 不参与选择的模型 ID
   */
  function pickFastest(candidateModels, exclude = new Set()) {
    if (!candidateModels?.length) return null;
    const candidates = exclude.size ? candidateModels.filter((m) => !exclude.has(m)) : candidateModels;
    if (!candidates.length) return null;
    let best = null;
    let bestAvg = Infinity;
    for (const model of candidates) {
      const samples = byModel.get(model);
      if (!samples?.length) {
        if (defaultLatency < bestAvg) {
          bestAvg = defaultLatency;
          best = model;
        }
        continue;
      }
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg < bestAvg) {
        bestAvg = avg;
        best = model;
      }
    }
    return best ?? candidates[0];
  }

  return { record, pickFastest, byModel };
}
