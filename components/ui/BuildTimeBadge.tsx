"use client";

import React from "react";

export function BuildTimeBadge({ className = "" }: { className?: string }) {
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || "Đang cập nhật";

  return (
    <div className={`px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono text-center select-none ${className}`}>
      Cập nhật: {buildTime}
    </div>
  );
}
