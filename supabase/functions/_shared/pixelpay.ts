import Settings from 'npm:@pixelpay/sdk-core@2.5.2/lib/models/Settings';
import Card from 'npm:@pixelpay/sdk-core@2.5.2/lib/models/Card';
import Billing from 'npm:@pixelpay/sdk-core@2.5.2/lib/models/Billing';
import Item from 'npm:@pixelpay/sdk-core@2.5.2/lib/models/Item';
import Order from 'npm:@pixelpay/sdk-core@2.5.2/lib/models/Order';
import Environment from 'npm:@pixelpay/sdk-core@2.5.2/lib/resources/Environment';
import SaleTransaction from 'npm:@pixelpay/sdk-core@2.5.2/lib/requests/SaleTransaction';
import CardTokenization from 'npm:@pixelpay/sdk-core@2.5.2/lib/requests/CardTokenization';
import Transaction from 'npm:@pixelpay/sdk-core@2.5.2/lib/services/Transaction';
import Tokenization from 'npm:@pixelpay/sdk-core@2.5.2/lib/services/Tokenization';
import TransactionResult from 'npm:@pixelpay/sdk-core@2.5.2/lib/entities/TransactionResult';
import SuccessResponse from 'npm:@pixelpay/sdk-core@2.5.2/lib/responses/SuccessResponse';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface AdminBillingContext {
  customer_name: string;
  customer_email: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_country: string;
  billing_phone: string;
}

export interface CardInput {
  number: string;
  cvv2: string;
  expire_month: number;
  expire_year: number;
  cardholder: string;
}

let settingsPromise: Promise<InstanceType<typeof Settings>> | null = null;

async function sha512Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getPixelPayCurrency(): string {
  return (Deno.env.get('PIXELPAY_CURRENCY') ?? 'HNL').toUpperCase();
}

export function isPixelPaySandbox(): boolean {
  return (Deno.env.get('PIXELPAY_MODE') ?? 'sandbox') !== 'production';
}

/** Settings según docs: endpoint, Key ID, Secret Key (SHA512), ambiente SANDBOX/LIVE. */
export async function getPixelPaySettings(): Promise<InstanceType<typeof Settings>> {
  if (!settingsPromise) {
    settingsPromise = (async () => {
      const settings = new Settings();
      const endpoint = (Deno.env.get('PIXELPAY_ENDPOINT') ?? 'https://pixelpay.dev').replace(/\/$/, '');
      const keyId = Deno.env.get('PIXELPAY_KEY_ID');
      const secretKey = Deno.env.get('PIXELPAY_SECRET_KEY');

      if (!keyId || !secretKey) {
        throw new Error('PIXELPAY_KEY_ID o PIXELPAY_SECRET_KEY no configurados en Supabase Secrets');
      }

      settings.setupEndpoint(endpoint);
      settings.setupCredentials(keyId, await sha512Hex(secretKey));
      settings.setupEnvironment(isPixelPaySandbox() ? Environment.SANDBOX : Environment.LIVE);
      settings.setupLanguage('es');

      Transaction.withConcurrency();
      return settings;
    })();
  }
  return settingsPromise;
}

function formatSdkError(response: unknown, prefix: string): string {
  const r = response as {
    message?: string;
    errors?: Record<string, string[]>;
    data?: { response_reason?: string; response_code?: string };
  };

  if (r.errors && Object.keys(r.errors).length > 0) {
    const fields = Object.entries(r.errors)
      .map(([k, v]) => `${k}: ${v.join(', ')}`)
      .join('; ');
    return `${prefix}: ${r.message ?? 'Datos inválidos'} (${fields})`;
  }

  const reason = r.data?.response_reason ?? r.message;
  const code = r.data?.response_code;
  if (reason) {
    return code ? `${prefix}: ${reason} (código ${code})` : `${prefix}: ${reason}`;
  }

  return `${prefix}: respuesta inesperada de PixelPay`;
}

function responseToRecord(response: { toJson?: () => unknown }): Record<string, unknown> {
  if (typeof response.toJson === 'function') {
    return response.toJson() as Record<string, unknown>;
  }
  return response as Record<string, unknown>;
}

function buildBillingModel(ctx: AdminBillingContext): InstanceType<typeof Billing> {
  const billing = new Billing();
  billing.address = ctx.billing_address;
  billing.country = ctx.billing_country;
  billing.state = ctx.billing_state;
  billing.city = ctx.billing_city;
  billing.phone = ctx.billing_phone;
  return billing;
}

function buildCardModel(input: CardInput): InstanceType<typeof Card> {
  const card = new Card();
  card.number = input.number.replace(/\s/g, '');
  card.cvv2 = input.cvv2;
  card.expire_month = input.expire_month;
  card.expire_year = input.expire_year;
  card.cardholder = input.cardholder;
  return card;
}

/** Order + Item según SDK (SaleTransaction.setOrder). */
export function buildPixelPayOrder(params: {
  orderId: string;
  currency: string;
  total: number;
  descripcion: string;
  customerName: string;
  customerEmail: string;
}): InstanceType<typeof Order> {
  const item = new Item();
  item.code = 'FACT';
  item.title = params.descripcion;
  item.price = params.total;
  item.qty = 1;

  const order = new Order();
  order.id = params.orderId;
  order.currency = params.currency;
  order.customer_name = params.customerName;
  order.customer_email = params.customerEmail;
  order.addItem(item);
  return order;
}

