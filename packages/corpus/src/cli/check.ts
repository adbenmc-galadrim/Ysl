import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { coverage } from '#coverage';
import { missingFiles, readManifest } from '#manifest';
import { outDir } from '#cli/output';

const { values } = parseArgs({
  options: { private: { type: 'string' }, out: { type: 'string' } },
});
const out = outDir(values.out);
const manifests = [
  join(out, 'synthetic/labels.json'),
  join(out, 'web/labels.json'),
].filter((file) => existsSync(file));

if (values.private) {
  const annotations = join(resolve(values.private), 'annotations.json');
  if (!existsSync(annotations)) {
    console.error(`${annotations} introuvable`);
    process.exit(1);
  }
  manifests.push(annotations);
}

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
