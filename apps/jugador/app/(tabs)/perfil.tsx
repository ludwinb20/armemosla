import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Switch, 
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../components/lottie/PlayerEmptyState';
import { 
  getCurrentProfile, 
  updateProfile, 
  UserProfile,
} from '../../lib/user';
import {
  obtenerEquiposJugador,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipo,
  establecerEquipoPrincipal,
  EquipoWithMembers,
} from '../../lib/equipos';
import { uploadImage } from '../../lib/storage';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Text, Button, Card, Input, Chip, Divider, DialogSheet, MenuRow } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimCenter,
} from '../../lib/rnModalPresets';

export default function PerfilScreen() {
  const { colors } = useGlassTheme();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userType, setUserType] = useState<'Jugador' | 'Administrador de Cancha' | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Campos del formulario de edición
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  // Equipos (solo para jugadores)
  const [equipos, setEquipos] = useState<EquipoWithMembers[]>([]);
  const [showEquiposModal, setShowEquiposModal] = useState(false);
  const [showEquipoForm, setShowEquipoForm] = useState(false);
  const [equipoEditando, setEquipoEditando] = useState<EquipoWithMembers | null>(null);
  const [formEquipoNombre, setFormEquipoNombre] = useState('');
  const [formEquipoLogoUri, setFormEquipoLogoUri] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);


  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await getCurrentProfile();
      const type = profileData?.user_type ?? null;
      setUserType(type);

      const equiposData = await obtenerEquiposJugador();
      setEquipos(equiposData);

      if (profileData) {
        setProfile(profileData);
        setEditForm({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          email: profileData.email || '',
        });
      }
    } catch (error: any) {
      console.error('Error al cargar perfil:', error);
      showError('Error', 'No se pudo cargar la información del perfil');
    } finally {
      setLoading(false);
    }
  };


  const handleSignOut = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.error('Error al cerrar sesión:', error);
              showError('Error', 'No se pudo cerrar sesión');
            } else {
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const updated = await updateProfile(editForm);
      setProfile(updated);
      setShowEditModal(false);
      showSuccess('Éxito', 'Perfil actualizado correctamente');
    } catch (error: any) {
      console.error('Error al actualizar perfil:', error);
      showError('Error', error.message || 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEquipos = async () => {
    try {
      setLoading(true);
      const equiposData = await obtenerEquiposJugador();
      setEquipos(equiposData);
      setShowEquiposModal(true);
    } catch (error: any) {
      showError('Error', error.message || 'No se pudieron cargar tus equipos');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (userType: string | null) => {
    switch (userType) {
      case 'Administrador de Cancha':
        return 'business-outline';
      case 'Jugador':
        return 'person-outline';
      default:
        return 'person-outline';
    }
  };

  if (loading) {
    return (
      <Screen edges={["top", "bottom"]} className="flex-1">
        <PlayerLoadingView message="Cargando perfil..." />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]} className="flex-1">
      <ScrollView 
        className="flex-1"
        contentContainerClassName="p-md"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View className="items-center py-xl border-b mb-lg" style={{ borderBottomColor: colors.borderLight }}>
          <View className="w-[100px] h-[100px] rounded-full justify-center items-center mb-md" style={{ backgroundColor: colors.surface }}>
            {profile?.avatar_url ? (
              <Text className="text-4xl font-bold">
                {profile.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            ) : (
              <Ionicons 
                name={getTypeIcon(profile?.user_type || null)} 
                size={48} 
                color={colors.textSecondary} 
              />
            )}
          </View>
          <Text className="text-xl font-bold mb-xs" style={{ color: colors.text }}>
            {profile?.full_name || 'Usuario'}
          </Text>
          <Text className="text-sm mb-sm" style={{ color: colors.textSecondary }}>
            {profile?.email || 'Sin email'}
          </Text>
          {profile?.user_type && (
            <View className="flex-row items-center px-md py-xs rounded-full mt-xs" style={{ backgroundColor: colors.surface }}>
              <Ionicons 
                name={getTypeIcon(profile.user_type)} 
                size={16} 
                color={colors.primary} 
              />
              <Text className="ml-xs text-sm font-semibold" style={{ color: colors.primary }}>
                {profile.user_type}
              </Text>
            </View>
          )}
        </View>

        {/* Menu Section */}
        <View className="mb-lg">
          <MenuRow
            icon="person-outline"
            title="Editar Perfil"
            subtitle="Cambiar nombre, teléfono o email"
            onPress={() => setShowEditModal(true)}
          />




          {true && (
            <MenuRow
              icon="people-outline"
              iconColor={colors.primary}
              title="Mis Equipos"
              subtitle="Crea y administra tus equipos (nombre obligatorio, escudo opcional)"
              onPress={handleOpenEquipos}
            />
          )}

          <MenuRow
            icon={theme === 'dark' ? 'moon' : 'sunny'}
            title={`Modo ${theme === 'dark' ? 'Oscuro' : 'Claro'}`}
            rightElement={
              <Switch
                value={theme === 'dark'}
                onValueChange={(enabled) => {
                  const next = enabled ? 'dark' : 'light';
                  if (next !== theme) setTheme(next);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text}
              />
            }
          />
        </View>

        <Card
          onPress={handleSignOut}
          className="mt-auto mb-lg border"
          style={{ borderColor: colors.error + '40' }}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text className="text-md font-semibold ml-sm" style={{ color: colors.error }}>
              Cerrar Sesión
            </Text>
          </View>
        </Card>
      </ScrollView>


      {/* Modal de Editar Perfil */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showEditModal}
        onBackdropPress={() => setShowEditModal(false)}
        onBackButtonPress={() => setShowEditModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0">
              <Text className="text-xl font-bold" style={{ color: colors.text }}>Editar Perfil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg pb-lg"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View className="mb-md">
                <Text style={{ color: colors.text }}>Nombre Completo</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={editForm.full_name}
                  onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
                  placeholder="Ingresa tu nombre completo"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View className="mb-md">
                <Text style={{ color: colors.text }}>Teléfono</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder="Ingresa tu teléfono"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-md">
                <Text style={{ color: colors.text }}>Email</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="Ingresa tu email"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>

            <View className="flex-row p-lg border-t gap-md flex-shrink-0">
              <TouchableOpacity
                className={cn("p-md rounded-md items-center", "border flex-1")} style={{ backgroundColor: colors.surface }}
                onPress={() => setShowEditModal(false)}
                disabled={saving}
              >
                <Text className="text-md font-semibold" style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={cn("p-md rounded-md items-center", "flex-1")} style={{ backgroundColor: colors.primary }}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
        </DialogSheet>
      </RNModal>

      {/* Modal Equipos */}
      {true && (
        <RNModal
          {...rBackdrop}
          {...rModalAnimCenter}
          isVisible={showEquiposModal}
          onBackdropPress={() => setShowEquiposModal(false)}
          onBackButtonPress={() => setShowEquiposModal(false)}
          style={rCenter}
        >
          <DialogSheet maxHeight={modalMaxHeight}>
              <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0">
                <Text className="text-xl font-bold" style={{ color: colors.text }}>Mis Equipos</Text>
                <TouchableOpacity onPress={() => setShowEquiposModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerClassName="p-lg pb-lg"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {equipos.length === 0 ? (
                  <PlayerEmptyState
                    variant="team"
                    title="Sin equipos"
                    text="No tenés equipos. Creá uno nuevo."
                    compact
                  />
                ) : (
                  equipos.map((equipo) => (
                    <View
                      key={equipo.id}
                      className="rounded-md p-md mb-md border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <View className="flex-row items-center mb-sm">
                        {equipo.logo_url ? (
                          <Image source={{ uri: equipo.logo_url }} className="w-[60px] h-[60px] rounded-md mr-md" />
                        ) : (
                          <View className="w-[60px] h-[60px] rounded-md mr-md items-center justify-center" style={{ backgroundColor: colors.border }}>
                            <Ionicons name="shirt-outline" size={32} color={colors.textSecondary} />
                          </View>
                        )}
                        <View className="flex-1">
                          <View className="flex-row items-center gap-sm flex-wrap">
                            <Text className="text-lg font-bold" style={{ color: colors.text }}>{equipo.nombre}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row gap-sm flex-wrap">
                        {!equipo.es_principal && (
                          <TouchableOpacity
                            className="flex-row items-center p-sm rounded-md border gap-xs flex-1 min-w-[100px]" style={{ borderColor: colors.primary }}
                            onPress={async () => {
                              try {
                                await establecerEquipoPrincipal(equipo.id);
                                showSuccess('Éxito', 'Equipo establecido como principal');
                                await loadProfile();
                              } catch (error: any) {
                                showError('Error', error.message || 'No se pudo establecer el equipo principal');
                              }
                            }}
                          >
                            <Ionicons name="star-outline" size={18} color={colors.primary} />
                            <Text className="text-sm font-medium" style={{ color: colors.primary }}>Establecer Principal</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          className="flex-row items-center p-sm rounded-md border gap-xs flex-1 min-w-[100px]" style={{ borderColor: colors.border }}
                          onPress={() => {
                            setEquipoEditando(equipo);
                            setFormEquipoNombre(equipo.nombre);
                            setFormEquipoLogoUri(null);
                            setShowEquipoForm(true);
                          }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.text} />
                          <Text className="text-sm font-medium" style={{ color: colors.text }}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-row items-center p-sm rounded-md border gap-xs flex-1 min-w-[100px]" style={{ borderColor: colors.error }}
                          onPress={() => {
                            showError(
                              'Eliminar Equipo',
                              `¿Estás seguro de que deseas eliminar "${equipo.nombre}"?`,
                              async () => {
                                try {
                                  await eliminarEquipo(equipo.id);
                                  showSuccess('Éxito', 'Equipo eliminado');
                                  await loadProfile();
                                } catch (error: any) {
                                  showError('Error', error.message || 'No se pudo eliminar el equipo');
                                }
                              }
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                          <Text className="text-sm font-medium" style={{ color: colors.error }}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View className="flex-row p-lg border-t gap-md flex-shrink-0">
                <TouchableOpacity
                  className="p-md rounded-md items-center" style={{ backgroundColor: colors.primary }}
                  disabled={equipos.length > 0}
                  onPress={() => {
                    if (equipos.length > 0) {
                      showError('Límite alcanzado', 'Solo puedes tener un equipo. Edita el actual para modificarlo.');
                      return;
                    }
                    setEquipoEditando(null);
                    setFormEquipoNombre('');
                    setFormEquipoLogoUri(null);
                    setShowEquipoForm(true);
                  }}
                >
                  <Ionicons
                    name={equipos.length > 0 ? 'lock-closed-outline' : 'add-circle-outline'}
                    size={20}
                    color={colors.textInverse}
                  />
                  <Text className="text-md font-semibold text-text-inverse">
                    {equipos.length > 0 ? '1 equipo por usuario' : 'Crear Equipo'}
                  </Text>
                </TouchableOpacity>
              </View>
          </DialogSheet>
        </RNModal>
      )}

      {/* Modal Form Equipo */}
      {true && (
        <RNModal
          {...rBackdrop}
          {...rModalAnimCenter}
          isVisible={showEquipoForm}
          onBackdropPress={() => setShowEquipoForm(false)}
          onBackButtonPress={() => setShowEquipoForm(false)}
          avoidKeyboard
          style={rCenter}
        >
          <DialogSheet maxHeight={modalMaxHeight}>
              <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0">
                <Text className="text-xl font-bold" style={{ color: colors.text }}>
                  {equipoEditando ? 'Editar Equipo' : 'Crear Equipo'}
                </Text>
                <TouchableOpacity onPress={() => setShowEquipoForm(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerClassName="p-lg pb-lg"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <View className="mb-md">
                  <Text style={{ color: colors.text }}>Nombre *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                    value={formEquipoNombre}
                    onChangeText={setFormEquipoNombre}
                    placeholder="Nombre del equipo"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View className="mb-md">
                  <Text style={{ color: colors.text }}>Logo</Text>
                  <TouchableOpacity
                    className="w-full h-[200px] rounded-md border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    onPress={async () => {
                      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (status !== 'granted') {
                        showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
                        return;
                      }

                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.8,
                      });

                      if (!result.canceled && result.assets[0]?.uri) {
                        setFormEquipoLogoUri(result.assets[0].uri);
                      }
                    }}
                  >
                    {formEquipoLogoUri ? (
                      <Image source={{ uri: formEquipoLogoUri }} className="w-full h-full rounded-md" />
                    ) : equipoEditando?.logo_url ? (
                      <Image source={{ uri: equipoEditando.logo_url }} className="w-full h-full rounded-md" />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
                        <Text className="mt-sm text-sm" style={{ color: colors.textSecondary }}>Seleccionar logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View className="flex-row p-lg border-t gap-md flex-shrink-0">
                <TouchableOpacity
                  className={cn("p-md rounded-md items-center", "border flex-1")} style={{ backgroundColor: colors.surface }}
                  onPress={() => setShowEquipoForm(false)}
                  disabled={saving || subiendoLogo}
                >
                  <Text className="text-md font-semibold" style={{ color: colors.text }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={cn("p-md rounded-md items-center", "flex-1")} style={{ backgroundColor: colors.primary }}
                  onPress={async () => {
                    const nombreLimpio = formEquipoNombre.trim();
                    if (!nombreLimpio) {
                      showError('Error', 'El nombre es requerido');
                      return;
                    }

                    try {
                      setSaving(true);
                      let logoUrl = equipoEditando?.logo_url;

                      if (formEquipoLogoUri) {
                        setSubiendoLogo(true);
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Usuario no autenticado');
                        
                        const timestamp = Date.now();
                        const logoPath = `equipos/${user.id}/${equipoEditando?.id || 'new'}/${timestamp}.jpg`;
                        logoUrl = await uploadImage(formEquipoLogoUri, 'equipos', logoPath);
                        setSubiendoLogo(false);
                      }

                      if (equipoEditando) {
                        await actualizarEquipo(equipoEditando.id, {
                          nombre: nombreLimpio,
                          logo_url: logoUrl,
                        });
                        showSuccess('Éxito', 'Equipo actualizado correctamente');
                      } else {
                        await crearEquipo(nombreLimpio, logoUrl);
                        showSuccess('Éxito', 'Equipo creado correctamente');
                      }

                      setShowEquipoForm(false);
                      await loadProfile();
                    } catch (error: any) {
                      console.error('Error al guardar equipo:', error);
                      showError('Error', error.message || 'No se pudo guardar el equipo');
                    } finally {
                      setSaving(false);
                      setSubiendoLogo(false);
                    }
                  }}
                  disabled={saving || subiendoLogo || !formEquipoNombre.trim()}
                >
                  {(saving || subiendoLogo) ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text className="text-md font-semibold text-text-inverse">
                      {equipoEditando ? 'Guardar' : 'Crear'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
          </DialogSheet>
        </RNModal>
      )}

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

