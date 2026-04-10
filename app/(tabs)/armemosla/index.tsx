import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { useThemeColors } from '../../../hooks/useThemeColors';

type CardDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
};

export default function ArmemoslaScreen() {
  const colors = useThemeColors();

  const cards: CardDef[] = [
    {
      key: 'apartar',
      icon: 'calendar-outline',
      title: 'Apartar cancha',
      description:
        'Reservá la cancha sin publicar nada en la piscina (si ya tenés rival o solo querés el turno).',
      onPress: () => router.push({ pathname: '/(tabs)/armemosla/buscar', params: { flow: 'solo' } }),
    },
    {
      key: 'apartar-rival',
      icon: 'football-outline',
      title: 'Apartar cancha y buscar rival',
      description:
        'Después de reservar, publicás tu partido en la piscina para que otros equipos puedan pedirte reto.',
      onPress: () => router.push({ pathname: '/(tabs)/armemosla/buscar', params: { flow: 'con_rival' } }),
    },
    {
      key: 'rival-reserva',
      icon: 'ticket-outline',
      title: 'Buscar rival para una cancha ya apartada',
      description:
        'Elegí una reserva pendiente y sumala a la piscina si todavía necesitás contrincante.',
      onPress: () => router.push('/(tabs)/armemosla/rival-desde-reserva'),
    },
    {
      key: 'solo-rival',
      icon: 'people-outline',
      title: 'Buscar rival',
      description:
        'Entrá a la piscina: partidos publicados por otros. Pedí reto con tu equipo; si te aceptan, ese partido deja de listarse.',
      onPress: () =>
        router.push({
          pathname: '/(tabs)/armemosla/buscar-rival',
          params: { initialTab: 'buscar-partidos' },
        }),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.title, { color: colors.text }]}>Armemosla</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Elige cómo quieres jugar
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {cards.map((card) => (
          <TouchableOpacity
            key={card.key}
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={card.onPress}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: Colors.primary + '18' }]}>
              <Ionicons name={card.icon} size={28} color={Colors.primary} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {card.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});
