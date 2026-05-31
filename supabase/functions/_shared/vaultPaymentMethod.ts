import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type VaultCard = {
  brand?: string;
  last_digits?: string;
  expiry?: string;
};

export function parseCardExpiry(expiry?: string): { expMes: number | null; expAnio: number | null } {
  if (!expiry) return { expMes: null, expAnio: null };
  const [y, m] = expiry.split('-');
  return {
    expAnio: parseInt(y, 10) || null,
    expMes: parseInt(m, 10) || null,
  };
}

export async function upsertMetodoPagoVault(
  admin: SupabaseClient,
  adminId: string,
  vaultId: string,
  card?: VaultCard
): Promise<void> {
  const { expMes, expAnio } = parseCardExpiry(card?.expiry);

  const { count } = await admin
    .from('metodos_pago_paypal')
    .select('*', { count: 'exact', head: true })
    .eq('admin_id', adminId)
    .eq('activo', true);

  const { error } = await admin.from('metodos_pago_paypal').upsert(
    {
      admin_id: adminId,
      paypal_vault_id: vaultId,
      marca: card?.brand ?? null,
      ultimos_digitos: card?.last_digits ?? null,
      exp_mes: expMes,
      exp_anio: expAnio,
      es_predeterminado: (count ?? 0) === 0,
      activo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'admin_id,paypal_vault_id' }
  );

  if (error) throw new Error(error.message);
}
