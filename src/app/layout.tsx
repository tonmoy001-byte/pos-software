import type { Metadata } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import SWRegister from "@/components/sw-register";
import { Providers } from "@/components/providers";
import { AuthGate } from "@/components/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const hindSiliguri = Hind_Siliguri({ 
  subsets: ["bengali"], 
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind" 
});

export const metadata: Metadata = {
  title: "RetailOS | Unified POS Control Center",
  description: "Cloud-Based Retail ERP/POS for Mobile Phone Shops",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RetailOS",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${hindSiliguri.variable}`}>
      <body className="flex bg-background min-h-screen" suppressHydrationWarning>
        <Providers>
          <AuthGate>
            <SWRegister />
            <SidebarWrapper />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
