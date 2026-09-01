import { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      identity?: string;
      role?: AppRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    identity?: string;
    role?: AppRole;
  }
}
