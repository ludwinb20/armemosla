import { Suspense } from 'react';
import { Loader } from '@/components/Loader';
import LoginPage from './LoginClient';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="login-wrap">
        <Loader />
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}
