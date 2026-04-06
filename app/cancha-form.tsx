import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Vista de detalle (solo si hay canchaId)
  if (canchaId) {
    if (!canchaData) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Cancha</Text>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={Colors.text} />
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
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.menuContainer}>
              {canchaData.activo ? (
                <TouchableOpacity
                  style={styles.menuItem}
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
                  <Ionicons name="eye-off-outline" size={20} color={Colors.error} />
                  <Text style={[styles.menuItemText, { color: Colors.error }]}>
                    Desactivar Cancha
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
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
                  <Ionicons name="eye-outline" size={20} color={Colors.success} />
                  <Text style={[styles.menuItemText, { color: Colors.success }]}>
                    Activar Cancha
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </RNModal>

        {/* Banner de estado activo/inactivo */}
        {canchaData.activo === false && (
          <View style={styles.inactiveBanner}>
            <Ionicons name="eye-off" size={24} color={Colors.textInverse} />
            <Text style={styles.inactiveBannerText}>
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
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
          >
          {/* Complejo */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Complejo</Text>
              {!isEditingComplejo ? (
                <TouchableOpacity
                  onPress={() => {
                    setComplejoTemp(canchaData.complejo_id);
                    setIsEditingComplejo(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingComplejo(false);
                      setComplejoTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingComplejo ? (
              <View style={styles.complejoSelector}>
                {complejos.length === 0 ? (
                  <Text style={styles.complejoSelectorEmpty}>
                    No tienes complejos. Crea uno primero.
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {complejos.map((complejo) => (
                      <TouchableOpacity
                        key={complejo.id}
                        style={[
                          styles.complejoChip,
                          complejoTemp === complejo.id && styles.complejoChipActive,
                        ]}
                        onPress={() => setComplejoTemp(complejo.id)}
                      >
                        <Text
                          style={[
                            styles.complejoChipText,
                            complejoTemp === complejo.id && styles.complejoChipTextActive,
                          ]}
                        >
                          {complejo.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <Text style={styles.detailValue}>{canchaData.complejo?.nombre || 'Sin complejo'}</Text>
            )}
          </View>

          {/* Nombre */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Nombre</Text>
              {!isEditingNombre ? (
                <TouchableOpacity
                  onPress={() => {
                    setNombreTemp(canchaData.nombre || '');
                    setIsEditingNombre(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingNombre(false);
                      setNombreTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingNombre ? (
              <TextInput
                style={styles.detailInput}
                value={nombreTemp}
                onChangeText={setNombreTemp}
                placeholder="Nombre de la cancha *"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text style={styles.detailValue}>{canchaData.nombre || 'Sin nombre'}</Text>
            )}
          </View>

          {/* Medidas */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Medidas</Text>
              {!isEditingLargo && !isEditingAncho ? (
                <TouchableOpacity
                  onPress={() => {
                    setLargoTemp(canchaData.largo?.toString() || '');
                    setAnchoTemp(canchaData.ancho?.toString() || '');
                    setIsEditingLargo(true);
                    setIsEditingAncho(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingLargo(false);
                      setIsEditingAncho(false);
                      setLargoTemp('');
                      setAnchoTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingLargo || isEditingAncho ? (
              <View style={styles.medidasEditContainer}>
                <View style={styles.medidaInputContainer}>
                  <Text style={styles.medidaLabel}>Largo (m)</Text>
                  <TextInput
                    style={styles.medidaInput}
                    value={largoTemp}
                    onChangeText={setLargoTemp}
                    placeholder="Ej: 40"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.medidaInputContainer}>
                  <Text style={styles.medidaLabel}>Ancho (m)</Text>
                  <TextInput
                    style={styles.medidaInput}
                    value={anchoTemp}
                    onChangeText={setAnchoTemp}
                    placeholder="Ej: 20"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.detailValue}>
                {canchaData.largo && canchaData.ancho
                  ? `${canchaData.largo}m x ${canchaData.ancho}m`
                  : 'Sin medidas'}
              </Text>
            )}
          </View>

          {/* Jugadores por equipo */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Jugadores por equipo</Text>
              {!isEditingJugadores ? (
                <TouchableOpacity
                  onPress={() => {
                    setJugadoresTemp(canchaData.jugadores_por_equipo.toString());
                    setIsEditingJugadores(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingJugadores(false);
                      setJugadoresTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingJugadores ? (
              <TextInput
                style={styles.detailInput}
                value={jugadoresTemp}
                onChangeText={setJugadoresTemp}
                placeholder="Ej: 5, 7, 11"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <View>
                <Text style={styles.detailValue}>{canchaData.jugadores_por_equipo} vs {canchaData.jugadores_por_equipo}</Text>
                <Text style={styles.detailValueSecondary}>
                  Cantidad ideal/recomendada por equipo (incluyendo portero)
                </Text>
              </View>
            )}
          </View>

          {/* Precio por hora */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Precio por hora</Text>
              {!isEditingPrecio ? (
                <TouchableOpacity
                  onPress={() => {
                    setPrecioTemp(canchaData.precio_por_hora.toString());
                    setIsEditingPrecio(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingPrecio(false);
                      setPrecioTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingPrecio ? (
              <TextInput
                style={styles.detailInput}
                value={precioTemp}
                onChangeText={setPrecioTemp}
                placeholder="Ej: 15000"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <Text style={styles.detailValue}>
                L {canchaData.precio_por_hora.toLocaleString()}/hora
              </Text>
            )}
          </View>

          {/* Fotos */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>
                Fotos ({canchaData.fotos?.length || 0})
              </Text>
              {!isEditingFotos ? (
                <TouchableOpacity
                  onPress={() => setIsEditingFotos(true)}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.detailFotosContainer}
            >
              {canchaData.fotos && canchaData.fotos.length > 0 ? (
                canchaData.fotos.map((foto, index) => (
                  <View key={foto.id || index} style={styles.detailFotoItem}>
                    <TouchableOpacity
                      onPress={() => setSelectedImage(foto.foto_url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: foto.foto_url }}
                        style={styles.detailFoto}
                      />
                    </TouchableOpacity>
                    {isEditingFotos && (
                      <TouchableOpacity
                        style={styles.detailFotoRemoveButton}
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
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.detailValueSecondary}>Sin fotos</Text>
              )}
              {isEditingFotos && (
                <TouchableOpacity
                  style={styles.detailFotoAddButton}
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
                  <Ionicons name="add" size={32} color={Colors.textSecondary} />
                  <Text style={styles.detailFotoAddText}>Agregar</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Disponibilidad */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Disponibilidad</Text>
              {!isEditingDisponibilidad ? (
                <TouchableOpacity
                  onPress={() => setIsEditingDisponibilidad(true)}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingDisponibilidad(false);
                      loadCancha();
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingDisponibilidad ? (
              <View style={styles.disponibilidadEditContainer}>
                {DIAS_SEMANA.map((dia) => {
                  const isSelected = disponibilidad[dia.id] !== undefined;
                  const horario = disponibilidad[dia.id];
                  return (
                    <View key={dia.id} style={styles.diaDisponibilidadRow}>
                      <TouchableOpacity
                        style={styles.diaCheckbox}
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
                          color={isSelected ? Colors.primary : Colors.textSecondary}
                        />
                        <Text style={[styles.diaNombre, isSelected && styles.diaNombreSelected]}>
                          {dia.nombre}
                        </Text>
                      </TouchableOpacity>
                      {isSelected && horario && (
                        <View style={styles.horarioContainer}>
                          <TouchableOpacity
                            style={styles.timeButton}
                            onPress={() => openTimePicker(dia.id, 'inicio')}
                          >
                            <Ionicons name="time-outline" size={16} color={Colors.primary} />
                            <Text style={styles.timeButtonText}>
                              {formatTime(horario.hora_inicio)}
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.horarioSeparator}>-</Text>
                          <TouchableOpacity
                            style={styles.timeButton}
                            onPress={() => openTimePicker(dia.id, 'fin')}
                          >
                            <Ionicons name="time-outline" size={16} color={Colors.primary} />
                            <Text style={styles.timeButtonText}>
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
              <View style={styles.disponibilidadViewContainer}>
                {canchaData.disponibilidad && canchaData.disponibilidad.length > 0 ? (
                  canchaData.disponibilidad.map((disp) => {
                    const dia = DIAS_SEMANA.find(d => d.id === disp.dia_semana);
                    return (
                      <View key={disp.id} style={styles.disponibilidadItem}>
                        <Text style={styles.disponibilidadDia}>{dia?.nombre}</Text>
                        <Text style={styles.disponibilidadHorario}>
                          {formatTime(disp.hora_inicio)} - {formatTime(disp.hora_fin)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.detailValueSecondary}>Sin disponibilidad configurada</Text>
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
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={Colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.imageModalImage}
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
            <SafeAreaView style={styles.timePickerContainer} edges={['bottom']}>
              <View style={styles.timePickerHeader}>
                <Text style={styles.timePickerTitle}>
                  {showTimePicker && DIAS_SEMANA.find(d => d.id === showTimePicker.dia)?.nombre} -{' '}
                  {showTimePicker?.tipo === 'inicio' ? 'Hora inicio' : 'Hora fin'}
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerContent}>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Hora:</Text>
                  <ScrollView
                    style={styles.timePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timePickerOption,
                          timePickerValue.hora === h.toString() &&
                            styles.timePickerOptionSelected,
                        ]}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.toString(),
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.timePickerOptionText,
                            timePickerValue.hora === h.toString() &&
                              styles.timePickerOptionTextSelected,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Minuto:</Text>
                  <ScrollView
                    style={styles.timePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.timePickerOption,
                          timePickerValue.minuto === m.toString().padStart(2, '0') &&
                            styles.timePickerOptionSelected,
                        ]}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            minuto: m.toString().padStart(2, '0'),
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.timePickerOptionText,
                            timePickerValue.minuto === m.toString().padStart(2, '0') &&
                              styles.timePickerOptionTextSelected,
                          ]}
                        >
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Periodo:</Text>
                  <View style={styles.ampmContainer}>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        timePickerValue.ampm === 'AM' && styles.ampmButtonSelected,
                      ]}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'AM',
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          timePickerValue.ampm === 'AM' && styles.ampmButtonTextSelected,
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        timePickerValue.ampm === 'PM' && styles.ampmButtonSelected,
                      ]}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'PM',
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          timePickerValue.ampm === 'PM' && styles.ampmButtonTextSelected,
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerCancelButton}
                  onPress={() => setShowTimePicker(null)}
                >
                  <Text style={styles.timePickerCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerSaveButton}
                  onPress={saveTime}
                >
                  <Text style={styles.timePickerSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
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
      </SafeAreaView>
    );
  }

  // Vista de creación (solo cuando no hay canchaId)
  if (!canchaId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva Cancha</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={styles.saveButton}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
          >
          {/* Complejo */}
          <View style={styles.section}>
            <Text style={styles.label}>Complejo *</Text>
            <View style={styles.complejoSelector}>
              {complejos.length === 0 ? (
                <Text style={styles.complejoSelectorEmpty}>
                  No tienes complejos. Crea uno primero.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {complejos.map((complejo) => (
                    <TouchableOpacity
                      key={complejo.id}
                      style={[
                        styles.complejoChip,
                        complejoId === complejo.id && styles.complejoChipActive,
                      ]}
                      onPress={() => setComplejoId(complejo.id)}
                    >
                      <Text
                        style={[
                          styles.complejoChipText,
                          complejoId === complejo.id && styles.complejoChipTextActive,
                        ]}
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
          <View style={styles.section}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Cancha 1, Cancha Principal"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Medidas */}
          <View style={styles.section}>
            <Text style={styles.label}>Medidas (opcional)</Text>
            <View style={styles.medidasContainer}>
              <View style={styles.medidaInputContainer}>
                <Text style={styles.medidaLabel}>Largo (metros)</Text>
                <TextInput
                  style={styles.medidaInput}
                  value={largo}
                  onChangeText={setLargo}
                  placeholder="Ej: 40"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.medidaInputContainer}>
                <Text style={styles.medidaLabel}>Ancho (metros)</Text>
                <TextInput
                  style={styles.medidaInput}
                  value={ancho}
                  onChangeText={setAncho}
                  placeholder="Ej: 20"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Jugadores por equipo */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Cantidad ideal/recomendada de jugadores por equipo (incluyendo portero) *
            </Text>
            <TextInput
              style={styles.input}
              value={jugadoresPorEquipo}
              onChangeText={setJugadoresPorEquipo}
              placeholder="Ej: 5, 7, 11"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          {/* Precio por hora */}
          <View style={styles.section}>
            <Text style={styles.label}>Precio por hora *</Text>
            <TextInput
              style={styles.input}
              value={precioPorHora}
              onChangeText={setPrecioPorHora}
              placeholder="Ej: 15000"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          {/* Fotos */}
          <View style={styles.section}>
            <View style={styles.fotosHeader}>
              <Text style={styles.label}>Fotos (opcional)</Text>
              <Text style={styles.fotosHint}>
                💡 Los usuarios tienden a confiar más en canchas con fotografías
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosContainer}>
              {fotos.map((foto, index) => (
                <View key={index} style={styles.fotoItem}>
                  <TouchableOpacity
                    onPress={() => setSelectedImage(foto.uri || foto.url || '')}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: foto.uri || foto.url || '' }} style={styles.fotoImage} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fotoRemoveButton}
                    onPress={() => removeFoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.fotoAddButton}
                onPress={() => pickImage()}
              >
                <Ionicons name="add" size={32} color={Colors.textSecondary} />
                <Text style={styles.fotoAddText}>Agregar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Disponibilidad */}
          <View style={styles.section}>
            <Text style={styles.label}>Disponibilidad</Text>
            <Text style={styles.sectionHint}>
              Selecciona los días de la semana y los horarios en que la cancha está disponible
            </Text>
            <View style={styles.disponibilidadContainer}>
              {DIAS_SEMANA.map((dia) => {
                const isSelected = disponibilidad[dia.id] !== undefined;
                const horario = disponibilidad[dia.id];
                return (
                  <View key={dia.id} style={styles.diaDisponibilidadRow}>
                    <TouchableOpacity
                      style={styles.diaCheckbox}
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
                        color={isSelected ? Colors.primary : Colors.textSecondary}
                      />
                      <Text style={[styles.diaNombre, isSelected && styles.diaNombreSelected]}>
                        {dia.nombre}
                      </Text>
                    </TouchableOpacity>
                    {isSelected && horario && (
                      <View style={styles.horarioContainer}>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePicker(dia.id, 'inicio')}
                        >
                          <Ionicons name="time-outline" size={16} color={Colors.primary} />
                          <Text style={styles.timeButtonText}>
                            {formatTime(horario.hora_inicio)}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.horarioSeparator}>-</Text>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePicker(dia.id, 'fin')}
                        >
                          <Ionicons name="time-outline" size={16} color={Colors.primary} />
                          <Text style={styles.timeButtonText}>
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
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Estado</Text>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: Colors.borderLight, true: Colors.primary + '40' }}
                thumbColor={activo ? Colors.primary : Colors.textSecondary}
              />
            </View>
            <Text style={styles.toggleHint}>
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
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={Colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.imageModalImage}
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
            <SafeAreaView style={styles.timePickerContainer} edges={['bottom']}>
              <View style={styles.timePickerHeader}>
                <Text style={styles.timePickerTitle}>
                  {showTimePicker && DIAS_SEMANA.find(d => d.id === showTimePicker.dia)?.nombre} -{' '}
                  {showTimePicker?.tipo === 'inicio' ? 'Hora inicio' : 'Hora fin'}
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerContent}>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Hora:</Text>
                  <ScrollView
                    style={styles.timePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timePickerOption,
                          timePickerValue.hora === h.toString() &&
                            styles.timePickerOptionSelected,
                        ]}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            hora: h.toString(),
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.timePickerOptionText,
                            timePickerValue.hora === h.toString() &&
                              styles.timePickerOptionTextSelected,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Minuto:</Text>
                  <ScrollView
                    style={styles.timePickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.timePickerOption,
                          timePickerValue.minuto === m.toString().padStart(2, '0') &&
                            styles.timePickerOptionSelected,
                        ]}
                        onPress={() =>
                          setTimePickerValue({
                            ...timePickerValue,
                            minuto: m.toString().padStart(2, '0'),
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.timePickerOptionText,
                            timePickerValue.minuto === m.toString().padStart(2, '0') &&
                              styles.timePickerOptionTextSelected,
                          ]}
                        >
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timePickerLabel}>Periodo:</Text>
                  <View style={styles.ampmContainer}>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        timePickerValue.ampm === 'AM' && styles.ampmButtonSelected,
                      ]}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'AM',
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          timePickerValue.ampm === 'AM' && styles.ampmButtonTextSelected,
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        timePickerValue.ampm === 'PM' && styles.ampmButtonSelected,
                      ]}
                      onPress={() =>
                        setTimePickerValue({
                          ...timePickerValue,
                          ampm: 'PM',
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          timePickerValue.ampm === 'PM' && styles.ampmButtonTextSelected,
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerCancelButton}
                  onPress={() => setShowTimePicker(null)}
                >
                  <Text style={styles.timePickerCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerSaveButton}
                  onPress={saveTime}
                >
                  <Text style={styles.timePickerSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
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
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  saveButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  menuButton: {
    padding: Spacing.xs,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: Spacing.md,
  },
  menuContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    minWidth: 200,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  inactiveBanner: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  inactiveBannerText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  complejoSelector: {
    marginTop: Spacing.xs,
  },
  complejoSelectorEmpty: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    padding: Spacing.md,
    textAlign: 'center',
  },
  complejoChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  complejoChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  complejoChipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  complejoChipTextActive: {
    color: Colors.textInverse,
  },
  medidasContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  medidaInputContainer: {
    flex: 1,
  },
  medidaLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  medidaInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  fotosHeader: {
    marginBottom: Spacing.xs,
  },
  fotosHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  fotosContainer: {
    marginTop: Spacing.sm,
  },
  fotoItem: {
    position: 'relative',
    marginRight: Spacing.sm,
  },
  fotoImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  fotoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  fotoAddButton: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  fotoAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  disponibilidadContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  diaDisponibilidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  diaCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  diaNombre: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  diaNombreSelected: {
    color: Colors.text,
    fontWeight: Typography.fontWeight.semibold,
  },
  horarioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  horarioSeparator: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  toggleHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  detailSection: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  detailLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  detailLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  detailEditIconButton: {
    padding: Spacing.xs,
  },
  detailEditActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  detailSaveButton: {
    padding: Spacing.xs,
  },
  detailCancelButton: {
    padding: Spacing.xs,
  },
  detailInput: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  detailValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  detailValueSecondary: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  medidasEditContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  detailFotosContainer: {
    marginTop: Spacing.sm,
  },
  detailFotoItem: {
    position: 'relative',
    marginRight: Spacing.sm,
  },
  detailFoto: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
  },
  detailFotoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    zIndex: 1,
  },
  detailFotoAddButton: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  detailFotoAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  disponibilidadEditContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  disponibilidadViewContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  disponibilidadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disponibilidadDia: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  disponibilidadHorario: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  timePickerContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  timePickerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  timePickerContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  timePickerRow: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timePickerLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  timePickerScroll: {
    maxHeight: 200,
  },
  timePickerOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    alignItems: 'center',
  },
  timePickerOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  timePickerOptionText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text,
  },
  timePickerOptionTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  ampmContainer: {
    flexDirection: 'column',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    width: '100%',
  },
  ampmButton: {
    width: '100%',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  ampmButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ampmButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
  },
  ampmButtonTextSelected: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.bold,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timePickerCancelButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  timePickerSaveButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  timePickerSaveText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});

