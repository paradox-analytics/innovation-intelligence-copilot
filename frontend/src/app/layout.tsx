import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Innovation Intelligence Copilot",
  description:
    "AI-powered multi-agent platform for enterprise technology advisory. Strategic decision support through advanced research, knowledge synthesis, and executive intelligence.",
  keywords: [
    "innovation",
    "intelligence",
    "AI",
    "enterprise",
    "technology advisory",
    "strategic analysis",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
