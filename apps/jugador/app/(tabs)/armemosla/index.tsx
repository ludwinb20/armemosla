import React from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Text, Button, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

type CardDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  primary?: boolean;
};

export default function ArmemoslaScreen() {
  const { colors } = useGlassTheme();

  const cards: CardDef[] = [
    {
      key: 'apartar',
      icon: 'calendar-outline',
      title: 'Apartar cancha',
      description: 'Reservá el turno si ya tenés rival o solo querés asegurar la cancha.',
      onPress: () => router.push({ pathname: '/(tabs)/armemosla/buscar', params: { flow: 'solo' } }),
      primary: true,
    },
    {
      key: 'apartar-rival',
      icon: 'people-outline',
      title: 'Apartar cancha y buscar rival',
      description: 'Reservás y publicás tu partido para que otros equipos te soliciten jugar.',
      onPress: () => router.push({ pathname: '/(tabs)/armemosla/buscar', params: { flow: 'con_rival' } }),
      primary: true,
    },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="px-lg pt-md pb-lg">
        <Text variant="h2">Armemosla</Text>
        <Text variant="bodySecondary" className="mt-xs">
          Reservá cancha o unite a un partido que busca rival
        </Text>
      </View>
      <Divider className="my-0" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-md pb-xxl gap-md"
        showsVerticalScrollIndicator={false}
      >
        {cards.map((card) => (
          <Card
            key={card.key}
            onPress={card.onPress}
            className="flex-row items-center gap-md"
            style={card.primary ? { borderColor: colors.primary + '50', borderWidth: 1.5 } : undefined}
          >
            <View
              className="w-[52px] h-[52px] rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.primary + '18' }}
            >
              <Ionicons name={card.icon} size={28} color={colors.primary} />
            </View>
            <View className="flex-1 min-w-0">
              <Text variant="label" className="font-bold mb-xs">
                {card.title}
              </Text>
              <Text variant="caption">{card.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Card>
        ))}

        <Button
          variant="ghost"
          onPress={() => router.push('/(tabs)/armemosla/buscar-rival')}
          className="py-lg mt-sm"
        >
          <View className="flex-row items-center gap-xs">
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <Text variant="body" style={{ color: colors.primary }} className="font-semibold">
              Ver partidos que buscan rival
            </Text>
          </View>
        </Button>
      </ScrollView>
    </Screen>
  );
}
