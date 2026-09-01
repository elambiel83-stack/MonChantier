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
    <div className="dashboard-shell min-h-screen bg-[#f4f6f2] text-slate-800 lg:flex">
      <DashboardSidebar sessionRole={role} />
      <main className="dashboard-content flex-1 px-5 py-7 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
