import { TopBar } from "@/components/fleet/top-bar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="flex-1">{children}</main>
    </>
  );
}
