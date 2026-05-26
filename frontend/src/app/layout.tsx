import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Normador",
  description: "Plataforma local para implementacion normativa asistida por IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
