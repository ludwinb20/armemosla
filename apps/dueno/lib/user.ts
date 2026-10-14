import { supabase } from './supabase';
import {
  ensureAppRole as sharedEnsureAppRole,
  getCurrentProfile as sharedGetCurrentProfile,
  getIsPlatformAdmin as sharedGetIsPlatformAdmin,
  getUserType as sharedGetUserType,
  hasUserType as sharedHasUserType,
  updateProfile as sharedUpdateProfile,
  type AppUserRole,
  type UpdateProfileData,
  type UserProfile,
} from '@armemosla/shared';
import { APP_HOME_ROUTE, APP_ROLE } from '@/constants/appRole';

export type { AppUserRole, UpdateProfileData, UserProfile };

export async function hasUserType(): Promise<boolean> {
  return sharedHasUserType(supabase);
}

export async function getUserType(): Promise<AppUserRole | null> {
  return sharedGetUserType(supabase);
}

export async function getIsPlatformAdmin(): Promise<boolean> {
  return sharedGetIsPlatformAdmin(supabase);
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  return sharedGetCurrentProfile(supabase);
}

export async function updateProfile(updates: UpdateProfileData): Promise<UserProfile> {
  return sharedUpdateProfile(supabase, updates);
}

/** Asigna o valida el rol fijo de esta app. */
export async function ensureAppRole(): Promise<UserProfile> {
  return sharedEnsureAppRole(supabase, APP_ROLE);
}

/** Ruta inicial tras login o al abrir la app (solo si el rol es válido). */
export async function getInitialAppRoute(): Promise<string> {
  await ensureAppRole();
  return APP_HOME_ROUTE;
}
