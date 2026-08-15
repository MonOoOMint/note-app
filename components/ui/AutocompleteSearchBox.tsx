"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Folder, Search, X, Check, Plus, ChevronDown } from "lucide-react";

export interface AutocompleteItem {
  id: string;
  name: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface AutocompleteSearchBoxProps {
  value: string | null;
  onChange: (val: string) => void;
  items: AutocompleteItem[];
  placeholder?: string;
  noneLabel?: string;
  allowNone?: boolean;
  className?: string;
  placement?: "top" | "bottom";
  onCreate?: (name: string) => Promise<string | void> | string | void;
  icon?: React.ReactNode;
}

// Utility hàm chuẩn hoá tiếng Việt không dấu
function normalizeStr(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

export function AutocompleteSearchBox({
  value,
  onChange,
  items = [],
  placeholder = "Tìm hoặc chọn nhóm...",
  noneLabel = "Không phân nhóm",
  allowNone = true,
  className = "",
  placement = "bottom",
  onCreate,
  icon = <Folder size={13} className="text-zinc-400 shrink-0" />
}: AutocompleteSearchBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(() => {
    if (!value) return null;
    return items.find((i) => i.id === value) || null;
  }, [value, items]);

  // Lọc danh sách theo từ khoá nhập
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const query = normalizeStr(searchTerm.trim());
    return items.filter((item) => normalizeStr(item.name).includes(query));
  }, [items, searchTerm]);

  // Click ra ngoài để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!onCreate || !searchTerm.trim()) return;
    const res = await onCreate(searchTerm.trim());
    if (typeof res === "string") {
      onChange(res);
    }
    setIsOpen(false);
    setSearchTerm("");
  };

  // Điều hướng bàn phím (Arrow Up/Down, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        return;
      }
    }

    const totalOptions = filteredItems.length + (allowNone ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (totalOptions || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions) % (totalOptions || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allowNone && highlightedIndex === 0) {
        handleSelect("");
      } else {
        const itemIdx = allowNone ? highlightedIndex - 1 : highlightedIndex;
        if (itemIdx >= 0 && itemIdx < filteredItems.length) {
          handleSelect(filteredItems[itemIdx].id);
        } else if (onCreate && searchTerm.trim() && filteredItems.length === 0) {
          handleCreateNew();
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  const isExactMatch = useMemo(() => {
    if (!searchTerm.trim()) return true;
    return items.some((i) => normalizeStr(i.name) === normalizeStr(searchTerm.trim()));
  }, [items, searchTerm]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Box nhập tìm kiếm & hiển thị giá trị */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center gap-2 px-2.5 h-8 bg-[#1a2024] hover:bg-[#20272c] focus-within:bg-[#14191d] border rounded-xl transition-all cursor-text text-xs ${
          isOpen ? "border-blue-500/80 ring-2 ring-blue-500/15" : "border-zinc-700/80 hover:border-zinc-600"
        }`}
      >
        {icon}

        {/* Khi mở -> Cho gõ tìm kiếm; Khi đóng -> Hiển thị tên đã chọn */}
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : (selectedItem ? selectedItem.name : (value ? "" : noneLabel))}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedItem ? selectedItem.name : placeholder}
          className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-400 outline-none text-xs truncate"
        />

        {/* Nút Xoá lựa chọn / Mũi tên */}
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700/50 transition-colors"
              title="Bỏ chọn"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <ChevronDown size={13} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* DROPDOWN DANH SÁCH GỢI Ý AUTOCOMPLETE */}
      {isOpen && (
        <div
          ref={listRef}
          className={`absolute ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } left-0 w-full min-w-[220px] max-w-[90vw] bg-[#1a2024] border border-zinc-700/80 rounded-xl shadow-2xl z-[90] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header hiển thị từ khoá tìm kiếm nếu có */}
          {searchTerm.trim() && (
            <div className="px-3 py-1.5 bg-[#14191d] border-b border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Lọc theo: &quot;{searchTerm}&quot;</span>
              <span className="font-mono text-zinc-500">{filteredItems.length} kết quả</span>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {/* Lựa chọn 'Không phân nhóm' */}
            {allowNone && !searchTerm.trim() && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                  !value
                    ? "bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/20"
                    : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                  <span className="truncate">{noneLabel}</span>
                </div>
                {!value && <Check size={13} className="text-blue-400 shrink-0 ml-2" />}
              </button>
            )}

            {/* Danh sách các nhóm khớp */}
            {filteredItems.map((item, idx) => {
              const isSelected = value === item.id;
              const isHighlighted = allowNone ? highlightedIndex === idx + 1 : highlightedIndex === idx;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30"
                      : isHighlighted
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {item.icon || <Folder size={13} className="text-blue-400 shrink-0" />}
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {item.badge !== undefined && (
                      <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-1.5 py-0.2 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && <Check size={13} className="text-blue-400 shrink-0" />}
                  </div>
                </button>
              );
            })}

            {/* Khi không có kết quả */}
            {filteredItems.length === 0 && (
              <div className="py-4 px-3 text-center space-y-2">
                <p className="text-xs text-zinc-500">Không tìm thấy nhóm &quot;{searchTerm}&quot;</p>
                {onCreate && !isExactMatch && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="w-full px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus size={13} />
                    <span>Tạo nhóm &quot;{searchTerm.trim()}&quot;</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
