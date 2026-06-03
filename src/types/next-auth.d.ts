import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string;
      storeName: string;
      status: string;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    storeId: string;
    storeName: string;
    status: string;
    onboardingComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    storeId: string;
    storeName: string;
    status: string;
    onboardingComplete: boolean;
  }
}
