import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReservasScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="calendar-outline" size={64} color={Colors.textSecondary} />
        <Text style={styles.title}>Reservas</Text>
        <Text style={styles.subtitle}>
          Próximamente: Gestiona las reservas de tus canchas
        </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

