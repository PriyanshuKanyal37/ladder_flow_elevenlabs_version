'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isImmersiveInterview =
    pathname === '/interview' ||
    pathname === '/interview/ui';

  useEffect(() => {
    function syncWithViewport() {
      setSidebarOpen(window.innerWidth >= 768);
    }

    syncWithViewport();
    window.addEventListener('resize', syncWithViewport);
    return () => window.removeEventListener('resize', syncWithViewport);
  }, []);

  return (
    <div className="relative min-h-screen bg-app text-primary">
      <div className="mesh-background" />
      {!isImmersiveInterview && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((current) => !current)}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <main
        className={
          isImmersiveInterview
            ? 'min-h-screen'
            : `min-h-screen overflow-auto pl-0 transition-[padding] duration-300 ${sidebarOpen ? 'md:pl-[240px]' : 'md:pl-[56px]'}`
        }
      >
        {children}
      </main>
    </div>
  );
}
