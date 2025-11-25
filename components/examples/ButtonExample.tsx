import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { globalStyles } from '../../styles/globalStyles';
import { Colors, Spacing } from '../../constants/theme';

/**
 * Ejemplos de botones usando el sistema de estilos
 */
export const ButtonExamples = () => {
  return (
    <View style={{ padding: Spacing.md, gap: Spacing.md }}>
      {/* Botón primario */}
      <TouchableOpacity style={globalStyles.buttonPrimary}>
        <Text style={globalStyles.buttonText}>Botón Primario</Text>
      </TouchableOpacity>

      {/* Botón secundario */}
      <TouchableOpacity style={globalStyles.buttonSecondary}>
        <Text style={globalStyles.buttonText}>Botón Secundario</Text>
      </TouchableOpacity>

      {/* Botón outline */}
      <TouchableOpacity style={globalStyles.buttonOutline}>
        <Text style={globalStyles.buttonTextOutline}>Botón Outline</Text>
      </TouchableOpacity>
    </View>
  );
};

