import { supabase } from './supabase';
import { getDiaSemanaHN, getTimeHMInHN } from './fechaHora';

export interface CanchaBusqueda {
  id: string;
  nombre: string;
  precio_por_hora: number;
  jugadores_por_equipo: number;
  activo: boolean;
  distancia?: number; // Distancia en km desde la ubicación de búsqueda
  disponible: boolean; // Si está disponible en la fecha/hora especificada
  complejo: {
    id: string;
    nombre: string;
    direccion_texto?: string;
    direccion_lat?: number;
    direccion_lng?: number;
  };
  fotos?: Array<{
    id: string;
    foto_url: string;
    orden: number;
  }>;
}

export interface ComplejoBusqueda {
  id: string;
  nombre: string;
  direccion_texto?: string;
  direccion_lat?: number;
  direccion_lng?: number;
  distancia?: number; // Distancia en km desde la ubicación de búsqueda
  tieneDisponibilidad: boolean; // Si tiene al menos una cancha disponible
  canchas: CanchaBusqueda[]; // Canchas del complejo
  fotos?: Array<{
    id: string;
    foto_url: string;
    orden: number;
  }>;
}

export interface FiltrosBusqueda {
  nombre?: string; // Buscar en nombre de complejo o cancha
  precioMin?: number;
  precioMax?: number;
  fechaHora: string; // ISO string, requerido
  lat?: number; // Para ordenar por distancia
  lng?: number; // Para ordenar por distancia
  radioKm?: number; // Radio máximo en km (solo si hay lat/lng)
}

/**
 * Calcula la distancia en km entre dos puntos usando la fórmula de Haversine
 */
