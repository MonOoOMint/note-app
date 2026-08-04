"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Bookmark, FileText, User } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { href: "/todos", icon: CheckSquare, label: "Todos" },
    { href: "/notes", icon: FileText, label: "Notes" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-zinc-800/50 flex items-center justify-around h-16 z-50 px-2 pb-safe">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center space-y-1 w-16 h-full relative transition-all duration-300 ${
              isActive 
                ? "text-blue-600 dark:text-blue-500 translate-y-[-2px]" 
                : "text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400"
            }`}
          >
            {isActive && (
              <span className="absolute -top-1 w-8 h-1 bg-blue-600 dark:bg-blue-500 rounded-b-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "drop-shadow-sm" : ""} />
            <span className={`text-[10px] font-medium transition-all ${isActive ? "font-bold" : ""}`}>
              {link.label}
            </span>
          </Link>
        );
      })}
      
      <button className="flex flex-col items-center justify-center space-y-1 w-16 h-full text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
        <User size={22} strokeWidth={2} />
        <span className="text-[10px] font-medium">Profile</span>
      </button>
    </nav>
  );
}
