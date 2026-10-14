import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import {
  getCanchaById,
  createCancha,
  updateCancha,
  addCanchaFoto,
  deleteCanchaFoto,
  toggleCanchaActivo,
  setCanchaDisponibilidad,
  CanchaWithRelations,
} from '../lib/canchas';
import { getComplejos } from '../lib/complejos';
import { uploadImage } from '../lib/storage';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { Screen, Text, Button, Card, Input, Chip, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import CustomAlert from '../components/CustomAlert';

const DIAS_SEMANA = [
  { id: 0, nombre: 'Lunes' },
  { id: 1, nombre: 'Martes' },
  { id: 2, nombre: 'Miércoles' },
  { id: 3, nombre: 'Jueves' },
  { id: 4, nombre: 'Viernes' },
  { id: 5, nombre: 'Sábado' },
  { id: 6, nombre: 'Domingo' },
];

export default function CanchaFormScreen() {
  const { colors } = useGlassTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const canchaId = params.id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!canchaId);
  const [complejoId, setComplejoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [largo, setLargo] = useState('');
  const [ancho, setAncho] = useState('');
  const [jugadoresPorEquipo, setJugadoresPorEquipo] = useState('');
  const [precioPorHora, setPrecioPorHora] = useState('');
  const [fotos, setFotos] = useState<Array<{ uri: string; url?: string; id?: string }>>([]);
  const [activo, setActivo] = useState(true);
  const [disponibilidad, setDisponibilidad] = useState<Record<number, { hora_inicio: string; hora_fin: string }>>({});
  const [canchaData, setCanchaData] = useState<CanchaWithRelations | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [complejos, setComplejos] = useState<Array<{ id: string; nombre: string }>>([]);
  
  // Estados para edición inline
  const [isEditingComplejo, setIsEditingComplejo] = useState(false);
  const [complejoTemp, setComplejoTemp] = useState('');
  const [isEditingNombre, setIsEditingNombre] = useState(false);
  const [nombreTemp, setNombreTemp] = useState('');
  const [isEditingLargo, setIsEditingLargo] = useState(false);
  const [largoTemp, setLargoTemp] = useState('');
  const [isEditingAncho, setIsEditingAncho] = useState(false);
  const [anchoTemp, setAnchoTemp] = useState('');
  const [isEditingJugadores, setIsEditingJugadores] = useState(false);
  const [jugadoresTemp, setJugadoresTemp] = useState('');
  const [isEditingPrecio, setIsEditingPrecio] = useState(false);
  const [precioTemp, setPrecioTemp] = useState('');
  const [isEditingFotos, setIsEditingFotos] = useState(false);
  const [isEditingDisponibilidad, setIsEditingDisponibilidad] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{ dia: number; tipo: 'inicio' | 'fin' } | null>(null);
  const [timePickerValue, setTimePickerValue] = useState({ hora: '08', minuto: '00', ampm: 'AM' as 'AM' | 'PM' });

  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useEffect(() => {
    loadComplejos();
    if (canchaId) {
      loadCancha();
    }
  }, [canchaId]);

  const loadComplejos = async () => {
    try {
      const data = await getComplejos();
      setComplejos(data.map(c => ({ id: c.id, nombre: c.nombre })));
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
    }
  };

  const loadCancha = async () => {
    try {
      setLoadingData(true);
      const cancha = await getCanchaById(canchaId!);
      if (cancha) {
        setCanchaData(cancha);
        setComplejoId(cancha.complejo_id);
        setNombre(cancha.nombre || '');
        setLargo(cancha.largo?.toString() || '');
        setAncho(cancha.ancho?.toString() || '');
        setJugadoresPorEquipo(cancha.jugadores_por_equipo.toString());
        setPrecioPorHora(cancha.precio_por_hora.toString());
        setActivo(cancha.activo);
        if (cancha.fotos) {
          setFotos(cancha.fotos.map(f => ({ uri: f.foto_url, url: f.foto_url, id: f.id })));
        }
        if (cancha.disponibilidad) {
          const disp: Record<number, { hora_inicio: string; hora_fin: string }> = {};
          cancha.disponibilidad.forEach(d => {
            disp[d.dia_semana] = {
              hora_inicio: d.hora_inicio,
              hora_fin: d.hora_fin,
            };
          });
          setDisponibilidad(disp);
        }
      }
    } catch (error: any) {
      showError('Error', 'No se pudo cargar la cancha');
    } finally {
      setLoadingData(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
      return false;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setFotos([...fotos, { uri: result.assets[0].uri }]);
      return true;
    }
    return false;
  };

  const removeFoto = (index: number) => {
    const foto = fotos[index];
    if (foto.id && foto.url) {
      showError(
        'Eliminar foto',
        '¿Estás seguro de que deseas eliminar esta foto?',
        async () => {
          try {
            if (foto.id) {
              await deleteCanchaFoto(foto.id);
            }
            const newFotos = fotos.filter((_, i) => i !== index);
            setFotos(newFotos);
            if (canchaId) {
              await loadCancha();
            }
            showSuccess('Éxito', 'Foto eliminada correctamente');
          } catch (error: any) {
            showError('Error', 'No se pudo eliminar la foto');
          }
        },
        () => {},
        'Eliminar',
        'Cancelar'
      );
    } else {
      const newFotos = fotos.filter((_, i) => i !== index);
      setFotos(newFotos);
    }
  };

  const handleSave = async () => {
    // Validaciones
    if (!complejoId) {
      showError('Error', 'Debes seleccionar un complejo');
      return;
    }

    if (!nombre.trim()) {
      showError('Error', 'El nombre de la cancha es obligatorio');
      return;
    }

    if (!jugadoresPorEquipo.trim() || parseInt(jugadoresPorEquipo) <= 0) {
      showError('Error', 'La cantidad de jugadores por equipo debe ser mayor a 0');
      return;
    }

    if (!precioPorHora.trim() || parseFloat(precioPorHora) < 0) {
      showError('Error', 'El precio por hora debe ser mayor o igual a 0');
      return;
    }

    // Validar medidas si se proporcionan
    if (largo.trim() && parseFloat(largo) <= 0) {
      showError('Error', 'El largo debe ser mayor a 0');
      return;
    }
    if (ancho.trim() && parseFloat(ancho) <= 0) {
      showError('Error', 'El ancho debe ser mayor a 0');
      return;
    }

    try {
      setLoading(true);

      // Preparar datos de la cancha
      const canchaData: any = {
        complejo_id: complejoId,
        nombre: nombre.trim(),
        largo: largo.trim() ? parseFloat(largo) : undefined,
        ancho: ancho.trim() ? parseFloat(ancho) : undefined,
        jugadores_por_equipo: parseInt(jugadoresPorEquipo),
        precio_por_hora: parseFloat(precioPorHora),
        activo,
      };

      let savedCancha;
      if (canchaId) {
        savedCancha = await updateCancha(canchaId, canchaData);
      } else {
        savedCancha = await createCancha(canchaData);
      }

      // Subir fotos nuevas
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        if (!foto.url && foto.uri) {
          const timestamp = Date.now();
          const fotoPath = `canchas/${savedCancha.id}/fotos/${timestamp}-${i}.jpg`;
          const fotoUrl = await uploadImage(foto.uri, 'canchas', fotoPath);
          await addCanchaFoto(savedCancha.id, fotoUrl, i);
        }
      }

      // Guardar disponibilidad
      const disponibilidadArray = Object.entries(disponibilidad).map(([dia, horario]) => ({
        dia_semana: parseInt(dia),
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
      }));
      await setCanchaDisponibilidad(savedCancha.id, disponibilidadArray);

      if (canchaId) {
        await loadCancha();
        showSuccess('Éxito', 'Cancha actualizada correctamente');
      } else {
        showSuccess('Éxito', 'Cancha creada correctamente', () => router.push(`/cancha-form?id=${savedCancha.id}`));
      }
    } catch (error: any) {
      console.error('Error al guardar cancha:', error);
      showError('Error', error.message || 'No se pudo guardar la cancha');
    } finally {
      setLoading(false);
    }
  };

  // Convertir de formato 24 horas (HH:mm:ss) a formato 12 horas (h:mm AM/PM)
  const formatTime12Hour = (time24: string): string => {
    // time viene en formato HH:mm:ss o HH:mm
    const parts = time24.split(':');
    const hour24 = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    const minuteFormatted = minute.length === 1 ? `0${minute}` : minute;
    
    if (hour24 === 0) {
      return `12:${minuteFormatted} AM`;
    } else if (hour24 < 12) {
      return `${hour24}:${minuteFormatted} AM`;
    } else if (hour24 === 12) {
      return `12:${minuteFormatted} PM`;
    } else {
      return `${hour24 - 12}:${minuteFormatted} PM`;
    }
  };

  // Convertir de formato 24 horas a objeto para el picker (12 horas + AM/PM)
  const convert24To12 = (time24: string): { hora: string; minuto: string; ampm: 'AM' | 'PM' } => {
    const parts = time24.split(':');
    const hour24 = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    
    let hour12: number;
    let ampm: 'AM' | 'PM';
    
    if (hour24 === 0) {
      hour12 = 12;
      ampm = 'AM';
    } else if (hour24 < 12) {
      hour12 = hour24;
      ampm = 'AM';
    } else if (hour24 === 12) {
      hour12 = 12;
      ampm = 'PM';
    } else {
      hour12 = hour24 - 12;
      ampm = 'PM';
    }
    
    return {
      hora: hour12.toString(),
      minuto: minute,
      ampm,
    };
  };

  // Convertir de formato 12 horas a formato 24 horas (HH:mm:ss)
  const convert12To24 = (hora12: string, minuto: string, ampm: 'AM' | 'PM'): string => {
    let hour24 = parseInt(hora12, 10);
    
    if (ampm === 'AM') {
      if (hour24 === 12) {
        hour24 = 0;
      }
    } else {
      // PM
      if (hour24 !== 12) {
        hour24 += 12;
      }
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minuto.padStart(2, '0')}:00`;
  };

  const formatTime = formatTime12Hour;

  const openTimePicker = (dia: number, tipo: 'inicio' | 'fin') => {
    const currentTime = disponibilidad[dia]?.[tipo === 'inicio' ? 'hora_inicio' : 'hora_fin'] || '08:00:00';
    const time12 = convert24To12(currentTime);
    setTimePickerValue(time12);
    setShowTimePicker({ dia, tipo });
  };

  const saveTime = () => {
    if (!showTimePicker) return;
    const { dia, tipo } = showTimePicker;
    const timeString = convert12To24(timePickerValue.hora, timePickerValue.minuto, timePickerValue.ampm);
    
    setDisponibilidad(prev => {
      const currentHorario = prev[dia] || { hora_inicio: '08:00:00', hora_fin: '20:00:00' };
      return {
        ...prev,
        [dia]: {
          hora_inicio: tipo === 'inicio' ? timeString : currentHorario.hora_inicio,
          hora_fin: tipo === 'fin' ? timeString : currentHorario.hora_fin,
        },
      };
    });
    setShowTimePicker(null);
  };

  if (loadingData) {
    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        <PlayerLoadingView />
      </Screen>
    );
  }

  // Vista de detalle (solo si hay canchaId)
  if (canchaId) {
    if (!canchaData) {
      return (
        <Screen className="flex-1" edges={['top', 'bottom']}>
          <PlayerLoadingView />
        </Screen>
      );
    }

    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-md py-sm border-b">
          <TouchableOpacity onPress={() => router.back()} className="p-xs">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold flex-1 text-center">Detalle de Cancha</Text>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            className="p-xs"
          >
            <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Menú desplegable */}
        <RNModal
          isVisible={showMenu}
          onBackdropPress={() => setShowMenu(false)}
          onBackButtonPress={() => setShowMenu(false)}
          animationIn="fadeIn"
          animationOut="fadeOut"
          backdropOpacity={0.5}
          useNativeDriverForBackdrop
          hideModalContentWhileAnimating
          style={{ margin: 0, flex: 1 }}
        >
          <TouchableOpacity
            className="absolute inset-0"
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View className="absolute top-12 right-md rounded-md border overflow-hidden z-50 min-w-[180px]">
              {canchaData.activo ? (
                <TouchableOpacity
                  className="flex-row items-center px-md py-md gap-sm border-b"
                  onPress={() => {
                    setShowMenu(false);
                    showError(
                      'Desactivar cancha',
                      `¿Estás seguro de que deseas desactivar esta cancha? Los usuarios no podrán visualizarla ni reservarla.`,
                      async () => {
                        try {
                          await toggleCanchaActivo(canchaData.id, false);
                          showSuccess('Éxito', 'Cancha desactivada correctamente');
                          await loadCancha();
                        } catch (error: any) {
                          showError('Error', 'No se pudo desactivar la cancha');
                        }
                      },
                      () => {},
                      'Desactivar',
                      'Cancelar'
                    );
                  }}
                >
                  <Ionicons name="eye-off-outline" size={20} color={colors.error} />
                  <Text className={cn("text-md")} style={{ color: colors.error }}>
                    Desactivar Cancha
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center px-md py-md gap-sm border-b"
                  onPress={() => {
                    setShowMenu(false);
                    showError(
                      'Activar cancha',
                      `¿Estás seguro de que deseas activar esta cancha?`,
                      async () => {
                        try {
                          await toggleCanchaActivo(canchaData.id, true);
                          showSuccess('Éxito', 'Cancha activada correctamente');
                          await loadCancha();
                        } catch (error: any) {
                          showError('Error', 'No se pudo activar la cancha');
                        }
                      },
                      () => {},
                      'Activar',
                      'Cancelar'
                    );
                  }}
                >
                  <Ionicons name="eye-outline" size={20} color={colors.success} />
                  <Text className={cn("text-md")} style={{ color: colors.success }}>
                    Activar Cancha
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </RNModal>

        {/* Banner de estado activo/inactivo */}
        {canchaData.activo === false && (
          <View className="flex-row items-center p-md gap-sm">
            <Ionicons name="eye-off" size={24} color={colors.textInverse} />
            <Text className="text-md font-medium flex-1 text-text-inverse">
              Esta cancha está inactiva. Los usuarios no podrán visualizarla ni reservarla.
            </Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
          >
          {/* Complejo */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Complejo</Text>
              {!isEditingComplejo ? (
                <TouchableOpacity
                  onPress={() => {
                    setComplejoTemp(canchaData.complejo_id);
                    setIsEditingComplejo(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      if (!complejoTemp) {
                        showError('Error', 'Debes seleccionar un complejo');
                        return;
                      }
                      try {
                        setLoading(true);
                        await updateCancha(canchaId, {
                          complejo_id: complejoTemp,
                        });
                        await loadCancha();
                        setIsEditingComplejo(false);
                        showSuccess('Éxito', 'Complejo actualizado correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar el complejo');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingComplejo(false);
                      setComplejoTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingComplejo ? (
              <View className="border rounded-md p-md min-h-[48px] justify-center">
                {complejos.length === 0 ? (
                  <Text className="text-text-secondary">
                    No tienes complejos. Crea uno primero.
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {complejos.map((complejo) => (
                      <TouchableOpacity
                        key={complejo.id}
                        className={cn("px-md py-sm rounded-md border mr-sm mb-sm", "complejoTemp === complejo.id && 'bg-primary border-primary'")}
                        onPress={() => setComplejoTemp(complejo.id)}
                      >
                        <Text
                          className={cn("text-sm", "complejoTemp === complejo.id && 'text-text-inverse font-semibold'")}
                        >
                          {complejo.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <Text className="text-lg font-semibold">{canchaData.complejo?.nombre || 'Sin complejo'}</Text>
            )}
          </View>

          {/* Nombre */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Nombre</Text>
              {!isEditingNombre ? (
                <TouchableOpacity
                  onPress={() => {
                    setNombreTemp(canchaData.nombre || '');
                    setIsEditingNombre(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      if (!nombreTemp.trim()) {
                        showError('Error', 'El nombre de la cancha es obligatorio');
                        return;
                      }
                      try {
                        setLoading(true);
                        await updateCancha(canchaId, { nombre: nombreTemp.trim() });
                        await loadCancha();
                        setIsEditingNombre(false);
                        showSuccess('Éxito', 'Nombre actualizado correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar el nombre');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingNombre(false);
                      setNombreTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingNombre ? (
              <TextInput
                className="text-lg font-semibold border rounded-md p-md"
                value={nombreTemp}
                onChangeText={setNombreTemp}
                placeholder="Nombre de la cancha *"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text className="text-lg font-semibold">{canchaData.nombre || 'Sin nombre'}</Text>
            )}
          </View>

          {/* Medidas */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Medidas</Text>
              {!isEditingLargo && !isEditingAncho ? (
                <TouchableOpacity
                  onPress={() => {
                    setLargoTemp(canchaData.largo?.toString() || '');
                    setAnchoTemp(canchaData.ancho?.toString() || '');
                    setIsEditingLargo(true);
                    setIsEditingAncho(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        setLoading(true);
                        await updateCancha(canchaId, {
                          largo: largoTemp.trim() ? parseFloat(largoTemp) : undefined,
                          ancho: anchoTemp.trim() ? parseFloat(anchoTemp) : undefined,
                        });
                        await loadCancha();
                        setIsEditingLargo(false);
                        setIsEditingAncho(false);
                        showSuccess('Éxito', 'Medidas actualizadas correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudieron actualizar las medidas');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingLargo(false);
                      setIsEditingAncho(false);
                      setLargoTemp('');
                      setAnchoTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingLargo || isEditingAncho ? (
              <View className="flex-row gap-sm">
                <View className="flex-1">
                  <Text className="text-xs mb-xs">Largo (m)</Text>
                  <TextInput
                    className="border rounded-md px-sm py-sm text-md"
                    value={largoTemp}
                    onChangeText={setLargoTemp}
                    placeholder="Ej: 40"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs mb-xs">Ancho (m)</Text>
                  <TextInput
                    className="border rounded-md px-sm py-sm text-md"
                    value={anchoTemp}
                    onChangeText={setAnchoTemp}
                    placeholder="Ej: 20"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
              <Text className="text-lg font-semibold">
                {canchaData.largo && canchaData.ancho
                  ? `${canchaData.largo}m x ${canchaData.ancho}m`
                  : 'Sin medidas'}
              </Text>
            )}
          </View>

          {/* Jugadores por equipo */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Jugadores por equipo</Text>
              {!isEditingJugadores ? (
                <TouchableOpacity
                  onPress={() => {
                    setJugadoresTemp(canchaData.jugadores_por_equipo.toString());
                    setIsEditingJugadores(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      if (!jugadoresTemp.trim() || parseInt(jugadoresTemp) <= 0) {
                        showError('Error', 'La cantidad de jugadores debe ser mayor a 0');
                        return;
                      }
                      try {
                        setLoading(true);
                        await updateCancha(canchaId, {
                          jugadores_por_equipo: parseInt(jugadoresTemp),
                        });
                        await loadCancha();
                        setIsEditingJugadores(false);
                        showSuccess('Éxito', 'Jugadores por equipo actualizados correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingJugadores(false);
                      setJugadoresTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingJugadores ? (
              <TextInput
                className="text-lg font-semibold border rounded-md p-md"
                value={jugadoresTemp}
                onChangeText={setJugadoresTemp}
                placeholder="Ej: 5, 7, 11"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <View>
                <Text className="text-lg font-semibold">{canchaData.jugadores_por_equipo} vs {canchaData.jugadores_por_equipo}</Text>
                <Text className="text-md italic mt-xs">
                  Cantidad ideal/recomendada por equipo (incluyendo portero)
                </Text>
              </View>
            )}
          </View>

          {/* Precio por hora */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Precio por hora</Text>
              {!isEditingPrecio ? (
                <TouchableOpacity
                  onPress={() => {
                    setPrecioTemp(canchaData.precio_por_hora.toString());
                    setIsEditingPrecio(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      if (!precioTemp.trim() || parseFloat(precioTemp) < 0) {
                        showError('Error', 'El precio debe ser mayor o igual a 0');
                        return;
                      }
                      try {
                        setLoading(true);
                        await updateCancha(canchaId, {
                          precio_por_hora: parseFloat(precioTemp),
                        });
                        await loadCancha();
                        setIsEditingPrecio(false);
                        showSuccess('Éxito', 'Precio actualizado correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar el precio');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingPrecio(false);
                      setPrecioTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingPrecio ? (
              <TextInput
                className="text-lg font-semibold border rounded-md p-md"
                value={precioTemp}
                onChangeText={setPrecioTemp}
                placeholder="Ej: 15000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <Text className="text-lg font-semibold">
                L {canchaData.precio_por_hora.toLocaleString()}/hora
              </Text>
            )}
          </View>

          {/* Fotos */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">
                Fotos ({canchaData.fotos?.length || 0})
              </Text>
              {!isEditingFotos ? (
                <TouchableOpacity
                  onPress={() => setIsEditingFotos(true)}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-sm"
            >
              {canchaData.fotos && canchaData.fotos.length > 0 ? (
                canchaData.fotos.map((foto, index) => (
                  <View key={foto.id || index} className="relative mr-sm">
                    <TouchableOpacity
                      onPress={() => setSelectedImage(foto.foto_url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: foto.foto_url }}
                        className="w-[150px] h-[150px] rounded-md"
                      />
                    </TouchableOpacity>
                    {isEditingFotos && (
                      <TouchableOpacity
                        className="absolute -top-2 -right-2 rounded-full z-10"
                        onPress={async () => {
                          showError(
                            'Eliminar foto',
                            '¿Estás seguro de que deseas eliminar esta foto?',
                            async () => {
                              try {
                                setLoading(true);
                                if (foto.id) {
                                  await deleteCanchaFoto(foto.id);
                                  await loadCancha();
                                  showSuccess('Éxito', 'Foto eliminada correctamente');
                                }
                              } catch (error: any) {
                                showError('Error', 'No se pudo eliminar la foto');
                              } finally {
                                setLoading(false);
                              }
                            },
                            () => {},
                            'Eliminar',
                            'Cancelar'
                          );
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text className="text-md italic mt-xs">Sin fotos</Text>
              )}
              {isEditingFotos && (
                <TouchableOpacity
                  className="w-[150px] h-[150px] rounded-md border-2 border-dashed justify-center items-center"
                  onPress={async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
                      return;
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      aspect: [4, 3],
                      quality: 0.8,
                    });

                    if (!result.canceled && result.assets[0]?.uri && canchaId) {
                      try {
                        setLoading(true);
                        const timestamp = Date.now();
                        const fotoPath = `canchas/${canchaId}/fotos/${timestamp}.jpg`;
                        const fotoUrl = await uploadImage(result.assets[0].uri, 'canchas', fotoPath);
                        const orden = canchaData.fotos?.length || 0;
                        await addCanchaFoto(canchaId, fotoUrl, orden);
                        await loadCancha();
                        showSuccess('Éxito', 'Foto agregada correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo agregar la foto');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                >
                  <Ionicons name="add" size={32} color={colors.textSecondary} />
                  <Text className="text-xs mt-xs">Agregar</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Disponibilidad */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Disponibilidad</Text>
              {!isEditingDisponibilidad ? (
                <TouchableOpacity
                  onPress={() => setIsEditingDisponibilidad(true)}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        setLoading(true);
                        const disponibilidadArray = Object.entries(disponibilidad).map(([dia, horario]) => ({
                          dia_semana: parseInt(dia),
                          hora_inicio: horario.hora_inicio,
                          hora_fin: horario.hora_fin,
                        }));
                        await setCanchaDisponibilidad(canchaId, disponibilidadArray);
                        await loadCancha();
                        setIsEditingDisponibilidad(false);
                        showSuccess('Éxito', 'Disponibilidad actualizada correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar la disponibilidad');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingDisponibilidad(false);
                      loadCancha();
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingDisponibilidad ? (
              <View className="mt-sm gap-sm">
                {DIAS_SEMANA.map((dia) => {
                  const isSelected = disponibilidad[dia.id] !== undefined;
                  const horario = disponibilidad[dia.id];
                  return (
                    <View key={dia.id} className="flex-row items-center py-sm border-b">
                      <TouchableOpacity
                        className="w-6 h-6 rounded-sm border-2 mr-sm justify-center items-center"
                        onPress={() => {
                          if (isSelected) {
                            const newDisp = { ...disponibilidad };
                            delete newDisp[dia.id];
                            setDisponibilidad(newDisp);
                          } else {
                            setDisponibilidad({
                              ...disponibilidad,
                              [dia.id]: {
                                hora_inicio: '08:00:00',
                                hora_fin: '20:00:00',
                              },
                            });
                          }
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={isSelected ? colors.primary : colors.textSecondary}
                        />
                        <Text className={cn("text-md flex-1", "isSelected && 'font-semibold'")}>
                          {dia.nombre}
                        </Text>
                      </TouchableOpacity>
                      {isSelected && horario && (
                        <View className="flex-row items-center gap-sm flex-1">
                          <TouchableOpacity
                            className="px-sm py-xs rounded-md border"
                            onPress={() => openTimePicker(dia.id, 'inicio')}
                          >
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <Text className="text-sm">
                              {formatTime(horario.hora_inicio)}
                            </Text>
                          </TouchableOpacity>
                          <Text className="text-md">-</Text>
                          <TouchableOpacity
                            className="px-sm py-xs rounded-md border"
                            onPress={() => openTimePicker(dia.id, 'fin')}
                          >
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <Text className="text-sm">
                              {formatTime(horario.hora_fin)}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="mt-sm gap-xs">
                {canchaData.disponibilidad && canchaData.disponibilidad.length > 0 ? (
                  canchaData.disponibilidad.map((disp) => {
                    const dia = DIAS_SEMANA.find(d => d.id === disp.dia_semana);
                    return (
                      <View key={disp.id} className="flex-row justify-between items-center p-sm rounded-md border">
                        <Text className="text-md font-semibold">{dia?.nombre}</Text>
                        <Text className="text-md">
                          {formatTime(disp.hora_inicio)} - {formatTime(disp.hora_fin)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text className="text-md italic mt-xs">Sin disponibilidad configurada</Text>
                )}
              </View>
            )}
          </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal de vista de imagen */}
        <RNModal
          isVisible={selectedImage !== null}
          onBackdropPress={() => setSelectedImage(null)}
          onBackButtonPress={() => setSelectedImage(null)}
          animationIn="fadeIn"
          animationOut="fadeOut"
          backdropOpacity={0.95}
          useNativeDriverForBackdrop
          hideModalContentWhileAnimating
          style={{ margin: 0, flex: 1 }}
        >
          <View className="flex-1 justify-center items-center">
            <TouchableOpacity
              className="absolute top-[50px] right-5 z-10 rounded-full w-10 h-10 justify-center items-center"
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            )}
          </View>
        </RNModal>

        {/* Modal de TimePicker */}
        <RNModal
          isVisible={showTimePicker !== null}
          onBackdropPress={() => setShowTimePicker(null)}
          onBackButtonPress={() => setShowTimePicker(null)}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          backdropOpacity={0.5}
          useNativeDriverForBackdrop
          hideModalContentWhileAnimating
          style={{ flex: 1, margin: 0, justifyContent: 'flex-end' }}
        >
            <Screen className="rounded-t-lg p-md max-h-[60%]" edges={['bottom']}>
              <View className="flex-row justify-between items-center mb-md pb-sm border-b">
                <Text className="text-lg font-bold">
                  {showTimePicker && DIAS_SEMANA.find(d => d.id === showTimePicker.dia)?.nombre} -{' '}
                  {showTimePicker?.tipo === 'inicio' ? 'Hora inicio' : 'Hora fin'}
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-md mb-md">
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Hora:</Text>
                  <ScrollView
                    className="max-h-[200px]"
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <TouchableOpacity
                        key={h}
                        className={cn(
                          'p-sm rounded-md mb-xs items-center',
                          timePickerValue.hora === h.toString() && 'border'
                        )}
                        style={
                          timePickerValue.hora === h.toString()
                            ? { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                            : undefined
                        }
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.toString(),
                          })
                        }
                      >
                        <Text
                          className={cn(
                            'text-lg',
                            timePickerValue.hora === h.toString() && 'font-bold'
                          )}
                          style={
                            timePickerValue.hora === h.toString()
                              ? { color: colors.primary }
                              : undefined
                          }
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Minuto:</Text>
                  <ScrollView
                    className="max-h-[200px]"
                    showsVerticalScrollIndicator={false}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <TouchableOpacity
                        key={m}
                        className={cn(
                          'p-sm rounded-md mb-xs items-center',
                          timePickerValue.minuto === m.toString().padStart(2, '0') && 'border'
                        )}
                        style={
                          timePickerValue.minuto === m.toString().padStart(2, '0')
                            ? { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                            : undefined
                        }
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            minuto: m.toString().padStart(2, '0'),
                          })
                        }
                      >
                        <Text
                          className={cn(
                            'text-lg',
                            timePickerValue.minuto === m.toString().padStart(2, '0') && 'font-bold'
                          )}
                          style={
                            timePickerValue.minuto === m.toString().padStart(2, '0')
                              ? { color: colors.primary }
                              : undefined
                          }
                        >
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Periodo:</Text>
                  <View className="flex-col gap-xs mt-sm w-full">
                    <TouchableOpacity
                      className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", "timePickerValue.ampm === 'AM' && 'bg-primary border-primary'")}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'AM',
                        })
                      }
                    >
                      <Text
                        className={cn("text-md font-medium", "timePickerValue.ampm === 'AM' && 'text-text-inverse font-bold'")}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", "timePickerValue.ampm === 'PM' && 'bg-primary border-primary'")}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'PM',
                        })
                      }
                    >
                      <Text
                        className={cn("text-md font-medium", "timePickerValue.ampm === 'PM' && 'text-text-inverse font-bold'")}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-sm">
                <TouchableOpacity
                  className="flex-1 p-md rounded-md items-center"
                  onPress={() => setShowTimePicker(null)}
                >
                  <Text className="text-md font-semibold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 p-md rounded-md items-center"
                  onPress={saveTime}
                >
                  <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
                </TouchableOpacity>
              </View>
            </Screen>
        </RNModal>

        <CustomAlert
          visible={alertVisible}
          title={alertOptions.title}
          message={alertOptions.message}
          type={alertOptions.type}
          confirmText={alertOptions.confirmText}
          cancelText={alertOptions.cancelText}
          onConfirm={handleConfirm}
          onCancel={handleCancel || hideAlert}
        />
      </Screen>
    );
  }

  // Vista de creación (solo cuando no hay canchaId)
  if (!canchaId) {
    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-md py-sm border-b">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-xs"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold flex-1 text-center">Nueva Cancha</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className="px-md py-sm rounded-md"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
          >
          {/* Complejo */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Complejo *</Text>
            <View className="border rounded-md p-md min-h-[48px] justify-center">
              {complejos.length === 0 ? (
                <Text className="text-text-secondary">
                  No tienes complejos. Crea uno primero.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {complejos.map((complejo) => (
                    <TouchableOpacity
                      key={complejo.id}
                      className={cn("px-md py-sm rounded-md border mr-sm mb-sm", "complejoId === complejo.id && 'bg-primary border-primary'")}
                      onPress={() => setComplejoId(complejo.id)}
                    >
                      <Text
                        className={cn("text-sm", "complejoId === complejo.id && 'text-text-inverse font-semibold'")}
                      >
                        {complejo.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Nombre */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Nombre *</Text>
            <TextInput
              className="border rounded-md px-sm py-sm text-md"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Cancha 1, Cancha Principal"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {/* Medidas */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Medidas (opcional)</Text>
            <View className="flex-row gap-sm">
              <View className="flex-1">
                <Text className="text-xs mb-xs">Largo (metros)</Text>
                <TextInput
                  className="border rounded-md px-sm py-sm text-md"
                  value={largo}
                  onChangeText={setLargo}
                  placeholder="Ej: 40"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs mb-xs">Ancho (metros)</Text>
                <TextInput
                  className="border rounded-md px-sm py-sm text-md"
                  value={ancho}
                  onChangeText={setAncho}
                  placeholder="Ej: 20"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Jugadores por equipo */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">
              Cantidad ideal/recomendada de jugadores por equipo (incluyendo portero) *
            </Text>
            <TextInput
              className="border rounded-md px-sm py-sm text-md"
              value={jugadoresPorEquipo}
              onChangeText={setJugadoresPorEquipo}
              placeholder="Ej: 5, 7, 11"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          {/* Precio por hora */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Precio por hora *</Text>
            <TextInput
              className="border rounded-md px-sm py-sm text-md"
              value={precioPorHora}
              onChangeText={setPrecioPorHora}
              placeholder="Ej: 15000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          {/* Fotos */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-sm">
              <Text className="text-sm font-medium mb-xs">Fotos (opcional)</Text>
              <Text className="text-xs">
                💡 Los usuarios tienden a confiar más en canchas con fotografías
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-sm">
              {fotos.map((foto, index) => (
                <View key={index} className="relative mr-sm">
                  <TouchableOpacity
                    onPress={() => setSelectedImage(foto.uri || foto.url || '')}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: foto.uri || foto.url || '' }} className="w-[100px] h-[100px] rounded-md" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="absolute -top-2 -right-2 rounded-full"
                    onPress={() => removeFoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                className="w-[100px] h-[100px] rounded-md border-2 border-dashed justify-center items-center"
                onPress={() => pickImage()}
              >
                <Ionicons name="add" size={32} color={colors.textSecondary} />
                <Text className="text-xs mt-xs">Agregar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Disponibilidad */}
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Disponibilidad</Text>
            <Text className="text-xs mb-sm">
              Selecciona los días de la semana y los horarios en que la cancha está disponible
            </Text>
            <View className="mt-sm gap-sm">
              {DIAS_SEMANA.map((dia) => {
                const isSelected = disponibilidad[dia.id] !== undefined;
                const horario = disponibilidad[dia.id];
                return (
                  <View key={dia.id} className="flex-row items-center py-sm border-b">
                    <TouchableOpacity
                      className="w-6 h-6 rounded-sm border-2 mr-sm justify-center items-center"
                      onPress={() => {
                        if (isSelected) {
                          const newDisp = { ...disponibilidad };
                          delete newDisp[dia.id];
                          setDisponibilidad(newDisp);
                        } else {
                          setDisponibilidad({
                            ...disponibilidad,
                            [dia.id]: {
                              hora_inicio: '08:00:00',
                              hora_fin: '20:00:00',
                            },
                          });
                        }
                      }}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text className={cn("text-md flex-1", "isSelected && 'font-semibold'")}>
                        {dia.nombre}
                      </Text>
                    </TouchableOpacity>
                    {isSelected && horario && (
                      <View className="flex-row items-center gap-sm flex-1">
                        <TouchableOpacity
                          className="px-sm py-xs rounded-md border"
                          onPress={() => openTimePicker(dia.id, 'inicio')}
                        >
                          <Ionicons name="time-outline" size={16} color={colors.primary} />
                          <Text className="text-sm">
                            {formatTime(horario.hora_inicio)}
                          </Text>
                        </TouchableOpacity>
                        <Text className="text-md">-</Text>
                        <TouchableOpacity
                          className="px-sm py-xs rounded-md border"
                          onPress={() => openTimePicker(dia.id, 'fin')}
                        >
                          <Ionicons name="time-outline" size={16} color={colors.primary} />
                          <Text className="text-sm">
                            {formatTime(horario.hora_fin)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Estado */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-medium mb-xs">Estado</Text>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: colors.borderLight, true: colors.primary + '40' }}
                thumbColor={activo ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text className="text-xs mt-xs">
              {activo ? 'La cancha está activa y visible para los usuarios' : 'La cancha está inactiva y no será visible'}
            </Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal de vista de imagen */}
        <RNModal
          isVisible={selectedImage !== null}
          onBackdropPress={() => setSelectedImage(null)}
          onBackButtonPress={() => setSelectedImage(null)}
          animationIn="fadeIn"
          animationOut="fadeOut"
          backdropOpacity={0.95}
          useNativeDriverForBackdrop
          hideModalContentWhileAnimating
          style={{ margin: 0, flex: 1 }}
        >
          <View className="flex-1 justify-center items-center">
            <TouchableOpacity
              className="absolute top-[50px] right-5 z-10 rounded-full w-10 h-10 justify-center items-center"
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            )}
          </View>
        </RNModal>

        {/* Modal de TimePicker */}
        <RNModal
          isVisible={showTimePicker !== null}
          onBackdropPress={() => setShowTimePicker(null)}
          onBackButtonPress={() => setShowTimePicker(null)}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          backdropOpacity={0.5}
          useNativeDriverForBackdrop
          hideModalContentWhileAnimating
          style={{ flex: 1, margin: 0, justifyContent: 'flex-end' }}
        >
            <Screen className="rounded-t-lg p-md max-h-[60%]" edges={['bottom']}>
              <View className="flex-row justify-between items-center mb-md pb-sm border-b">
                <Text className="text-lg font-bold">
                  {showTimePicker && DIAS_SEMANA.find(d => d.id === showTimePicker.dia)?.nombre} -{' '}
                  {showTimePicker?.tipo === 'inicio' ? 'Hora inicio' : 'Hora fin'}
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-md mb-md">
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Hora:</Text>
                  <ScrollView
                    className="max-h-[200px]"
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <TouchableOpacity
                        key={h}
                        className={cn(
                          'p-sm rounded-md mb-xs items-center',
                          timePickerValue.hora === h.toString() && 'border'
                        )}
                        style={
                          timePickerValue.hora === h.toString()
                            ? { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                            : undefined
                        }
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.toString(),
                          })
                        }
                      >
                        <Text
                          className={cn(
                            'text-lg',
                            timePickerValue.hora === h.toString() && 'font-bold'
                          )}
                          style={
                            timePickerValue.hora === h.toString()
                              ? { color: colors.primary }
                              : undefined
                          }
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Minuto:</Text>
                  <ScrollView
                    className="max-h-[200px]"
                    showsVerticalScrollIndicator={false}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <TouchableOpacity
                        key={m}
                        className={cn(
                          'p-sm rounded-md mb-xs items-center',
                          timePickerValue.minuto === m.toString().padStart(2, '0') && 'border'
                        )}
                        style={
                          timePickerValue.minuto === m.toString().padStart(2, '0')
                            ? { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                            : undefined
                        }
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            minuto: m.toString().padStart(2, '0'),
                          })
                        }
                      >
                        <Text
                          className={cn(
                            'text-lg',
                            timePickerValue.minuto === m.toString().padStart(2, '0') && 'font-bold'
                          )}
                          style={
                            timePickerValue.minuto === m.toString().padStart(2, '0')
                              ? { color: colors.primary }
                              : undefined
                          }
                        >
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View className="flex-1 items-start">
                  <Text className="text-sm font-medium mb-sm">Periodo:</Text>
                  <View className="flex-col gap-xs mt-sm w-full">
                    <TouchableOpacity
                      className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", "timePickerValue.ampm === 'AM' && 'bg-primary border-primary'")}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'AM',
                        })
                      }
                    >
                      <Text
                        className={cn("text-md font-medium", "timePickerValue.ampm === 'AM' && 'text-text-inverse font-bold'")}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={cn("w-full p-sm rounded-md border items-center justify-center min-h-[40px]", "timePickerValue.ampm === 'PM' && 'bg-primary border-primary'")}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'PM',
                        })
                      }
                    >
                      <Text
                        className={cn("text-md font-medium", "timePickerValue.ampm === 'PM' && 'text-text-inverse font-bold'")}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-sm">
                <TouchableOpacity
                  className="flex-1 p-md rounded-md items-center"
                  onPress={() => setShowTimePicker(null)}
                >
                  <Text className="text-md font-semibold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 p-md rounded-md items-center"
                  onPress={saveTime}
                >
                  <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
                </TouchableOpacity>
              </View>
            </Screen>
        </RNModal>

        <CustomAlert
          visible={alertVisible}
          title={alertOptions.title}
          message={alertOptions.message}
          type={alertOptions.type}
          confirmText={alertOptions.confirmText}
          cancelText={alertOptions.cancelText}
          onConfirm={handleConfirm}
          onCancel={handleCancel || hideAlert}
        />
      </Screen>
    );
  }

  return null;
}