export function calcularDistancia(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

type FotoItem = { id: string; foto_url: string; orden: number };

const BATCH_SIZE = 100;

async function obtenerFotosPorCanchas(canchaIds: string[]): Promise<Map<string, FotoItem[]>> {
  const map = new Map<string, FotoItem[]>();
  if (canchaIds.length === 0) return map;

  for (let i = 0; i < canchaIds.length; i += BATCH_SIZE) {
    const chunk = canchaIds.slice(i, i + BATCH_SIZE);
    const { data: fotos } = await supabase
      .from('cancha_fotos')
      .select('id, foto_url, orden, cancha_id')
      .in('cancha_id', chunk)
      .order('orden', { ascending: true });

    for (const foto of fotos || []) {
      const list = map.get(foto.cancha_id) || [];
      list.push({ id: foto.id, foto_url: foto.foto_url, orden: foto.orden });
      map.set(foto.cancha_id, list);
    }
  }

  return map;
}

export async function obtenerFotosPorComplejos(
  complejoIds: string[]
): Promise<Map<string, FotoItem[]>> {
  const map = new Map<string, FotoItem[]>();
  if (complejoIds.length === 0) return map;

  for (let i = 0; i < complejoIds.length; i += BATCH_SIZE) {
    const chunk = complejoIds.slice(i, i + BATCH_SIZE);
    const { data: fotos } = await supabase
      .from('complejo_fotos')
      .select('id, foto_url, orden, complejo_id')
      .in('complejo_id', chunk)
      .order('orden', { ascending: true });

    for (const foto of fotos || []) {
      const list = map.get(foto.complejo_id) || [];
      list.push({ id: foto.id, foto_url: foto.foto_url, orden: foto.orden });
      map.set(foto.complejo_id, list);
    }
  }

  return map;
}

async function obtenerDisponibilidadPorCanchas(
  canchaIds: string[],
  fechaHora: string
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (canchaIds.length === 0) return result;

  const fecha = new Date(fechaHora);
  const fechaFin = new Date(fecha.getTime() + 60 * 60 * 1000);
  const diaSemana = getDiaSemanaHN(fechaHora);
  const hora = getTimeHMInHN(fechaHora);

  for (const id of canchaIds) {
    result.set(id, true);
  }

  const reservadas = new Set<string>();
  const horarioPorCancha = new Map<string, { hora_inicio: string; hora_fin: string }>();

  for (let i = 0; i < canchaIds.length; i += BATCH_SIZE) {
    const chunk = canchaIds.slice(i, i + BATCH_SIZE);

    const [{ data: disponibilidades }, { data: reservas }] = await Promise.all([
      supabase
        .from('cancha_disponibilidad')
        .select('cancha_id, hora_inicio, hora_fin')
        .in('cancha_id', chunk)
        .eq('dia_semana', diaSemana),
      supabase
        .from('reservas')
        .select('cancha_id')
        .in('cancha_id', chunk)
        .eq('estado', 'pendiente')
        .gte('fecha_hora', fecha.toISOString())
        .lt('fecha_hora', fechaFin.toISOString()),
    ]);

    for (const disp of disponibilidades || []) {
      horarioPorCancha.set(disp.cancha_id, disp);
    }
    for (const reserva of reservas || []) {
      reservadas.add(reserva.cancha_id);
    }
  }

  for (const id of canchaIds) {
    const horario = horarioPorCancha.get(id);
    if (horario && (hora < horario.hora_inicio || hora >= horario.hora_fin)) {
      result.set(id, false);
    } else if (reservadas.has(id)) {
      result.set(id, false);
    }
  }

  return result;
}

/**
 * Verifica si una cancha está disponible en una fecha/hora específica
 */
export async function obtenerDisponibilidadCancha(
  canchaId: string,
  fechaHora: string
): Promise<boolean> {
  try {
    const fecha = new Date(fechaHora);
    const fechaFin = new Date(fecha.getTime() + 60 * 60 * 1000);

    // Verificar que la cancha esté activa
    const { data: cancha, error: canchaError } = await supabase
      .from('canchas')
      .select('activo, complejo:complejos(activo)')
      .eq('id', canchaId)
      .single();

    if (canchaError || !cancha || !cancha.activo) {
      return false;
    }

    // Verificar que el complejo esté activo
    const complejo = cancha.complejo as any;
    if (!complejo || !complejo.activo) {
      return false;
    }

    // Verificar disponibilidad por horario de la cancha
    const diaSemana = getDiaSemanaHN(fechaHora);
    const hora = getTimeHMInHN(fechaHora);

    const { data: disponibilidad } = await supabase
      .from('cancha_disponibilidad')
      .select('hora_inicio, hora_fin')
      .eq('cancha_id', canchaId)
      .eq('dia_semana', diaSemana)
      .single();

    // Si no hay disponibilidad configurada, asumir que está disponible
    if (disponibilidad) {
      if (hora < disponibilidad.hora_inicio || hora >= disponibilidad.hora_fin) {
        return false;
      }
    }

    // Verificar si hay reservas en conflicto
    const { data: reservas, error: reservasError } = await supabase
      .from('reservas')
      .select('id')
      .eq('cancha_id', canchaId)
      .eq('estado', 'pendiente')
      .gte('fecha_hora', fecha.toISOString())
      .lt('fecha_hora', fechaFin.toISOString());

    if (reservasError) {
      console.error('Error al verificar reservas:', reservasError);
      return false;
    }

    // Si hay reservas en conflicto, no está disponible
    return !reservas || reservas.length === 0;
  } catch (error: any) {
    console.error('Error al verificar disponibilidad:', error);
    return false;
  }
}

/**
 * Busca canchas por ubicación (cercanas a coordenadas)
 */
export async function buscarCanchasPorUbicacion(
  lat: number,
  lng: number,
  fechaHora: string,
  radioKm: number = 50
): Promise<CanchaBusqueda[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Obtener todas las canchas activas con sus complejos activos
    const { data: canchas, error } = await supabase
      .from('canchas')
      .select(`
        id,
        nombre,
        precio_por_hora,
        jugadores_por_equipo,
        activo,
        complejo:complejos!inner(
          id,
          nombre,
          direccion_texto,
          direccion_lat,
          direccion_lng,
          activo
        )
      `)
      .eq('activo', true)
      .eq('complejos.activo', true);

    if (error) throw error;
    if (!canchas) return [];

    type Candidata = { cancha: (typeof canchas)[number]; distancia: number };
    const candidatas: Candidata[] = [];

    for (const cancha of canchas) {
      const complejo = cancha.complejo as any;

      if (!complejo.activo || !complejo.direccion_lat || !complejo.direccion_lng) {
        continue;
      }

      const distancia = calcularDistancia(
        lat,
        lng,
        parseFloat(complejo.direccion_lat),
        parseFloat(complejo.direccion_lng)
      );

      if (distancia > radioKm) {
        continue;
      }

      candidatas.push({ cancha, distancia });
    }

    const canchaIds = candidatas.map((c) => c.cancha.id);
    const [fotosMap, disponibilidadMap] = await Promise.all([
      obtenerFotosPorCanchas(canchaIds),
      obtenerDisponibilidadPorCanchas(canchaIds, fechaHora),
    ]);

    const resultados: CanchaBusqueda[] = candidatas.map(({ cancha, distancia }) => {
      const complejo = cancha.complejo as any;
      return {
        id: cancha.id,
        nombre: cancha.nombre,
        precio_por_hora: parseFloat(cancha.precio_por_hora),
        jugadores_por_equipo: cancha.jugadores_por_equipo,
        activo: cancha.activo,
        distancia,
        disponible: disponibilidadMap.get(cancha.id) ?? false,
        fotos: fotosMap.get(cancha.id) || [],
        complejo: {
          id: complejo.id,
          nombre: complejo.nombre,
          direccion_texto: complejo.direccion_texto,
          direccion_lat: parseFloat(complejo.direccion_lat),
          direccion_lng: parseFloat(complejo.direccion_lng),
        },
      };
    });

    // Ordenar por distancia
    resultados.sort((a, b) => (a.distancia || 0) - (b.distancia || 0));

    return resultados;
  } catch (error: any) {
    console.error('❌ [buscarCanchasPorUbicacion] Error:', error);
    throw error;
  }
}

