#!/usr/bin/env node
/**
 * Envía una notificación push de prueba vía Expo Push API.
 *
 * Uso:
 *   pnpm test:push ExponentPushToken[xxxx] "Título" "Mensaje"
 *   pnpm test:push --token ExponentPushToken[xxxx] --title "Hola" --body "Prueba"
 *
 * Obtén el token en consola al abrir la app en un dispositivo físico.
 * Prueba alternativa: https://expo.dev/notifications
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPushReceipt(ticketId) {
  await sleep(3000);
  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });
  const json = await res.json();
  return json?.data?.[ticketId] ?? null;
}

function printUsage() {
  console.log(`
Uso:
  pnpm test:push <ExponentPushToken[...]> [título] [mensaje]

  pnpm test:push --token ExponentPushToken[...] --title "Título" --body "Mensaje"
  pnpm test:push --token ExponentPushToken[...] --title "Título" --body "Mensaje" --data '{"type":"test"}'

Opciones:
  --token, -t     Token Expo (obligatorio)
  --title         Título (default: "Prueba armemosla")
  --body, -b      Cuerpo (default: "Push de prueba")
  --data, -d      JSON opcional en data (ej. '{"type":"test"}')
  --help, -h      Esta ayuda
`);
}

function parseArgs(argv) {
  const positional = [];
  let token = process.env.EXPO_PUSH_TOKEN;
  let title = 'Prueba armemosla';
  let body = 'Push de prueba desde scripts/test-push-notification.mjs';
  let dataJson = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--token' || arg === '-t') {
      token = argv[++i];
      continue;
    }
    if (arg === '--title') {
      title = argv[++i];
      continue;
    }
    if (arg === '--body' || arg === '-b') {
      body = argv[++i];
      continue;
    }
    if (arg === '--data' || arg === '-d') {
      dataJson = argv[++i];
      continue;
    }
    if (arg.startsWith('-')) {
      console.error(`Opción desconocida: ${arg}`);
      printUsage();
      process.exit(1);
    }
    positional.push(arg);
  }

  if (!token && positional[0]?.startsWith('ExponentPushToken[')) {
    token = positional.shift();
  }
  if (positional[0]) title = positional[0];
  if (positional[1]) body = positional[1];

  let data;
  if (dataJson) {
    try {
      data = JSON.parse(dataJson);
    } catch {
      console.error('❌ --data debe ser JSON válido');
      process.exit(1);
    }
  } else {
    data = { type: 'test', source: 'test-push-notification.mjs' };
  }

  return { token, title, body, data };
}

async function main() {
  const { token, title, body, data } = parseArgs(process.argv.slice(2));

  if (!token) {
    console.error('❌ Falta el token Expo.\n');
    printUsage();
    process.exit(1);
  }

  if (!token.startsWith('ExponentPushToken[')) {
    console.warn('⚠️  El token no parece un Expo Push Token (debería empezar con ExponentPushToken[).');
  }

  const payload = {
    to: token,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  };

  console.log('📤 Enviando push a Expo...\n', JSON.stringify(payload, null, 2), '\n');

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error('❌ Error HTTP', res.status, json);
    process.exit(1);
  }

  console.log('✅ Respuesta Expo:\n', JSON.stringify(json, null, 2));

  const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
  if (ticket?.status === 'error') {
    console.error('\n❌ Expo rechazó el envío:', ticket.message, ticket.details ?? '');
    process.exit(1);
  }

  console.log('\n✅ Push encolado. Revisá el dispositivo (foreground y background).');

  const ticketId = ticket?.id;
  if (ticketId) {
    console.log(`\n⏳ Consultando receipt (${ticketId})...`);
    const receipt = await fetchPushReceipt(ticketId);
    if (!receipt) {
      console.warn('⚠️  Receipt aún no disponible. Reintentá en unos segundos en https://expo.dev/notifications');
      return;
    }
    console.log('\n📋 Receipt de entrega:\n', JSON.stringify(receipt, null, 2));
    if (receipt.status === 'error') {
      console.error('\n❌ FCM/APNs rechazó la entrega:', receipt.message, receipt.details ?? '');
      console.error('\nSugerencias:');
      if (receipt.details?.error === 'DeviceNotRegistered') {
        console.error('  - Token viejo: cerrá la app, abrila de nuevo y copiá un token nuevo.');
      }
      process.exit(1);
    }
    console.log('\n✅ Entrega confirmada por Expo/FCM. Si no ves la notificación, revisá permisos y ajustes del teléfono (abajo).');
  }
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
