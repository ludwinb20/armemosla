import { Suspense } from 'react';
import { Loader } from '@/components/Loader';
import ReservasPageClient from './ReservasPageClient';

export default function ReservasPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ReservasPageClient />
    </Suspense>
  );
}
