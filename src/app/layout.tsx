import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistrar } from "@/components/pwa-registrar";

export const metadata: Metadata = {
  title: { default: "스튜디오 키오스크", template: "%s · 스튜디오 키오스크" },
  description: "사진관 현장 접수와 운영을 위한 멀티테넌트 PWA",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "스튜디오 접수" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><PwaRegistrar />{children}</body></html>;
}
