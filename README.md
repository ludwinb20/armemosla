# Armemosla (monorepo)

App de alquiler de canchas y retos. Estructura:

```
apps/jugador     # Expo — jugadores
apps/dueno       # Expo — dueños de cancha
apps/admin-web   # Next.js — superadmin
packages/shared  # Tipos y lógica compartida (Supabase)
db_settings/     # SQL / RLS
supabase/        # Edge Functions
```

## Requisitos

- Node.js 20+
- pnpm 10 (`packageManager` en root)
- Expo / EAS para builds nativos

## Setup

```bash
pnpm install
```

Copiá variables:

- Móviles: `apps/jugador/.env` y `apps/dueno/.env` (mismo formato `EXPO_PUBLIC_*` de antes)
- Admin web: `apps/admin-web/.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Aplicá el CRM en Supabase:

```bash
# Ejecutar en el SQL editor (o tu flujo habitual):
# db_settings/56_prospectos_venues.sql
```

## Scripts

```bash
pnpm jugador          # Expo app jugadores
pnpm dueno            # Expo app dueños
pnpm admin-web        # Next.js en :3001
```

## Roles

- Cada app móvil fija su `user_type` (no hay cambio de rol en Perfil).
- Admin plataforma (`es_admin_plataforma`) solo en `apps/admin-web`.
