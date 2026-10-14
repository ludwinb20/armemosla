import { Suspense } from 'react';
import { Loader } from '@/components/Loader';
import CanchasPage from './CanchasPageClient';

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <CanchasPage />
    </Suspense>
  );
}
