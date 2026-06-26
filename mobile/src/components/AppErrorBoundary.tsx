import React, { Component, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  children: ReactNode;
  /** Cambia al navegar: limpia el error sin recargar toda la app. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  componentDidCatch(error: Error) {
    console.error('AppErrorBoundary:', error);
  }

  private handleRetry = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.text}>
            Recarga la página (Ctrl+F5). Si sigue fallando, cierra sesión y vuelve a entrar.
          </Text>
          {this.state.message ? (
            <Text style={styles.debug} selectable>
              {this.state.message}
            </Text>
          ) : null}
          <Pressable style={styles.btn} onPress={this.handleRetry}>
            <Text style={styles.btnText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
  text: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  debug: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
    maxWidth: 480,
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
