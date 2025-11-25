-- Configuración inicial básica de Supabase
-- Ejecutar este archivo primero

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Política: Los usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Función para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

