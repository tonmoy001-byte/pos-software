import type { Metadata } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const hindSiliguri = Hind_Siliguri({ 
  subsets: ["bengali"], 
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind" 
});

export const metadata: Metadata = {
  title: "RetailOS | Unified POS Control Center",
  description: "Cloud-Based Retail ERP/POS for Mobile Phone Shops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // In a real app, we'd get the role from the session
  const mockUserRole = "ADMIN"; 

  return (
    <html lang="en" className={`${inter.variable} ${hindSiliguri.variable}`}>
      <body className="flex bg-background min-h-screen">
        <Sidebar userRole={mockUserRole} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
