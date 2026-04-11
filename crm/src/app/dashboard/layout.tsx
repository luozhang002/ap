import { CrmDashboardShell } from "./CrmDashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <CrmDashboardShell>{children}</CrmDashboardShell>;
}
