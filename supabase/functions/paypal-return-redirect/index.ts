import { corsHeaders } from '../_shared/paypal.ts';

/** Redirección HTTPS → deep link de la app tras aprobar pago en PayPal. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const facturaId = url.searchParams.get('factura_id') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const modo = url.searchParams.get('modo') ?? '';

  const deepLink =
    modo === 'tarjeta'
      ? `armemosla://pagos/return?modo=tarjeta&token=${encodeURIComponent(token)}`
      : `armemosla://pagos/return?factura_id=${encodeURIComponent(facturaId)}&token=${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pago recibido</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fff; text-align: center; padding: 24px; }
    a { color: #22c55e; }
  </style>
  <script>window.location.replace(${JSON.stringify(deepLink)});</script>
</head>
<body>
  <div>
    <p>Pago procesado. Volviendo a Armemosla…</p>
    <p><a href="${deepLink}">Tocá aquí si no se abre la app</a></p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
});
