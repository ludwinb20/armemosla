import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getUserType, hasUserType } from '../lib/user';

export function useRoleCheck() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        setIsChecking(true);
        
        // Verificar si el usuario tiene tipo configurado
        const hasType = await hasUserType();
        
        if (!hasType) {
          // Si no tiene tipo, redirigir a selección
          router.replace('/select-user-type');
          setHasAccess(false);
          return;
        }

        // Verificar que el usuario esté autenticado
        const userType = await getUserType();
        
        if (!userType) {
          // Si no puede obtener el tipo, redirigir a login
          router.replace('/login');
          setHasAccess(false);
          return;
        }

        // Usuario tiene tipo configurado, permitir acceso
        setHasAccess(true);
      } catch (error) {
        console.error('❌ [useRoleCheck] Error:', error);
        router.replace('/login');
        setHasAccess(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkRole();
  }, [router]);

  return { isChecking, hasAccess };
}

