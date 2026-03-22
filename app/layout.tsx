import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dodge AI — Order to Cash",
  description: "Graph intelligence for Order-to-Cash workflows",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