/**
 * Busca canchas por filtros (nombre, precio, etc.)
 */
export async function buscarCanchasPorFiltros(
  filtros: FiltrosBusqueda
): Promise<CanchaBusqueda[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    if (!filtros.fechaHora) {
      throw new Error('Fecha y hora son requeridos para buscar canchas');
    }

    // Construir query base
    let query = supabase
      .from('canchas')
      .select(`
        id,
        nombre,
        precio_por_hora,
        jugadores_por_equipo,
        activo,
        complejo:complejos!inner(
          id,
          nombre,
          direccion_texto,
          direccion_lat,
          direccion_lng,
          activo
        )
      `)
      .eq('activo', true)
      .eq('complejos.activo', true);

    // Filtrar por precio
    if (filtros.precioMin !== undefined) {
      query = query.gte('precio_por_hora', filtros.precioMin);
    }
    if (filtros.precioMax !== undefined) {
      query = query.lte('precio_por_hora', filtros.precioMax);
    }

    const { data: canchas, error } = await query;

    if (error) throw error;
    if (!canchas) return [];

    type Candidata = {
      cancha: (typeof canchas)[number];
      distancia?: number;
    };
    const candidatas: Candidata[] = [];

    for (const cancha of canchas) {
      const complejo = cancha.complejo as any;

      if (filtros.nombre) {
        const nombreBusqueda = filtros.nombre.toLowerCase();
        const nombreComplejo = complejo.nombre?.toLowerCase() || '';
        const nombreCancha = cancha.nombre?.toLowerCase() || '';

        if (
          !nombreComplejo.includes(nombreBusqueda) &&
          !nombreCancha.includes(nombreBusqueda)
        ) {
          continue;
        }
      }

      let distancia: number | undefined;
      if (filtros.lat && filtros.lng && complejo.direccion_lat && complejo.direccion_lng) {
        distancia = calcularDistancia(
          filtros.lat,
          filtros.lng,
          parseFloat(complejo.direccion_lat),
          parseFloat(complejo.direccion_lng)
        );

        if (filtros.radioKm && distancia > filtros.radioKm) {
          continue;
        }
      }

      candidatas.push({ cancha, distancia });
    }

    const canchaIds = candidatas.map((c) => c.cancha.id);
    const [fotosMap, disponibilidadMap] = await Promise.all([
      obtenerFotosPorCanchas(canchaIds),
      obtenerDisponibilidadPorCanchas(canchaIds, filtros.fechaHora),
    ]);

    const resultados: CanchaBusqueda[] = candidatas.map(({ cancha, distancia }) => {
      const complejo = cancha.complejo as any;
      return {
        id: cancha.id,
        nombre: cancha.nombre,
        precio_por_hora: parseFloat(cancha.precio_por_hora),
        jugadores_por_equipo: cancha.jugadores_por_equipo,
        activo: cancha.activo,
        distancia,
        disponible: disponibilidadMap.get(cancha.id) ?? false,
        fotos: fotosMap.get(cancha.id) || [],
        complejo: {
          id: complejo.id,
          nombre: complejo.nombre,
          direccion_texto: complejo.direccion_texto,
          direccion_lat: complejo.direccion_lat ? parseFloat(complejo.direccion_lat) : undefined,
          direccion_lng: complejo.direccion_lng ? parseFloat(complejo.direccion_lng) : undefined,
        },
      };
    });

    // Ordenar: primero disponibles, luego por distancia o precio
    resultados.sort((a, b) => {
      // Disponibles primero
      if (a.disponible && !b.disponible) return -1;
      if (!a.disponible && b.disponible) return 1;

      // Si hay distancia, ordenar por distancia
      if (filtros.lat && filtros.lng && a.distancia !== undefined && b.distancia !== undefined) {
        return a.distancia - b.distancia;
      }

      // Sino, ordenar por precio
      return a.precio_por_hora - b.precio_por_hora;
    });

    return resultados;
  } catch (error: any) {
    console.error('❌ [buscarCanchasPorFiltros] Error:', error);
    throw error;
  }
}

