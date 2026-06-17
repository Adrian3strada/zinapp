import React, { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  height?: number;
}

interface State {
  hasError: boolean;
}

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('MapErrorBoundary:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.fallback, this.props.height ? { height: this.props.height } : null]}>
          <Text style={styles.emoji}>🗺️</Text>
          <Text style={styles.text}>
            {this.props.fallbackMessage ?? 'No se pudo cargar el mapa en este dispositivo.'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 160,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emoji: { fontSize: 28, marginBottom: 8 },
  text: { color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
