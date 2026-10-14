import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nativeWindColorScheme } from 'nativewind';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@armemosla_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);
  const syncedToNativeWindRef = useRef<ThemeMode | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (savedTheme === 'light' || savedTheme === 'dark')) {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error('Error al cargar el tema:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading || syncedToNativeWindRef.current === theme) {
      return;
    }
    syncedToNativeWindRef.current = theme;
    nativeWindColorScheme.set(theme);
  }, [theme, isLoading]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState((current) => {
      if (current === newTheme) {
        return current;
      }
      void AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      syncedToNativeWindRef.current = null;
      return newTheme;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      syncedToNativeWindRef.current = null;
      return next;
    });
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
}
