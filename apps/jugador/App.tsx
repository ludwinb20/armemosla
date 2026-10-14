import React from 'react';
import { Logo } from './components/Logo';
import { Screen } from '@/components/ui';

export default function App() {
  return (
    <Screen className="justify-center items-center">
      <Logo variant="full" format="png" width={700} height={300} />
    </Screen>
  );
}
