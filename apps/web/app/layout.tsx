import type { Metadata } from "next";
import type { ReactNode } from "react";

import { QueryProvider } from "../providers/query-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "SyncSlate",
  description: "A focused workspace for real-time technical interviews.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
