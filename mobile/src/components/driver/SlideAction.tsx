import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../theme/colors';

const THUMB = 52;
const COMPLETE_RATIO = 0.82;

interface Props {
  label: string;
  completeLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Track / accent color when ready */
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  onComplete: () => void | Promise<void>;
}

/** Botón deslizable estilo DiDi (Conectar / Aceptar). */
export default function SlideAction({
  label,
  completeLabel,
  icon = 'chevron-forward',
  color = colors.accent,
  disabled = false,
  loading = false,
  onComplete,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const offsetAnim = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);
  const completingRef = useRef(false);
  const maxOffset = Math.max(0, trackWidth - THUMB - 8);

  const setOffsetImmediate = useCallback(
    (value: number) => {
      offsetRef.current = value;
      offsetAnim.setValue(value);
    },
    [offsetAnim],
  );

  const animateTo = useCallback(
    (value: number, onEnd?: () => void) => {
      offsetRef.current = value;
      Animated.spring(offsetAnim, {
        toValue: value,
        useNativeDriver: false,
        bounciness: 6,
        speed: 18,
      }).start(({ finished }) => {
        if (finished) onEnd?.();
      });
    },
    [offsetAnim],
  );

  const reset = useCallback(() => {
    completingRef.current = false;
    animateTo(0);
  }, [animateTo]);

  useEffect(() => {
    if (disabled || loading) {
      completingRef.current = false;
      setOffsetImmediate(0);
    }
  }, [disabled, loading, setOffsetImmediate]);

  const finish = useCallback(async () => {
    if (completingRef.current || disabled || loading) return;
    completingRef.current = true;
    animateTo(maxOffset);
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // ignore
      }
    }
    try {
      await onComplete();
    } finally {
      reset();
    }
  }, [disabled, loading, maxOffset, onComplete, reset, animateTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !loading && maxOffset > 0,
        onMoveShouldSetPanResponder: (_, g) =>
          !disabled && !loading && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          completingRef.current = false;
          offsetAnim.stopAnimation((v) => {
            offsetRef.current = typeof v === 'number' ? v : offsetRef.current;
          });
        },
        onPanResponderMove: (_, g) => {
          if (disabled || loading || completingRef.current) return;
          const next = Math.min(maxOffset, Math.max(0, g.dx));
          setOffsetImmediate(next);
        },
        onPanResponderRelease: () => {
          if (disabled || loading || completingRef.current) return;
          if (offsetRef.current >= maxOffset * COMPLETE_RATIO) {
            void finish();
          } else {
            reset();
          }
        },
        onPanResponderTerminate: () => reset(),
      }),
    [disabled, loading, maxOffset, finish, reset, setOffsetImmediate, offsetAnim],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const fillWidth = Animated.add(offsetAnim, THUMB);
  const labelOpacity = offsetAnim.interpolate({
    inputRange: [0, Math.max(1, maxOffset)],
    outputRange: [1, 0.12],
    extrapolate: 'clamp',
  });
  const completeOpacity = offsetAnim.interpolate({
    inputRange: [Math.max(0, maxOffset * 0.72), Math.max(1, maxOffset * COMPLETE_RATIO)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: disabled ? colors.border : `${color}22` },
        disabled && styles.trackDisabled,
      ]}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: color }]} />
      <Animated.Text
        style={[styles.label, { opacity: labelOpacity }, disabled && styles.labelDisabled]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      {completeLabel ? (
        <Animated.Text style={[styles.completeLabel, { opacity: completeOpacity }]} numberOfLines={1}>
          {completeLabel}
        </Animated.Text>
      ) : null}
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX: offsetAnim }],
            backgroundColor: disabled ? colors.textMuted : color,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Ionicons name={icon} size={24} color="#FFF" />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + 8,
    borderRadius: (THUMB + 8) / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  trackDisabled: { opacity: 0.7 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: (THUMB + 8) / 2,
    opacity: 0.35,
  },
  label: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: THUMB + 16,
    letterSpacing: 0.2,
  },
  completeLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: THUMB + 16,
  },
  labelDisabled: { color: colors.textMuted },
  thumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
});
