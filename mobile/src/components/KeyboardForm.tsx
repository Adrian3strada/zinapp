import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keyboardAvoidingBehavior } from '../utils/webPlatform';

type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

type KeyboardFormContextValue = {
  scrollRef: RefObject<ScrollView | null>;
  onInputFocus: (e: FocusEvent) => void;
};

const KeyboardFormContext = createContext<KeyboardFormContextValue | null>(null);

/** FormField / inputs pueden avisar al contenedor al tomar foco. */
export function useKeyboardForm() {
  return useContext(KeyboardFormContext);
}

type Props = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Offset del KAV (safe top + header si aplica). */
  keyboardVerticalOffset?: number;
  /** Padding inferior con teclado cerrado. */
  bottomPadding?: number;
  /** Holgura extra al desplazar el campo sobre el teclado. */
  extraScrollHeight?: number;
  showsVerticalScrollIndicator?: boolean;
  /** Pie fijo (p. ej. botón Confirmar) dentro del KAV, fuera del ScrollView. */
  footer?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /**
   * false en hojas/modales con maxHeight: evita flex:1 que colapsa el ScrollView a 0.
   * @default true
   */
  fill?: boolean;
};

/**
 * Contenedor unificado para formularios con teclado.
 *
 * Una sola estrategia de avoidance:
 * - iOS: KeyboardAvoidingView (padding) + scroll al foco
 * - Android/web: pan del SO / layout web + scroll al foco
 *
 * No combina KAV + automaticallyAdjustKeyboardInsets + padding manual
 * (eso inflaba contentSize y provocaba saltos al deslizar).
 */
export default function KeyboardForm({
  children,
  contentContainerStyle,
  style,
  keyboardVerticalOffset,
  bottomPadding = 24,
  extraScrollHeight = 28,
  showsVerticalScrollIndicator = false,
  footer,
  refreshControl,
  fill = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const offset = keyboardVerticalOffset ?? (Platform.OS === 'ios' ? insets.top : 0);
  const layoutStyle = fill ? styles.flex : styles.shrink;
  const behavior = keyboardAvoidingBehavior();

  const scrollFocusedIntoView = useCallback(
    (reactTag: number) => {
      if (Platform.OS === 'web' || !scrollRef.current) return;

      const run = () => {
        const responder = (
          scrollRef.current as unknown as {
            getScrollResponder?: () => {
              scrollResponderScrollNativeHandleToKeyboard?: (
                nodeHandle: number,
                extraHeight: number,
                animated: boolean,
              ) => void;
            };
          }
        )?.getScrollResponder?.();

        if (responder?.scrollResponderScrollNativeHandleToKeyboard) {
          responder.scrollResponderScrollNativeHandleToKeyboard(
            reactTag,
            extraScrollHeight + 20,
            true,
          );
          return;
        }

        const scrollNode = findNodeHandle(scrollRef.current);
        if (!scrollNode) return;

        UIManager.measureInWindow(reactTag, (_x, y, _w, h) => {
          UIManager.measureInWindow(scrollNode, (_sx, sy, _sw, sh) => {
            const fieldBottom = y + h;
            const visibleBottom = sy + sh - extraScrollHeight;
            if (fieldBottom <= visibleBottom) return;
            const nextY = scrollYRef.current + (fieldBottom - visibleBottom) + 16;
            scrollRef.current?.scrollTo({ y: Math.max(0, nextY), animated: true });
          });
        });
      };

      requestAnimationFrame(() => {
        setTimeout(run, Platform.OS === 'ios' ? 90 : 50);
      });
    },
    [extraScrollHeight],
  );

  const onInputFocus = useCallback(
    (e: FocusEvent) => {
      const nativeTarget = (e as NativeSyntheticEvent<{ target?: number }>).nativeEvent?.target;
      const tag =
        typeof nativeTarget === 'number'
          ? nativeTarget
          : findNodeHandle((e as { target?: unknown }).target as never);
      if (typeof tag === 'number') scrollFocusedIntoView(tag);
    },
    [scrollFocusedIntoView],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const ctx = useMemo(
    () => ({ scrollRef, onInputFocus }),
    [onInputFocus],
  );

  return (
    <KeyboardFormContext.Provider value={ctx}>
      <KeyboardAvoidingView
        style={[layoutStyle, style]}
        behavior={behavior}
        keyboardVerticalOffset={behavior ? offset : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={layoutStyle}
          contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </KeyboardFormContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexGrow: 0, flexShrink: 1 },
});
