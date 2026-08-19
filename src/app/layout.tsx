import type { Metadata, Viewport } from "next";
import { ScenarioProvider } from "@/lib/scenario";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalOps — Data operations control plane",
  description: "A traceable workflow for turning product signals into quality-controlled dataset releases.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#10120f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ScenarioProvider>{children}</ScenarioProvider>
      </body>
    </html>
  );
}
