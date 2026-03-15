/**
 * 按模型记录最近 N 次请求的延迟（毫秒），用于自动选择“最快”的免费模型
 */
const DEFAULT_MAX_SAMPLES = 20;

export function createLatencyTracker(maxSamples = DEFAULT_MAX_SAMPLES) {
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
   * 在候选模型列表中，选出近期平均延迟最低的模型；若无数据则返回列表第一个
   */
  function pickFastest(candidateModels) {
    if (!candidateModels?.length) return null;
    let best = null;
    let bestAvg = Infinity;
    for (const model of candidateModels) {
      const samples = byModel.get(model);
      if (!samples?.length) {
        // 无数据时优先返回第一个，避免总是选同一个
        if (best === null) best = model;
        continue;
      }
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg < bestAvg) {
        bestAvg = avg;
        best = model;
      }
    }
    return best ?? candidateModels[0];
  }

  return { record, pickFastest, byModel };
}
