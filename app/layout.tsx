import type { Metadata, Viewport } from 'next';
import { Kanit, Inter } from 'next/font/google';
import './globals.css';

const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-kanit',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MHNK Police Department - Mahahorn Diwa',
  description: 'ระบบจัดการข้อมูลเจ้าหน้าที่ตำรวจ MHNK — Mahahorn Diwa FiveM Server',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0f1e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanit.variable} ${inter.variable}`}>
      <body>
        <div className="scanner-line" />
        <div className="bg-glow" />
        <div className="bg-dots" />
        <div className="relative z-1">{children}</div>
      </body>
    </html>
  );
}
