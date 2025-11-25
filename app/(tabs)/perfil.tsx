import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PerfilScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error);
    } else {
      router.replace('/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color={Colors.textSecondary} />
          </View>
          <Text style={styles.title}>Perfil</Text>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color={Colors.text} />
            <Text style={styles.menuText}>Editar Perfil</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
            <Text style={styles.menuText}>Configuración</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={24} color={Colors.text} />
            <Text style={styles.menuText}>Ayuda</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  menuSection: {
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  menuText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    marginTop: 'auto',
    marginBottom: Spacing.lg,
  },
  signOutText: {
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: Spacing.sm,
  },
});

