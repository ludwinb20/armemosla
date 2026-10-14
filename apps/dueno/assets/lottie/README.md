# Animaciones Lottie (jugador)

Animaciones vectoriales generadas para Armemosla (soccer, paleta `#00C56E`). Uso interno en la app; estilo flat/minimal.

| Archivo | Variante | Uso |
|---------|----------|-----|
| `soccer-ball-loading.json` | `loading` | Reservado; la carga usa `BouncingSoccerBallLoader` (Reanimated) |
| `soccer-field-empty.json` | `emptyField` | Sin reservas / sin canchas |
| `players-waiting.json` | `waitingPlayers` | Sin rivales, solicitudes o jugadores |
| `trophy-idle.json` | `trophy` | Logros vacíos / motivación |
| `team-jersey.json` | `team` | Sin equipos en perfil |

## Regenerar

```bash
node scripts/generate-lottie-assets.mjs
```

## Native

Tras instalar `lottie-react-native`, hace falta **rebuild del dev client**:

```bash
pnpm run android
# o
pnpm run ios
```
