import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NozesIA - Atendimento Inteligente via WhatsApp",
  description:
    "Plataforma de atendimento automatizado via WhatsApp com Inteligência Artificial para lojas de roupas.",
  keywords: [
    "whatsapp",
    "ia",
    "atendimento",
    "chatbot",
    "automação",
    "loja de roupas",
    "inteligência artificial",
  ],
  authors: [{ name: "NozesIA" }],
  openGraph: {
    title: "NozesIA - Atendimento Inteligente via WhatsApp",
    description: "Atenda seus clientes 24h com Inteligência Artificial",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