async function ensureApprovedSale(
  response: unknown,
  settings: InstanceType<typeof Settings>,
  orderId: string,
  prefix: string
): Promise<{ raw: Record<string, unknown>; result: InstanceType<typeof TransactionResult> }> {
  if (!TransactionResult.validateResponse(response)) {
    throw new Error(formatSdkError(response, prefix));
  }

  const result = TransactionResult.fromResponse(response as InstanceType<typeof SuccessResponse>);

  if (!(response instanceof SuccessResponse) || result.response_approved === false) {
    throw new Error(formatSdkError(response, prefix));
  }

  const secretKey = Deno.env.get('PIXELPAY_SECRET_KEY');
  if (result.payment_hash && secretKey) {
    const tx = new Transaction(settings);
    const valid = tx.verifyPaymentHash(result.payment_hash, orderId, secretKey);
    if (!valid) {
      throw new Error(`${prefix}: verificación payment_hash falló`);
    }
  }

  return { raw: responseToRecord(response as { toJson: () => unknown }), result };
}

function ensureTokenSuccess(response: unknown, prefix: string): Record<string, unknown> {
  if (!(response instanceof SuccessResponse) || !response.success) {
    throw new Error(formatSdkError(response, prefix));
  }
  return responseToRecord(response as { toJson: () => unknown });
}

/** Venta directa con tarjeta (SaleTransaction + Transaction.doSale). */
export async function pixelPaySaleWithCard(params: {
  order: InstanceType<typeof Order>;
  billing: AdminBillingContext;
  card: CardInput;
}): Promise<Record<string, unknown>> {
  const settings = await getPixelPaySettings();
  const sale = new SaleTransaction();
  sale.setOrder(params.order);
  sale.setCard(buildCardModel(params.card));
  sale.setBilling(buildBillingModel(params.billing));

  const service = new Transaction(settings);
  const response = await service.doSale(sale);
  const { raw } = await ensureApprovedSale(response, settings, params.order.id!, 'Pago rechazado');
  return raw;
}

/** Venta con tarjeta tokenizada (sale.setCardToken). */
export async function pixelPaySaleWithToken(params: {
  order: InstanceType<typeof Order>;
  token: string;
}): Promise<Record<string, unknown>> {
  const settings = await getPixelPaySettings();
  const sale = new SaleTransaction();
  sale.setOrder(params.order);
  sale.setCardToken(params.token);

  const service = new Transaction(settings);
  const response = await service.doSale(sale);
  const { raw } = await ensureApprovedSale(response, settings, params.order.id!, 'Pago rechazado');
  return raw;
}

/** Tokenización (CardTokenization + Tokenization.vaultCard). */
export async function pixelPayTokenizeCard(params: {
  card: CardInput;
  billing: AdminBillingContext;
}): Promise<Record<string, unknown>> {
  const settings = await getPixelPaySettings();
  const request = new CardTokenization();
  request.setCard(buildCardModel(params.card));
  request.setBilling(buildBillingModel(params.billing));
  request.email = params.billing.customer_email;

  const service = new Tokenization(settings);
  const response = await service.vaultCard(request);
  return ensureTokenSuccess(response, 'No se pudo guardar la tarjeta');
}

export async function pixelPayDeleteToken(token: string): Promise<void> {
  const settings = await getPixelPaySettings();
  const service = new Tokenization(settings);
  const response = await service.deleteCard(token);
  ensureTokenSuccess(response, 'No se pudo eliminar la tarjeta');
}

export function extractTokenData(data: Record<string, unknown>): {
  token: string;
  marca: string | null;
  ultimos_digitos: string | null;
  exp_mes: number | null;
  exp_anio: number | null;
} {
  const card = (data.data ?? data) as Record<string, unknown>;
  const token = String(card.token ?? '');
  const network = card.network ? String(card.network) : null;
  const last = card.last ? String(card.last) : null;
  const mask = card.mask ? String(card.mask) : null;
  const ultimos = last ?? (mask ? mask.slice(-4) : null);
  return {
    token,
    marca: network,
    ultimos_digitos: ultimos,
    exp_mes: null,
    exp_anio: null,
  };
}

export function extractSaleIds(data: Record<string, unknown>): {
  transaction_id: string | null;
  payment_uuid: string | null;
} {
  const tx = (data.data ?? {}) as Record<string, unknown>;
  return {
    transaction_id: tx.transaction_id ? String(tx.transaction_id) : null,
    payment_uuid: tx.payment_uuid ? String(tx.payment_uuid) : null,
  };
}

export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length >= 7) return digits.slice(0, 15);
  return '99999999';
}

export function buildBillingFromProfile(
  profile: { full_name?: string | null; phone?: string | null; email?: string | null } | null,
  userEmail: string | undefined
): AdminBillingContext {
  return {
    customer_name: profile?.full_name?.trim() || 'Administrador',
    customer_email: profile?.email?.trim() || userEmail || 'admin@armemosla.app',
    billing_address: 'Centro',
    billing_city: 'San Pedro Sula',
    billing_state: 'HN-CR',
    billing_country: 'HN',
    billing_phone: normalizePhone(profile?.phone),
  };
}
