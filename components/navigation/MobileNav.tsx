"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Bookmark, FileText, User } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { href: "/todos", icon: CheckSquare, label: "Todos" },
    { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
    { href: "/notes", icon: FileText, label: "Notes" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-white/90 dark:bg-[#13171a]/95 backdrop-blur-xl border-t border-gray-200/60 dark:border-zinc-800/80 flex items-center justify-around h-16 z-50 px-3 pb-safe shadow-lg">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 h-full relative transition-all duration-200 flex-1 ${
              isActive 
                ? "text-blue-600 dark:text-blue-400 font-bold translate-y-[-1px]" 
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {isActive && (
              <span className="absolute top-0 w-10 h-1 bg-blue-600 dark:bg-blue-500 rounded-b-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "drop-shadow-sm" : ""} />
            <span className="text-xs tracking-tight">
              {link.label}
            </span>
          </Link>
        );
      })}
      
      <button className="flex flex-col items-center justify-center space-y-1 py-1 px-2.5 h-full text-zinc-500 hover:text-zinc-300 transition-colors flex-1">
        <User size={22} strokeWidth={2} />
        <span className="text-xs font-medium tracking-tight">Profile</span>
      </button>
    </nav>
  );
}
