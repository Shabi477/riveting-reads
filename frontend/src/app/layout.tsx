import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Riveting Reads - Learn Spanish Through Stories",
  description: "Interactive Spanish learning with audio stories and tap-to-learn vocabulary",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
