import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from './Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import {
  finishImageCrop,
  getCropSession,
  subscribeCropSession,
  type CropRequest,
} from '../utils/imageCropStore';

type Size = { width: number; height: number };

function loadImageSize(uri: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error('No se pudo medir la imagen')),
    );
  });
}

async function cropUriToAspect(
  uri: string,
  imageSize: Size,
  /** Región del crop en coordenadas de la imagen natural */
  crop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  if (Platform.OS !== 'web') {
    // En nativo usamos el cropper del sistema; este modal es fallback web.
    return uri;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    el.crossOrigin = 'anonymous';
    el.src = uri;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const outW = Math.max(1, Math.round(crop.width * scale));
  const outH = Math.max(1, Math.round(crop.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo recortar la imagen');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo exportar el recorte'))),
      'image/jpeg',
      0.9,
    );
  });

  return URL.createObjectURL(blob);
}

function CropEditor({ request }: { request: CropRequest }) {
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [stage, setStage] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const aspect = request.aspect[0] / request.aspect[1];

  useEffect(() => {
    let alive = true;
    loadImageSize(request.uri)
      .then((size) => {
        if (alive) setImageSize(size);
      })
      .catch(() => {
        if (alive) setError('No se pudo abrir la imagen.');
      });
    return () => {
      alive = false;
    };
  }, [request.uri]);

  const frame = useMemo(() => {
    if (stage.width < 40 || stage.height < 40) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    const pad = 24;
    const maxW = stage.width - pad * 2;
    const maxH = stage.height - pad * 2;
    let width = maxW;
    let height = width / aspect;
    if (height > maxH) {
      height = maxH;
      width = height * aspect;
    }
    return {
      width,
      height,
      left: (stage.width - width) / 2,
      top: (stage.height - height) / 2,
    };
  }, [aspect, stage.height, stage.width]);

  const baseScale = useMemo(() => {
    if (!imageSize || frame.width <= 0) return 1;
    return Math.max(frame.width / imageSize.width, frame.height / imageSize.height);
  }, [frame.height, frame.width, imageSize]);

  const displayScale = baseScale * zoom;
  const displayW = (imageSize?.width ?? 0) * displayScale;
  const displayH = (imageSize?.height ?? 0) * displayScale;

  const clampOffset = useCallback(
    (x: number, y: number, nextZoom = zoom) => {
      if (!imageSize || frame.width <= 0) return { x: 0, y: 0 };
      const scale = baseScale * nextZoom;
      const w = imageSize.width * scale;
      const h = imageSize.height * scale;
      const minX = frame.width - w;
      const minY = frame.height - h;
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [baseScale, frame.height, frame.width, imageSize, zoom],
  );

  useEffect(() => {
    if (!imageSize || frame.width <= 0) return;
    const scale = baseScale;
    const w = imageSize.width * scale;
    const h = imageSize.height * scale;
    setZoom(1);
    const minX = frame.width - w;
    const minY = frame.height - h;
    setOffset({
      x: Math.min(0, Math.max(minX, (frame.width - w) / 2)),
      y: Math.min(0, Math.max(minY, (frame.height - h) / 2)),
    });
  }, [baseScale, frame.height, frame.width, imageSize]);

  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = {
            x: 0,
            y: 0,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
          };
        },
        onPanResponderMove: (_, gesture) => {
          setOffset(
            clampOffset(dragStart.current.ox + gesture.dx, dragStart.current.oy + gesture.dy),
          );
        },
      }),
    [clampOffset],
  );

  const changeZoom = (delta: number) => {
    setZoom((prev) => {
      const next = Math.min(4, Math.max(1, Math.round((prev + delta) * 10) / 10));
      setOffset((o) => clampOffset(o.x, o.y, next));
      return next;
    });
  };

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  };

  const handleCancel = () => finishImageCrop(null);

  const handleConfirm = async () => {
    if (!imageSize || frame.width <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const scale = displayScale;
      const cropX = Math.max(0, -offset.x / scale);
      const cropY = Math.max(0, -offset.y / scale);
      const cropW = Math.min(imageSize.width - cropX, frame.width / scale);
      const cropH = Math.min(imageSize.height - cropY, frame.height / scale);
      const cropped = await cropUriToAspect(request.uri, imageSize, {
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
      });
      finishImageCrop(cropped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo recortar la imagen.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{request.title ?? 'Recortar foto'}</Text>
        <Pressable onPress={handleCancel} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.hint}>Arrastra la foto y usa + / − para encuadrar</Text>

      <View style={styles.stage} onLayout={onStageLayout}>
        {frame.width > 0 && imageSize ? (
          <View
            style={[
              styles.frame,
              {
                width: frame.width,
                height: frame.height,
                left: frame.left,
                top: frame.top,
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Image
              source={{ uri: request.uri }}
              style={{
                width: displayW,
                height: displayH,
                transform: [{ translateX: offset.x }, { translateY: offset.y }],
              }}
              resizeMode="stretch"
            />
            <View pointerEvents="none" style={styles.frameBorder} />
          </View>
        ) : (
          <Text style={styles.loading}>Cargando imagen…</Text>
        )}
      </View>

      <View style={styles.zoomRow}>
        <Pressable style={styles.zoomBtn} onPress={() => changeZoom(-0.2)} accessibilityRole="button">
          <Ionicons name="remove" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        <Pressable style={styles.zoomBtn} onPress={() => changeZoom(0.2)} accessibilityRole="button">
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={handleCancel} style={styles.actionBtn} />
        <Button
          title={busy ? 'Recortando…' : 'Usar foto'}
          onPress={handleConfirm}
          loading={busy}
          disabled={!imageSize || busy}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
}

/** Host global: escucha requestImageCrop() y muestra el modal. */
export default function ImageCropHost() {
  const [request, setRequest] = useState<CropRequest | null>(null);

  useEffect(() => {
    const sync = () => {
      const session = getCropSession();
      setRequest(session ? { uri: session.uri, aspect: session.aspect, title: session.title } : null);
    };
    sync();
    return subscribeCropSession(sync);
  }, []);

  return (
    <Modal visible={!!request} animationType="slide" transparent onRequestClose={() => finishImageCrop(null)}>
      <View style={styles.overlay}>
        {request ? <CropEditor key={request.uri} request={request} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    zIndex: 10000,
    ...(Platform.OS === 'web' ? ({ position: 'fixed' as const, inset: 0 } as object) : null),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.screen,
    maxHeight: '92%',
    gap: spacing.sm,
    ...(Platform.OS === 'web' ? ({ maxHeight: '92vh' } as object) : null),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  stage: {
    height: 360,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    position: 'relative',
  },
  frame: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 2,
  },
  loading: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 160,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: {
    minWidth: 56,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: { flex: 1 },
});
