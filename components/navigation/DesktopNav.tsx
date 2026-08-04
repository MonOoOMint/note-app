"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Bookmark, FileText, User } from "lucide-react";

export function DesktopNav() {
  const pathname = usePathname();

  const links = [
    { href: "/todos", icon: CheckSquare, label: "Todo List" },
    { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
    { href: "/notes", icon: FileText, label: "Quick Note" },
  ];

  return (
    <header className="hidden md:flex h-16 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-gray-200/80 dark:border-zinc-800/80 px-6 items-center justify-between shrink-0 z-40 transition-colors">
      {/* Brand Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
          M
        </div>
        <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
          MyApp
        </span>
      </div>
      
      {/* Center Navigation Tabs */}
      <nav className="flex items-center space-x-1.5 bg-zinc-100/90 dark:bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
                isActive 
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-semibold shadow-sm" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-blue-600 dark:text-blue-400" : ""} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* Right User Actions */}
      <div className="flex items-center space-x-3">
        <button className="flex items-center space-x-2 px-3 py-2 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
            <User size={16} />
          </div>
          <span className="text-sm font-medium hidden lg:inline">Profile</span>
        </button>
      </div>
    </header>
  );
}
