import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Switch, 
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { 
  getCurrentProfile, 
  updateProfile, 
  UserProfile,
} from '../../lib/user';
import { Screen, Text, DialogSheet, MenuRow, Card } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import {
  getDatosFiscalesCliente,
  guardarDatosFiscalesCliente,
  getDatosFiscalesBloqueados,
  DatosFiscalesCliente,
} from '../../lib/datosFiscales';
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


  const [datosFiscales, setDatosFiscales] = useState<DatosFiscalesCliente | null>(null);
  const [fiscalesBloqueados, setFiscalesBloqueados] = useState(false);
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const [fiscalForm, setFiscalForm] = useState({ razon_social: '', rtn: '', direccion: '' });
  const [savingFiscal, setSavingFiscal] = useState(false);

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

      if (profileData) {
        setProfile(profileData);
        setEditForm({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          email: profileData.email || '',
        });
      }

      const [fiscal, bloqueado] = await Promise.all([
        getDatosFiscalesCliente(),
        getDatosFiscalesBloqueados(),
      ]);
      setDatosFiscales(fiscal);
      setFiscalesBloqueados(bloqueado);
      if (fiscal) {
        setFiscalForm({
          razon_social: fiscal.razon_social,
          rtn: fiscal.rtn,
          direccion: fiscal.direccion || '',
        });
      }
    } catch (error: any) {
      console.error('Error al cargar perfil:', error);
      showError('Error', 'No se pudo cargar la información del perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFiscal = async () => {
    if (!fiscalForm.razon_social.trim() || !fiscalForm.rtn.trim()) {
      showError('Error', 'Razón social y RTN son obligatorios');
      return;
    }
    try {
      setSavingFiscal(true);
      const saved = await guardarDatosFiscalesCliente(fiscalForm);
      setDatosFiscales(saved);
      setShowFiscalModal(false);
      showSuccess('Éxito', 'Datos de facturación guardados');
    } catch (error: unknown) {
      showError('Error', error instanceof Error ? error.message : 'No se pudieron guardar los datos');
    } finally {
      setSavingFiscal(false);
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
              icon="document-text-outline"
              iconColor={colors.primary}
              title="Datos de facturación (RTN)"
              subtitle={
                datosFiscales
                  ? `${datosFiscales.razon_social} · RTN ${datosFiscales.rtn}`
                  : 'Configurá tu RTN para recibir factura fiscal'
              }
              hint={fiscalesBloqueados ? 'Bloqueado: ya hay facturas fiscales emitidas' : undefined}
              onPress={() => setShowFiscalModal(true)}
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

      {/* Modal Datos Fiscales */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showFiscalModal}
        onBackdropPress={() => setShowFiscalModal(false)}
        onBackButtonPress={() => setShowFiscalModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0">
              <Text className="text-xl font-bold" style={{ color: colors.text }}>Datos de facturación</Text>
              <TouchableOpacity onPress={() => setShowFiscalModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg pb-lg"
              keyboardShouldPersistTaps="handled"
            >
              {fiscalesBloqueados && (
                <View className="flex-row p-md rounded-md border mb-lg" style={{ backgroundColor: colors.warning + '20', borderColor: colors.warning }}>
                  <Text className="text-sm leading-5" style={{ color: colors.textSecondary }}>
                    No podés editar estos datos porque ya se emitió al menos una factura fiscal a tu nombre.
                  </Text>
                </View>
              )}
              <View className="mb-md">
                <Text style={{ color: colors.text }}>Razón social</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={fiscalForm.razon_social}
                  onChangeText={(text) => setFiscalForm({ ...fiscalForm, razon_social: text })}
                  editable={!fiscalesBloqueados}
                  placeholder="Nombre legal de la empresa"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View className="mb-md">
                <Text style={{ color: colors.text }}>RTN</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={fiscalForm.rtn}
                  onChangeText={(text) => setFiscalForm({ ...fiscalForm, rtn: text })}
                  editable={!fiscalesBloqueados}
                  placeholder="0801..."
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <View className="mb-md">
                <Text style={{ color: colors.text }}>Dirección (opcional)</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  value={fiscalForm.direccion}
                  onChangeText={(text) => setFiscalForm({ ...fiscalForm, direccion: text })}
                  editable={!fiscalesBloqueados}
                  placeholder="Dirección fiscal"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </ScrollView>
            {!fiscalesBloqueados && (
              <View className="flex-row p-lg border-t gap-md flex-shrink-0">
                <TouchableOpacity
                  className={cn("p-md rounded-md items-center", "border flex-1")} style={{ backgroundColor: colors.surface }}
                  onPress={() => setShowFiscalModal(false)}
                >
                  <Text className="text-md font-semibold" style={{ color: colors.text }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={cn("p-md rounded-md items-center", "flex-1")} style={{ backgroundColor: colors.primary }}
                  onPress={() => void handleSaveFiscal()}
                  disabled={savingFiscal}
                >
                  {savingFiscal ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
        </DialogSheet>
      </RNModal>

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

