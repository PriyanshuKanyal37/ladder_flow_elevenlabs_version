import AuthGuard from '@/components/auth/AuthGuard';
import { UserProvider } from '@/lib/context/UserContext';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <UserProvider>
        <DashboardShell>{children}</DashboardShell>
      </UserProvider>
    </AuthGuard>
  );
}

