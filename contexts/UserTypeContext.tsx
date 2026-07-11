import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { getUserType, getIsPlatformAdmin } from '../lib/user';
import { supabase } from '../lib/supabase';

export type AppUserType = 'Jugador' | 'Administrador de Cancha' | null;

interface UserTypeContextType {
  userType: AppUserType;
  isPlatformAdmin: boolean;
  loadingUserType: boolean;
  refreshUserType: (options?: { showLoading?: boolean }) => Promise<AppUserType>;
  setUserType: (type: AppUserType) => void;
}

const UserTypeContext = createContext<UserTypeContextType | undefined>(undefined);

interface UserTypeProviderProps {
  children: ReactNode;
}

export function UserTypeProvider({ children }: UserTypeProviderProps) {
  const [userType, setUserTypeState] = useState<AppUserType>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loadingUserType, setLoadingUserType] = useState(true);

  const refreshUserType = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;
    try {
      if (showLoading) {
        setLoadingUserType(true);
      }
      const [type, platformAdmin] = await Promise.all([
        getUserType(),
        getIsPlatformAdmin(),
      ]);
      setUserTypeState(type);
      setIsPlatformAdmin(platformAdmin);
      return type;
    } catch (error) {
      console.error('Error al obtener tipo de usuario:', error);
      return null;
    } finally {
      if (showLoading) {
        setLoadingUserType(false);
      }
    }
  }, []);

  const setUserType = useCallback((type: AppUserType) => {
    setUserTypeState(type);
    setLoadingUserType(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async (userId: string) => {
      channel = supabase
        .channel(`profile_user_type_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const nextType = payload.new?.user_type as AppUserType | undefined;
            if (nextType) {
              setUserTypeState(nextType);
            } else {
              void refreshUserType({ showLoading: false });
            }
          }
        )
        .subscribe();
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        setUserTypeState(null);
        setIsPlatformAdmin(false);
        setLoadingUserType(false);
        return;
      }

      await refreshUserType({ showLoading: true });
      if (!cancelled) {
        void setupRealtime(session.user.id);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      if (!session?.user) {
        setUserTypeState(null);
        setIsPlatformAdmin(false);
        setLoadingUserType(false);
        return;
      }

      await refreshUserType({ showLoading: _event === 'SIGNED_IN' });
      if (!cancelled) {
        void setupRealtime(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refreshUserType]);

  return (
    <UserTypeContext.Provider value={{ userType, isPlatformAdmin, loadingUserType, refreshUserType, setUserType }}>
      {children}
    </UserTypeContext.Provider>
  );
}

export function useUserType() {
  const context = useContext(UserTypeContext);
  if (context === undefined) {
    throw new Error('useUserType debe usarse dentro de UserTypeProvider');
  }
  return context;
}
