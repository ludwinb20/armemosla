import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { supabase } from '../lib/supabase';
import {
  combinarMensajeInicialConHistorial,
  enviarMensajeSolicitud,
  MENSAJES_PAGE_SIZE,
  MensajeSolicitudItem,
  marcarSolicitudComoLeida,
  obtenerContextoConversacionSolicitud,
  obtenerMensajesSolicitud,
  SolicitudConversacionContext,
} from '../lib/mensajesSolicitud';
import { aceptarSolicitud, rechazarSolicitud } from '../lib/partidos';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';

function formatFechaHora(fechaHora: string) {
  const fecha = new Date(fechaHora);
  return {
    fecha: fecha.toLocaleDateString('es-HN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    hora: fecha.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function formatHoraMensaje(iso: string) {
  return new Date(iso).toLocaleTimeString('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SolicitudChatScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ solicitudId?: string | string[] }>();
  const solicitudId = Array.isArray(params.solicitudId) ? params.solicitudId[0] : params.solicitudId;

  const [contexto, setContexto] = useState<SolicitudConversacionContext | null>(null);
  const [mensajes, setMensajes] = useState<MensajeSolicitudItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const mensajesDbRef = useRef<MensajeSolicitudItem[]>([]);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();
  const showErrorRef = useRef(showError);
  const showSuccessRef = useRef(showSuccess);
  showErrorRef.current = showError;
  showSuccessRef.current = showSuccess;

  const puedeGestionarSolicitud =
    contexto?.direccion === 'recibida' && contexto.estado === 'pendiente';

  const marcarLeida = useCallback(async () => {
    if (!solicitudId) return;
    await marcarSolicitudComoLeida(solicitudId);
  }, [solicitudId]);

  const rebuildMensajes = useCallback(
    (ctx: SolicitudConversacionContext, dbMensajesDesc: MensajeSolicitudItem[]) => {
      mensajesDbRef.current = dbMensajesDesc;
      setMensajes(combinarMensajeInicialConHistorial(ctx, dbMensajesDesc));
    },
    []
  );

  const loadInitial = useCallback(async () => {
    if (!solicitudId) {
      setLoading(false);
      setLoadError('Conversación no encontrada');
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const [ctxResult, mensajesResult] = await Promise.allSettled([
        obtenerContextoConversacionSolicitud(solicitudId),
        obtenerMensajesSolicitud(solicitudId, { limit: MENSAJES_PAGE_SIZE }),
      ]);

      if (ctxResult.status === 'rejected') {
        throw ctxResult.reason;
      }

      const ctx = ctxResult.value;
      const dbMensajes =
        mensajesResult.status === 'fulfilled' ? mensajesResult.value : [];

      if (mensajesResult.status === 'rejected') {
        console.error('Error al cargar mensajes:', mensajesResult.reason);
      }

      setContexto(ctx);
      rebuildMensajes(ctx, dbMensajes);
      setHasMore(dbMensajes.length >= MENSAJES_PAGE_SIZE);
      await marcarSolicitudComoLeida(solicitudId);
    } catch (error) {
      console.error('Error al cargar conversación:', error);
      setLoadError('No se pudo abrir la conversación');
      showErrorRef.current('Error', 'No se pudo abrir la conversación');
    } finally {
      setLoading(false);
    }
  }, [rebuildMensajes, solicitudId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useFocusEffect(
    useCallback(() => {
      if (solicitudId && !loading) {
        void marcarLeida();
      }
    }, [solicitudId, loading, marcarLeida])
  );

  useEffect(() => {
    if (!solicitudId) return;

    const channel = supabase
      .channel(`mensajes_solicitud_${solicitudId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_solicitud',
          filter: `solicitud_id=eq.${solicitudId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            solicitud_id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };

          if (mensajesDbRef.current.some((m) => m.id === row.id)) return;

          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.sender_id)
            .maybeSingle();

          const nuevo: MensajeSolicitudItem = {
            id: row.id,
            solicitudId: row.solicitud_id,
            senderId: row.sender_id,
            senderNombre: sender?.full_name?.trim() || 'Jugador',
            body: row.body,
            createdAt: row.created_at,
          };

          setContexto((ctx) => {
            if (!ctx) return ctx;
            const nextDb = [nuevo, ...mensajesDbRef.current];
            rebuildMensajes(ctx, nextDb);
            return ctx;
          });
          void marcarLeida();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rebuildMensajes, solicitudId, marcarLeida]);

  const loadOlder = async () => {
    if (!solicitudId || !contexto || loadingMore || !hasMore) return;

    const dbOnly = mensajesDbRef.current;
    if (dbOnly.length === 0) return;

    const oldest = dbOnly[dbOnly.length - 1];

    try {
      setLoadingMore(true);
      const older = await obtenerMensajesSolicitud(solicitudId, {
        before: oldest.createdAt,
        limit: MENSAJES_PAGE_SIZE,
      });

      if (older.length === 0) {
        setHasMore(false);
        return;
      }

      const merged = [...dbOnly, ...older];
      rebuildMensajes(contexto, merged);
      setHasMore(older.length >= MENSAJES_PAGE_SIZE);
    } catch (error) {
      console.error('Error al cargar mensajes anteriores:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleEnviar = async () => {
    if (!solicitudId || !texto.trim() || enviando) return;

    try {
      setEnviando(true);
      const enviado = await enviarMensajeSolicitud(solicitudId, texto);

      setTexto('');

      if (mensajesDbRef.current.some((m) => m.id === enviado.id)) return;

      setContexto((ctx) => {
        if (!ctx) return ctx;
        const nextDb = [enviado, ...mensajesDbRef.current];
        rebuildMensajes(ctx, nextDb);
        return ctx;
      });
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      showError('Error', 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const handleAceptar = async () => {
    if (!solicitudId || procesandoSolicitud) return;
    try {
      setProcesandoSolicitud(true);
      await aceptarSolicitud(solicitudId);
      setContexto((ctx) => (ctx ? { ...ctx, estado: 'aceptada' } : ctx));
      showSuccessRef.current('Rival confirmado', 'La solicitud fue aceptada. Lo verás en tus reservas.');
    } catch (error) {
      console.error('Error al aceptar solicitud:', error);
      showErrorRef.current('Error', error instanceof Error ? error.message : 'No se pudo aceptar');
    } finally {
      setProcesandoSolicitud(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitudId || procesandoSolicitud) return;
    try {
      setProcesandoSolicitud(true);
      await rechazarSolicitud(solicitudId);
      setContexto((ctx) => (ctx ? { ...ctx, estado: 'rechazada' } : ctx));
      showSuccessRef.current('Solicitud rechazada', 'El rival fue notificado en la conversación.');
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      showErrorRef.current('Error', error instanceof Error ? error.message : 'No se pudo rechazar');
    } finally {
      setProcesandoSolicitud(false);
    }
  };

  const reservaInfo = useMemo(() => {
    if (!contexto?.reservaFechaHora) return null;
    return formatFechaHora(contexto.reservaFechaHora);
  }, [contexto?.reservaFechaHora]);

  const renderMensaje = ({ item }: { item: MensajeSolicitudItem }) => {
    const esMio = item.senderId === currentUserId;

    return (
      <View style={[styles.mensajeRow, esMio ? styles.mensajeRowMio : styles.mensajeRowOtro]}>
        <View
          style={[
            styles.burbuja,
            esMio
              ? { backgroundColor: Colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          {!esMio && (
            <Text style={[styles.remitente, { color: Colors.primary }]}>{item.senderNombre}</Text>
          )}
          <Text style={[styles.mensajeBody, { color: esMio ? Colors.textInverse : colors.text }]}>
            {item.body}
          </Text>
          <Text
            style={[
              styles.mensajeHora,
              { color: esMio ? Colors.textInverse + 'CC' : colors.textSecondary },
            ]}
          >
            {formatHoraMensaje(item.createdAt)}
            {item.esMensajeInicial ? ' · solicitud' : ''}
          </Text>
        </View>
      </View>
    );
  };

  if (!solicitudId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={{ color: colors.text }}>Conversación no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : loadError ? (
            <Text style={[styles.headerTitle, { color: colors.text }]}>{loadError}</Text>
          ) : contexto ? (
            <>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {contexto.rivalEquipoNombre}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {contexto.rivalUsuarioNombre} · {contexto.miEquipoNombre}
              </Text>
              {(contexto.canchaNombre || reservaInfo) && (
                <Text style={[styles.headerMeta, { color: colors.textSecondary }]} numberOfLines={2}>
                  {contexto.canchaNombre}
                  {contexto.complejoNombre ? ` · ${contexto.complejoNombre}` : ''}
                  {reservaInfo ? ` · ${reservaInfo.fecha} ${reservaInfo.hora}` : ''}
                </Text>
              )}
            </>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <PlayerLoadingView message="Cargando conversación..." style={styles.centered} />
        ) : loadError ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyChatText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
              {loadError}
            </Text>
            <TouchableOpacity onPress={loadInitial} style={{ marginTop: Spacing.md }}>
              <Text style={{ color: Colors.primary, fontWeight: Typography.fontWeight.semibold }}>
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        ) : mensajes.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
              Escribe el primer mensaje
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...mensajes].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={renderMensaje}
            inverted
            contentContainerStyle={styles.listContent}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null
            }
          />
        )}

        {puedeGestionarSolicitud && !loading && !loadError && (
          <View style={[styles.gestionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Text style={[styles.gestionHint, { color: colors.textSecondary }]}>
              ¿Confirmás a este rival?
            </Text>
            <View style={styles.gestionActions}>
              <TouchableOpacity
                style={[styles.gestionBtn, { borderColor: Colors.error }]}
                onPress={handleRechazar}
                disabled={procesandoSolicitud}
              >
                {procesandoSolicitud ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <>
                    <Ionicons name="close-outline" size={18} color={Colors.error} />
                    <Text style={[styles.gestionBtnText, { color: Colors.error }]}>Rechazar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gestionBtn, styles.gestionBtnPrimary, { backgroundColor: Colors.success }]}
                onPress={handleAceptar}
                disabled={procesandoSolicitud}
              >
                {procesandoSolicitud ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={18} color={Colors.textInverse} />
                    <Text style={[styles.gestionBtnText, { color: Colors.textInverse }]}>Aceptar rival</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
            ]}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            editable={!enviando && !loading && !loadError}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: texto.trim() ? Colors.primary : colors.border },
            ]}
            onPress={handleEnviar}
            disabled={!texto.trim() || enviando || loading || !!loadError}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Ionicons name="send" size={20} color={Colors.textInverse} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        confirmText={alertOptions.confirmText}
        cancelText={alertOptions.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.xs,
  },
  backButton: {
    padding: Spacing.xs,
    marginTop: 2,
  },
  headerContent: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  headerMeta: {
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexGrow: 1,
  },
  mensajeRow: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  mensajeRowMio: {
    alignSelf: 'flex-end',
  },
  mensajeRowOtro: {
    alignSelf: 'flex-start',
  },
  burbuja: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  remitente: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 2,
  },
  mensajeBody: {
    fontSize: Typography.fontSize.md,
    lineHeight: 20,
  },
  mensajeHora: {
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingMore: {
    paddingVertical: Spacing.sm,
  },
  emptyChatText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  gestionBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  gestionHint: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  gestionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gestionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  gestionBtnPrimary: {
    borderWidth: 0,
  },
  gestionBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
