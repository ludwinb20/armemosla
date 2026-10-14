import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Armemosla',
  description: 'Panel superadmin Armemosla',
  icons: {
    icon: '/icono.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