/**
 * Agrupa canchas por complejo para mostrar en el mapa
 */
export function agruparCanchasPorComplejo(canchas: CanchaBusqueda[]): ComplejoBusqueda[] {
  const complejosMap = new Map<string, ComplejoBusqueda>();

  for (const cancha of canchas) {
    const complejoId = cancha.complejo.id;
    
    if (!complejosMap.has(complejoId)) {
      complejosMap.set(complejoId, {
        id: complejoId,
        nombre: cancha.complejo.nombre,
        direccion_texto: cancha.complejo.direccion_texto,
        direccion_lat: cancha.complejo.direccion_lat,
        direccion_lng: cancha.complejo.direccion_lng,
        distancia: cancha.distancia,
        tieneDisponibilidad: false,
        canchas: [],
      });
    }

    const complejo = complejosMap.get(complejoId)!;
    complejo.canchas.push(cancha);
    
    // Actualizar distancia (usar la menor si hay múltiples canchas)
    if (cancha.distancia !== undefined) {
      if (complejo.distancia === undefined || cancha.distancia < complejo.distancia) {
        complejo.distancia = cancha.distancia;
      }
    }

    // Si alguna cancha está disponible, el complejo tiene disponibilidad
    if (cancha.disponible) {
      complejo.tieneDisponibilidad = true;
    }
  }

  return Array.from(complejosMap.values());
}

/**
 * Obtiene canchas de un complejo específico con fotos del complejo
 */
