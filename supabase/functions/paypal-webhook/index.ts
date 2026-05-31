import { corsHeaders, jsonResponse } from '../_shared/paypal.ts';
import { captureAndFinalize, getServiceSupabase } from '../_shared/finalizePayPal.ts';
import { upsertMetodoPagoVault } from '../_shared/vaultPaymentMethod.ts';

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    customer?: { id?: string };
    payment_source?: {
      card?: {
        brand?: string;
        last_digits?: string;
        expiry?: string;
      };
    };
    supplementary_data?: {
      related_ids?: { order_id?: string };
    };
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405);
  }

  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
  if (!webhookId) {
    console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID no configurado — omitiendo verificación de firma');
  }

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody) as WebhookEvent;
    const eventType = event.event_type ?? '';

    console.log('[paypal-webhook]', eventType, event.id);

    const admin = getServiceSupabase();

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      if (!orderId) {
        return jsonResponse({ ok: false, error: 'order id missing' }, 400);
      }

      await admin
        .from('pagos_paypal')
        .update({ estado: 'approved', updated_at: new Date().toISOString() })
        .eq('paypal_order_id', orderId);

      const result = await captureAndFinalize(admin, orderId);
      if (!result.ok) {
        console.error('[paypal-webhook] capture failed', result.error);
        await admin
          .from('pagos_paypal')
          .update({ estado: 'failed', error_message: result.error })
          .eq('paypal_order_id', orderId);
        return jsonResponse({ ok: false, error: result.error }, 422);
      }

      return jsonResponse({ ok: true, factura_id: result.factura_id });
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const { data: pago } = await admin
          .from('pagos_paypal')
          .select('estado, factura_id')
          .eq('paypal_order_id', orderId)
          .maybeSingle();

        if (pago?.estado === 'captured') {
          return jsonResponse({ ok: true, factura_id: pago.factura_id, duplicate: true });
        }
      }
      return jsonResponse({ ok: true, ignored: true });
    }

    if (eventType === 'VAULT.PAYMENT-TOKEN.CREATED') {
      const vaultId = event.resource?.id;
      const card = event.resource?.payment_source?.card;
      const customer = event.resource?.customer as
        | { id?: string; merchant_customer_id?: string }
        | undefined;

      let adminId: string | null = null;
      if (customer?.merchant_customer_id) {
        const { data: resolved } = await admin.rpc('admin_id_from_paypal_merchant_customer_id', {
          p_merchant_id: customer.merchant_customer_id,
        });
        adminId = (resolved as string | null) ?? null;
      }
      if (!adminId && customer?.id) {
        adminId = customer.id;
      }

      if (!vaultId || !adminId) {
        return jsonResponse({ ok: false, error: 'vault token sin customer id' }, 400);
      }

      await upsertMetodoPagoVault(admin, adminId, vaultId, card);

      return jsonResponse({ ok: true, vault_id: vaultId });
    }

    return jsonResponse({ ok: true, ignored: true, event_type: eventType });
  } catch (error) {
    console.error('[paypal-webhook]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
