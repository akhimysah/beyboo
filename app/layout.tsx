import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOOZZO — Un regard. Votre univers.",
  description: "Dix compagnons et un écran qui vous répond.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
