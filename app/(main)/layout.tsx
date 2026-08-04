import { DesktopNav } from "@/components/navigation/DesktopNav";
import { MobileNav } from "@/components/navigation/MobileNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden relative">
      {/* Top Header Navigation for Desktop */}
      <DesktopNav />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden pb-16 md:pb-0 w-full flex flex-col">
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      <MobileNav />
    </div>
  );
}

