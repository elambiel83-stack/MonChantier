import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ROLE } from "@/lib/roles";
import DashboardSidebar from "./_components/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const role = session!.user!.role || DEFAULT_ROLE;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 lg:flex">
      <DashboardSidebar sessionRole={role} />
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}
