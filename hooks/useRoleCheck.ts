import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useUserType } from '../contexts/UserTypeContext';

export function useRoleCheck() {
  const router = useRouter();
  const { userType, isPlatformAdmin, loadingUserType } = useUserType();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (loadingUserType) {
      return;
    }

    const checkRole = async () => {
      try {
        setIsChecking(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace('/login');
          setHasAccess(false);
          return;
        }

        if (!userType && !isPlatformAdmin) {
          router.replace('/select-user-type');
          setHasAccess(false);
          return;
        }

        setHasAccess(true);
      } catch (error) {
        console.error('❌ [useRoleCheck] Error:', error);
        router.replace('/login');
        setHasAccess(false);
      } finally {
        setIsChecking(false);
      }
    };

    void checkRole();
  }, [userType, isPlatformAdmin, loadingUserType, router]);

  return { isChecking: loadingUserType || isChecking, hasAccess };
}
