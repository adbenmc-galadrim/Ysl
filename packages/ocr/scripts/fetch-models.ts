import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

type Pinned = { url: string; sha256: string; to: string };

const HUGGING_FACE =
  'https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/bf1d5edb0335d3262be7caf13f766ba274b4cadd';
const TESSDATA_FAST =
  'https://github.com/tesseract-ocr/tessdata_fast/raw/87416418657359cb625c412a48b6e1d6d41c29bd';

/** PP-OCRv6 tiny (spike S3) and the Tesseract v7 fallback languages. */
export const PINNED: Pinned[] = [
  {
    url: `${HUGGING_FACE}/detection/PP-OCRv6_tiny_det.onnx`,
    sha256: '193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8',
    to: 'paddle/det.onnx',
  },
  {
    url: `${HUGGING_FACE}/recognition/PP-OCRv6_tiny_rec.onnx`,
    sha256: '9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6',
    to: 'paddle/rec.onnx',
  },
  {
    url: `${HUGGING_FACE}/recognition/ppocrv6_tiny_dict.txt`,
    sha256: '2f3717bbd530b681b6db3be35cc485e8a41a932b9558b833986bf0894eb21f2d',
    to: 'paddle/dict.txt',
  },
  {
    url: `${TESSDATA_FAST}/fra.traineddata`,
    sha256: 'ced037562e8c80c13122dece28dd477d399af80911a28791a66a63ac1e3445ca',
    to: 'tesseract/fra.traineddata',
  },
  {
    url: `${TESSDATA_FAST}/eng.traineddata`,
    sha256: '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
    to: 'tesseract/eng.traineddata',
  },
];

const ATTEMPTS = 3;

const modelsDir = resolve(import.meta.dirname, '..', 'models');

const sha256 = (data: Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function download(url: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await wait(2000 * attempt);
    }
  }
  throw new Error(`${url} : ${String(lastError)}`);
}

async function fetchPinned(file: Pinned): Promise<void> {
  const target = join(modelsDir, file.to);
  if (existsSync(target) && sha256(readFileSync(target)) === file.sha256) {
    console.log(`déjà présent  ${file.to}`);
    return;
  }
  const data = await download(file.url);
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

for (const file of PINNED) await fetchPinned(file);
