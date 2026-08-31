import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ROLE, roleDashboardPath } from "@/lib/roles";

export default async function DashboardIndexPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role || DEFAULT_ROLE;
  redirect(roleDashboardPath(role));
}
