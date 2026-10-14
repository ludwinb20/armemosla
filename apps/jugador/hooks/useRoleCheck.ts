import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ensureAppRole } from '../lib/user';
import { useUserType } from '../contexts/UserTypeContext';
import { APP_ROLE } from '@/constants/appRole';

export function useRoleCheck() {
  const router = useRouter();
  const { setUserType, loadingUserType, refreshUserType } = useUserType();
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

        try {
          const profile = await ensureAppRole();
          setUserType(profile.user_type);
          setHasAccess(true);
        } catch (roleError: unknown) {
          const message =
            roleError instanceof Error
              ? roleError.message
              : `Esta cuenta no es de tipo ${APP_ROLE}.`;
          Alert.alert('App incorrecta', message, [
            {
              text: 'Cerrar sesión',
              onPress: async () => {
                await supabase.auth.signOut();
                router.replace('/login');
              },
            },
          ]);
          setHasAccess(false);
        }
      } catch (error) {
        console.error('❌ [useRoleCheck] Error:', error);
        router.replace('/login');
        setHasAccess(false);
      } finally {
        setIsChecking(false);
      }
    };

    void checkRole();
  }, [loadingUserType, router, setUserType, refreshUserType]);

  return { isChecking: loadingUserType || isChecking, hasAccess };
}
