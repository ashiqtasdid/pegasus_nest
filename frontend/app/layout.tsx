import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: '🚀 Pegasus Nest - AI Plugin Generator',
  description:
    'Generate custom Minecraft plugins with AI assistance. Create Bukkit/Spigot plugins with intelligent code generation.',
  keywords: [
    'minecraft',
    'plugin',
    'generator',
    'AI',
    'bukkit',
    'spigot',
    'java',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
