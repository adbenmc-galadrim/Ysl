/**
 * Where the Vite plugin publishes the Tesseract languages, unhashed: the
 * worker of tesseract.js builds `<dir>/<lang>.traineddata` itself.
 */
export const TESSERACT_LANGUAGES_DIR = 'ocr/tesseract';

export const TESSERACT_LANGUAGES = ['fra', 'eng'] as const;

export const languageFile = (language: string) => `${language}.traineddata`;