export async function obtenerCanchasDeComplejo(
  complejoId: string,
  fechaHora: string
): Promise<{ canchas: CanchaBusqueda[]; fotosComplejo: Array<{ id: string; foto_url: string; orden: number }> }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Obtener complejo con fotos
    const { data: complejo, error: complejoError } = await supabase
      .from('complejos')
      .select('*')
      .eq('id', complejoId)
      .eq('activo', true)
      .single();

    if (complejoError || !complejo) {
      throw new Error('Complejo no encontrado');
    }

    // Obtener fotos del complejo
    const { data: fotosComplejo } = await supabase
      .from('complejo_fotos')
      .select('id, foto_url, orden')
      .eq('complejo_id', complejoId)
      .order('orden', { ascending: true });

    // Obtener canchas del complejo
    const { data: canchas, error: canchasError } = await supabase
      .from('canchas')
      .select('*')
      .eq('complejo_id', complejoId)
      .eq('activo', true);

    if (canchasError) throw canchasError;
    if (!canchas || canchas.length === 0) {
      return { canchas: [], fotosComplejo: fotosComplejo || [] };
    }

    const canchaIds = canchas.map((c) => c.id);
    const [fotosMap, disponibilidadMap] = await Promise.all([
      obtenerFotosPorCanchas(canchaIds),
      obtenerDisponibilidadPorCanchas(canchaIds, fechaHora),
    ]);

    const canchasConDatos: CanchaBusqueda[] = canchas.map((cancha) => ({
      id: cancha.id,
      nombre: cancha.nombre,
      precio_por_hora: parseFloat(cancha.precio_por_hora),
      jugadores_por_equipo: cancha.jugadores_por_equipo,
      activo: cancha.activo,
      disponible: disponibilidadMap.get(cancha.id) ?? false,
      fotos: fotosMap.get(cancha.id) || [],
      complejo: {
        id: complejo.id,
        nombre: complejo.nombre,
        direccion_texto: complejo.direccion_texto,
        direccion_lat: complejo.direccion_lat ? parseFloat(complejo.direccion_lat) : undefined,
        direccion_lng: complejo.direccion_lng ? parseFloat(complejo.direccion_lng) : undefined,
      },
    }));

    return {
      canchas: canchasConDatos,
      fotosComplejo: fotosComplejo || [],
    };
  } catch (error: any) {
    console.error('❌ [obtenerCanchasDeComplejo] Error:', error);
    throw error;
  }
}

/**
 * Obtiene todas las canchas públicas activas (sin filtros)
 * Útil para mostrar todas las opciones disponibles
 */
export async function obtenerTodasLasCanchas(): Promise<CanchaBusqueda[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: canchas, error } = await supabase
      .from('canchas')
      .select(`
        id,
        nombre,
        precio_por_hora,
        jugadores_por_equipo,
        activo,
        complejo:complejos!inner(
          id,
          nombre,
          direccion_texto,
          direccion_lat,
          direccion_lng,
          activo
        )
      `)
      .eq('activo', true)
      .eq('complejos.activo', true)
      .order('precio_por_hora', { ascending: true });

    if (error) throw error;
    if (!canchas) return [];

    return canchas.map((cancha) => {
      const complejo = cancha.complejo as any;
      return {
        id: cancha.id,
        nombre: cancha.nombre,
        precio_por_hora: parseFloat(cancha.precio_por_hora),
        jugadores_por_equipo: cancha.jugadores_por_equipo,
        activo: cancha.activo,
        disponible: false, // Se debe verificar con fecha/hora
        complejo: {
          id: complejo.id,
          nombre: complejo.nombre,
          direccion_texto: complejo.direccion_texto,
          direccion_lat: complejo.direccion_lat ? parseFloat(complejo.direccion_lat) : undefined,
          direccion_lng: complejo.direccion_lng ? parseFloat(complejo.direccion_lng) : undefined,
        },
      };
    });
  } catch (error: any) {
    console.error('❌ [obtenerTodasLasCanchas] Error:', error);
    throw error;
  }
}
