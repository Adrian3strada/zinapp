import type { ImageAspect } from './imagePicker';

export type CropRequest = {
  uri: string;
  aspect: ImageAspect;
  title?: string;
};

type CropSession = CropRequest & {
  resolve: (uri: string | null) => void;
};

let session: CropSession | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getCropSession(): CropSession | null {
  return session;
}

export function subscribeCropSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Abre el modal de recorte y resuelve con la URI recortada (o null si cancela). */
export function requestImageCrop(
  uri: string,
  aspect: ImageAspect,
  title = 'Recortar foto',
): Promise<string | null> {
  return new Promise((resolve) => {
    if (session) {
      session.resolve(null);
    }
    session = { uri, aspect, title, resolve };
    notify();
  });
}

export function finishImageCrop(uri: string | null): void {
  const current = session;
  session = null;
  notify();
  current?.resolve(uri);
}
