import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { chatApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { OrderMessage } from '../types';
import { getApiErrorMessage } from '../utils/apiErrors';

interface Props {
  orderId: number;
  closed?: boolean;
}

export default function OrderChatPanel({ orderId, closed }: Props) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await chatApi.list(orderId);
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending || closed) return;
    setSending(true);
    try {
      const { data } = await chatApi.send(orderId, text);
      setMessages((prev) => [...prev, data]);
      setBody('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setBody(text);
      // eslint-disable-next-line no-console
      console.warn(getApiErrorMessage(err, 'No se envió el mensaje'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Chat del pedido</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          contentContainerStyle={messages.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <Text style={styles.empty}>Sin mensajes. Coordina aquí con restaurante o repartidor.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.bubble}>
              <Text style={styles.sender}>{item.sender_name} · {item.sender_role}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}
      {!closed && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Escribe un mensaje..."
            maxLength={1000}
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={send} disabled={sending || !body.trim()}>
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  loader: { padding: 20 },
  list: { maxHeight: 220 },
  emptyList: { padding: 16 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  sender: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
