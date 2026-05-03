import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string;
      storeName: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    storeId: string;
    storeName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    storeId: string;
    storeName: string;
  }
}
