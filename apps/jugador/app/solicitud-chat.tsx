import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { Screen, Text, Button, Input, Surface } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

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
  const { colors } = useGlassTheme();
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
      <View className={`my-1 max-w-[85%] ${esMio ? 'self-end' : 'self-start'}`}>
        <View
          className="rounded-lg px-md py-sm"
          style={
            esMio
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1 }
          }
        >
          {!esMio && (
            <Text variant="caption" className="font-semibold mb-0.5" style={{ color: colors.primary }}>
              {item.senderNombre}
            </Text>
          )}
          <Text variant="body" style={{ color: esMio ? '#FFFFFF' : colors.text }}>
            {item.body}
          </Text>
          <Text
            variant="caption"
            className="mt-1 self-end"
            style={{ color: esMio ? 'rgba(255,255,255,0.8)' : colors.textSecondary }}
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
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center">
          <Text>Conversación no encontrada</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Surface variant="solid" className="flex-row items-start px-sm py-sm border-b border-border-subtle dark:border-border-subtle-dark gap-xs">
        <Pressable onPress={() => router.back()} className="p-xs mt-0.5" hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View className="flex-1 min-h-[48px] justify-center">
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : loadError ? (
            <Text variant="h4">{loadError}</Text>
          ) : contexto ? (
            <>
              <Text variant="h4" numberOfLines={1}>
                {contexto.rivalEquipoNombre}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {contexto.rivalUsuarioNombre} · {contexto.miEquipoNombre}
              </Text>
              {(contexto.canchaNombre || reservaInfo) && (
                <Text variant="caption" numberOfLines={2} className="mt-1">
                  {contexto.canchaNombre}
                  {contexto.complejoNombre ? ` · ${contexto.complejoNombre}` : ''}
                  {reservaInfo ? ` · ${reservaInfo.fecha} ${reservaInfo.hora}` : ''}
                </Text>
              )}
            </>
          ) : null}
        </View>
      </Surface>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <PlayerLoadingView message="Cargando conversación..." style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />
        ) : loadError ? (
          <View className="flex-1 justify-center items-center">
            <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
            <Text variant="caption" className="mt-md text-center">
              {loadError}
            </Text>
            <Pressable onPress={loadInitial} className="mt-md">
              <Text className="text-primary font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        ) : mensajes.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
            <Text variant="caption" className="mt-sm">
              Escribe el primer mensaje
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...mensajes].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={renderMensaje}
            inverted
            contentContainerClassName="px-md py-sm flex-grow"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-sm">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />
        )}

        {puedeGestionarSolicitud && !loading && !loadError && (
          <Surface variant="solid" className="px-md py-sm border-t border-border-subtle dark:border-border-subtle-dark gap-sm">
            <Text variant="caption" className="text-center">
              ¿Confirmás a este rival?
            </Text>
            <View className="flex-row gap-sm">
              <Button
                variant="outline"
                className="flex-1 border-error"
                onPress={handleRechazar}
                disabled={procesandoSolicitud}
                loading={procesandoSolicitud}
              >
                <View className="flex-row items-center gap-xs">
                  {!procesandoSolicitud && <Ionicons name="close-outline" size={18} color={colors.error} />}
                  <Text style={{ color: colors.error }} className="font-semibold text-sm">
                    Rechazar
                  </Text>
                </View>
              </Button>
              <Button
                className="flex-1"
                onPress={handleAceptar}
                disabled={procesandoSolicitud}
                loading={procesandoSolicitud}
                style={{ backgroundColor: colors.success }}
              >
                <View className="flex-row items-center gap-xs">
                  {!procesandoSolicitud && <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />}
                  <Text variant="inverse" className="text-sm">
                    Aceptar rival
                  </Text>
                </View>
              </Button>
            </View>
          </Surface>
        )}

        <Surface variant="solid" className="flex-row items-end p-sm gap-sm border-t border-border-subtle dark:border-border-subtle-dark">
          <Input
            className="flex-1 min-h-[44px] max-h-[120px]"
            containerClassName="flex-1 mb-0"
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje..."
            multiline
            maxLength={2000}
            editable={!enviando && !loading && !loadError}
          />
          <TouchableOpacity
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: texto.trim() ? colors.primary : colors.borderSubtle }}
            onPress={handleEnviar}
            disabled={!texto.trim() || enviando || loading || !!loadError}
          >
            {enviando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </Surface>
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
      />
    </Screen>
  );
}
