// Ejemplo de uso de autenticación con Supabase
import { supabase } from './supabase';

// Ejemplo: Iniciar sesión con email y contraseña
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Error al iniciar sesión:', error.message);
    return { data: null, error };
  }
  
  return { data, error: null };
}

// Ejemplo: Registrarse con email y contraseña
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    console.error('Error al registrarse:', error.message);
    return { data: null, error };
  }
  
  return { data, error: null };
}

// Ejemplo: Cerrar sesión
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error al cerrar sesión:', error.message);
    return { error };
  }
  
  return { error: null };
}

// Ejemplo: Obtener el usuario actual
export function getCurrentUser() {
  return supabase.auth.getUser();
}

// Ejemplo: Escuchar cambios de autenticación
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}

