import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { PADDLE_FILES } from '../src/engines/paths.ts';

type Pinned = { url: string; sha256: string; to: string };

const HUGGING_FACE =
  'https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/bf1d5edb0335d3262be7caf13f766ba274b4cadd';
const TESSDATA_FAST =
  'https://github.com/tesseract-ocr/tessdata_fast/raw/87416418657359cb625c412a48b6e1d6d41c29bd';

const downloads: Pinned[] = [
  {
    url: `${HUGGING_FACE}/detection/PP-OCRv5_mobile_det_infer.onnx`,
    sha256: 'd7fe3ea74652890722c0f4d02458b7261d9f5ae6c92904d05707c9eb155c7924',
    to: PADDLE_FILES['v5-mobile'].detection,
  },
  {
    url: `${HUGGING_FACE}/recognition/multi/latin/v5/latin_PP-OCRv5_mobile_rec_infer.onnx`,
    sha256: '497dbed20b7fd86334c9deb5082c2958982a316bb16e3589ebc6502cd85cae79',
    to: PADDLE_FILES['v5-mobile'].recognition,
  },
  {
    url: `${HUGGING_FACE}/recognition/multi/latin/v5/ppocrv5_latin_dict.txt`,
    sha256: '7274e68c7675355e45dd75c360c83faa0d0624de33a704c799a7da8897662201',
    to: PADDLE_FILES['v5-mobile'].dictionary,
  },
  {
    url: `${HUGGING_FACE}/detection/PP-OCRv6_tiny_det.onnx`,
    sha256: '193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8',
    to: PADDLE_FILES['v6-tiny'].detection,
  },
  {
    url: `${HUGGING_FACE}/recognition/PP-OCRv6_tiny_rec.onnx`,
    sha256: '9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6',
    to: PADDLE_FILES['v6-tiny'].recognition,
  },
  {
    url: `${HUGGING_FACE}/recognition/ppocrv6_tiny_dict.txt`,
    sha256: '2f3717bbd530b681b6db3be35cc485e8a41a932b9558b833986bf0894eb21f2d',
    to: PADDLE_FILES['v6-tiny'].dictionary,
  },
  {
    url: `${HUGGING_FACE}/detection/PP-OCRv6_small_det.onnx`,
    sha256: 'd73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e',
    to: PADDLE_FILES['v6-small'].detection,
  },
  {
    url: `${HUGGING_FACE}/recognition/PP-OCRv6_small_rec.onnx`,
    sha256: '5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634',
    to: PADDLE_FILES['v6-small'].recognition,
  },
  {
    url: `${HUGGING_FACE}/recognition/ppocrv6_dict.txt`,
    sha256: '41557512862dfe31970cf22407742b629725461dd84c0d8771bde9c87c2202c8',
    to: PADDLE_FILES['v6-small'].dictionary,
  },
  {
    url: `${TESSDATA_FAST}/fra.traineddata`,
    sha256: 'ced037562e8c80c13122dece28dd477d399af80911a28791a66a63ac1e3445ca',
    to: 'models/tesseract/fra.traineddata',
  },
  {
    url: `${TESSDATA_FAST}/eng.traineddata`,
    sha256: '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
    to: 'models/tesseract/eng.traineddata',
  },
];

const publicDir = resolve(import.meta.dirname, '..', 'public');
const require = createRequire(import.meta.url);

const sha256 = (data: Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

async function fetchPinned(file: Pinned): Promise<void> {
  const target = join(publicDir, file.to);
  if (existsSync(target) && sha256(readFileSync(target)) === file.sha256) {
    console.log(`déjà présent  ${file.to}`);
    return;
  }
  const response = await fetch(file.url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${file.url} : HTTP ${response.status}`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(data);
  if (actual !== file.sha256) {
    throw new Error(
      `${file.url} : sha256 ${actual}, attendu ${file.sha256} (fichier modifié en amont ?)`,
    );
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`téléchargé    ${file.to} (${data.length} octets)`);
}

function packageRoot(entry: string): string {
  let directory = dirname(entry);
  while (!existsSync(join(directory, 'package.json'))) {
    directory = dirname(directory);
  }
  return directory;
}

function copyRuntime(): void {
  for (const name of [
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
  ]) {
    const to = join(publicDir, 'runtime', 'ort', name);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(require.resolve(`onnxruntime-web/${name}`), to);
  }
  const tesseract = packageRoot(require.resolve('tesseract.js'));
  const core = dirname(
    createRequire(join(tesseract, 'package.json')).resolve('tesseract.js-core'),
  );
  const toDir = join(publicDir, 'runtime', 'tesseract');
  mkdirSync(toDir, { recursive: true });
  for (const name of [
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ]) {
    copyFileSync(join(core, name), join(toDir, name));
  }
  copyFileSync(
    join(tesseract, 'dist', 'worker.min.js'),
    join(toDir, 'worker.min.js'),
  );
  console.log('runtime onnxruntime-web et tesseract copié dans public/runtime');
}

for (const file of downloads) await fetchPinned(file);
copyRuntime();
