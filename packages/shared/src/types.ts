export type AppUserRole = 'Jugador' | 'Administrador de Cancha';

export type EstadoComercial =
  | 'existente'
  | 'en_app'
  | 'ofrecido_rechazado'
  | 'ofrecido_en_proceso';

export const ESTADO_COMERCIAL_LABELS: Record<EstadoComercial, string> = {
  existente: 'Existente (SPS)',
  en_app: 'En la app',
  ofrecido_rechazado: 'Ofrecido — no aceptaron',
  ofrecido_en_proceso: 'Ofrecido — en proceso',
};

/** Colores hex para mapa CRM */
export const ESTADO_COMERCIAL_COLORS: Record<EstadoComercial, string> = {
  existente: '#6B7280',
  en_app: '#16A34A',
  ofrecido_rechazado: '#DC2626',
  ofrecido_en_proceso: '#D97706',
};

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  user_type: AppUserRole | null;
  es_admin_plataforma?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  email?: string;
}

export interface ProspectoVenue {
  id: string;
  nombre: string;
  direccion_texto: string | null;
  direccion_lat: number;
  direccion_lng: number;
  estado_comercial: EstadoComercial;
  complejo_id: string | null;
  notas: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectoCancha {
  id: string;
  prospecto_id: string;
  nombre: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProspectoInput {
  nombre: string;
  direccion_texto?: string | null;
  direccion_lat: number;
  direccion_lng: number;
  estado_comercial?: EstadoComercial;
  complejo_id?: string | null;
  notas?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
}

export interface UpdateProspectoInput {
  nombre?: string;
  direccion_texto?: string | null;
  direccion_lat?: number;
  direccion_lng?: number;
  estado_comercial?: EstadoComercial;
  complejo_id?: string | null;
  notas?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
}

/** Centro por defecto: San Pedro Sula */
export const SPS_MAP_CENTER = { lat: 15.5047, lng: -88.0251 } as const;
export const SPS_MAP_DEFAULT_ZOOM = 12;
