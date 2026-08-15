"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Edit2, Loader2, Link2, X, Download, Upload, Menu, Lock, LayoutGrid, Columns, ChevronDown, GripVertical, Search, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AlertModal } from "@/components/ui/AlertModal";

interface Board {
  id: string;
  name: string;
  order: number;
}

interface Folder {
  id: string;
  name: string;
  order: number;
  color?: string;
  board_id: string;
}

interface Bookmark {
  id: string;
  folder_id: string;
  title: string;
  url: string;
  favicon_url: string;
  description: string;
  order: number;
}

function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function HighlightText({ text, query, className = "" }: { text: string; query: string; className?: string }) {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const normalizedQuery = normalizeText(query.trim());
  const normalizedText = normalizeText(text);

  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return <span className={className}>{text}</span>;
  }

  const before = text.slice(0, matchIndex);
  const matched = text.slice(matchIndex, matchIndex + query.trim().length);
  const after = text.slice(matchIndex + query.trim().length);

  return (
    <span className={className}>
      {before}
      <mark className="bg-amber-400/30 text-amber-200 font-semibold px-0.5 rounded-sm">{matched}</mark>
      {after}
    </span>
  );
}

interface BookmarksClientProps {
  userId: string;
  initialBoards?: Board[];
  initialFolders?: Folder[];
  initialBookmarks?: Bookmark[];
}

