import { Stack } from 'expo-router';

/**
 * Stack interno de la pestaña Armemosla: el botón atrás del sistema hace pop
 * al hub en lugar de mezclar historial con otras pestañas (p. ej. Inicio admin).
 */
export default function ArmemoslaStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
