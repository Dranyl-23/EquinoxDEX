import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import { NetworkBanner } from "@/components/NetworkBanner";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SettingsProvider } from "@/components/SettingsProvider";

export const metadata: Metadata = {
  title: "EquinoxDEX | Next-Gen Cross-Margin Perpetual DEX",
  description: "Institutional Trading Engine on Stellar Soroban. Ephemeral 1-Click Trading & Cross-Margin Architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-brand selection:text-white font-sans">
        <WalletProvider>
          <LanguageProvider>
            <SettingsProvider>
              <ToastProvider>
                <NetworkBanner />
                <Navbar />
                {children}
              </ToastProvider>
            </SettingsProvider>
          </LanguageProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
