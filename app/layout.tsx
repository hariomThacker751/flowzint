import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowzint",
  description: "AI-native WhatsApp sales operating dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}


