import { IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const serif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  variable: '--font-serif',
});

export const metadata = {
  title: 'Trala.la — talking cards',
  description: 'Conversation cards for groups. One question at a time. No account, no setup.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Trala.la' },
};

export const viewport = {
  themeColor: '#0c0c0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
