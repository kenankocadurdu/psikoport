import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { TwoFactorGuard } from "@/components/auth/two-factor-guard";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const fetchCache = 'default-no-store';
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TwoFactorGuard>
      <div className="min-h-screen flex">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
      <OnboardingWizard />
    </TwoFactorGuard>
  );
}
