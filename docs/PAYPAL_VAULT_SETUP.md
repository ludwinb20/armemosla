# PayPal — activar Vault y tarjetas (sandbox)

El error **"PayPal setup token" / NOT_AUTHORIZED / Vault** significa que tu **app REST de sandbox** aún no puede guardar tarjetas. La app de Armemosla está bien; falta configuración en PayPal.

## Checklist (15 min)

### 1. Entrar al Developer Dashboard

1. [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
2. Arriba a la derecha: modo **Sandbox** (no Live).

### 2. App REST correcta

1. **Apps & Credentials** → sección **Sandbox**.
2. Abrí la app cuyo **Client ID** coincide con `PAYPAL_CLIENT_ID` en Supabase.
3. Si no tenés app, creá **REST API app** → tipo **Merchant**.

### 3. Activar tarjetas (ACDC)

1. En la app → **Features** (o **Sandbox App Settings**).
2. **Accept payments** → marcar:
   - **Advanced Credit and Debit Card Payments**  
     (a veces: *Expanded Credit and Debit Card Payments*)
3. **Save changes**.

### 4. Activar Vault

1. En la misma sección **Accept payments** → **Advanced options**.
2. Marcar **Vault**.
3. **Save**.

### 5. Cuenta business de sandbox

1. **Testing Tools** → **Sandbox accounts**.
2. Usá una cuenta tipo **Business** (no Personal) como merchant de prueba.
3. Si ACDC sigue deshabilitado, entrá a la business en [sandbox.paypal.com](https://www.sandbox.paypal.com) y completá:
   - [Onboarding PPCP sandbox](https://www.sandbox.paypal.com/bizsignup/entry/product/ppcp)

### 6. Secrets en Supabase

En **Project Settings → Edge Functions → Secrets**:

| Secret | Valor |
|--------|--------|
| `PAYPAL_CLIENT_ID` | Client ID de **esa** app sandbox |
| `PAYPAL_CLIENT_SECRET` | Secret de la misma app |
| `PAYPAL_MODE` | `sandbox` |
| `PAYPAL_CURRENCY` | `USD` (o la moneda que uses) |

Redeploy después de cambiar secrets:

```bash
pnpm exec supabase functions deploy paypal-add-card
pnpm exec supabase functions deploy paypal-complete-add-card
```

### 7. Probar

1. **Agregar tarjeta** en la app.
2. En Metro deberías ver `[PayPal:add-card:start] OK`.
3. Si falla, copiá el log `[PayPal:add-card:start] error` (incluye `details` y mensaje PayPal).

## Errores frecuentes

| Síntoma | Causa |
|---------|--------|
| NOT_AUTHORIZED | Vault o ACDC no activos en la app |
| Credenciales live + `PAYPAL_MODE=sandbox` | Mezcla sandbox/live |
| App distinta a la de Supabase | Client ID no coincide |
| Cuenta Personal sandbox | Vault requiere Business |

## Producción (live)

Para cobrar de verdad hace falta onboarding de comercio en live y aprobación de PayPal para tarjetas. Hasta entonces, probá todo en sandbox.
