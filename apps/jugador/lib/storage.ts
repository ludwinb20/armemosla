import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

/**
 * Sube una imagen a Supabase Storage
 * @param uri - URI local de la imagen
 * @param bucket - Nombre del bucket de storage
 * @param path - Ruta donde guardar la imagen (ej: 'complejos/logo-123.jpg')
 * @returns URL pública de la imagen subida
 */
export async function uploadImage(
  uri: string,
  bucket: string,
  path: string
): Promise<string> {
  try {
    // Obtener el tipo MIME de la imagen
    const fileExtension = uri.split('.').pop()?.toLowerCase();
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    // Leer el archivo como base64 usando expo-file-system legacy API
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convertir base64 a ArrayBuffer
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Subir a Supabase Storage usando el ArrayBuffer
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, byteArray, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('❌ [uploadImage] Error al subir imagen:', error);
      throw error;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('✅ [uploadImage] Imagen subida exitosamente:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error: any) {
    console.error('❌ [uploadImage] Error general:', error);
    throw new Error(`Error al subir imagen: ${error.message}`);
  }
}

/**
 * Elimina una imagen de Supabase Storage
 * @param bucket - Nombre del bucket
 * @param path - Ruta de la imagen a eliminar
 */
export async function deleteImage(bucket: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('❌ [deleteImage] Error al eliminar imagen:', error);
      throw error;
    }

    console.log('✅ [deleteImage] Imagen eliminada exitosamente');
  } catch (error: any) {
    console.error('❌ [deleteImage] Error general:', error);
    throw new Error(`Error al eliminar imagen: ${error.message}`);
  }
}

/**
 * Extrae el path de una URL de Supabase Storage
 * @param url - URL pública de Supabase Storage
 * @returns Path relativo de la imagen
 */
export function extractPathFromUrl(url: string): string {
  // Las URLs de Supabase Storage tienen el formato:
  // https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
  const parts = url.split('/');
  const bucketIndex = parts.findIndex((part) => part === 'public') + 1;
  return parts.slice(bucketIndex).join('/');
}

