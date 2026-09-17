import { AppRole } from "@/lib/roles";
import { TenantRole } from "@/lib/tenantRoleStore";

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      identity?: string;
      role?: AppRole;
      tenantId?: string | null;
      tenantRole?: TenantRole | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    identity?: string;
    role?: AppRole;
    tenantId?: string | null;
    tenantRole?: TenantRole | null;
  }
}
