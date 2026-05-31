import { corsHeaders } from '../_shared/paypal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const facturaId = url.searchParams.get('factura_id') ?? '';
  const deepLink = `armemosla://pagos/cancel?factura_id=${encodeURIComponent(facturaId)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pago cancelado</title>
  <script>window.location.replace(${JSON.stringify(deepLink)});</script>
</head>
<body style="font-family:system-ui;text-align:center;padding:40px;">
  <p>Pago cancelado.</p>
  <a href="${deepLink}">Volver a Armemosla</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
});
