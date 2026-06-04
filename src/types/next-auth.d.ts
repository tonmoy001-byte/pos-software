import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string;
      storeName: string;
      storeStatus?: string;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    storeId: string;
    storeName: string;
    storeStatus?: string;
    onboardingComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    storeId: string;
    storeName: string;
    storeStatus?: string;
    onboardingComplete: boolean;
  }
}
