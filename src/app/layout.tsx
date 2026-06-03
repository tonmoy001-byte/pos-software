import type { Metadata } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getSession } from "@/lib/server/session";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const user = session?.user;

  // Paths that shouldn't show the sidebar
  const noSidebarPaths = ["/auth/", "/onboarding", "/pending-approval", "/setup"];

  // Note: Since this is a server component, we don't have access to the current path easily here
  // without using headers or middleware-passed props.
  // For now, let's keep it simple. If user is not authenticated or in onboarding, don't show sidebar.
  const showSidebar = !!user && user.onboardingComplete && user.status === "ACTIVE";

  return (
    <html lang="en" className={`${inter.variable} ${hindSiliguri.variable}`}>
      <body className="flex bg-background min-h-screen">
        <AuthProvider>
          {showSidebar && <Sidebar userRole={user.role} userId={user.id} />}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
