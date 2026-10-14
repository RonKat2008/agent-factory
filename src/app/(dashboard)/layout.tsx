import { TopBar } from "@/components/fleet/top-bar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </>
  );
}
