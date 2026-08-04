"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  buttonText?: string;
  onClose: () => void;
}

export function AlertModal({
  isOpen,
  title,
  message,
  type = "info",
  buttonText = "Đã hiểu",
  onClose,
}: AlertModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (type) {
      case "error":
        return (
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200/60 dark:border-red-500/20 shadow-sm">
            <AlertCircle size={24} />
          </div>
        );
      case "warning":
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-500/20 shadow-sm">
            <AlertTriangle size={24} />
          </div>
        );
      case "success":
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/20 shadow-sm">
            <CheckCircle2 size={24} />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/20 shadow-sm">
            <Info size={24} />
          </div>
        );
    }
  };

  const getButtonClasses = () => {
    switch (type) {
      case "error":
        return "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20";
      default:
        return "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20";
    }
  };

  const defaultTitle = () => {
    switch (type) {
      case "error":
        return "Thông báo lỗi";
      case "warning":
        return "Cảnh báo";
      case "success":
        return "Thành công";
      default:
        return "Thông báo";
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200 z-10">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          {renderIcon()}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {title || defaultTitle()}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-6 font-semibold transition-all ${getButtonClasses()}`}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
