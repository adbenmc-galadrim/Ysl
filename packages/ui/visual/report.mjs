/**
 * Verdict of a visual run: the screens whose share of differing pixels goes
 * over the tolerated maximum, and the Markdown table a CI job summary shows.
 */
/** @typedef {{ story: string, ref: string, pct: number }} Result */

/**
 * @param {Result[]} results
 * @param {number} max
 */
export function verdict(results, max) {
  const failed = results.filter((r) => r.pct > max);
  return { ok: results.length > 0 && failed.length === 0, failed };
}

/**
 * @param {Result[]} results
 * @param {number} max
 */
export function markdown(results, max) {
  const lines = [
    `| Écran | Écart | Seuil ${max.toFixed(2)} % |`,
    '|---|---:|:---:|',
  ];
  for (const r of results) {
    lines.push(
      `| \`${r.ref}\` | ${r.pct.toFixed(2)} % | ${r.pct > max ? '❌' : '✅'} |`,
    );
  }
  if (!results.length) lines.push('| _aucun écran comparé_ | | ❌ |');
  return lines.join('\n') + '\n';
}
