import { Suspense } from 'react';
import { Loader } from '@/components/Loader';
import UsuariosPageClient from './UsuariosPageClient';

export default function UsuariosPage() {
  return (
    <Suspense fallback={<Loader />}>
      <UsuariosPageClient />
    </Suspense>
  );
}
