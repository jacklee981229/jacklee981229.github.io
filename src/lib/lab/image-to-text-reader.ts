// Image to Text in the browser: the reader, PaddleOCR.js with PaddleOCR's PP-OCRv6 tiny models, which loads only when
// the first picture arrives. The models and ONNX Runtime's engine are served from this site (fingerprinted by the
// build), so the browser keeps them and nothing is asked of another site.
import type { OcrResultItem, PaddleOCR } from '@paddleocr/paddleocr-js';
import detUrl from '../../assets/image-to-text/PP-OCRv6_tiny_det.tar?url';
import recUrl from '../../assets/image-to-text/PP-OCRv6_tiny_rec.tar?url';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

let reader: ReturnType<typeof PaddleOCR.create> | null = null;

/** The reader, made once: about 15 MB to download the first time (the models and the engine), then from the browser. */
export function getReader() {
  reader ??= import('@paddleocr/paddleocr-js')
    .then(({ PaddleOCR }) => PaddleOCR.create({
      textDetectionModelName: 'PP-OCRv6_tiny_det',
      textDetectionModelAsset: { url: detUrl },
      textRecognitionModelName: 'PP-OCRv6_tiny_rec',
      textRecognitionModelAsset: { url: recUrl },
      // One thread: a page can only share memory between threads with headers GitHub Pages doesn't send. The engine's
      // file is named by the build, so it's given as ONNX Runtime's { wasm } form, which PaddleOCR.js passes on as it
      // is though its types say a folder's address.
      ortOptions: { backend: 'wasm', wasmPaths: { wasm: wasmUrl } as unknown as string, numThreads: 1 },
    }))
    .catch((e) => {
      // A failed start (offline, say) can be tried again with the next picture.
      reader = null;
      throw e;
    });
  return reader;
}

/** The lines found in a picture, each with its box. */
export async function readPicture(picture: Blob): Promise<OcrResultItem[]> {
  const [result] = await (await getReader()).predict(picture);
  return result?.items ?? [];
}
