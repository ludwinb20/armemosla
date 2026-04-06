import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { 
  getCurrentProfile, 
  updateProfile, 
  changeUserType, 
  UserProfile,
  getUserType,
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
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../lib/rnModalPresets';

export default function PerfilScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colors = useThemeColors();
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userType, setUserType] = useState<'Jugador' | 'Administrador de Cancha' | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangeTypeModal, setShowChangeTypeModal] = useState(false);
  const [confirmChangeType, setConfirmChangeType] = useState(false);
  
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
      const type = await getUserType();
      setUserType(type);
      
      // Si es jugador, cargar equipos
      if (type === 'Jugador') {
        const equiposData = await obtenerEquiposJugador();
        setEquipos(equiposData);
      }
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

  const handleOpenChangeType = () => {
    setConfirmChangeType(false);
    setShowChangeTypeModal(true);
  };

  const handleConfirmChangeType = async () => {
    if (!profile) return;

    const newType = profile.user_type === 'Jugador' ? 'Administrador de Cancha' : 'Jugador';

    try {
      setSaving(true);
      const updated = await changeUserType(newType);
      setProfile(updated);
      setShowChangeTypeModal(false);
      setConfirmChangeType(false);
      // Redirigir según el nuevo tipo de usuario
      const redirectRoute = newType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
      
      // Pequeño delay para asegurar que la BD se actualice antes de redirigir
      setTimeout(() => {
        showSuccess(
          'Tipo de usuario cambiado', 
          `Tu cuenta ahora es de tipo: ${newType}`,
          () => {
            // Redirigir según el nuevo tipo de usuario
            router.replace(redirectRoute);
          }
        );
      }, 300);
    } catch (error: any) {
      console.error('Error al cambiar tipo de usuario:', error);
      showError('Error', error.message || 'No se pudo cambiar el tipo de usuario');
    } finally {
      setSaving(false);
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={[styles.profileSection, { borderBottomColor: colors.borderLight }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
            {profile?.avatar_url ? (
              <Text style={styles.avatarText}>
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
          <Text style={[styles.name, { color: colors.text }]}>
            {profile?.full_name || 'Usuario'}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {profile?.email || 'Sin email'}
          </Text>
          {profile?.user_type && (
            <View style={[styles.typeBadge, { backgroundColor: colors.surface }]}>
              <Ionicons 
                name={getTypeIcon(profile.user_type)} 
                size={16} 
                color={Colors.primary} 
              />
              <Text style={[styles.typeText, { color: Colors.primary }]}>
                {profile.user_type}
              </Text>
            </View>
          )}
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={() => setShowEditModal(true)}
          >
            <Ionicons name="person-outline" size={24} color={colors.text} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuText, { color: colors.text }]}>Editar Perfil</Text>
              <Text style={[styles.menuSubtext, { color: colors.textSecondary }]}>
                Cambiar nombre, teléfono o email
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={handleOpenChangeType}
          >
            <Ionicons name="swap-horizontal-outline" size={24} color={Colors.warning} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuText, { color: colors.text }]}>Cambiar Tipo de Usuario</Text>
              <Text style={[styles.menuSubtext, { color: colors.textSecondary }]}>
                Cambiar entre Jugador y Administrador
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.menuItem, { backgroundColor: colors.surface, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={24} color={colors.text} />
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Modo {theme === 'dark' ? 'Oscuro' : 'Claro'}
                </Text>
              </View>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: Colors.error + '40' }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Editar Perfil */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showEditModal}
        onBackdropPress={() => setShowEditModal(false)}
        onBackButtonPress={() => setShowEditModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Perfil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nombre Completo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editForm.full_name}
                  onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
                  placeholder="Ingresa tu nombre completo"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder="Ingresa tu teléfono"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="Ingresa tu email"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={() => setShowEditModal(false)}
                disabled={saving}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: Colors.primary }]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal de Cambiar Tipo de Usuario */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showChangeTypeModal}
        onBackdropPress={() => setShowChangeTypeModal(false)}
        onBackButtonPress={() => setShowChangeTypeModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Cambiar Tipo de Usuario</Text>
              <TouchableOpacity onPress={() => setShowChangeTypeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={[styles.warningBox, { backgroundColor: Colors.warning + '20', borderColor: Colors.warning }]}>
                <Ionicons name="warning-outline" size={24} color={Colors.warning} />
                <View style={styles.warningContent}>
                  <Text style={[styles.warningTitle, { color: colors.text }]}>
                    ⚠️ Cambio Importante
                  </Text>
                  <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                    Cambiar tu tipo de usuario afectará el acceso a las funcionalidades de la aplicación.
                  </Text>
                  {profile?.user_type === 'Administrador de Cancha' && (
                    <Text style={[styles.warningText, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                      Si cambias a Jugador, perderás acceso a las funciones de administración.
                    </Text>
                  )}
                </View>
              </View>

              <View style={[styles.checkboxContainer, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.checkbox, { borderColor: colors.border }]}
                  onPress={() => setConfirmChangeType(!confirmChangeType)}
                >
                  {confirmChangeType && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmChangeType(!confirmChangeType)}>
                  <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                    Entiendo las consecuencias de este cambio
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                onPress={() => setShowChangeTypeModal(false)}
                disabled={saving}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonSave, 
                  { 
                    backgroundColor: confirmChangeType 
                      ? Colors.warning 
                      : colors.border,
                    opacity: confirmChangeType ? 1 : 0.5
                  }
                ]}
                onPress={handleConfirmChangeType}
                disabled={saving || !confirmChangeType}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Cambiar Tipo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal Equipos */}
      {userType === 'Jugador' && (
        <RNModal
          {...rBackdrop}
          {...rModalAnimLeft}
          isVisible={showEquiposModal}
          onBackdropPress={() => setShowEquiposModal(false)}
          onBackButtonPress={() => setShowEquiposModal(false)}
          style={rCenter}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Mis Equipos</Text>
                <TouchableOpacity onPress={() => setShowEquiposModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerStyle={styles.modalBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {equipos.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No tienes equipos. Crea uno nuevo.
                    </Text>
                  </View>
                ) : (
                  equipos.map((equipo) => (
                    <View
                      key={equipo.id}
                      style={[styles.equipoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={styles.equipoHeader}>
                        {equipo.logo_url ? (
                          <Image source={{ uri: equipo.logo_url }} style={styles.equipoLogo} />
                        ) : (
                          <View style={[styles.equipoLogoPlaceholder, { backgroundColor: colors.border }]}>
                            <Ionicons name="shirt-outline" size={32} color={colors.textSecondary} />
                          </View>
                        )}
                        <View style={styles.equipoInfo}>
                          <View style={styles.equipoNombreRow}>
                            <Text style={[styles.equipoNombre, { color: colors.text }]}>{equipo.nombre}</Text>
                            {equipo.es_principal && (
                              <View style={[styles.principalBadge, { backgroundColor: Colors.primary + '20' }]}>
                                <Text style={[styles.principalBadgeText, { color: Colors.primary }]}>Principal</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.equipoActions}>
                        {!equipo.es_principal && (
                          <TouchableOpacity
                            style={[styles.equipoActionButton, { borderColor: Colors.primary }]}
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
                            <Ionicons name="star-outline" size={18} color={Colors.primary} />
                            <Text style={[styles.equipoActionText, { color: Colors.primary }]}>Establecer Principal</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.equipoActionButton, { borderColor: colors.border }]}
                          onPress={() => {
                            setEquipoEditando(equipo);
                            setFormEquipoNombre(equipo.nombre);
                            setFormEquipoLogoUri(null);
                            setShowEquipoForm(true);
                          }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.text} />
                          <Text style={[styles.equipoActionText, { color: colors.text }]}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.equipoActionButton, { borderColor: Colors.error }]}
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
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                          <Text style={[styles.equipoActionText, { color: Colors.error }]}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                  onPress={() => {
                    setEquipoEditando(null);
                    setFormEquipoNombre('');
                    setFormEquipoLogoUri(null);
                    setShowEquipoForm(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.textInverse} />
                  <Text style={styles.modalButtonTextSave}>Crear Equipo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </RNModal>
      )}

      {/* Modal Form Equipo */}
      {userType === 'Jugador' && (
        <RNModal
          {...rBackdrop}
          {...rModalAnimLeft}
          isVisible={showEquipoForm}
          onBackdropPress={() => setShowEquipoForm(false)}
          onBackButtonPress={() => setShowEquipoForm(false)}
          avoidKeyboard
          style={rCenter}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {equipoEditando ? 'Editar Equipo' : 'Crear Equipo'}
                </Text>
                <TouchableOpacity onPress={() => setShowEquipoForm(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerStyle={styles.modalBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Nombre *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={formEquipoNombre}
                    onChangeText={setFormEquipoNombre}
                    placeholder="Nombre del equipo"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Logo</Text>
                  <TouchableOpacity
                    style={[styles.logoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                      <Image source={{ uri: formEquipoLogoUri }} style={styles.logoPreview} />
                    ) : equipoEditando?.logo_url ? (
                      <Image source={{ uri: equipoEditando.logo_url }} style={styles.logoPreview} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.logoPickerText, { color: colors.textSecondary }]}>Seleccionar logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.surface }]}
                  onPress={() => setShowEquipoForm(false)}
                  disabled={saving || subiendoLogo}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: Colors.primary }]}
                  onPress={async () => {
                    if (!formEquipoNombre.trim()) {
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
                          nombre: formEquipoNombre,
                          logo_url: logoUrl,
                        });
                        showSuccess('Éxito', 'Equipo actualizado correctamente');
                      } else {
                        await crearEquipo(formEquipoNombre, logoUrl);
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
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <Text style={styles.modalButtonTextSave}>
                      {equipoEditando ? 'Guardar' : 'Crear'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  name: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  typeText: {
    marginLeft: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  menuSection: {
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  menuText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  menuSubtext: {
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: 'auto',
    marginBottom: Spacing.lg,
  },
  signOutText: {
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: Spacing.sm,
  },
  // Modal Styles (fondo oscuro lo aporta el backdrop de react-native-modal)
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalBodyContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
    flexShrink: 0,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonSave: {
    ...Shadows.sm,
  },
  modalButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalButtonTextSave: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  warningBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  warningContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  warningTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  warningText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
  },
  // Estilos para equipos
  equipoCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  equipoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  equipoLogo: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  equipoLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipoInfo: {
    flex: 1,
  },
  equipoNombreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  equipoNombre: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  principalBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  principalBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  equipoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  equipoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    flex: 1,
    minWidth: 100,
  },
  equipoActionText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  logoPicker: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  logoPickerText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
});
