export type PaddleModelId = 'v5-mobile' | 'v6-tiny' | 'v6-small';

export type PaddleFiles = {
  detection: string;
  recognition: string;
  dictionary: string;
};

export const PADDLE_FILES: Record<PaddleModelId, PaddleFiles> = {
  'v5-mobile': {
    detection: 'models/paddle/v5-mobile/det.onnx',
    recognition: 'models/paddle/v5-mobile/rec.onnx',
    dictionary: 'models/paddle/v5-mobile/dict.txt',
  },
  'v6-tiny': {
    detection: 'models/paddle/v6-tiny/det.onnx',
    recognition: 'models/paddle/v6-tiny/rec.onnx',
    dictionary: 'models/paddle/v6-tiny/dict.txt',
  },
  'v6-small': {
    detection: 'models/paddle/v6-small/det.onnx',
    recognition: 'models/paddle/v6-small/rec.onnx',
    dictionary: 'models/paddle/v6-small/dict.txt',
  },
};

export const TESSERACT_LANG_DIR = 'models/tesseract';
export const TESSERACT_LANGS = ['fra', 'eng'] as const;
export const TESSERACT_CORE_DIR = 'runtime/tesseract';
export const TESSERACT_WORKER = 'tesseract-probe.js';
export const ORT_DIR = 'runtime/ort/';
