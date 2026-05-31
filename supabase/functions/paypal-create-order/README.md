# PayPal — pagos seguros con tarjeta

## Experiencia del administrador

1. **Pagos → Pagar factura** abre pantalla dedicada.
2. **Tarjetas guardadas**: pago en un toque (servidor cobra con token vault; sin reingresar tarjeta).
3. **Agregar tarjeta** o **Pagar con otra tarjeta**: checkout en WebView (página segura de PayPal).
4. Tras pagar, vuelve a la app automáticamente.

## Seguridad (PCI)

| Dónde | Qué se guarda |
|-------|----------------|
| App | Nada sensible — solo tokens de sesión Supabase |
| Supabase DB | `paypal_vault_id`, últimos 4 dígitos, marca (nunca PAN ni CVV) |
| Edge Functions | `PAYPAL_CLIENT_SECRET` (solo servidor) |
| PayPal | Datos completos de tarjeta |

La app **nunca** toca números de tarjeta. PayPal tokeniza y vaultea; nosotros guardamos referencias.

## SQL

- `41_pagos_paypal.sql`
- `42_metodos_pago_paypal.sql`

## Edge Functions

| Función | Uso |
|---------|-----|
| `paypal-create-order` | Crear checkout para factura |
| `paypal-capture-order` | Confirmar cobro (app/deep link) |
| `paypal-pay-saved` | Cobrar con tarjeta guardada |
| `paypal-add-card` | Iniciar vault de nueva tarjeta |
| `paypal-complete-add-card` | Confirmar tarjeta tras checkout (setup → payment token) |
| `paypal-payment-methods` | Listar / eliminar / predeterminado |
| `paypal-webhook` | Captura automática + guardar tarjetas |
| `paypal-return-redirect` | HTTPS → `armemosla://pagos/return` |
| `paypal-cancel-redirect` | Cancelación → app |

## Secrets

`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_CURRENCY`, `PAYPAL_WEBHOOK_ID`

## Webhook eventos

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `VAULT.PAYMENT-TOKEN.CREATED`

## Requisito PayPal

Activar **Advanced Credit and Debit Card Processing** y **Vault** en tu app REST de PayPal Developer.

## Deploy

```bash
pnpm exec supabase functions deploy paypal-create-order
pnpm exec supabase functions deploy paypal-capture-order
pnpm exec supabase functions deploy paypal-pay-saved
pnpm exec supabase functions deploy paypal-add-card
pnpm exec supabase functions deploy paypal-complete-add-card
pnpm exec supabase functions deploy paypal-payment-methods
pnpm exec supabase functions deploy paypal-webhook
pnpm exec supabase functions deploy paypal-return-redirect
pnpm exec supabase functions deploy paypal-cancel-redirect
```

Rebuild dev client tras instalar `react-native-webview`.
