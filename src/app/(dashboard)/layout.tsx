import { TopBar } from "@/components/fleet/top-bar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { PageTransition } from "@/components/motion/page-transition";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <TopBar />
      <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <PageTransition>{children}</PageTransition>
      </main>
      <OnboardingOverlay />
    </MotionProvider>
  );
}