export function BookmarksClient({ 
  userId,
  initialBoards = [],
  initialFolders = [],
  initialBookmarks = []
}: BookmarksClientProps) {
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(initialBoards.length > 0 ? initialBoards[0].id : null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [loading, setLoading] = useState(initialBoards.length === 0 && initialFolders.length === 0);

  // Modals state
  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<{ id?: string, name: string } | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id?: string, board_id?: string, name: string, color: string } | null>(null);

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<{ id?: string, folder_id: string, url: string, title?: string, favicon_url?: string } | null>(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  // Custom Confirm & Alert Dialogs
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "info" | "success" | "error" | "warning";
  }>({
    isOpen: false,
    message: "",
  });

  // Drag & Drop state
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDropSlot, setFolderDropSlot] = useState<{ colIndex: number; rowIndex: number } | null>(null);
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null);
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);
  const dragItemRef = useRef<{ type: 'folder' | 'bookmark'; id: string; folderId?: string } | null>(null);

  // Column Layout Settings State (Tùy chỉnh số cột & độ dãn)
  const [columnCount, setColumnCount] = useState<number | 'auto'>('auto');
  const [gapSize, setGapSize] = useState<number>(20);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const viewSettingsRef = useRef<HTMLDivElement>(null);

  // Search State (Tìm kiếm theo tên hiển thị và URL)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Import/Export state
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Đọc cài đặt số cột & khoảng cách từ localStorage
  useEffect(() => {
    try {
      const savedCols = localStorage.getItem('bookmark_column_count');
      if (savedCols) {
        if (savedCols === 'auto') {
          setColumnCount('auto');
        } else {
          const parsed = parseInt(savedCols, 10);
          if (!isNaN(parsed) && parsed >= 2 && parsed <= 8) {
            setColumnCount(parsed);
          }
        }
      }
      const savedGap = localStorage.getItem('bookmark_gap_size');
      if (savedGap) {
        const parsed = parseInt(savedGap, 10);
        if (!isNaN(parsed) && [12, 16, 20, 24].includes(parsed)) {
          setGapSize(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Phím tắt bàn phím: '/' hoặc 'Ctrl + K' để tìm kiếm, 'Esc' để thoát tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewSettingsRef.current && !viewSettingsRef.current.contains(e.target as Node)) {
        setIsViewSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSetColumnCount = (count: number | 'auto') => {
    setColumnCount(count);
    try {
      localStorage.setItem('bookmark_column_count', count.toString());
    } catch {}
  };

  const handleSetGapSize = (gap: number) => {
    setGapSize(gap);
    try {
      localStorage.setItem('bookmark_gap_size', gap.toString());
    } catch {}
  };

  useEffect(() => {
    if (initialBoards.length === 0 && initialFolders.length === 0) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      const [boardsRes, foldersRes, bookmarksRes] = await Promise.all([
        supabase.from('bookmark_boards').select('*').order('order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('bookmark_folders').select('*').order('order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('bookmarks').select('*').order('order', { ascending: true }).order('created_at', { ascending: true })
      ]);

      if (boardsRes.data) {
        const loadedBoards = boardsRes.data;
        setBoards(loadedBoards);
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('bookmark_active_board_id') : null;
        setActiveBoardId(prev => {
          if (prev && loadedBoards.some(b => b.id === prev)) return prev;
          if (savedId && loadedBoards.some(b => b.id === savedId)) return savedId;
          return loadedBoards[0]?.id || null;
        });
      }
      if (foldersRes.data) {
        setFolders(foldersRes.data);
      }
      if (bookmarksRes.data) {
        setBookmarks(bookmarksRes.data);
      }
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBoard = (id: string) => {
    setActiveBoardId(id);
    try {
      localStorage.setItem('bookmark_active_board_id', id);
    } catch {}
  };

  // Khôi phục board đã lưu trong localStorage khi tải trang
  useEffect(() => {
    try {
      const savedBoardId = localStorage.getItem('bookmark_active_board_id');
      if (savedBoardId && boards.some(b => b.id === savedBoardId)) {
        setActiveBoardId(savedBoardId);
      }
    } catch {}
  }, [boards]);

  // --- BOARD ACTIONS ---
  const handleSaveBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoard || !editingBoard.name.trim()) return;

    if (editingBoard.id) {
      const { data, error } = await supabase.from('bookmark_boards').update({ 
        name: editingBoard.name.trim() 
      }).eq('id', editingBoard.id).select().single();
      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi", message: "Lỗi sửa bảng: " + error.message, type: "error" });
      }
      if (data) setBoards(boards.map(b => b.id === editingBoard.id ? data : b));
    } else {
      const { data, error } = await supabase.from('bookmark_boards').insert({
        user_id: userId,
        name: editingBoard.name.trim(),
        order: boards.length
      }).select().single();
      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi", message: "Lỗi thêm bảng: " + error.message, type: "error" });
      }
      if (data) {
        setBoards([...boards, data]);
        setActiveBoardId(data.id);
        try {
          localStorage.setItem('bookmark_active_board_id', data.id);
        } catch {}
      }
    }
    setIsBoardModalOpen(false);
  };

  const handleDeleteBoard = (id: string) => {
    const boardToDelete = boards.find(b => b.id === id);
    const boardName = boardToDelete ? `"${boardToDelete.name}"` : "bảng này";

    setConfirmConfig({
      isOpen: true,
      title: "Xoá Bảng Bookmark",
      message: `Bạn có chắc chắn muốn xoá ${boardName} và TOÀN BỘ thư mục, liên kết bên trong?`,
      confirmText: "Xoá Bảng",
      variant: "danger",
      onConfirm: async () => {
        const remainingBoards = boards.filter(b => b.id !== id);
        setBoards(remainingBoards);
        setFolders(folders.filter(f => f.board_id !== id));
        if (activeBoardId === id) {
          const nextBoardId = remainingBoards[0]?.id || null;
          setActiveBoardId(nextBoardId);
          try {
            if (nextBoardId) {
              localStorage.setItem('bookmark_active_board_id', nextBoardId);
            } else {
              localStorage.removeItem('bookmark_active_board_id');
            }
          } catch {}
        }
        await supabase.from('bookmark_boards').delete().eq('id', id);
      },
    });
  };

  // --- FOLDER ACTIONS ---
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editingFolder.name.trim()) return;

    const targetBoardId = editingFolder.board_id || activeBoardId;

    if (editingFolder.id) {
      // Edit
      const { data, error } = await supabase.from('bookmark_folders').update({ 
        board_id: targetBoardId,
        name: editingFolder.name.trim(),
        color: editingFolder.color
      }).eq('id', editingFolder.id).select().single();
      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi", message: "Lỗi sửa thư mục: " + error.message, type: "error" });
      }
      if (data) setFolders(folders.map(f => f.id === editingFolder.id ? data : f));
    } else {
      // Create
      const { data, error } = await supabase.from('bookmark_folders').insert({
        user_id: userId,
        board_id: targetBoardId,
        name: editingFolder.name.trim(),
        color: editingFolder.color,
        order: folders.filter(f => f.board_id === targetBoardId).length
      }).select().single();
      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi", message: "Lỗi thêm thư mục: " + error.message, type: "error" });
      }
      if (data) setFolders([...folders, data]);
    }
    setIsFolderModalOpen(false);
  };

  const handleDeleteFolder = (id: string) => {
    const folderToDelete = folders.find(f => f.id === id);
    const folderName = folderToDelete ? `"${folderToDelete.name}"` : "thư mục này";

    setConfirmConfig({
      isOpen: true,
      title: "Xoá Thư mục",
      message: `Bạn có chắc chắn muốn xoá ${folderName} và toàn bộ liên kết bên trong?`,
      confirmText: "Xoá Thư mục",
      variant: "danger",
      onConfirm: async () => {
        setFolders(folders.filter(f => f.id !== id));
        setBookmarks(bookmarks.filter(b => b.folder_id !== id));
        await supabase.from('bookmark_folders').delete().eq('id', id);
      },
    });
  };

  // Helper lấy favicon dự phòng từ Google CDN siêu nhanh và đáng tin cậy
  const getEffectiveFavicon = (url: string, customFavicon?: string) => {
    if (customFavicon && customFavicon.trim() && !customFavicon.includes('localhost')) {
      return customFavicon.trim();
    }
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch (e) {
      return '';
    }
  };

  // --- BOOKMARK ACTIONS ---
  const handleSaveBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark || !editingBookmark.url.trim()) return;

    const url = editingBookmark.url.trim();
    let finalTitle = editingBookmark.title?.trim();
    let faviconUrl = editingBookmark.favicon_url || "";
    let description = "";

    if (editingBookmark.id) {
      // Sửa Bookmark hiện có
      const existing = bookmarks.find(b => b.id === editingBookmark.id);
      if (!finalTitle) {
        finalTitle = existing?.title || url;
      }
      
      // Nếu favicon rỗng hoặc URL thay đổi, tự động lấy favicon mới
      if (!faviconUrl || (existing && existing.url !== url)) {
        faviconUrl = getEffectiveFavicon(url);
      }

      const { data, error } = await supabase
        .from('bookmarks')
        .update({ 
          url: url,
          title: finalTitle,
          favicon_url: faviconUrl
        })
        .eq('id', editingBookmark.id)
        .select()
        .single();

      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi", message: "Lỗi cập nhật bookmark: " + error.message, type: "error" });
      }
      if (data) {
        setBookmarks(bookmarks.map(b => b.id === editingBookmark.id ? data : b));
      }
    } else {
      // Thêm mới Bookmark
      setIsFetchingMeta(true);
      try {
        const res = await fetch('/api/fetch-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        if (res.ok) {
          const meta = await res.json();
          if (!finalTitle) finalTitle = meta.title; // Lấy tự động nếu người dùng không nhập
          faviconUrl = meta.favicon_url || getEffectiveFavicon(url);
          description = meta.description || "";
        }
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
      setIsFetchingMeta(false);

      if (!finalTitle) finalTitle = url; // Fallback
      if (!faviconUrl) faviconUrl = getEffectiveFavicon(url);

      const newBm = {
        user_id: userId,
        folder_id: editingBookmark.folder_id,
        title: finalTitle,
        url: url,
        favicon_url: faviconUrl,
        description: description,
        order: bookmarks.filter(b => b.folder_id === editingBookmark.folder_id).length
      };
      
      // Optimistic
      const tempId = Math.random().toString();
      setBookmarks([...bookmarks, { ...newBm, id: tempId }]);

      const { data, error } = await supabase.from('bookmarks').insert(newBm).select().single();
      if (data) {
        setBookmarks(prev => prev.map(b => b.id === tempId ? data : b));
      } else {
        console.error(error);
        setBookmarks(prev => prev.filter(b => b.id !== tempId));
      }
    }
    setIsBookmarkModalOpen(false);
  };

  const handleDeleteBookmark = async (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
    await supabase.from('bookmarks').delete().eq('id', id);
  };

  // Helper phân chia các folder vào N cột thực sự
  const numCols = columnCount === 'auto' ? 5 : (typeof columnCount === 'number' ? columnCount : 5);

  const getColumnsData = (activeList: Folder[], totalCols: number): Folder[][] => {
    const cols: Folder[][] = Array.from({ length: totalCols }, () => []);
    const sorted = [...activeList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const usesColFormat = sorted.some(f => (f.order ?? 0) >= 1000);
    if (usesColFormat) {
      sorted.forEach(f => {
        const col = Math.floor((f.order ?? 0) / 1000);
        const targetCol = Math.min(Math.max(0, col), totalCols - 1);
        cols[targetCol].push(f);
      });
    } else {
      // Sequential fallback
      sorted.forEach((f, idx) => {
        const targetCol = idx % totalCols;
        cols[targetCol].push(f);
      });
    }
    return cols;
  };

  // --- DRAG AND DROP HANDLERS (PAPALY STYLE) ---
  const handleDragStartBookmark = (e: React.DragEvent, id: string, folderId: string) => {
    e.stopPropagation();
    dragItemRef.current = { type: 'bookmark', id, folderId };
    setDraggedBookmarkId(id);
    setDraggedFolderId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'bookmark', id, folderId }));
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragStartFolder = (e: React.DragEvent, id: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }
    e.stopPropagation();
    dragItemRef.current = { type: 'folder', id };
    setDraggedFolderId(id);
    setDraggedBookmarkId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id }));
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDraggedFolderId(null);
    setDraggedBookmarkId(null);
    setFolderDropSlot(null);
    setDragOverBookmarkId(null);
    setDragOverBoardId(null);
  };

  const handleDragOverCard = (e: React.DragEvent, colIndex: number, rowIndex: number, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const currentDrag = dragItemRef.current;
    if (currentDrag?.type === 'folder') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseY = e.clientY;
      const isTop = mouseY < rect.top + rect.height / 2;
      const targetRow = isTop ? rowIndex : rowIndex + 1;

      if (!folderDropSlot || folderDropSlot.colIndex !== colIndex || folderDropSlot.rowIndex !== targetRow) {
        setFolderDropSlot({ colIndex, rowIndex: targetRow });
      }
    }
  };

  const handleDragOverColumnArea = (e: React.DragEvent, colIndex: number, totalRowsInCol: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const currentDrag = dragItemRef.current;
    if (currentDrag?.type === 'folder') {
      if (!folderDropSlot || folderDropSlot.colIndex !== colIndex || folderDropSlot.rowIndex !== totalRowsInCol) {
        setFolderDropSlot({ colIndex, rowIndex: totalRowsInCol });
      }
    }
  };

  const handleDragOverBookmark = (e: React.DragEvent, targetBookmarkId: string, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const currentDrag = dragItemRef.current;
    if (currentDrag?.type === 'bookmark' && currentDrag.id !== targetBookmarkId) {
      setDragOverBookmarkId(targetBookmarkId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropFolderAt = async (e: React.DragEvent, targetCol: number, targetRow: number) => {
    e.preventDefault();
    e.stopPropagation();

    let draggedId: string | null = dragItemRef.current?.id || null;
    let dragType: string | null = dragItemRef.current?.type || null;

    if (!draggedId || !dragType) {
      try {
        const data = e.dataTransfer.getData('application/json');
        if (data) {
          const parsed = JSON.parse(data);
          draggedId = parsed.id;
          dragType = parsed.type;
        }
      } catch (err) {}
    }

    // Reset drag indicators
    dragItemRef.current = null;
    setFolderDropSlot(null);
    setDraggedFolderId(null);
    setDraggedBookmarkId(null);

    if (dragType !== 'folder' || !draggedId) return;

    const currentActiveFolders = folders.filter(f => f.board_id === activeBoardId);
    const cols = getColumnsData(currentActiveFolders, numCols);

    // Locate source
    let sourceCol = -1;
    let sourceRow = -1;
    let draggedFolder: Folder | null = null;

    for (let c = 0; c < cols.length; c++) {
      const r = cols[c].findIndex(f => f.id === draggedId);
      if (r !== -1) {
        sourceCol = c;
        sourceRow = r;
        draggedFolder = cols[c][r];
        break;
      }
    }

    if (!draggedFolder || sourceCol === -1 || sourceRow === -1) return;

    // Remove from source
    cols[sourceCol].splice(sourceRow, 1);

    // Calculate final target row
    let finalTargetRow = targetRow;
    if (sourceCol === targetCol && sourceRow < targetRow) {
      finalTargetRow = Math.max(0, targetRow - 1);
    }
    finalTargetRow = Math.max(0, Math.min(cols[targetCol].length, finalTargetRow));

    // Insert into target column
    cols[targetCol].splice(finalTargetRow, 0, draggedFolder);

    // Re-index all orders
    const updatedActiveFolders: Folder[] = [];
    cols.forEach((colList, c) => {
      colList.forEach((f, r) => {
        updatedActiveFolders.push({ ...f, order: c * 1000 + r });
      });
    });

    const otherFolders = folders.filter(f => f.board_id !== activeBoardId);
    setFolders([...otherFolders, ...updatedActiveFolders]);

    // Save to DB
    const updates = updatedActiveFolders.map(f => ({
      id: f.id,
      user_id: userId,
      board_id: activeBoardId,
      name: f.name,
      color: f.color,
      order: f.order
    }));
    await supabase.from('bookmark_folders').upsert(updates);
  };

  const handleDropBookmark = async (e: React.DragEvent, targetFolderId: string, targetBookmarkId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    let draggedId: string | null = dragItemRef.current?.id || null;
    let dragType: string | null = dragItemRef.current?.type || null;

    if (!draggedId || !dragType) {
      try {
        const data = e.dataTransfer.getData('application/json');
        if (data) {
          const parsed = JSON.parse(data);
          draggedId = parsed.id;
          dragType = parsed.type;
        }
      } catch (err) {}
    }

    // Reset
    dragItemRef.current = null;
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);

    if (dragType !== 'bookmark' || !draggedId) return;

    const bmToMove = bookmarks.find(b => b.id === draggedId);
    if (!bmToMove) return;

    const targetFolderBookmarks = bookmarks
      .filter(b => b.folder_id === targetFolderId && b.id !== draggedId)
      .sort((a, b) => a.order - b.order);

    let newOrder = targetFolderBookmarks.length;
    if (targetBookmarkId) {
      const targetIdx = targetFolderBookmarks.findIndex(b => b.id === targetBookmarkId);
      if (targetIdx >= 0) {
        newOrder = targetIdx;
      }
    }

    // Splice the dragged item into the new position
    targetFolderBookmarks.splice(newOrder, 0, { ...bmToMove, folder_id: targetFolderId });

    // Update orders for the entire target folder
    const updatedTargetBookmarks = targetFolderBookmarks.map((b, idx) => ({ ...b, order: idx }));

    setBookmarks(prev => {
      const otherBookmarks = prev.filter(b => b.folder_id !== targetFolderId && b.id !== draggedId);
      return [...otherBookmarks, ...updatedTargetBookmarks];
    });

    // Async update to DB
    Promise.all(
      updatedTargetBookmarks.map(b => 
        supabase.from('bookmarks').update({ folder_id: targetFolderId, order: b.order }).eq('id', b.id)
      )
    ).catch(err => console.error("Error updating bookmarks order:", err));
  };

  const handleDropFolderOnBoard = async (e: React.DragEvent, targetBoardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBoardId(null);

    let folderIdToMove = dragItemRef.current?.type === 'folder' ? dragItemRef.current.id : draggedFolderId;
    if (!folderIdToMove) {
      try {
        const json = e.dataTransfer.getData('application/json');
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed.type === 'folder') folderIdToMove = parsed.id;
        }
      } catch (err) {}
    }

    dragItemRef.current = null;
    setDraggedFolderId(null);
    if (!folderIdToMove) return;

    const folderToMove = folders.find(f => f.id === folderIdToMove);
    if (!folderToMove || folderToMove.board_id === targetBoardId) return;

    const targetBoardFolders = folders.filter(f => f.board_id === targetBoardId);
    const newOrder = targetBoardFolders.length;

    // Optimistic Update
    setFolders(prev => prev.map(f => f.id === folderIdToMove ? { ...f, board_id: targetBoardId, order: newOrder } : f));

    // Save to DB
    const { error } = await supabase.from('bookmark_folders').update({ board_id: targetBoardId, order: newOrder }).eq('id', folderIdToMove);
    if (error) {
      setAlertConfig({ isOpen: true, title: "Lỗi", message: "Không thể chuyển cột sang bảng khác: " + error.message, type: "error" });
    }
  };

  // --- IMPORT / EXPORT ---
  const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  const handleExport = () => {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an exported bookmark file -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`;

    const activeFolders = folders.filter(f => f.board_id === activeBoardId).sort((a,b) => a.order - b.order);
    activeFolders.forEach(folder => {
      html += `    <DT><H3>${escapeHtml(folder.name)}</H3>\n    <DL><p>\n`;
      const folderBms = bookmarks.filter(b => b.folder_id === folder.id).sort((a,b) => a.order - b.order);
      folderBms.forEach(bm => {
        html += `        <DT><A HREF="${escapeHtml(bm.url)}" ICON="${escapeHtml(bm.favicon_url || '')}">${escapeHtml(bm.title)}</A>\n`;
      });
      html += `    </DL><p>\n`;
    });
    html += `</DL><p>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      let newFoldersData: any[] = [];
      let newBookmarksData: any[] = [];
      let currentFolderIndex = folders.length;

      const h3s = doc.querySelectorAll('h3');

      Array.from(h3s).forEach((h3, i) => {
        const folderName = h3.textContent?.trim() || "Imported Folder";
        const folderKey = `temp_${i}`;
        
        newFoldersData.push({
          user_id: userId,
          board_id: activeBoardId,
          name: folderName,
          color: 'blue',
          order: currentFolderIndex + i,
          _tempId: folderKey
        });

        let nextEl = h3.nextElementSibling;
        while (nextEl && nextEl.tagName !== 'DL') {
          nextEl = nextEl.nextElementSibling;
        }
        
        if (nextEl) {
          const links = nextEl.querySelectorAll('a');
          links.forEach(a => {
            const rawIcon = a.getAttribute('icon') || a.getAttribute('ICON') || a.getAttribute('icon_uri') || a.getAttribute('ICON_URI') || '';
            const favicon = getEffectiveFavicon(a.href, rawIcon);

            newBookmarksData.push({
              user_id: userId,
              title: a.textContent?.trim() || a.href,
              url: a.href,
              favicon_url: favicon,
              description: '',
              _tempFolderKey: folderKey
            });
          });
        }
      });

      if (newFoldersData.length === 0) {
        const links = doc.querySelectorAll('a');
        if (links.length > 0) {
          const folderKey = `temp_default`;
          newFoldersData.push({
            user_id: userId,
            board_id: activeBoardId,
            name: "Imported Bookmarks",
            color: 'blue',
            order: currentFolderIndex,
            _tempId: folderKey
          });
          links.forEach(a => {
            const rawIcon = a.getAttribute('icon') || a.getAttribute('ICON') || a.getAttribute('icon_uri') || a.getAttribute('ICON_URI') || '';
            const favicon = getEffectiveFavicon(a.href, rawIcon);

            newBookmarksData.push({
              user_id: userId,
              title: a.textContent?.trim() || a.href,
              url: a.href,
              favicon_url: favicon,
              description: '',
              _tempFolderKey: folderKey
            });
          });
        }
      }

      const foldersToInsert = newFoldersData.map(f => {
         const { _tempId, ...rest } = f;
         return rest;
      });
      
      let allInsertedFolders = [];
      if (foldersToInsert.length > 0) {
        const { data: insertedFolders, error: folderErr } = await supabase.from('bookmark_folders').insert(foldersToInsert).select();
        if (folderErr) throw folderErr;
        allInsertedFolders = insertedFolders || [];
      }

      const tempToRealId: Record<string, string> = {};
      allInsertedFolders.forEach((f: any, idx: number) => {
         tempToRealId[newFoldersData[idx]._tempId] = f.id;
      });

      const folderCounters: Record<string, number> = {};
      let bmsToInsert = newBookmarksData.map(b => {
         const { _tempFolderKey, ...rest } = b;
         const realFolderId = tempToRealId[_tempFolderKey];
         if (folderCounters[realFolderId] === undefined) folderCounters[realFolderId] = bookmarks.filter(bm => bm.folder_id === realFolderId).length;
         
         return {
           ...rest,
           folder_id: realFolderId,
           order: folderCounters[realFolderId]++
         };
      });

      const chunkSize = 200;
      const allInsertedBms = [];
      for (let i = 0; i < bmsToInsert.length; i += chunkSize) {
        const chunk = bmsToInsert.slice(i, i + chunkSize);
        const { data: insertedBms, error: bmErr } = await supabase.from('bookmarks').insert(chunk).select();
        if (bmErr) throw bmErr;
        if (insertedBms) allInsertedBms.push(...insertedBms);
      }

      setFolders([...folders, ...allInsertedFolders]);
      setBookmarks([...bookmarks, ...allInsertedBms]);
      
      setAlertConfig({
        isOpen: true,
        title: "Nhập dữ liệu thành công",
        message: `Đã nhập thành công ${allInsertedFolders.length} cột và ${allInsertedBms.length} liên kết!`,
        type: "success"
      });
    } catch (err: any) {
      console.error("Import error", err);
      setAlertConfig({
        isOpen: true,
        title: "Lỗi khi nhập dữ liệu",
        message: "Lỗi khi import: " + (err.message || "Định dạng file không hợp lệ"),
        type: "error"
      });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  // Trích xuất domain từ URL để hiển thị mờ mờ
  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } 
    catch (e) { return url; }
  };

  const FOLDER_COLORS = [
    { id: 'blue', class: 'bg-blue-500' },
    { id: 'red', class: 'bg-red-500' },
    { id: 'green', class: 'bg-green-500' },
    { id: 'yellow', class: 'bg-yellow-500' },
    { id: 'purple', class: 'bg-purple-500' },
    { id: 'pink', class: 'bg-pink-500' },
    { id: 'orange', class: 'bg-orange-500' },
    { id: 'zinc', class: 'bg-zinc-500' },
  ];

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = normalizeText(searchQuery.trim());

  // Lọc bookmark theo tên hiển thị và đường dẫn URL
  const matchingBookmarks = isSearching
    ? bookmarks.filter(bm => {
        if (searchScope === 'current') {
          const folder = folders.find(f => f.id === bm.folder_id);
          if (folder?.board_id !== activeBoardId) return false;
        }
        const titleMatch = normalizeText(bm.title || '').includes(normalizedQuery);
        const urlMatch = normalizeText(bm.url || '').includes(normalizedQuery);
        return titleMatch || urlMatch;
      })
    : [];

  const activeFolders = folders.filter(f => f.board_id === activeBoardId).sort((a,b) => a.order - b.order);

  // Danh sách các cột/nhóm cần hiển thị
  const displayFolders = isSearching
    ? (searchScope === 'all' ? folders : activeFolders)
        .filter(f => matchingBookmarks.some(bm => bm.folder_id === f.id))
        .sort((a, b) => a.order - b.order)
    : activeFolders;

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="h-full flex bg-gray-50/50 dark:bg-zinc-950">
      
      {/* Sidebar for Boards */}
      <aside className={`transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 flex flex-col shrink-0 ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-none'}`}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <span className="font-bold text-xs text-zinc-500 uppercase tracking-wider">Your Boards</span>
          <button 
            onClick={() => { setEditingBoard({ name: "" }); setIsBoardModalOpen(true); }} 
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            title="Thêm Bảng mới"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {boards.sort((a,b) => a.order - b.order).map(board => {
            const isDragOver = dragOverBoardId === board.id;
            return (
              <div 
                key={board.id} 
                onClick={() => handleSelectBoard(board.id)}
                onDragOver={(e) => {
                  if (draggedFolderId) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverBoardId(board.id);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (dragOverBoardId === board.id) {
                    setDragOverBoardId(null);
                  }
                }}
                onDrop={(e) => handleDropFolderOnBoard(e, board.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                  isDragOver
                    ? 'bg-blue-600/30 border-2 border-blue-500 text-blue-300 scale-[1.02] shadow-md'
                    : activeBoardId === board.id 
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDragOver ? 'bg-blue-400 animate-pulse' : activeBoardId === board.id ? 'bg-blue-500' : 'bg-zinc-500'}`} />
                  <span className="truncate text-[13px] font-medium">{board.name}</span>
                </div>
                
                <div className={`flex items-center shrink-0 ${activeBoardId === board.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <Lock size={12} className="text-zinc-500 mr-2" />
                  <button onClick={(e) => { e.stopPropagation(); setEditingBoard({ id: board.id, name: board.name }); setIsBoardModalOpen(true); }} className="p-1 hover:text-blue-500 text-zinc-400 transition-colors" title="Sửa tên bảng">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board.id); }} className="p-1 hover:text-red-500 text-zinc-400 transition-colors" title="Xóa bảng">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

        {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#181d20] relative z-30 shrink-0 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isSidebarOpen ? 'bg-zinc-200/70 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' : ''}`}
              title={isSidebarOpen ? "Ẩn danh sách bảng" : "Hiện danh sách bảng"}
            >
              <Menu size={18} />
            </button>

            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              {boards.find(b => b.id === activeBoardId)?.name || 'Bookmarks'}
              {isImporting && <Loader2 size={15} className="animate-spin text-blue-500 ml-1" />}
            </h1>
          </div>

          {/* Thanh tìm kiếm Bookmark theo Tên & URL - Kích thước lớn, hiện đại */}
          <div className="flex-1 max-w-2xl relative mx-2">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên hiển thị, đường dẫn URL... (Ctrl+K)"
                className="w-full h-10 pl-10 pr-36 bg-zinc-100/90 dark:bg-[#20262b] hover:bg-zinc-200/60 dark:hover:bg-[#283036] focus:bg-white dark:focus:bg-[#151a1e] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-xl text-[13px] transition-all border border-zinc-200 dark:border-zinc-700/80 focus:border-blue-500/80 focus:ring-4 focus:ring-blue-500/15 shadow-sm outline-none"
              />
              
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-700/50 transition-colors"
                    title="Xóa tìm kiếm (Esc)"
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/90 rounded-md border border-zinc-300/60 dark:border-zinc-700">
                    ⌘K
                  </kbd>
                )}

                <button
                  onClick={() => setSearchScope(prev => prev === 'current' ? 'all' : 'current')}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1 ${
                    searchScope === 'all'
                      ? 'bg-blue-600/20 border-blue-500/60 text-blue-400 font-semibold shadow-sm'
                      : 'bg-zinc-200/70 dark:bg-zinc-800/80 border-zinc-300/60 dark:border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                  title={searchScope === 'all' ? "Đang tìm trên Tất cả các bảng (Bấm để chỉ tìm bảng hiện tại)" : "Đang tìm trên Bảng hiện tại (Bấm để tìm toàn bộ các bảng)"}
                >
                  {searchScope === 'all' ? 'Tất cả bảng' : 'Bảng này'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input type="file" accept=".html" className="hidden" ref={fileInputRef} onChange={handleImport} />
            
            {/* Tùy chỉnh số cột hiển thị & độ dãn */}
            <div className="relative" ref={viewSettingsRef}>
              <Button 
                variant="ghost" 
                onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)} 
                className={`text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg px-2.5 h-8 text-xs font-medium flex items-center gap-1.5 border border-zinc-200/80 dark:border-zinc-700 ${isViewSettingsOpen ? 'bg-zinc-200/80 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' : ''}`}
                title="Tùy chỉnh số lượng cột hiển thị"
              >
                <LayoutGrid size={14} className="text-blue-500" />
                <span>{columnCount === 'auto' ? 'Tự động' : `${columnCount} Cột`}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 text-zinc-400 ${isViewSettingsOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isViewSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#1a2025] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-700/80">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Columns size={14} className="text-blue-500" /> Tùy chỉnh số cột
                    </span>
                    <button 
                      onClick={() => setIsViewSettingsOpen(false)} 
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="py-3 flex flex-col gap-3.5">
                    {/* Số lượng cột */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 mb-2">
                        <span>Số cột hiển thị ngang</span>
                        <span className="font-bold text-blue-500">
                          {columnCount === 'auto' ? 'Tự động (Co giãn)' : `${columnCount} cột (Full ngang)`}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleSetColumnCount('auto')}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex items-center justify-between ${
                            columnCount === 'auto'
                              ? 'bg-blue-600 text-white shadow-sm font-semibold'
                              : 'bg-zinc-100 dark:bg-[#252c33] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-[#2e3740] border border-transparent dark:border-zinc-700/40'
                          }`}
                        >
                          <span>⚡ Tự động theo kích thước màn</span>
                          {columnCount === 'auto' && <span className="text-[10px]">Đang dùng</span>}
                        </button>
                        
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          {[2, 3, 4, 5, 6, 7, 8].map(num => (
                            <button
                              key={num}
                              onClick={() => handleSetColumnCount(num)}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                columnCount === num
                                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                                  : 'bg-zinc-100 dark:bg-[#252c33] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-[#2e3740] border border-transparent dark:border-zinc-700/40'
                              }`}
                            >
                              {num} Cột
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Độ dãn khoảng cách (Gap) */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-700/80">
                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 mb-2">
                        <span>Khoảng cách giữa các cột</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{gapSize}px</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: "Gọn", val: 12 },
                          { label: "Vừa", val: 16 },
                          { label: "Rộng", val: 20 },
                          { label: "Thoáng", val: 24 },
                        ].map(item => (
                          <button
                            key={item.val}
                            onClick={() => handleSetGapSize(item.val)}
                            className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                              gapSize === item.val
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'bg-zinc-100 dark:bg-[#252c33] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#2e3740] border border-transparent dark:border-zinc-700/40'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg px-3 h-8 text-xs font-medium">
              <Upload size={13} className="mr-1.5" /> Nhập
            </Button>
            <Button variant="ghost" onClick={handleExport} className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg px-3 h-8 text-xs font-medium">
              <Download size={13} className="mr-1.5" /> Xuất
            </Button>
            
            <Button onClick={() => { setEditingFolder({ board_id: activeBoardId || '', name: "", color: "blue" }); setIsFolderModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 rounded-lg px-3.5 h-8 text-xs font-medium ml-1">
              <Plus size={14} className="mr-1.5" /> Thêm Cột
            </Button>
          </div>
        </header>

        {/* Boards Area (Papaly Multi-column Grid) */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#1e2327] dark:bg-[#1e2327]">
          {isSearching && displayFolders.length === 0 ? (
            /* Không tìm thấy kết quả tìm kiếm */
            <div className="flex flex-col items-center justify-center p-16 text-zinc-400">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
                <Search size={26} className="text-blue-400 opacity-80" />
              </div>
              <h3 className="text-base font-semibold text-zinc-200 mb-1">Không tìm thấy bookmark phù hợp</h3>
              <p className="text-xs text-zinc-400 max-w-sm text-center mb-5">
                Không tìm thấy bookmark nào khớp với từ khóa <span className="text-blue-400 font-medium font-mono">"{searchQuery}"</span> trong {searchScope === 'all' ? 'tất cả các bảng' : 'bảng hiện tại'}.
              </p>
              <div className="flex items-center gap-2">
                {searchScope === 'current' && (
                  <Button 
                    onClick={() => setSearchScope('all')} 
                    variant="outline"
                    className="text-xs border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg px-3.5 h-8 font-medium"
                  >
                    <Globe size={13} className="mr-1.5 text-blue-400" /> Tìm trên tất cả các bảng
                  </Button>
                )}
                <Button 
                  onClick={() => setSearchQuery('')} 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3.5 h-8 text-xs font-medium"
                >
                  <X size={13} className="mr-1.5" /> Xóa tìm kiếm
                </Button>
              </div>
            </div>
          ) : !isSearching && boards.length === 0 ? (
            /* Chưa có Bảng nào */
            <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
              <p className="text-sm mb-3">Bạn chưa có Bảng Bookmark nào</p>
              <Button onClick={() => { setEditingBoard({ name: "" }); setIsBoardModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 h-9 text-xs font-medium">
                <Plus size={14} className="mr-1.5" /> Tạo Bảng Đầu Tiên
              </Button>
            </div>
          ) : !isSearching && activeFolders.length === 0 ? (
            /* Bảng hiện tại chưa có dữ liệu */
            <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
              <p className="text-sm mb-3">Chưa có danh mục nào trong Bảng này</p>
              <Button onClick={() => { setEditingFolder({ board_id: activeBoardId || '', name: "", color: "blue" }); setIsFolderModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 h-9 text-xs font-medium">
                <Plus size={14} className="mr-1.5" /> Thêm Cột Mới
              </Button>
            </div>
          ) : (
            /* Lưới các cột & nhóm */
            <div 
              className="w-full grid items-start"
              style={{
                gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                gap: `${gapSize}px`,
              }}
            >
              {getColumnsData(displayFolders, numCols).map((colFolders, colIndex) => {
                return (
                  <div 
                    key={`col-${colIndex}`}
                    className="flex flex-col min-h-[400px] rounded-xl transition-all duration-150 relative pb-12"
                    onDragOver={(e) => !isSearching && handleDragOverColumnArea(e, colIndex, colFolders.length)}
                    onDrop={(e) => !isSearching && handleDropFolderAt(e, colIndex, colFolders.length)}
                  >
                    {/* Cột trống */}
                    {!isSearching && colFolders.length === 0 && !(draggedFolderId && folderDropSlot?.colIndex === colIndex) && (
                      <div 
                        className="w-full min-h-[140px] rounded-xl border-2 border-dashed border-zinc-800/80 hover:border-zinc-700/80 bg-zinc-800/20 flex flex-col items-center justify-center p-4 transition-all duration-150 text-zinc-600 hover:text-zinc-400 select-none"
                      >
                        <Plus size={18} className="mb-1 opacity-40" />
                        <span className="text-xs">Cột trống (Kéo nhóm vào đây)</span>
                      </div>
                    )}

                    {/* Danh sách các nhóm trong cột */}
                    {colFolders.map((folder, rowIndex) => {
                      const folderBookmarks = isSearching 
                        ? matchingBookmarks.filter(b => b.folder_id === folder.id)
                        : bookmarks.filter(b => b.folder_id === folder.id);
                      const colorObj = FOLDER_COLORS.find(c => c.id === (folder.color || 'blue')) || FOLDER_COLORS[0];
                      const isDraggingThis = draggedFolderId === folder.id;
                      const showPlaceholderAbove = !isSearching && draggedFolderId && folderDropSlot?.colIndex === colIndex && folderDropSlot?.rowIndex === rowIndex && !isDraggingThis;

                      return (
                        <React.Fragment key={folder.id}>
                          {/* Khung thả Papaly phía trên thẻ */}
                          {showPlaceholderAbove && (
                            <div 
                              className="w-full min-h-[85px] rounded-xl border-2 border-dashed border-blue-500 bg-blue-500/10 flex items-center justify-center text-xs text-blue-400 font-medium transition-all duration-150 animate-pulse my-2"
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onDrop={(e) => handleDropFolderAt(e, colIndex, rowIndex)}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                <span>Thả nhóm vào đây</span>
                              </div>
                            </div>
                          )}

                          {/* Thẻ nhóm (Folder Card) */}
                          <div 
                            className={`w-full flex flex-col rounded-xl border bg-[#252b30] p-3.5 transition-all duration-150 my-2 ${
                              isDraggingThis ? 'opacity-30 scale-95 border-dashed border-blue-500 shadow-none' : 'border-zinc-700/50 hover:border-zinc-600/80 shadow-sm'
                            }`}
                            draggable={!isSearching}
                            onDragStart={(e) => !isSearching && handleDragStartFolder(e, folder.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => !isSearching && handleDragOverCard(e, colIndex, rowIndex, folder.id)}
                            onDrop={(e) => {
                              if (isSearching) return;
                              const currentDrag = dragItemRef.current;
                              if (currentDrag?.type === 'bookmark') {
                                handleDropBookmark(e, folder.id);
                              } else {
                                handleDropFolderAt(e, colIndex, folderDropSlot?.rowIndex ?? rowIndex);
                              }
                            }}
                          >
                            {/* Tiêu đề nhóm */}
                            <div className="flex items-center justify-between group mb-2.5 cursor-grab active:cursor-grabbing select-none">
                              <div className="flex items-center min-w-0 pr-1">
                                {!isSearching && <GripVertical size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 mr-1" />}
                                <div className={`w-1 h-4 rounded-full mr-2 shrink-0 ${colorObj.class}`} />
                                <h3 className="font-bold text-[14px] text-zinc-100 truncate">{folder.name}</h3>
                                {isSearching && searchScope === 'all' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal ml-2 shrink-0 border border-zinc-700/50" title="Thuộc Bảng">
                                    {boards.find(b => b.id === folder.board_id)?.name || 'Bảng khác'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: folder.id, board_id: folder.board_id || activeBoardId || '', name: folder.name, color: folder.color || 'blue' }); setIsFolderModalOpen(true); }} className="p-1 text-zinc-500 hover:text-blue-400 transition-colors" title="Sửa cột & chuyển bảng">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-1 text-zinc-500 hover:text-red-400 transition-colors" title="Xóa cột">
                                  <Trash2 size={13} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingBookmark({ folder_id: folder.id, url: "" }); setIsBookmarkModalOpen(true); }} className="p-1 text-zinc-500 hover:text-green-400 transition-colors ml-1" title="Thêm bookmark">
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Danh sách bookmarks bên trong nhóm */}
                            <div className="flex flex-col space-y-0.5 min-h-[30px]">
                              {folderBookmarks.map(bm => {
                                const faviconSrc = getEffectiveFavicon(bm.url, bm.favicon_url);
                                return (
                                  <a 
                                    key={bm.id} 
                                    href={bm.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    draggable={!isSearching}
                                    onDragStart={(e) => !isSearching && handleDragStartBookmark(e, bm.id, folder.id)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => !isSearching && handleDragOverBookmark(e, bm.id, folder.id)}
                                    onDrop={(e) => !isSearching && handleDropBookmark(e, folder.id, bm.id)}
                                    className={`group flex items-center py-1.5 px-2 rounded hover:bg-white/5 transition-colors relative cursor-pointer ${dragOverBookmarkId === bm.id ? 'border-t-2 border-blue-500' : 'border-t-2 border-transparent'} ${draggedBookmarkId === bm.id ? 'opacity-50' : ''}`}
                                  >
                                    <div className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5 opacity-90 group-hover:opacity-100 mt-0.5 self-start">
                                      {faviconSrc ? (
                                        <img 
                                          src={faviconSrc} 
                                          alt="" 
                                          className="w-4 h-4 object-contain rounded-[2px]" 
                                          onError={(e) => { 
                                            const domain = getDomain(bm.url);
                                            if (!e.currentTarget.src.includes('duckduckgo')) {
                                              e.currentTarget.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
                                            } else {
                                              e.currentTarget.style.display = 'none';
                                            }
                                          }} 
                                        />
                                      ) : (
                                        <Link2 size={14} className="text-zinc-500" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-12">
                                      <HighlightText text={bm.title} query={searchQuery} className="text-[13px] text-zinc-300 group-hover:text-zinc-100 transition-colors truncate block font-medium" />
                                      {isSearching && (
                                        <HighlightText text={bm.url} query={searchQuery} className="text-[11px] text-zinc-500 group-hover:text-zinc-400 truncate block mt-0.5 font-mono" />
                                      )}
                                    </div>

                                    {/* Action buttons (Edit & Delete on hover) */}
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#252b30]/95 px-1 py-0.5 rounded shadow-sm">
                                      <button 
                                        onClick={(e) => { 
                                          e.preventDefault(); 
                                          e.stopPropagation(); 
                                          setEditingBookmark({ 
                                            id: bm.id, 
                                            folder_id: bm.folder_id, 
                                            url: bm.url, 
                                            title: bm.title,
                                            favicon_url: bm.favicon_url 
                                          }); 
                                          setIsBookmarkModalOpen(true); 
                                        }} 
                                        className="p-1 text-zinc-400 hover:text-blue-400 transition-colors" 
                                        title="Sửa link"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button 
                                        onClick={(e) => { 
                                          e.preventDefault(); 
                                          e.stopPropagation(); 
                                          setConfirmConfig({
                                            isOpen: true,
                                            title: "Xoá Bookmark",
                                            message: `Bạn có chắc muốn xoá bookmark "${bm.title || bm.url}"?`,
                                            confirmText: "Xoá Link",
                                            variant: "danger",
                                            onConfirm: () => handleDeleteBookmark(bm.id)
                                          });
                                        }} 
                                        className="p-1 text-zinc-400 hover:text-red-400 transition-colors ml-0.5" 
                                        title="Xoá link"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </a>
                                );
                              })}

                              {folderBookmarks.length === 0 && (
                                <div className="py-2 px-2 text-zinc-600 text-[13px]">Trống</div>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Khung thả Papaly ở cuối cột */}
                    {!isSearching && draggedFolderId && folderDropSlot?.colIndex === colIndex && folderDropSlot?.rowIndex === colFolders.length && (
                      <div 
                        className="w-full min-h-[85px] rounded-xl border-2 border-dashed border-blue-500 bg-blue-500/10 flex items-center justify-center text-xs text-blue-400 font-medium transition-all duration-150 animate-pulse my-2"
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => handleDropFolderAt(e, colIndex, colFolders.length)}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                          <span>Thả nhóm xuống cuối cột</span>
                        </div>
                      </div>
                    )}

                    {/* Vùng đệm bắt sự kiện thả ở cuối cột */}
                    {!isSearching && draggedFolderId && colFolders.length > 0 && !(folderDropSlot?.colIndex === colIndex && folderDropSlot?.rowIndex === colFolders.length) && (
                      <div 
                        className="w-full min-h-[45px] rounded-xl border border-dashed border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 flex items-center justify-center transition-all duration-150 text-zinc-600 hover:text-blue-400 text-xs my-1 cursor-pointer"
                        onDragOver={(e) => handleDragOverColumnArea(e, colIndex, colFolders.length)}
                        onDrop={(e) => handleDropFolderAt(e, colIndex, colFolders.length)}
                      >
                        <span>+ Thả xuống cuối cột</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* Board Modal */}
      {isBoardModalOpen && editingBoard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingBoard.id ? 'Chỉnh sửa Bảng' : 'Thêm Bảng mới'}
              </h2>
              <button onClick={() => setIsBoardModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveBoard} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Tên Bảng
                </label>
                <Input 
                  autoFocus
                  placeholder="Ví dụ: Công việc, Giải trí, Học tập..." 
                  value={editingBoard.name}
                  onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                  className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsBoardModalOpen(false)}>Hủy</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Lưu Bảng</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Add/Edit Folder Modal */}
      {isFolderModalOpen && editingFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFolderModalOpen(false)} />
          <form onSubmit={handleSaveFolder} className="relative bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{editingFolder.id ? "Sửa tên Cột" : "Thêm Cột mới"}</h2>
              <button type="button" onClick={() => setIsFolderModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tên Cột</label>
                <Input autoFocus placeholder="VD: Công việc, Tin tức..." value={editingFolder.name} onChange={e => setEditingFolder({...editingFolder, name: e.target.value})} />
              </div>

              {/* Board Selector */}
              {boards.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Thuộc Bảng</label>
                  <select 
                    value={editingFolder.board_id || activeBoardId || ''}
                    onChange={e => setEditingFolder({ ...editingFolder, board_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Màu sắc</label>
                <div className="flex items-center gap-2">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingFolder({...editingFolder, color: c.id})}
                      className={`w-6 h-6 rounded-full transition-transform ${c.class} ${editingFolder.color === c.id ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 dark:ring-offset-zinc-900' : 'opacity-80 hover:scale-110'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-950/50">
              <Button type="button" variant="ghost" onClick={() => setIsFolderModalOpen(false)}>Huỷ</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20">Lưu lại</Button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Bookmark Modal */}
      {isBookmarkModalOpen && editingBookmark && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isFetchingMeta && setIsBookmarkModalOpen(false)} />
          <form onSubmit={handleSaveBookmark} className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold">
                {editingBookmark.id ? "Chỉnh sửa Bookmark" : "Thêm Bookmark"}
              </h2>
              <button type="button" disabled={isFetchingMeta} onClick={() => setIsBookmarkModalOpen(false)} className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Đường dẫn (URL)</label>
                <Input 
                  autoFocus 
                  placeholder="https://example.com" 
                  value={editingBookmark.url} 
                  onChange={e => setEditingBookmark({...editingBookmark, url: e.target.value})} 
                  disabled={isFetchingMeta}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tên hiển thị</label>
                <Input 
                  placeholder={editingBookmark.id ? "Tên hiển thị bookmark" : "Để trống để tự động lấy tiêu đề"} 
                  value={editingBookmark.title || ""} 
                  onChange={e => setEditingBookmark({...editingBookmark, title: e.target.value})} 
                  disabled={isFetchingMeta}
                />
              </div>
              <p className="text-xs text-zinc-500">
                {editingBookmark.id
                  ? "Bạn có thể chỉnh sửa đường dẫn URL hoặc tên hiển thị của liên kết này."
                  : "Hệ thống sẽ tự động quét lấy Logo trang web và Tiêu đề (nếu bạn để trống)."}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-2xl">
              <Button type="button" variant="ghost" onClick={() => setIsBookmarkModalOpen(false)} disabled={isFetchingMeta}>Huỷ</Button>
              <Button type="submit" disabled={!editingBookmark.url.trim() || isFetchingMeta} className="bg-blue-600 text-white hover:bg-blue-700 min-w-28">
                {isFetchingMeta ? <Loader2 size={16} className="animate-spin" /> : (editingBookmark.id ? "Lưu thay đổi" : "Thêm ngay")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
