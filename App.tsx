import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from './components/Logo';
import { globalStyles } from './styles/globalStyles';

export default function App() {
  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.contentCentered}>
        <Logo variant="full" format="png" width={700} height={300} />
      </View>
    </SafeAreaView>
  );
}

