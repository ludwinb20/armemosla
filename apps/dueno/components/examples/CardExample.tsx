import React from 'react';
import { View, Text } from 'react-native';
import { globalStyles } from '../../styles/globalStyles';
import { Spacing } from '../../constants/theme';

/**
 * Ejemplos de cards usando el sistema de estilos
 */
export const CardExamples = () => {
  return (
    <View style={{ padding: Spacing.md, gap: Spacing.md }}>
      {/* Card básica */}
      <View style={globalStyles.card}>
        <Text style={globalStyles.heading3}>Card Básica</Text>
        <Text style={globalStyles.body}>
          Esta es una card con sombra suave
        </Text>
      </View>

      {/* Card elevada */}
      <View style={globalStyles.cardElevated}>
        <Text style={globalStyles.heading3}>Card Elevada</Text>
        <Text style={globalStyles.body}>
          Esta es una card con sombra más pronunciada
        </Text>
      </View>
    </View>
  );
};

