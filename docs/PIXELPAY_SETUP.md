# PixelPay — configuración

Integración con el **[PixelPay SDK 2.x](https://docs.pixelpay.app/docs/es/sdk/getting-started)** en Edge Functions (backend). La app solo envía datos de tarjeta al servidor; **no** usa WebView ni redirección.

## Arquitectura (según docs)

| Capa | Responsabilidad |
|------|-----------------|
| **App (React Native)** | Formulario de tarjeta → Edge Functions |
| **Edge Functions** | `@pixelpay/sdk-core`: `Settings`, `Order`, `SaleTransaction`, `Transaction.doSale`, `Tokenization.vaultCard` |
| **PixelPay** | Cobro y tokenización |

Como indica la documentación, las operaciones del SDK (excepto `withAuthenticationRequest` para 3DS) se ejecutan en el **backend**.

## Secrets en Supabase

**Project Settings → Edge Functions → Secrets:**

| Secret | Descripción |
|--------|-------------|
| `PIXELPAY_ENDPOINT` | Dominio del comercio (Preferences → API Options). Sandbox: `https://pixelpay.dev` |
| `PIXELPAY_KEY_ID` | Key ID |
| `PIXELPAY_SECRET_KEY` | Secret Key en **texto plano** (el servidor la hashea SHA512 y valida `payment_hash`) |
| `PIXELPAY_MODE` | `sandbox` o `production` |
| `PIXELPAY_CURRENCY` | `HNL` |

Referencia: [Extracción de endpoint y llaves](https://docs.pixelpay.app/docs/es/sdk/endpoint-and-key-extraction)

## SQL

```text
db_settings/47_pagos_pixelpay.sql
```

## Deploy

```bash
pnpm exec supabase functions deploy pixelpay-charge
pnpm exec supabase functions deploy pixelpay-tokenize
pnpm exec supabase functions deploy pixelpay-payment-methods
```

## Sandbox — tarjetas de prueba

- `4111111111111111`
- `5555555555554444`
- CVV: `999`

Ver [casos de uso sandbox](https://docs.pixelpay.app/docs/en/sandbox/use-cases).

## Flujo implementado

1. **Cobro con tarjeta nueva**: `SaleTransaction` + `Card` + `Billing` → `Transaction.doSale`
2. **Cobro con tarjeta guardada**: `SaleTransaction` + `setCardToken(token)`
3. **Guardar tarjeta**: `CardTokenization` → `Tokenization.vaultCard`
4. **Validación**: `TransactionResult.validateResponse` + `verifyPaymentHash`

## Respuestas de error

El SDK devuelve `{ success, message, data, errors }`. Los errores de validación (422) incluyen el objeto `errors` por campo — esos mensajes se propagan a la app.
