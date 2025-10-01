const TOL = { VN: 10, VF: 10, HN: 50, HF: 150 };

export const SELECT_RESULTS_FIELDS = `
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.VN')) AS DECIMAL(20,6)) AS VN,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.VF')) AS DECIMAL(20,6)) AS VF,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.HN')) AS DECIMAL(20,6)) AS HN,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.HF')) AS DECIMAL(20,6)) AS HF
`;

export function precisionPctContinuous({ VN, VF, HN, HF }) {
  const parts = [
    ['VN', VN],
    ['VF', VF],
    ['HN', HN],
    ['HF', HF],
  ].filter(([, v]) => typeof v === 'number' && !Number.isNaN(v));

  if (!parts.length) return 0;

  const scores = parts.map(([key, value]) => {
    const limit = TOL[key];
    if (!limit || !isFinite(limit) || limit <= 0) return 0;
    const relative = Math.abs(value) / limit;
    const score = Math.max(0, 1 - Math.min(1, relative));
    return score;
  });

  const average = scores.reduce((acc, score) => acc + score, 0) / scores.length;
  return +(average * 100).toFixed(1);
}
