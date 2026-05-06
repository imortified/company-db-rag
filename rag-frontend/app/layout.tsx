import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AccessibilityProvider } from "@/app/context/AccessibilityContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAG Knowledge Base",
  description: "Ask questions about your company documents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AccessibilityProvider>{children}</AccessibilityProvider>
      </body>
    </html>
  );
}