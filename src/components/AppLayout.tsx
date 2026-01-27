import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOfflineDataCache } from '@/hooks/useOfflineDataCache';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Initialize offline data caching
  useOfflineDataCache();

  return (
    <SidebarProvider>
      <OfflineBanner />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
