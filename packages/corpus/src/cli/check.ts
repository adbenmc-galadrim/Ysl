import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { coverage } from '#coverage';
import { missingFiles, readManifest } from '#manifest';

const { values } = parseArgs({ options: { private: { type: 'string' } } });

const out = resolve(import.meta.dirname, '../../out');
const manifests = [
  join(out, 'synthetic/labels.json'),
  join(out, 'web/labels.json'),
  ...(values.private
    ? [join(resolve(values.private), 'annotations.json')]
    : []),
].filter((file) => existsSync(file));

const labels = manifests.flatMap(readManifest);
const report = coverage(labels);
const missing = missingFiles(labels);

console.log(`Manifestes : ${manifests.join(', ') || 'aucun'}`);
console.log(`\n${report.total} étiquettes annotées`);
console.log('\nPar source');
console.table(report.bySource);
console.log('Par transporteur');
console.table(report.byCarrier);
console.log(
  `À relire : ${labels.filter((l) => !l.reviewed).length} étiquettes non validées`,
);

const problems = [
  ...report.problems,
  ...missing.map((path) => `fichier absent : ${path}`),
];
if (problems.length > 0) {
  console.error(`\nCorpus insuffisant :\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nCorpus conforme.');
