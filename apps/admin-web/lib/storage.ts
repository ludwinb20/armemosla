import type { SupabaseClient } from '@supabase/supabase-js';

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadComplejoImage(
  supabase: SupabaseClient,
  complejoId: string,
  file: File,
  folder: 'logo' | 'fotos'
): Promise<string> {
  const ext = extensionFor(file);
  const name =
    folder === 'logo'
      ? `logo-${Date.now()}.${ext}`
      : `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `complejos/${complejoId}/${folder}/${name}`;
  return uploadImage(supabase, 'complejos', path, file);
}

export async function uploadCanchaImage(
  supabase: SupabaseClient,
  canchaId: string,
  file: File
): Promise<string> {
  const ext = extensionFor(file);
  const name = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `canchas/${canchaId}/fotos/${name}`;
  return uploadImage(supabase, 'canchas', path, file);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
