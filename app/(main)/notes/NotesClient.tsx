"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Plus, 
  Search, 
  X, 
  Pin, 
  Tag as TagIcon, 
  Edit2, 
  Trash2, 
  Copy, 
  Check, 
  Menu, 
  LayoutGrid, 
  List, 
  Sparkles, 
  Palette, 
  ExternalLink,
  ChevronRight,
  Folder,
  ArrowUpDown,
  SlidersHorizontal,
  Maximize2,
  FileText,
  ChevronDown,
  Paperclip,
  Download,
  File,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  Eye,
  PenLine,
  GripVertical,
  Layers,
  Clock
} from "lucide-react";
import { AutocompleteSearchBox } from "@/components/ui/AutocompleteSearchBox";
import { SortableNoteGroupWrapper } from "@/components/notes/SortableNoteGroupWrapper";
import { BuildTimeBadge } from "@/components/ui/BuildTimeBadge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AlertModal } from "@/components/ui/AlertModal";

// --- TYPES ---
export interface NoteGroup {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  group_id?: string | null;
  title?: string | null;
  content?: string | null;
  type: 'text' | 'image' | 'file';
  image_url?: string | null;
  source_app?: string | null;
  color?: string;
  is_pinned?: boolean;
  order?: number;
  created_at: string;
  updated_at?: string;
}

export interface NoteTag {
  note_id: string;
  tag_id: string;
}

export type NoteSortOption = 'created_desc' | 'updated_desc' | 'created_asc' | 'updated_asc';
export type ViewMode = 'grid' | 'list' | 'accordion';

export const SORT_OPTIONS: { id: NoteSortOption; label: string; shortLabel: string; desc: string }[] = [
  {
    id: 'updated_desc',
    label: 'Mới nhất (Cập nhật & Tạo)',
    shortLabel: 'Mới nhất',
    desc: 'Ghi chú vừa tạo hoặc vừa chỉnh sửa sẽ hiển thị trước tiên'
  },
  {
    id: 'created_desc',
    label: 'Ngày tạo: Mới nhất',
    shortLabel: 'Tạo mới nhất',
    desc: 'Ghi chú tạo gần đây nhất hiển thị trước (bỏ qua chỉnh sửa)'
  },
  {
    id: 'created_asc',
    label: 'Ngày tạo: Cũ nhất',
    shortLabel: 'Tạo cũ nhất',
    desc: 'Ghi chú tạo đầu tiên sẽ hiển thị trước'
  },
  {
    id: 'updated_asc',
    label: 'Ngày cập nhật: Cũ nhất',
    shortLabel: 'Sửa cũ nhất',
    desc: 'Ghi chú ít chỉnh sửa nhất sẽ hiển thị trước'
  }
];

export type NoteGroupBy = 'group' | 'date' | 'none';

export const GROUP_BY_OPTIONS: { id: NoteGroupBy; label: string; shortLabel: string; desc: string }[] = [
  {
    id: 'group',
    label: 'Theo Nhóm chủ đề',
    shortLabel: 'Gom theo nhóm',
    desc: 'Phân chia thành từng khu vực theo nhóm ghi chú (mặc định)'
  },
  {
    id: 'date',
    label: 'Theo Mốc thời gian',
    shortLabel: 'Theo thời gian',
    desc: 'Phân chia theo Hôm nay, Hôm qua, 7 ngày qua, Cũ hơn'
  },
  {
    id: 'none',
    label: 'Không gom nhóm',
    shortLabel: 'Dạng phẳng',
    desc: 'Hiển thị tất cả ghi chú trong một lưới phẳng liền mạch'
  }
];

export type DateBucketKey = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'older';

export const DATE_BUCKETS: { key: DateBucketKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7days', label: '7 ngày qua' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: 'older', label: 'Cũ hơn' },
];

export function getDateBucketKey(dateStr: string): DateBucketKey {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    
    // So sánh ngày theo lịch địa phương
    const isToday = d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();
    if (isToday) return 'today';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getDate() === yesterday.getDate();
    if (isYesterday) return 'yesterday';

    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7 && diffDays >= 0) return 'last7days';

    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      return 'thisMonth';
    }

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth()) {
      return 'lastMonth';
    }

    return 'older';
  } catch {
    return 'older';
  }
}

export function compareNotes(a: Note, b: Note, sort: NoteSortOption): number {
  if (sort === 'created_desc') {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  }
  if (sort === 'created_asc') {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
  }
  if (sort === 'updated_asc') {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
  // Mặc định: 'updated_desc' (Ngày tạo và ngày cập nhật mới nhất)
  const timeA = new Date(a.updated_at || a.created_at).getTime();
  const timeB = new Date(b.updated_at || b.created_at).getTime();
  if (timeB !== timeA) return timeB - timeA;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

interface NotesClientProps {
  userId: string;
  initialGroups?: NoteGroup[];
  initialNotes?: Note[];
  initialTags?: Tag[];
  initialNoteTags?: NoteTag[];
  initialSharedTitle?: string;
  initialSharedText?: string;
  initialSharedImage?: string;
  isSharedSuccess?: boolean;
}

// Bảng màu note dịu mắt, tối giản chuẩn Dark mode
const NOTE_COLORS = [
  { id: 'default', name: 'Mặc định', bg: 'bg-[#181d20]', border: 'border-zinc-800/80', text: 'text-zinc-300' },
  { id: 'blue', name: 'Xanh dương', bg: 'bg-[#15232d]', border: 'border-blue-900/60', text: 'text-blue-200' },
  { id: 'emerald', name: 'Xanh lá', bg: 'bg-[#14261f]', border: 'border-emerald-900/60', text: 'text-emerald-200' },
  { id: 'purple', name: 'Tím', bg: 'bg-[#22182d]', border: 'border-purple-900/60', text: 'text-purple-200' },
  { id: 'amber', name: 'Hổ phách', bg: 'bg-[#282115]', border: 'border-amber-900/60', text: 'text-amber-200' },
  { id: 'rose', name: 'Đỏ hồng', bg: 'bg-[#28171d]', border: 'border-rose-900/60', text: 'text-rose-200' },
  { id: 'cyan', name: 'Xanh ngọc', bg: 'bg-[#12242a]', border: 'border-cyan-900/60', text: 'text-cyan-200' },
];

function getColorConfig(colorId?: string) {
  return NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
}

// Xác định loại tệp đính kèm (Ảnh, PDF, Word, Excel, TXT, ...)
export function getFileCategory(urlOrName?: string | null): 'image' | 'pdf' | 'word' | 'excel' | 'txt' | 'file' {
  if (!urlOrName) return 'file';
  const clean = urlOrName.split('?')[0].toLowerCase();
  if (clean.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i) || clean.startsWith('data:image/')) return 'image';
  if (clean.endsWith('.pdf') || clean.startsWith('data:application/pdf')) return 'pdf';
  if (clean.match(/\.(doc|docx)$/i) || clean.includes('wordprocessingml') || clean.includes('msword')) return 'word';
  if (clean.match(/\.(xls|xlsx|csv)$/i) || clean.includes('spreadsheetml') || clean.includes('ms-excel')) return 'excel';
  if (clean.endsWith('.txt') || clean.startsWith('data:text/plain')) return 'txt';
  return 'file';
}

// Lấy tên tệp từ đường dẫn URL
export function getFileNameFromUrl(url?: string | null): string {
  if (!url) return 'Tệp đính kèm';
  try {
    if (url.startsWith('data:')) {
      const mime = url.substring(5, url.indexOf(';'));
      if (mime.includes('pdf')) return 'document.pdf';
      if (mime.includes('word')) return 'document.docx';
      if (mime.includes('excel') || mime.includes('spreadsheet')) return 'spreadsheet.xlsx';
      if (mime.includes('text')) return 'document.txt';
      return 'Tập tin đính kèm';
    }
    const clean = url.split('?')[0];
    const parts = clean.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart.replace(/^\d+-[a-z0-9]+-/, '').replace(/^\d+-/, '')) || 'Tệp đính kèm';
  } catch {
    return 'Tệp đính kèm';
  }
}

// Trích xuất tất cả ảnh markdown trong nội dung (![alt](url))
export function extractMarkdownImages(content?: string | null): { alt: string; url: string; match: string }[] {
  if (!content) return [];
  const regex = /!\[(.*?)\]\(((?:https?:\/\/|data:image\/|\/)[^\s\)]+)\)/g;
  const images: { alt: string; url: string; match: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push({
      alt: match[1] || 'Hình ảnh',
      url: match[2],
      match: match[0]
    });
  }
  return images;
}

// Xóa cú pháp ảnh markdown khỏi nội dung để lấy văn bản thuần hiển thị gọn gàng
export function stripMarkdownImages(content?: string | null): string {
  if (!content) return "";
  return content.replace(/!\[(.*?)\]\(((?:https?:\/\/|data:image\/|\/)[^\s\)]+)\)/g, "").trim();
}

// Kiểm tra ghi chú có chứa tệp đính kèm hoặc ảnh trong nội dung không
export function hasImagesOrAttachments(note: Note): boolean {
  if (note.image_url) return true;
  if (!note.content) return false;
  return extractMarkdownImages(note.content).length > 0;
}

// Gỡ một ảnh markdown cụ thể khỏi chuỗi nội dung
export function removeMarkdownImage(content: string, urlToRemove: string): string {
  if (!content) return "";
  const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)\\n?`, 'g');
  return content.replace(regex, '').trim();
}

// Chèn văn bản vào vị trí con trỏ chuột trong ô textarea
export function insertTextAtCursor(
  textarea: HTMLTextAreaElement | null,
  currentText: string,
  textToInsert: string
): { newText: string; newCursorPos: number } {
  if (!textarea) {
    const newText = currentText ? `${currentText}\n${textToInsert}` : textToInsert;
    return { newText, newCursorPos: newText.length };
  }

  const start = textarea.selectionStart ?? currentText.length;
  const end = textarea.selectionEnd ?? currentText.length;
  const before = currentText.substring(0, start);
  const after = currentText.substring(end);

  const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
  const insertion = `${prefix}${textToInsert}${suffix}`;
  const newText = `${before}${insertion}${after}`;
  const newCursorPos = start + insertion.length;

  return { newText, newCursorPos };
}

// Component hiển thị tệp đính kèm / hình ảnh đa năng
export function AttachmentDisplay({ 
  url, 
  onRemove, 
  onViewImage, 
  compact = false 
}: { 
  url: string; 
  onRemove?: () => void; 
  onViewImage?: (url: string) => void;
  compact?: boolean;
}) {
  const category = getFileCategory(url);
  const fileName = getFileNameFromUrl(url);

  if (category === 'image') {
    return (
      <div className="relative rounded-xl overflow-hidden bg-black/40 border border-zinc-700/60 group/img flex items-center justify-center">
        <img 
          src={url} 
          alt="Attached image" 
          className={`w-full object-cover ${compact ? 'max-h-36' : 'max-h-64 object-contain'} ${onViewImage ? 'cursor-zoom-in' : ''}`}
          onClick={() => onViewImage && onViewImage(url)}
        />
        {onViewImage && (
          <div 
            onClick={() => onViewImage(url)}
            className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-zoom-in"
          >
            <Maximize2 size={18} className="text-white drop-shadow" />
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 p-1.5 bg-black/75 hover:bg-red-600 text-white rounded-full shadow transition-colors z-10"
            title="Gỡ ảnh"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // Cấu hình nhãn & màu sắc theo loại file tài liệu
  const config = {
    pdf: {
      label: "PDF",
      bg: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
      badge: "bg-red-600 text-white",
      icon: FileText
    },
    word: {
      label: "DOC",
      bg: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20",
      badge: "bg-blue-600 text-white",
      icon: FileText
    },
    excel: {
      label: "XLS",
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
      badge: "bg-emerald-600 text-white",
      icon: FileSpreadsheet
    },
    txt: {
      label: "TXT",
      bg: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20",
      badge: "bg-amber-600 text-white",
      icon: FileText
    },
    file: {
      label: "FILE",
      bg: "bg-zinc-500/10 border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/20",
      badge: "bg-zinc-600 text-white",
      icon: File
    }
  }[category] || {
    label: "FILE",
    bg: "bg-zinc-500/10 border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/20",
    badge: "bg-zinc-600 text-white",
    icon: File
  };

  const IconComponent = config.icon;

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${config.bg} relative group/doc`}>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-3 min-w-0 flex-1 pr-2"
        title="Bấm để mở hoặc xem tệp"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative bg-zinc-900/80 border border-white/10 shadow-sm">
          <IconComponent size={18} />
          <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter ${config.badge}`}>
            {config.label}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold truncate text-zinc-200 hover:underline">{fileName}</span>
          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
            Bấm để mở / xem <ExternalLink size={10} />
          </span>
        </div>
      </a>
      
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Tải về máy"
        >
          <Download size={15} />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
            title="Xóa tệp đính kèm"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// Chuẩn hóa tiếng Việt không dấu cho tìm kiếm
function normalizeText(str: string): string {
  return (str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Định dạng thời gian tương đối
function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

// Trích xuất thông điệp lỗi chi tiết từ PostgREST / Supabase
export function formatErrorMessage(err: unknown, defaultMsg: string): string {
  if (!err) return defaultMsg;
  if (typeof err === 'object') {
    const pErr = err as { message?: string; details?: string; hint?: string; code?: string };
    if (pErr.code === 'PGRST202') {
      return "Database Supabase chưa được cài đặt hàm RPC (lỗi PGRST202). Vui lòng mở Supabase Dashboard > SQL Editor và chạy nội dung file migration SQL (supabase_notes.sql).";
    }
    if (pErr.message) {
      let msg = pErr.message;
      if (pErr.details) msg += ` - ${pErr.details}`;
      if (pErr.hint) msg += ` (Gợi ý: ${pErr.hint})`;
      return msg;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err) || defaultMsg;
}

// Xử lý định dạng in đậm (**text**) và mã inline (`code`)
function formatBoldAndCode(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Định dạng văn bản chứa liên kết URL clickable
function formatInlineText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  if (parts.length === 1) {
    return formatBoldAndCode(text);
  }
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{part}</span>
          <ExternalLink size={11} className="inline ml-0.5 opacity-70" />
        </a>
      );
    }
    return formatBoldAndCode(part);
  });
}

// Component hiển thị nội dung Markdown & Ảnh trực quan (Preview Mode)
export function NoteMarkdownPreview({ 
  content, 
  onViewImage 
}: { 
  content: string; 
  onViewImage: (url: string) => void; 
}) {
  if (!content || !content.trim()) {
    return (
      <div className="text-zinc-500 italic text-sm py-6 text-center border border-dashed border-zinc-800 rounded-2xl">
        Chưa có nội dung văn bản.
      </div>
    );
  }

  const imageRegex = /!\[(.*?)\]\(((?:https?:\/\/|data:image\/|\/)[^\s\)]+)\)/g;
  const segments: Array<{ type: 'text' | 'image'; text?: string; alt?: string; url?: string }> = [];
  let lastIdx = 0;
  let match;
  
  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        type: 'text',
        text: content.substring(lastIdx, match.index)
      });
    }
    segments.push({
      type: 'image',
      alt: match[1] || 'Hình ảnh',
      url: match[2]
    });
    lastIdx = imageRegex.lastIndex;
  }
  
  if (lastIdx < content.length) {
    segments.push({
      type: 'text',
      text: content.substring(lastIdx)
    });
  }

  return (
    <div className="space-y-4 text-zinc-200 leading-relaxed text-sm sm:text-base">
      {segments.map((seg, i) => {
        if (seg.type === 'image' && seg.url) {
          return (
            <div key={i} className="my-3 rounded-2xl overflow-hidden bg-black/40 border border-zinc-700/80 shadow-md group/prevImg relative flex flex-col items-center max-w-2xl">
              <img
                src={seg.url}
                alt={seg.alt || 'Hình ảnh'}
                className="w-full max-h-[480px] object-contain cursor-zoom-in transition-transform group-hover/prevImg:scale-[1.01]"
                onClick={() => onViewImage(seg.url!)}
              />
              <div 
                onClick={() => onViewImage(seg.url!)}
                className="absolute inset-0 bg-black/20 opacity-0 group-hover/prevImg:opacity-100 flex items-center justify-center transition-opacity cursor-zoom-in"
              >
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 text-white text-xs font-semibold rounded-xl shadow backdrop-blur-sm">
                  <Maximize2 size={13} /> Phóng to ảnh
                </span>
              </div>
              {seg.alt && seg.alt !== 'Hình ảnh' && (
                <div className="w-full text-center py-1.5 px-3 bg-zinc-900/90 text-xs text-zinc-400 border-t border-zinc-800">
                  {seg.alt}
                </div>
              )}
            </div>
          );
        }

        const textLines = (seg.text || '').split('\n');
        return (
          <div key={i} className="space-y-2">
            {textLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lIdx} className="h-2" />;
              }

              if (trimmed.startsWith('### ')) {
                return <h3 key={lIdx} className="text-base sm:text-lg font-bold text-zinc-100 pt-2">{trimmed.substring(4)}</h3>;
              }
              if (trimmed.startsWith('## ')) {
                return <h2 key={lIdx} className="text-lg sm:text-xl font-bold text-zinc-100 pt-3">{trimmed.substring(3)}</h2>;
              }
              if (trimmed.startsWith('# ')) {
                return <h1 key={lIdx} className="text-xl sm:text-2xl font-bold text-zinc-100 pt-4">{trimmed.substring(2)}</h1>;
              }

              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-blue-400 mt-1.5">•</span>
                    <span className="flex-1 break-words">{formatInlineText(trimmed.substring(2))}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="whitespace-pre-wrap break-words leading-relaxed text-zinc-300">
                  {formatInlineText(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function NotesClient({
  userId,
  initialGroups = [],
  initialNotes = [],
  initialTags = [],
  initialNoteTags = [],
  initialSharedTitle,
  initialSharedText,
  initialSharedImage,
  isSharedSuccess
}: NotesClientProps) {
  const [groups, setGroups] = useState<NoteGroup[]>(initialGroups);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [noteTags, setNoteTags] = useState<NoteTag[]>(initialNoteTags);

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<string>('all'); // 'all' | 'pinned' | 'images' | `group:${groupId}` | `tag:${tagId}`
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<NoteSortOption>('updated_desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [groupBy, setGroupBy] = useState<NoteGroupBy>('group');
  const [isGroupByDropdownOpen, setIsGroupByDropdownOpen] = useState(false);
  const groupByDropdownRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Section Collapse State trong chế độ Lưới/Danh sách
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const isSectionCollapsed = (id: string) => Boolean(collapsedSections[id]);

  // Accordion State
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});
  const toggleAccordion = (id: string) => {
    setExpandedAccordions(prev => ({ ...prev, [id]: prev[id] === true ? false : true }));
  };
  const isAccordionOpen = (id: string) => expandedAccordions[id] === true;

  const handleOpenCreateNote = (groupId: string = "") => {
    setEditingNote({
      id: "",
      user_id: userId,
      title: "",
      content: "",
      group_id: groupId || null,
      color: "default",
      type: "text",
      image_url: null,
      source_app: null,
      is_pinned: false,
      order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setEditTags([]);
    setEditTagInput("");
    setModalTab('edit');
    setIsMetadataDrawerOpen(false);
    setIsNoteModalOpen(true);
  };

  const handleQuickAddNote = (groupId: string = "") => {
    handleOpenCreateNote(groupId);
  };

  // Composer State (Khung nhập ghi chú nhanh)
  const hasInitialShare = Boolean(initialSharedTitle || initialSharedText || initialSharedImage);
  const [isComposerExpanded, setIsComposerExpanded] = useState(hasInitialShare);
  const [newTitle, setNewTitle] = useState(initialSharedTitle || "");
  const [newContent, setNewContent] = useState(initialSharedText || "");
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newSelectedTags, setNewSelectedTags] = useState<string[]>([]);
  const [newColor, setNewColor] = useState("default");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(initialSharedImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const composerContentImageInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalImageInputRef = useRef<HTMLInputElement>(null);
  const modalContentImageInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'edit' | 'preview'>('edit');
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ id?: string; name: string } | null>(null);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Alert & Confirm Modals
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

  const supabase = createClient();

  // Load user preferences from LocalStorage
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('notes_view_mode') as ViewMode | null;
      if (savedView === 'grid' || savedView === 'list' || savedView === 'accordion') {
        setViewMode(savedView);
      }
      const savedSort = localStorage.getItem('notes_sort_order') as NoteSortOption;
      if (savedSort && ['created_desc', 'updated_desc', 'created_asc', 'updated_asc'].includes(savedSort)) {
        setSortBy(savedSort);
      } else {
        setSortBy('updated_desc');
      }
      const savedGroupBy = localStorage.getItem('notes_group_by') as NoteGroupBy | null;
      if (savedGroupBy && ['group', 'date', 'none'].includes(savedGroupBy)) {
        setGroupBy(savedGroupBy);
      } else {
        setGroupBy('group');
      }
    } catch {}
  }, []);

  // Xử lý thông báo khi nhận dữ liệu chia sẻ thành công
  useEffect(() => {
    if (isSharedSuccess) {
      setAlertConfig({
        isOpen: true,
        title: "Đã lưu ghi chú chia sẻ! 📱",
        message: "Nội dung / hình ảnh đã được tự động lưu vào danh sách ghi chú của bạn.",
        type: "success"
      });
      if (typeof window !== "undefined" && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [isSharedSuccess]);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('notes_view_mode', mode); } catch {}
  };

  const changeSortBy = (sort: NoteSortOption) => {
    setSortBy(sort);
    try { localStorage.setItem('notes_sort_order', sort); } catch {}
  };

  const changeGroupBy = (mode: NoteGroupBy) => {
    setGroupBy(mode);
    try { localStorage.setItem('notes_group_by', mode); } catch {}
  };

  // Close composer / sort dropdown / groupBy dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        if (!newTitle.trim() && !newContent.trim() && !newImageUrl) {
          setIsComposerExpanded(false);
        }
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (groupByDropdownRef.current && !groupByDropdownRef.current.contains(e.target as Node)) {
        setIsGroupByDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newTitle, newContent, newImageUrl]);

  // Xử lý upload ảnh & tệp đính kèm đơn lẻ
  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/notes/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.url) return data.url;
      return null;
    } catch (err: unknown) {
      const message = formatErrorMessage(err, "Không thể tải tệp lên");
      setAlertConfig({
        isOpen: true,
        title: "Lỗi tải tệp",
        message,
        type: "error"
      });
      return null;
    }
  };

  // Upload nhiều file ảnh đồng thời
  const uploadMultipleImages = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => uploadImageFile(file));
      const results = await Promise.all(uploadPromises);
      return results.filter((url): url is string => Boolean(url));
    } finally {
      setIsUploading(false);
    }
  };

  // Xử lý Dán ảnh / tệp bằng Ctrl + V trong Khung tạo ghi chú nhanh
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles: File[] = [];
    let nonImageFile: File | null = null;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          } else if (!nonImageFile) {
            nonImageFile = file;
          }
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsComposerExpanded(true);
      const urls = await uploadMultipleImages(imageFiles);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setNewContent(prev => {
          const { newText } = insertTextAtCursor(composerTextareaRef.current, prev, markdown);
          return newText;
        });
      }
      return;
    }

    if (nonImageFile) {
      e.preventDefault();
      setIsComposerExpanded(true);
      setIsUploading(true);
      try {
        const url = await uploadImageFile(nonImageFile);
        if (url) setNewImageUrl(url);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Xử lý Kéo thả ảnh & tài liệu (Drag and Drop) trong Khung tạo ghi chú nhanh
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const nonImageFiles = files.filter(f => !f.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      setIsComposerExpanded(true);
      const urls = await uploadMultipleImages(imageFiles);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setNewContent(prev => {
          const { newText } = insertTextAtCursor(composerTextareaRef.current, prev, markdown);
          return newText;
        });
      }
    }

    if (nonImageFiles.length > 0 && !newImageUrl) {
      setIsComposerExpanded(true);
      setIsUploading(true);
      try {
        const url = await uploadImageFile(nonImageFiles[0]);
        if (url) setNewImageUrl(url);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Xử lý chọn nhiều ảnh để chèn vào nội dung ở Quick Composer
  const handleComposerContentImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const urls = await uploadMultipleImages(files);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setNewContent(prev => {
          const { newText } = insertTextAtCursor(composerTextareaRef.current, prev, markdown);
          return newText;
        });
      }
      e.target.value = '';
    }
  };

  // Tạo thẻ tag mới hoặc lấy tag đã có
  const getOrCreateTags = async (tagNames: string[]): Promise<Tag[]> => {
    const cleanNames = Array.from(new Set(
      tagNames
        .map(name => name.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean)
    ));
    const knownTags = new Map(tags.map(tag => [tag.name.toLowerCase(), tag]));
    const resultTags: Tag[] = [];
    const createdTags: Tag[] = [];

    for (const cleanName of cleanNames) {
      const existing = knownTags.get(cleanName);
      if (existing) {
        resultTags.push(existing);
        continue;
      }

      const { data, error } = await supabase
        .from('tags')
        .upsert({ user_id: userId, name: cleanName }, { onConflict: 'user_id,name' })
        .select()
        .single();

      if (error || !data) {
        throw error || new Error(`Không thể tạo tag #${cleanName}`);
      }

      const createdTag = data as Tag;
      knownTags.set(cleanName, createdTag);
      createdTags.push(createdTag);
      resultTags.push(createdTag);
    }

    if (createdTags.length > 0) {
      setTags(prev => {
        const existingIds = new Set(prev.map(tag => tag.id));
        return [...prev, ...createdTags.filter(tag => !existingIds.has(tag.id))];
      });
    }

    return resultTags;
  };

  // --- LƯU GHI CHÚ MỚI ---
  const handleCreateNote = async () => {
    if (!newTitle.trim() && !newContent.trim() && !newImageUrl) return;

    const noteType = newImageUrl ? 'image' : 'text';
    try {
      const resolvedTags = await getOrCreateTags(newSelectedTags);
      const tagIds = resolvedTags.map(tag => tag.id);
      const { data: createdNote, error } = await supabase
        .rpc('create_note_with_tags', {
          p_group_id: newGroupId || null,
          p_title: newTitle.trim() || null,
          p_content: newContent.trim() || null,
          p_type: noteType,
          p_image_url: newImageUrl,
          p_source_app: null,
          p_color: newColor,
          p_is_pinned: newIsPinned,
          p_order: 0,
          p_tag_ids: tagIds
        })
        .single();

      if (error || !createdNote) {
        throw error || new Error('Không thể tạo ghi chú');
      }

      const note = createdNote as Note;
      const tagLinks = tagIds.map(tagId => ({ note_id: note.id, tag_id: tagId }));
      setNoteTags(prev => [...prev, ...tagLinks]);
      setNotes(prev => [note, ...prev]);

      // Reset form only after the transaction succeeds.
      setNewTitle("");
      setNewContent("");
      setNewImageUrl(null);
      setNewSelectedTags([]);
      setNewTagInput("");
      setNewColor("default");
      setNewIsPinned(false);
      setIsComposerExpanded(false);
    } catch (error) {
      const message = formatErrorMessage(error, "Không thể lưu ghi chú");
      setAlertConfig({
        isOpen: true,
        title: "Lỗi lưu ghi chú",
        message,
        type: "error"
      });
    }
  };

  // --- SỬA GHI CHÚ ---
  const handleOpenEdit = (note: Note) => {
    setEditingNote({ ...note });
    const currentTagIds = noteTags.filter(nt => nt.note_id === note.id).map(nt => nt.tag_id);
    const currentTagNames = tags.filter(t => currentTagIds.includes(t.id)).map(t => t.name);
    setEditTags(currentTagNames);
    setEditTagInput("");
    setModalTab('edit');
    setIsMetadataDrawerOpen(false);
    setIsNoteModalOpen(true);
  };

  // Xử lý Dán ảnh / tệp bằng Ctrl + V trong Modal Ghi chú
  const handlePasteInModal = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles: File[] = [];
    let nonImageFile: File | null = null;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          } else if (!nonImageFile) {
            nonImageFile = file;
          }
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      const urls = await uploadMultipleImages(imageFiles);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setEditingNote(prev => {
          if (!prev) return null;
          const currentContent = prev.content || "";
          const { newText } = insertTextAtCursor(modalTextareaRef.current, currentContent, markdown);
          return { ...prev, content: newText };
        });
      }
      return;
    }

    if (nonImageFile) {
      e.preventDefault();
      if (editingNote && !editingNote.image_url) {
        setIsUploading(true);
        try {
          const url = await uploadImageFile(nonImageFile);
          if (url) setEditingNote(prev => prev ? { ...prev, image_url: url } : null);
        } finally {
          setIsUploading(false);
        }
      }
    }
  };

  // Xử lý Kéo thả ảnh & tài liệu (Drag and Drop) trong Modal Ghi chú
  const handleDropInModal = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const nonImageFiles = files.filter(f => !f.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      const urls = await uploadMultipleImages(imageFiles);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setEditingNote(prev => {
          if (!prev) return null;
          const currentContent = prev.content || "";
          const { newText } = insertTextAtCursor(modalTextareaRef.current, currentContent, markdown);
          return { ...prev, content: newText };
        });
      }
    }

    if (nonImageFiles.length > 0 && editingNote && !editingNote.image_url) {
      setIsUploading(true);
      try {
        const url = await uploadImageFile(nonImageFiles[0]);
        if (url) setEditingNote(prev => prev ? { ...prev, image_url: url } : null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Xử lý nút chọn nhiều ảnh để chèn vào nội dung trong Modal
  const handleModalContentImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const urls = await uploadMultipleImages(files);
      if (urls.length > 0) {
        const markdown = urls.map(u => `![Hình ảnh](${u})`).join('\n');
        setEditingNote(prev => {
          if (!prev) return null;
          const currentContent = prev.content || "";
          const { newText } = insertTextAtCursor(modalTextareaRef.current, currentContent, markdown);
          return { ...prev, content: newText };
        });
      }
      e.target.value = '';
    }
  };

  const handleSaveEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    if (!editingNote.title?.trim() && !editingNote.content?.trim() && !editingNote.image_url) {
      setAlertConfig({
        isOpen: true,
        title: "Chưa có nội dung",
        message: "Vui lòng nhập tiêu đề, nội dung hoặc đính kèm ảnh cho ghi chú.",
        type: "warning"
      });
      return;
    }

    if (!editingNote.id) {
      // Tạo mới ghi chú từ Modal
      const noteType = editingNote.image_url ? 'image' : 'text';
      try {
        const resolvedTags = await getOrCreateTags(editTags);
        const tagIds = resolvedTags.map(tag => tag.id);
        const { data: createdNote, error } = await supabase
          .rpc('create_note_with_tags', {
            p_group_id: editingNote.group_id || null,
            p_title: editingNote.title?.trim() || null,
            p_content: editingNote.content?.trim() || null,
            p_type: noteType,
            p_image_url: editingNote.image_url || null,
            p_source_app: editingNote.source_app || null,
            p_color: editingNote.color || 'default',
            p_is_pinned: editingNote.is_pinned || false,
            p_order: editingNote.order || 0,
            p_tag_ids: tagIds
          })
          .single();

        if (error || !createdNote) {
          throw error || new Error('Không thể tạo ghi chú');
        }

        const note = createdNote as Note;
        const newLinks = tagIds.map(tagId => ({ note_id: note.id, tag_id: tagId }));
        setNoteTags(prev => [...prev, ...newLinks]);
        setNotes(prev => [note, ...prev]);
        setIsNoteModalOpen(false);
        setEditingNote(null);
      } catch (error) {
        const message = formatErrorMessage(error, "Không thể tạo ghi chú");
        setAlertConfig({
          isOpen: true,
          title: "Lỗi tạo ghi chú",
          message,
          type: "error"
        });
      }
      return;
    }

    // Cập nhật note và thay toàn bộ tag links trong cùng một transaction DB.
    try {
      const resolvedTags = await getOrCreateTags(editTags);
      const tagIds = resolvedTags.map(tag => tag.id);
      const { data: updatedNote, error } = await supabase
        .rpc('update_note_with_tags', {
          p_note_id: editingNote.id,
          p_group_id: editingNote.group_id || null,
          p_title: editingNote.title?.trim() || null,
          p_content: editingNote.content?.trim() || null,
          p_type: editingNote.image_url ? 'image' : 'text',
          p_image_url: editingNote.image_url || null,
          p_color: editingNote.color || 'default',
          p_is_pinned: editingNote.is_pinned || false,
          p_tag_ids: tagIds
        })
        .single();

      if (error || !updatedNote) {
        throw error || new Error('Không thể cập nhật ghi chú');
      }

      const note = updatedNote as Note;
      const newLinks = tagIds.map(tagId => ({ note_id: editingNote.id, tag_id: tagId }));
      setNoteTags(prev => [
        ...prev.filter(noteTag => noteTag.note_id !== editingNote.id),
        ...newLinks
      ]);
      setNotes(prev => prev.map(existingNote => existingNote.id === editingNote.id ? note : existingNote));
      setIsNoteModalOpen(false);
      setEditingNote(null);
    } catch (error) {
      const message = formatErrorMessage(error, "Không thể cập nhật ghi chú");
      setAlertConfig({
        isOpen: true,
        title: "Lỗi cập nhật",
        message,
        type: "error"
      });
    }
  };

  // --- XOÁ GHI CHÚ ---
  const handleDeleteNote = (note: Note) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa Ghi Chú",
      message: "Bạn có chắc chắn muốn xóa ghi chú này không? Thao tác này không thể hoàn tác.",
      confirmText: "Xóa Ghi Chú",
      variant: "danger",
      onConfirm: async () => {
        setNotes(prev => prev.filter(n => n.id !== note.id));
        setNoteTags(prev => prev.filter(nt => nt.note_id !== note.id));
        await supabase.from('notes').delete().eq('id', note.id);
      }
    });
  };

  // --- GHIM / BỎ GHIM NHANH ---
  const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextPinned = !note.is_pinned;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: nextPinned } : n));
    await supabase.from('notes').update({ is_pinned: nextPinned }).eq('id', note.id);
  };

  // --- ĐỔI MÀU NHANH ---
  const handleChangeColor = async (note: Note, colorId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, color: colorId } : n));
    await supabase.from('notes').update({ color: colorId }).eq('id', note.id);
  };

  // --- COPY NỘI DUNG 1-CLICK ---
  const handleCopyNote = (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const textToCopy = [note.title, note.content].filter(Boolean).join("\n\n");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // --- QUẢN LÝ NHÓM (GROUPS) ---
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editingGroup.name.trim()) return;

    if (editingGroup.id) {
      const { data, error } = await supabase
        .from('note_groups')
        .update({ name: editingGroup.name.trim() })
        .eq('id', editingGroup.id)
        .select()
        .single();

      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi sửa nhóm", message: error.message, type: "error" });
        return;
      }
      if (data) setGroups(prev => prev.map(g => g.id === editingGroup.id ? data : g));
    } else {
      const { data, error } = await supabase
        .from('note_groups')
        .insert({
          user_id: userId,
          name: editingGroup.name.trim(),
          order: groups.length
        })
        .select()
        .single();

      if (error) {
        setAlertConfig({ isOpen: true, title: "Lỗi tạo nhóm", message: error.message, type: "error" });
        return;
      }
      if (data) {
        setGroups(prev => [...prev, data]);
        setSelectedFilter(`group:${data.id}`);
      }
    }
    setIsGroupModalOpen(false);
  };

  // Tạo nhóm nhanh trực tiếp từ ô Autocomplete
  const handleCreateGroupOnTheFly = async (name: string): Promise<string | void> => {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from('note_groups')
      .insert({
        user_id: userId,
        name: name.trim(),
        order: groups.length
      })
      .select()
      .single();

    if (data && !error) {
      setGroups(prev => [...prev, data]);
      return data.id;
    }
  };

  const handleDeleteGroup = (group: NoteGroup) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa Nhóm Ghi Chú",
      message: `Bạn có chắc chắn muốn xóa nhóm "${group.name}"? Các ghi chú bên trong sẽ được giữ lại ở mục Tất cả.`,
      confirmText: "Xóa Nhóm",
      variant: "danger",
      onConfirm: async () => {
        setGroups(prev => prev.filter(g => g.id !== group.id));
        setNotes(prev => prev.map(n => n.group_id === group.id ? { ...n, group_id: null } : n));
        if (selectedFilter === `group:${group.id}`) setSelectedFilter('all');
        await supabase.from('note_groups').delete().eq('id', group.id);
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleGroupDragEndDndKit = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // To handle two separate contexts (sidebar and accordion), strip any prefixes if used, or just use raw ID if we didn't prefix
    const draggedId = active.id.toString().replace('sidebar-', '').replace('accordion-', '');
    const targetId = over.id.toString().replace('sidebar-', '').replace('accordion-', '');

    const currentGroups = [...groups].sort((a,b) => (a.order || 0) - (b.order || 0));
    const draggedIdx = currentGroups.findIndex(g => g.id === draggedId);
    const targetIdx = currentGroups.findIndex(g => g.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const [removed] = currentGroups.splice(draggedIdx, 1);
    currentGroups.splice(targetIdx, 0, removed);

    const updatedGroups = currentGroups.map((g, index) => ({ ...g, order: index }));
    setGroups(updatedGroups);

    for (const group of updatedGroups) {
      await supabase.from('note_groups').update({ order: group.order }).eq('id', group.id);
    }
  };

  // --- LỌC VÀ TÌM KIẾM GHI CHÚ ---
  const normalizedQuery = normalizeText(searchQuery.trim());
  const isSearching = normalizedQuery.length > 0;

  const filteredNotes = notes.filter(note => {
    // Lọc theo sidebar filter
    if (selectedFilter === 'pinned' && !note.is_pinned) return false;
    if (selectedFilter === 'images' && !hasImagesOrAttachments(note)) return false;
    if (selectedFilter.startsWith('group:')) {
      const targetGroupId = selectedFilter.replace('group:', '');
      if (note.group_id !== targetGroupId) return false;
    }
    if (selectedFilter.startsWith('tag:')) {
      const targetTagId = selectedFilter.replace('tag:', '');
      const noteHasTag = noteTags.some(nt => nt.note_id === note.id && nt.tag_id === targetTagId);
      if (!noteHasTag) return false;
    }

    // Lọc theo thanh tìm kiếm (Tiêu đề, nội dung, tên tag, tên nhóm, tên file đính kèm)
    if (isSearching) {
      const titleMatch = normalizeText(note.title || '').includes(normalizedQuery);
      const contentMatch = normalizeText(stripMarkdownImages(note.content) || '').includes(normalizedQuery);
      
      const currentTagIds = noteTags.filter(nt => nt.note_id === note.id).map(nt => nt.tag_id);
      const tagMatch = tags
        .filter(t => currentTagIds.includes(t.id))
        .some(t => normalizeText(t.name).includes(normalizedQuery));

      const group = groups.find(g => g.id === note.group_id);
      const groupMatch = group ? normalizeText(group.name).includes(normalizedQuery) : false;
      const fileMatch = note.image_url ? normalizeText(getFileNameFromUrl(note.image_url)).includes(normalizedQuery) : false;

      if (!titleMatch && !contentMatch && !tagMatch && !groupMatch && !fileMatch) return false;
    }

    return true;
  });

  const sortedNotes = React.useMemo(() => {
    return [...filteredNotes].sort((a, b) => compareNotes(a, b, sortBy));
  }, [filteredNotes, sortBy]);

  const pinnedNotes = React.useMemo(() => sortedNotes.filter(n => n.is_pinned), [sortedNotes]);
  const otherNotes = React.useMemo(() => sortedNotes.filter(n => !n.is_pinned), [sortedNotes]);

  // Group notes for Accordion view
  const { groupedNotesMap, ungroupedNotes } = React.useMemo(() => {
    const map = new Map<string, Note[]>();
    const ungrouped: Note[] = [];
    
    otherNotes.forEach(note => {
      if (note.group_id) {
        if (!map.has(note.group_id)) map.set(note.group_id, []);
        map.get(note.group_id)!.push(note);
      } else {
        ungrouped.push(note);
      }
    });
    return { groupedNotesMap: map, ungroupedNotes: ungrouped };
  }, [otherNotes]);

  // Danh sách các nhóm có ghi chú, sắp xếp thông minh theo độ mới nhất (hoặc thứ tự sidebar)
  const activeSortedGroups = React.useMemo(() => {
    const groupIdsWithNotes = new Set(groupedNotesMap.keys());
    const active = groups.filter(g => groupIdsWithNotes.has(g.id));

    if (sortBy === 'updated_desc' || sortBy === 'created_desc') {
      return [...active].sort((a, b) => {
        const notesA = groupedNotesMap.get(a.id) || [];
        const notesB = groupedNotesMap.get(b.id) || [];
        if (notesA.length === 0) return 1;
        if (notesB.length === 0) return -1;
        // Ghi chú đầu tiên luôn là ghi chú mới nhất vì otherNotes đã được sort theo sortBy
        return compareNotes(notesA[0], notesB[0], sortBy);
      });
    }

    return [...active].sort((a, b) => a.order - b.order);
  }, [groups, groupedNotesMap, sortBy]);

  // Gom ghi chú theo mốc thời gian (Timeline)
  const dateGroupedNotes = React.useMemo(() => {
    const buckets: Record<DateBucketKey, Note[]> = {
      today: [],
      yesterday: [],
      last7days: [],
      thisMonth: [],
      lastMonth: [],
      older: []
    };

    otherNotes.forEach(note => {
      const dateToUse = sortBy.startsWith('created') ? note.created_at : (note.updated_at || note.created_at);
      const key = getDateBucketKey(dateToUse);
      buckets[key].push(note);
    });

    return buckets;
  }, [otherNotes, sortBy]);

  // Tổng số section đang hiển thị và danh sách ID của các section
  const allVisibleSectionIds = React.useMemo(() => {
    if (selectedFilter.startsWith('group:')) return [];
    if (groupBy === 'group') {
      const ids = activeSortedGroups.map(g => `group-${g.id}`);
      if (ungroupedNotes.length > 0) ids.push('group-ungrouped');
      return ids;
    }
    if (groupBy === 'date') {
      return DATE_BUCKETS.filter(b => dateGroupedNotes[b.key].length > 0).map(b => `date-${b.key}`);
    }
    return [];
  }, [groupBy, selectedFilter, activeSortedGroups, ungroupedNotes, dateGroupedNotes]);

  const visibleSectionsCount = allVisibleSectionIds.length;

  const areAllSectionsCollapsed = React.useMemo(() => {
    if (allVisibleSectionIds.length <= 1) return false;
    return allVisibleSectionIds.every(id => Boolean(collapsedSections[id]));
  }, [allVisibleSectionIds, collapsedSections]);

  const toggleAllSections = () => {
    if (areAllSectionsCollapsed) {
      // Mở tất cả
      setCollapsedSections({});
    } else {
      // Thu gọn tất cả
      const newMap: Record<string, boolean> = {};
      allVisibleSectionIds.forEach(id => {
        newMap[id] = true;
      });
      setCollapsedSections(newMap);
    }
  };

  // Helper render danh sách thẻ ghi chú
  const renderNotesGrid = (notesToRender: Note[], extraClass: string = "") => {
    if (notesToRender.length === 0) return null;
    const isGrid = viewMode !== 'list';
    return (
      <div className={`${isGrid ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start" : "space-y-3"} ${extraClass}`}>
        {notesToRender.map(note => (
          <NoteCardItem
            key={note.id}
            note={note}
            groups={groups}
            copiedId={copiedId}
            viewMode={viewMode === 'list' ? 'list' : 'grid'}
            sortBy={sortBy}
            onOpenEdit={handleOpenEdit}
            onTogglePin={handleTogglePin}
            onChangeColor={handleChangeColor}
            onCopyNote={handleCopyNote}
            onDeleteNote={handleDeleteNote}
            onViewImage={setLightboxImage}
            renderTags={renderNoteTags}
          />
        ))}
      </div>
    );
  };

  // Helper render tags của 1 note
  const renderNoteTags = (noteId: string) => {
    const currentTagIds = noteTags.filter(nt => nt.note_id === noteId).map(nt => nt.tag_id);
    const noteTagList = tags.filter(t => currentTagIds.includes(t.id));
    if (noteTagList.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {noteTagList.map(t => (
          <span 
            key={t.id}
            onClick={(e) => { e.stopPropagation(); setSelectedFilter(`tag:${t.id}`); }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 border border-zinc-700/50 transition-colors cursor-pointer"
          >
            #{t.name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex bg-[#13171a] text-zinc-100 relative overflow-hidden">
      
      {/* SIDEBAR BÊN TRÁI: Phân loại nhóm & tags */}
      <aside className={`transition-all duration-300 ease-in-out border-r border-zinc-800/80 bg-[#161b1e] flex flex-col shrink-0 ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-none'}`}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Quick Note</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Bộ lọc chính */}
          <div className="space-y-1">
            <button
              onClick={() => { setSelectedFilter('all'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedFilter === 'all' 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText size={15} />
                <span>Tất cả ghi chú</span>
              </div>
            </button>

            <button
              onClick={() => { setSelectedFilter('pinned'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedFilter === 'pinned' 
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' 
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Pin size={15} />
                <span>Đã ghim</span>
              </div>
            </button>

            <button
              onClick={() => { setSelectedFilter('images'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedFilter === 'images' 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Paperclip size={15} />
                <span>Có tệp đính kèm</span>
              </div>
            </button>
          </div>

          {/* Danh sách Nhóm (Groups) */}
          <DndContext id="notes-sidebar-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEndDndKit}>
            <div>
              <div className="flex items-center justify-between px-2 mb-2 mt-4">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nhóm Chủ Đề</span>
                <button 
                  onClick={() => { setEditingGroup({ name: "" }); setIsGroupModalOpen(true); }}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  + Thêm
                </button>
              </div>
              <div className="space-y-0.5">
                <SortableContext items={[...groups].sort((a, b) => a.order - b.order).map(g => `sidebar-${g.id}`)} strategy={verticalListSortingStrategy}>
                  {[...groups].sort((a, b) => a.order - b.order).map(group => {
                    const isSelected = selectedFilter === `group:${group.id}`;
                    return (
                      <SortableNoteGroupWrapper key={`sidebar-${group.id}`} id={`sidebar-${group.id}`}>
                        {({ setNodeRef, attributes, listeners, style, isDragging }) => (
                          <div
                            ref={setNodeRef}
                            style={style}
                            onClick={() => { setSelectedFilter(`group:${group.id}`); setIsSidebarOpen(false); }}
                            className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer transition-all ${
                              isSelected
                              ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                              : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                            } ${isDragging ? "ring-2 ring-blue-500 shadow-xl opacity-50" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div 
                                {...attributes} 
                                {...listeners} 
                                className="text-zinc-600 lg:opacity-0 group-hover:opacity-100 cursor-grab shrink-0 transition-opacity p-1 -ml-1 rounded hover:bg-zinc-800 touch-none"
                              >
                                <GripVertical size={13} className="pointer-events-none" />
                              </div>
                              <Folder size={14} className={isSelected ? 'text-blue-400' : 'text-zinc-500'} />
                              <span className="truncate">{group.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">{groupedNotesMap.get(group.id)?.length || 0}</span>
                            </div>
                          </div>
                        )}
                      </SortableNoteGroupWrapper>
                    );
                  })}
                </SortableContext>
              </div>
            </div>
          </DndContext>

          {/* Danh sách Thẻ (Tags) */}
          {tags.length > 0 && (
            <div>
              <div className="px-2 mb-2 mt-4">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Thẻ Thường Dùng</span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-1">
                {tags.map(tag => {
                  const isSelected = selectedFilter === `tag:${tag.id}`;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => { setSelectedFilter(isSelected ? 'all' : `tag:${tag.id}`); setIsSidebarOpen(false); }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold shadow-sm'
                          : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                      }`}
                    >
                      <TagIcon size={10} />
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <BuildTimeBadge className="border-t border-zinc-800 bg-[#121618]" />
      </aside>

      {/* NỘI DUNG CHÍNH (DANH SÁCH GHI CHÚ) */}
      <div className="flex-1 w-full md:w-auto shrink-0 md:shrink flex flex-col min-w-0 bg-[#0e1113] relative overflow-hidden transition-all duration-300">
        
        {/* Header trên cùng */}
        <header className="h-14 sm:h-16 px-3.5 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-[#181d20] relative z-30 shrink-0 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-2 sm:p-1.5 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ${isSidebarOpen ? 'bg-zinc-800 text-blue-400' : ''}`}
              title={isSidebarOpen ? "Ẩn danh mục" : "Hiện danh mục"}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-zinc-100 flex items-center gap-1.5 truncate">
              {isSearching ? (
                <>
                  <Search size={16} className="text-blue-400 shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-md">Tìm: &quot;{searchQuery}&quot;</span>
                  <span className="text-xs bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full shrink-0">{filteredNotes.length}</span>
                </>
              ) : (
                <>
                  <span className="truncate">
                    {selectedFilter === 'all' && 'Tất cả ghi chú'}
                    {selectedFilter === 'pinned' && 'Đã ghim ⭐'}
                    {selectedFilter === 'images' && 'Có tệp đính kèm 📎'}
                    {selectedFilter.startsWith('group:') && (groups.find(g => g.id === selectedFilter.replace('group:', ''))?.name || 'Nhóm')}
                    {selectedFilter.startsWith('tag:') && `#${tags.find(t => t.id === selectedFilter.replace('tag:', ''))?.name || 'Tag'}`}
                  </span>
                </>
              )}
            </h1>
          </div>

          {/* Thanh tìm kiếm Note (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl relative mx-2">
            <div className="relative flex items-center w-full">
              <Search size={18} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề, nội dung, #tag..."
                className="w-full h-10 pl-11 pr-10 bg-[#20262b] hover:bg-[#283036] focus:bg-[#151a1e] text-zinc-100 placeholder:text-zinc-500 rounded-xl text-sm transition-all border border-zinc-700/80 focus:border-blue-500/80 focus:ring-4 focus:ring-blue-500/15 shadow-sm outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-700/50"
                  title="Xóa tìm kiếm"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Controls: Tìm kiếm Mobile & Đổi chế độ xem Lưới / Danh sách */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút tìm kiếm mobile */}
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="md:hidden p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              title="Tìm kiếm"
            >
              <Search size={18} />
            </button>

            {/* Bộ chọn sắp xếp (Sort Dropdown) */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium border transition-all ${
                  isSortDropdownOpen 
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' 
                    : 'bg-[#20262b] text-zinc-300 hover:text-white border-zinc-700/80 hover:border-zinc-600'
                }`}
                title="Sắp xếp ghi chú"
              >
                <ArrowUpDown size={15} className="text-blue-400 shrink-0" />
                <span className="hidden sm:inline">
                  {SORT_OPTIONS.find(o => o.id === sortBy)?.shortLabel || 'Sắp xếp'}
                </span>
                <ChevronDown size={13} className={`transition-transform duration-200 text-zinc-400 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#181d20] border border-zinc-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                    <span>Sắp xếp ghi chú</span>
                    <ArrowUpDown size={12} className="text-blue-400" />
                  </div>
                  <div className="py-1 space-y-0.5">
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            changeSortBy(opt.id);
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-600/20 text-blue-300 font-semibold'
                              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-zinc-500 line-clamp-1">
                              {opt.desc}
                            </span>
                          </div>
                          {isSelected && <Check size={14} className="text-blue-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bộ chọn Gom nhóm (Group By Dropdown) - Hiển thị trong Grid & List */}
            {viewMode !== 'accordion' && (
              <div className="relative" ref={groupByDropdownRef}>
                <button
                  onClick={() => setIsGroupByDropdownOpen(!isGroupByDropdownOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium border transition-all ${
                    groupBy !== 'none'
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' 
                      : 'bg-[#20262b] text-zinc-300 hover:text-white border-zinc-700/80 hover:border-zinc-600'
                  }`}
                  title="Phân chia / Gom nhóm hiển thị"
                >
                  <Layers size={15} className="text-blue-400 shrink-0" />
                  <span className="hidden sm:inline">
                    {GROUP_BY_OPTIONS.find(o => o.id === groupBy)?.shortLabel || 'Gom nhóm'}
                  </span>
                  <ChevronDown size={13} className={`transition-transform duration-200 text-zinc-400 ${isGroupByDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isGroupByDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-[#181d20] border border-zinc-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                      <span>Phân nhóm hiển thị</span>
                      <Layers size={12} className="text-blue-400" />
                    </div>
                    <div className="py-1 space-y-0.5">
                      {GROUP_BY_OPTIONS.map((opt) => {
                        const isSelected = groupBy === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              changeGroupBy(opt.id);
                              setIsGroupByDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-600/20 text-blue-300 font-semibold'
                                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 font-medium">
                                {opt.id === 'group' && <Folder size={13} className="text-blue-400 shrink-0" />}
                                {opt.id === 'date' && <Clock size={13} className="text-blue-400 shrink-0" />}
                                {opt.id === 'none' && <LayoutGrid size={13} className="text-zinc-400 shrink-0" />}
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-zinc-500 line-clamp-1">
                                {opt.desc}
                              </span>
                            </div>
                            {isSelected && <Check size={14} className="text-blue-400 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 bg-[#20262b] p-1 rounded-xl border border-zinc-700/80">
              <button
                onClick={() => changeViewMode('grid')}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Chế độ Lưới (Grid)"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                onClick={() => changeViewMode('list')}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Chế độ Danh sách (List)"
              >
                <List size={17} />
              </button>
              <button
                onClick={() => changeViewMode('accordion')}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'accordion' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Chế độ Gom theo nhóm (Accordion)"
              >
                <Folder size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Nội dung danh sách ghi chú & Ô nhập nhanh */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-28 md:pb-8 space-y-4 sm:space-y-6">
          
          {/* KHUNG SOẠN THẢO GHI CHÚ NHANH & NÚT SEARCH (MOBILE BOTTOM BAR / DESKTOP HEADER) */}
          <div className={`fixed bottom-14 left-0 right-0 p-3 bg-[#13171a]/95 backdrop-blur z-40 border-t border-zinc-800 flex items-center gap-2 md:static md:bg-transparent md:border-none md:p-0 md:max-w-2xl md:mx-auto md:block ${isComposerExpanded ? 'bottom-0 h-screen md:h-auto bg-[#13171a] p-4 flex-col justify-center' : ''}`}>
            
            {/* Vùng mờ để click ra ngoài tắt composer trên mobile */}
            {isComposerExpanded && <div className="absolute inset-0 z-0 bg-black/40 md:hidden" onClick={() => setIsComposerExpanded(false)} />}
            
            <div 
              ref={composerRef}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`relative z-10 w-full bg-[#1a2024] border border-zinc-700/80 rounded-2xl shadow-xl transition-all duration-200 ${
                isComposerExpanded ? 'ring-2 ring-blue-500/40 p-4' : 'p-3 hover:border-zinc-600'
              }`}
            >
              {/* Preview tệp / ảnh đính kèm nếu có */}
              {newImageUrl && (
                <div className="mb-3">
                  <AttachmentDisplay 
                    url={newImageUrl} 
                    onRemove={() => setNewImageUrl(null)} 
                    onViewImage={setLightboxImage} 
                  />
                </div>
              )}

              {/* Ô nhập tiêu đề (hiện khi mở rộng) */}
              {isComposerExpanded && (
                <div className="flex items-start justify-between mb-3 pb-2 border-b border-zinc-800/80 gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Tiêu đề (tuỳ chọn)"
                    className="w-full bg-transparent text-base md:text-lg font-bold text-zinc-100 placeholder:text-zinc-500 outline-none"
                  />
                  <button
                    onClick={() => setNewIsPinned(!newIsPinned)}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${newIsPinned ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title={newIsPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  >
                    <Pin size={16} />
                  </button>
                </div>
              )}

              {/* Ô nhập nội dung chính */}
              <textarea
                ref={composerTextareaRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onFocus={() => setIsComposerExpanded(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCreateNote();
                  }
                }}
                placeholder={isComposerExpanded ? "Nội dung ghi chú... (Hỗ trợ paste nhiều ảnh / kéo thả tệp)" : "Tạo ghi chú nhanh... (Hỗ trợ paste nhiều ảnh / kéo thả tệp)"}
                rows={isComposerExpanded ? 3 : 1}
                className="w-full bg-transparent text-base md:text-sm text-zinc-200 placeholder:text-zinc-500 outline-none resize-none"
              />

              {/* Danh sách ảnh đã chèn trong nội dung (Composer preview) */}
              {isComposerExpanded && extractMarkdownImages(newContent).length > 0 && (
                <div className="my-2 p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                  <div className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ImageIcon size={14} className="text-emerald-400" />
                      Ảnh trong nội dung ({extractMarkdownImages(newContent).length})
                    </span>
                    <span className="text-xs text-zinc-400">Bấm X để gỡ</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractMarkdownImages(newContent).map((img, idx) => (
                      <div key={idx} className="relative group/thumb w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 bg-black/40 shrink-0">
                        <img 
                          src={img.url} 
                          alt={img.alt} 
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => setLightboxImage(img.url)}
                        />
                        <button
                          type="button"
                          onClick={() => setNewContent(prev => removeMarkdownImage(prev, img.url))}
                          className="absolute top-0.5 right-0.5 p-1 bg-black/80 hover:bg-red-600 text-white rounded-full transition-colors"
                          title="Gỡ ảnh khỏi nội dung"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags đang chọn */}
              {isComposerExpanded && newSelectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-2">
                  {newSelectedTags.map(tagName => (
                    <span key={tagName} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30">
                      #{tagName}
                      <button onClick={() => setNewSelectedTags(prev => prev.filter(t => t !== tagName))} className="hover:text-red-400 p-0.5">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Footer thanh công cụ khi mở rộng */}
              {isComposerExpanded && (
                <div className="flex flex-wrap items-center justify-between pt-3 mt-2 border-t border-zinc-800/80 gap-2">
                  
                  {/* Công cụ bên trái: Chọn nhóm, thêm tag, thêm ảnh, chọn màu */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    
                    {/* Nút Upload nhiều Ảnh vào nội dung */}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      ref={composerContentImageInputRef}
                      className="hidden"
                      onChange={handleComposerContentImagesUpload}
                    />
                    <button
                      type="button"
                      onClick={() => composerContentImageInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 sm:p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-xl transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
                      title="Chèn nhiều hình ảnh vào nội dung ghi chú (hoặc Ctrl+V)"
                    >
                      <ImageIcon size={18} />
                      <span>Chèn ảnh</span>
                    </button>

                    {/* Nút Upload Tệp đính kèm */}
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                      ref={imageInputRef}
                      className="hidden"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsUploading(true);
                          try {
                            const url = await uploadImageFile(e.target.files[0]);
                            if (url) setNewImageUrl(url);
                          } finally {
                            setIsUploading(false);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 sm:p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-xl transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
                      title="Đính kèm tệp / ảnh (PDF, Word, Excel, TXT, Ảnh)"
                    >
                      <Paperclip size={18} />
                      <span>{isUploading ? "Đang tải..." : "Đính kèm"}</span>
                    </button>

                    {/* Chọn Nhóm (Autocomplete Search Box) */}
                    <AutocompleteSearchBox
                      value={newGroupId}
                      onChange={setNewGroupId}
                      items={groups.map(g => ({
                        id: g.id,
                        name: g.name,
                        badge: groupedNotesMap.get(g.id)?.length
                      }))}
                      placement="top"
                      className="w-36 sm:w-44"
                      onCreate={handleCreateGroupOnTheFly}
                    />

                    {/* Thêm Tag nhanh */}
                    <div className="flex items-center bg-zinc-800/80 border border-zinc-700 rounded-xl h-8 sm:h-7 px-2.5">
                      <TagIcon size={14} className="text-zinc-500 mr-1.5 shrink-0" />
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTagInput.trim()) {
                            e.preventDefault();
                            const clean = newTagInput.trim().replace(/^#/, '');
                            if (clean && !newSelectedTags.includes(clean)) {
                              setNewSelectedTags(prev => [...prev, clean]);
                              setNewTagInput("");
                            }
                          }
                        }}
                        placeholder="Thêm tag..."
                        className="bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 w-20 sm:w-24 outline-none"
                      />
                    </div>

                    {/* Bảng chọn màu */}
                    <div className="flex items-center gap-1.5 ml-1">
                      {NOTE_COLORS.slice(0, 5).map(c => (
                        <button
                          key={c.id}
                          onClick={() => setNewColor(c.id)}
                          className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full border transition-transform ${c.bg} ${newColor === c.id ? 'scale-110 border-blue-400 ring-2 ring-blue-500/40' : 'border-zinc-600'}`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Nút Đóng & Lưu Note bên phải */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsComposerExpanded(false)}
                      className="px-3 py-2 text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={handleCreateNote}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors flex items-center gap-1"
                    >
                      Lưu Note
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nút Tìm Kiếm Mobile */}
            {!isComposerExpanded && (
              <button 
                onClick={() => setIsMobileSearchOpen(true)}
                className="md:hidden shrink-0 w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg border border-blue-500/50 hover:bg-blue-500 transition-colors"
                title="Tìm kiếm"
              >
                <Search size={20} />
              </button>
            )}
          </div>

          {selectedFilter === 'all' && !isSearching && viewMode === 'accordion' ? (
            /* ========================================================
               CHẾ ĐỘ ACCORDION (KHI XEM GOM THEO NHÓM)
               ======================================================== */
            <div className="space-y-4 pb-10">
              
              {/* 1. ACCORDION: ĐÃ GHIM */}
              {pinnedNotes.length > 0 && (
                <div className="bg-[#13171a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  <div 
                    onClick={() => toggleAccordion('pinned')}
                    className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 text-amber-400">
                      <button className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                        {isAccordionOpen('pinned') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      <Pin size={18} />
                      <span className="font-bold text-sm sm:text-base uppercase tracking-wider">Đã ghim</span>
                      <span className="text-xs text-zinc-300 font-mono bg-zinc-800/80 px-2.5 py-0.5 rounded-full">{pinnedNotes.length}</span>
                    </div>
                  </div>
                  {isAccordionOpen('pinned') && (
                    <div className="p-3.5 sm:p-4 pt-0 border-t border-zinc-800/50">
                      {renderNotesGrid(pinnedNotes, "mt-3 sm:mt-4")}
                    </div>
                  )}
                </div>
              )}

              {/* 2. DANH SÁCH ACCORDION CÁC NHÓM */}
              <DndContext id="notes-main-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEndDndKit}>
                <SortableContext items={[...groups].sort((a, b) => a.order - b.order).map(g => `accordion-${g.id}`)} strategy={verticalListSortingStrategy}>
                  {[...groups].sort((a, b) => a.order - b.order).map(group => {
                    const groupNotes = groupedNotesMap.get(group.id) || [];
                    return (
                      <SortableNoteGroupWrapper key={`accordion-${group.id}`} id={`accordion-${group.id}`}>
                        {({ setNodeRef, attributes, listeners, style, isDragging }) => (
                          <div 
                            ref={setNodeRef}
                            style={style}
                            className={`bg-[#13171a] border rounded-2xl overflow-hidden shadow-sm transition-all border-zinc-800/80 mb-4 ${isDragging ? "ring-2 ring-blue-500 opacity-50" : ""}`}
                          >
                            <div className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors">
                              <div className="flex items-center gap-2.5 sm:gap-3 text-blue-400 flex-1 min-w-0" onClick={() => toggleAccordion(group.id)}>
                                <div 
                                  {...attributes} 
                                  {...listeners} 
                                  className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded-lg hover:bg-zinc-800 touch-none" 
                                  title="Kéo để sắp xếp"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical size={16} className="pointer-events-none" />
                                </div>
                                <button className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1">
                                  {isAccordionOpen(group.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </button>
                                <Folder size={18} className="shrink-0" />
                                <span className="font-bold text-sm sm:text-base truncate">{group.name}</span>
                                <span className="text-xs text-zinc-300 font-mono bg-zinc-800/80 px-2.5 py-0.5 rounded-full shrink-0">{groupNotes.length}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setIsGroupModalOpen(true); }}
                                  className="p-2 sm:p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors"
                                  title="Sửa nhóm"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                                  className="p-2 sm:p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                  title="Xoá nhóm"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleQuickAddNote(group.id); }}
                                  className="text-xs sm:text-sm text-zinc-300 hover:text-blue-400 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 shrink-0 ml-1"
                                  title="Thêm ghi chú vào nhóm này"
                                >
                                  <Plus size={16} /> <span className="hidden sm:inline">Thêm</span>
                                </button>
                              </div>
                            </div>
                            
                            {isAccordionOpen(group.id) && groupNotes.length > 0 && (
                              <div className="p-3.5 sm:p-4 pt-0 border-t border-zinc-800/50">
                                {renderNotesGrid(groupNotes, "mt-3 sm:mt-4")}
                              </div>
                            )}
                          </div>
                        )}
                      </SortableNoteGroupWrapper>
                    );
                  })}
                </SortableContext>
              </DndContext>

              {/* 3. ACCORDION: KHÔNG PHÂN NHÓM */}
              {ungroupedNotes.length > 0 && (
                <div className="bg-[#13171a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  <div 
                    onClick={() => toggleAccordion('ungrouped')}
                    className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 text-zinc-300 flex-1 min-w-0">
                      <button className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1">
                        {isAccordionOpen('ungrouped') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      <FileText size={18} className="shrink-0" />
                      <span className="font-bold text-sm sm:text-base uppercase tracking-wider truncate">Không phân nhóm</span>
                      <span className="text-xs text-zinc-400 font-mono bg-zinc-800/80 px-2.5 py-0.5 rounded-full shrink-0">{ungroupedNotes.length}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleQuickAddNote(""); }}
                      className="text-xs sm:text-sm text-zinc-300 hover:text-blue-400 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 shrink-0 ml-1"
                    >
                      <Plus size={16} /> <span className="hidden sm:inline">Thêm ghi chú</span>
                    </button>
                  </div>
                  {isAccordionOpen('ungrouped') && (
                    <div className="p-3.5 sm:p-4 pt-0 border-t border-zinc-800/50">
                      {renderNotesGrid(ungroupedNotes, "mt-3 sm:mt-4")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               CHẾ ĐỘ TÌM KIẾM / LỌC (FLAT VIEW TRỰC QUAN)
               ======================================================== */
            <div className="space-y-4 pb-10">
              {/* Header thông tin tìm kiếm */}
              {isSearching && (
                <div className="flex items-center justify-between p-3 bg-[#161c20] border border-zinc-800 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Search size={14} className="text-blue-400" />
                    <span>
                      Tìm thấy <strong className="text-blue-400 font-bold">{filteredNotes.length}</strong> kết quả cho <span className="text-zinc-100 font-semibold">&quot;{searchQuery}&quot;</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-zinc-400 hover:text-blue-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                  >
                    <X size={12} /> Xóa tìm kiếm
                  </button>
                </div>
              )}

              {/* DANH SÁCH GHI CHÚ ĐÃ GHIM */}
              {pinnedNotes.length > 0 && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400/80 uppercase tracking-wider">
                    <Pin size={13} />
                    <span>Đã ghim ({pinnedNotes.length})</span>
                  </div>
                  {renderNotesGrid(pinnedNotes)}
                </div>
              )}

              {/* DANH SÁCH GHI CHÚ KHÁC */}
              <div className="space-y-4">
                {pinnedNotes.length > 0 && otherNotes.length > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider pb-1">
                    <span>{isSearching ? `Kết quả khác (${otherNotes.length})` : `Ghi chú (${otherNotes.length})`}</span>
                    {visibleSectionsCount > 1 && (
                      <button
                        onClick={toggleAllSections}
                        className="text-[11px] font-normal normal-case text-zinc-400 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg hover:bg-zinc-800/80"
                      >
                        {areAllSectionsCollapsed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>{areAllSectionsCollapsed ? 'Mở tất cả nhóm' : 'Thu gọn tất cả'}</span>
                      </button>
                    )}
                  </div>
                )}

                {pinnedNotes.length === 0 && otherNotes.length > 0 && visibleSectionsCount > 1 && (
                  <div className="flex items-center justify-between text-xs text-zinc-500 pb-1">
                    <span className="font-semibold text-zinc-400">
                      {isSearching ? `Tìm thấy ${otherNotes.length} ghi chú` : `Tổng cộng ${otherNotes.length} ghi chú`}
                    </span>
                    <button
                      onClick={toggleAllSections}
                      className="text-[11px] text-zinc-400 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg hover:bg-zinc-800/80"
                    >
                      {areAllSectionsCollapsed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>{areAllSectionsCollapsed ? 'Mở tất cả nhóm' : 'Thu gọn tất cả'}</span>
                    </button>
                  </div>
                )}

                {filteredNotes.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
                      {isSearching ? <Search size={24} /> : <FileText size={24} />}
                    </div>
                    <p className="text-sm font-semibold text-zinc-300">
                      {isSearching ? `Không tìm thấy ghi chú nào khớp với "${searchQuery}"` : "Chưa có ghi chú nào trong mục này"}
                    </p>
                    {isSearching ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors inline-block"
                      >
                        Xóa tìm kiếm
                      </button>
                    ) : (
                      <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                        Hãy dùng khung soạn thảo phía trên để tạo ghi chú nhanh, paste ảnh chụp màn hình (Ctrl+V) hoặc kéo thả file.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Trường hợp 1: Phân nhóm theo Nhóm chủ đề (Folder/Topic) */}
                    {groupBy === 'group' && !selectedFilter.startsWith('group:') ? (
                      <div className="space-y-6">
                        {/* Render từng nhóm có ghi chú */}
                        {activeSortedGroups.map(group => {
                          const groupNotes = groupedNotesMap.get(group.id) || [];
                          const secId = `group-${group.id}`;
                          const isCollapsed = isSectionCollapsed(secId);
                          return (
                            <div key={group.id} className="space-y-3">
                              {/* Header nhóm */}
                              <div
                                onClick={() => toggleSection(secId)}
                                className="flex items-center justify-between py-2 px-1 border-b border-zinc-800/80 cursor-pointer group/sec select-none transition-colors hover:border-zinc-700"
                              >
                                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    className="text-zinc-500 group-hover/sec:text-zinc-300 transition-colors p-0.5 rounded"
                                    title={isCollapsed ? "Mở rộng nhóm" : "Thu gọn nhóm"}
                                  >
                                    {isCollapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                                  </button>
                                  <Folder size={17} className="text-blue-400 shrink-0" />
                                  <h3 className="font-bold text-sm sm:text-base text-zinc-100 group-hover/sec:text-white transition-colors truncate">
                                    {group.name}
                                  </h3>
                                  <span className="text-xs text-zinc-400 font-mono bg-zinc-800/90 px-2.5 py-0.5 rounded-full border border-zinc-700/50 shrink-0">
                                    {groupNotes.length}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleQuickAddNote(group.id)}
                                    className="text-xs text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium border border-transparent hover:border-blue-500/20"
                                    title={`Thêm ghi chú vào ${group.name}`}
                                  >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">Thêm vào nhóm</span>
                                  </button>
                                </div>
                              </div>

                              {/* Lưới ghi chú của nhóm */}
                              {!isCollapsed && renderNotesGrid(groupNotes)}
                            </div>
                          );
                        })}

                        {/* Render phần ghi chú chưa phân nhóm */}
                        {ungroupedNotes.length > 0 && (
                          <div key="ungrouped" className="space-y-3 pt-1">
                            <div
                              onClick={() => toggleSection('group-ungrouped')}
                              className="flex items-center justify-between py-2 px-1 border-b border-zinc-800/80 cursor-pointer group/sec select-none transition-colors hover:border-zinc-700"
                            >
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  className="text-zinc-500 group-hover/sec:text-zinc-300 transition-colors p-0.5 rounded"
                                  title={isSectionCollapsed('group-ungrouped') ? "Mở rộng" : "Thu gọn"}
                                >
                                  {isSectionCollapsed('group-ungrouped') ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                                </button>
                                <FileText size={17} className="text-zinc-400 shrink-0" />
                                <h3 className="font-bold text-sm sm:text-base text-zinc-300 group-hover/sec:text-white transition-colors truncate">
                                  Chưa phân nhóm
                                </h3>
                                <span className="text-xs text-zinc-400 font-mono bg-zinc-800/90 px-2.5 py-0.5 rounded-full border border-zinc-700/50 shrink-0">
                                  {ungroupedNotes.length}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleQuickAddNote("")}
                                  className="text-xs text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium border border-transparent hover:border-blue-500/20"
                                  title="Thêm ghi chú chưa phân nhóm"
                                >
                                  <Plus size={14} />
                                  <span className="hidden sm:inline">Thêm ghi chú</span>
                                </button>
                              </div>
                            </div>

                            {!isSectionCollapsed('group-ungrouped') && renderNotesGrid(ungroupedNotes)}
                          </div>
                        )}

                        {/* Nếu không có nhóm nào và cũng không có ungroupedNotes (trường hợp hiếm) */}
                        {activeSortedGroups.length === 0 && ungroupedNotes.length === 0 && (
                          renderNotesGrid(otherNotes)
                        )}
                      </div>
                    ) : groupBy === 'date' ? (
                      /* Trường hợp 2: Phân nhóm theo Mốc thời gian (Timeline) */
                      <div className="space-y-6">
                        {DATE_BUCKETS.map(bucket => {
                          const bNotes = dateGroupedNotes[bucket.key];
                          if (bNotes.length === 0) return null;
                          const secId = `date-${bucket.key}`;
                          const isCollapsed = isSectionCollapsed(secId);
                          return (
                            <div key={bucket.key} className="space-y-3">
                              <div
                                onClick={() => toggleSection(secId)}
                                className="flex items-center justify-between py-2 px-1 border-b border-zinc-800/80 cursor-pointer group/sec select-none transition-colors hover:border-zinc-700"
                              >
                                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    className="text-zinc-500 group-hover/sec:text-zinc-300 transition-colors p-0.5 rounded"
                                    title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                                  >
                                    {isCollapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                                  </button>
                                  <Clock size={16} className="text-blue-400 shrink-0" />
                                  <h3 className="font-bold text-sm sm:text-base text-zinc-200 group-hover/sec:text-white transition-colors truncate">
                                    {bucket.label}
                                  </h3>
                                  <span className="text-xs text-zinc-400 font-mono bg-zinc-800/90 px-2.5 py-0.5 rounded-full border border-zinc-700/50 shrink-0">
                                    {bNotes.length}
                                  </span>
                                </div>
                              </div>

                              {!isCollapsed && renderNotesGrid(bNotes)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Trường hợp 3: Dạng phẳng (Không gom nhóm) hoặc Đang lọc riêng 1 nhóm */
                      renderNotesGrid(otherNotes)
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL TẠO / SỬA CHI TIẾT GHI CHÚ - TOÀN MÀN HÌNH TẬP TRUNG NỘI DUNG */}
      {isNoteModalOpen && editingNote && (
        <div className="fixed inset-0 z-[80] bg-[#0e1113] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <form onSubmit={handleSaveEditNote} className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Hidden file input for modal multiple content images */}
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={modalContentImageInputRef}
              onChange={handleModalContentImagesUpload}
            />

            {/* Hidden file input for modal attachment */}
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
              className="hidden"
              ref={modalImageInputRef}
              onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  setIsUploading(true);
                  try {
                    const url = await uploadImageFile(e.target.files[0]);
                    if (url) setEditingNote(prev => prev ? { ...prev, image_url: url } : null);
                  } finally {
                    setIsUploading(false);
                  }
                }
              }}
            />

            {/* Top Bar Navigation Header */}
            <header className="h-14 sm:h-16 px-3 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-[#14191d]/90 backdrop-blur shrink-0 gap-2 sm:gap-3">
              {/* Nút Quay lại */}
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors text-xs sm:text-sm"
                title="Đóng (Esc)"
              >
                <ArrowLeft size={20} />
                <span className="font-semibold hidden sm:inline">Quay lại</span>
              </button>

              {/* Trạng thái & Tiêu đề rút gọn ở Header */}
              <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-1">
                {/* Segmented Mode Switcher */}
                <div className="flex items-center bg-zinc-800/90 p-1 rounded-xl border border-zinc-700/60 text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setModalTab('edit')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                      modalTab === 'edit'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Chuyển sang chế độ chỉnh sửa"
                  >
                    <PenLine size={15} />
                    <span>Soạn thảo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                      modalTab === 'preview'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Chuyển sang chế độ xem trước trực quan"
                  >
                    <Eye size={15} />
                    <span>Xem trước</span>
                  </button>
                </div>
              </div>

              {/* Action buttons góc phải */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Nút Ghim */}
                <button
                  type="button"
                  onClick={() => setEditingNote(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : null)}
                  className={`p-2 rounded-xl transition-colors text-xs ${editingNote.is_pinned ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  title={editingNote.is_pinned ? "Bỏ ghim" : "Ghim ghi chú"}
                >
                  <Pin size={18} className={editingNote.is_pinned ? "fill-amber-400" : ""} />
                </button>

                {/* Nút Chèn ảnh vào nội dung */}
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('edit');
                    modalContentImageInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-xl transition-colors"
                  title="Chèn nhiều ảnh vào nội dung ghi chú (hoặc Ctrl+V dán ảnh)"
                >
                  <ImageIcon size={18} />
                </button>

                {/* Nút Đính kèm nhanh */}
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('edit');
                    modalImageInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-xl transition-colors"
                  title="Đính kèm tệp / ảnh"
                >
                  <Paperclip size={18} />
                </button>

                {/* Nút Mở rộng menu Tuỳ chọn (Nhóm, Màu, Tag) */}
                <button
                  type="button"
                  onClick={() => setIsMetadataDrawerOpen(!isMetadataDrawerOpen)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                    isMetadataDrawerOpen
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                      : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/80"
                  }`}
                  title="Tuỳ chọn nhóm, tag, màu sắc"
                >
                  <SlidersHorizontal size={16} />
                  <span className="hidden md:inline">Tuỳ chọn</span>
                  {(editingNote.group_id || editTags.length > 0 || editingNote.color !== 'default') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  )}
                </button>

                {/* Nút Xoá ghi chú (nếu sửa) */}
                {editingNote.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingNote) {
                        setIsNoteModalOpen(false);
                        handleDeleteNote(editingNote);
                      }
                    }}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors hidden sm:flex"
                    title="Xoá ghi chú"
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                {/* Nút Lưu */}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{editingNote.id ? "Lưu" : "Tạo"}</span>
                </button>
              </div>
            </header>

            {/* Main Workspace Layout */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* MAIN CONTENT AREA - Không gian lớn, thoáng đãng để đọc và viết */}
              <main 
                onPaste={handlePasteInModal}
                onDrop={handleDropInModal}
                onDragOver={(e) => e.preventDefault()}
                className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 max-w-4xl mx-auto w-full flex flex-col space-y-4"
              >
                {/* Metadata Chips Bar (Hiển thị tóm tắt & bấm để mở chỉnh sửa) */}
                <div className="flex flex-wrap items-center gap-2 pb-1">
                  {editingNote.group_id && (
                    <button
                      type="button"
                      onClick={() => setIsMetadataDrawerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-blue-300 text-xs sm:text-sm rounded-xl border border-zinc-700 transition-colors"
                    >
                      <Folder size={14} className="text-blue-400" />
                      <span>{groups.find(g => g.id === editingNote.group_id)?.name || "Nhóm"}</span>
                    </button>
                  )}
                  {editTags.map(tagName => (
                    <span
                      key={tagName}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/15 text-blue-300 border border-blue-500/30 text-xs rounded-lg"
                    >
                      #{tagName}
                    </span>
                  ))}
                  {editingNote.color !== 'default' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 text-zinc-300 text-xs rounded-lg border border-zinc-700">
                      <span className={`w-2.5 h-2.5 rounded-full ${NOTE_COLORS.find(c => c.id === editingNote.color)?.bg || 'bg-zinc-600'}`} />
                      <span>{NOTE_COLORS.find(c => c.id === editingNote.color)?.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsMetadataDrawerOpen(true)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    <Plus size={14} /> {(!editingNote.group_id && editTags.length === 0) ? "Thêm nhóm / tag" : "Chỉnh sửa"}
                  </button>
                </div>

                {/* NỘI DUNG Ở CHẾ ĐỘ XEM TRƯỚC (PREVIEW MODE) */}
                {modalTab === 'preview' ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    {/* Tiêu đề xem trước */}
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight pb-2 border-b border-zinc-800/60 break-words">
                      {editingNote.title?.trim() || "(Chưa có tiêu đề)"}
                    </h1>

                    {/* Tệp / Ảnh đính kèm */}
                    {editingNote.image_url && (
                      <div className="py-2">
                        <AttachmentDisplay
                          url={editingNote.image_url}
                          onViewImage={setLightboxImage}
                        />
                      </div>
                    )}

                    {/* Nội dung Markdown & Ảnh Inline */}
                    <div className="flex-1 pt-2">
                      <NoteMarkdownPreview
                        content={editingNote.content || ""}
                        onViewImage={setLightboxImage}
                      />
                    </div>
                  </div>
                ) : (
                  /* NỘI DUNG Ở CHẾ ĐỘ SOẠN THẢO (EDIT MODE) */
                  <>
                    {/* Tiêu đề ghi chú (Seamless Borderless) */}
                    <input
                      type="text"
                      autoFocus={!editingNote.id}
                      value={editingNote.title || ""}
                      onChange={(e) => setEditingNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                      placeholder="Tiêu đề ghi chú..."
                      className="w-full text-2xl sm:text-3xl font-bold text-zinc-100 placeholder:text-zinc-600 bg-transparent border-none outline-none tracking-tight pb-2"
                    />

                    {/* Tệp / Ảnh đính kèm (nếu có) */}
                    {editingNote.image_url && (
                      <div className="py-2">
                        <AttachmentDisplay
                          url={editingNote.image_url}
                          onRemove={() => setEditingNote(prev => prev ? { ...prev, image_url: null } : null)}
                          onViewImage={setLightboxImage}
                        />
                      </div>
                    )}

                    {/* Danh sách ảnh đã chèn trong nội dung (Modal preview & management) */}
                    {editingNote.content && extractMarkdownImages(editingNote.content).length > 0 && (
                      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon size={16} className="text-emerald-400" />
                            Ảnh trong nội dung ({extractMarkdownImages(editingNote.content).length})
                          </span>
                          <span className="text-xs text-zinc-400 font-normal">Click ảnh để xem lớn, bấm 🗑️ để gỡ khỏi nội dung</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                          {extractMarkdownImages(editingNote.content).map((img, idx) => (
                            <div 
                              key={idx} 
                              className="relative group/modalImg rounded-xl overflow-hidden border border-zinc-700/80 bg-black/40 aspect-video flex items-center justify-center shadow-sm"
                            >
                              <img 
                                src={img.url} 
                                alt={img.alt} 
                                className="w-full h-full object-cover cursor-zoom-in transition-transform group-hover/modalImg:scale-105"
                                onClick={() => setLightboxImage(img.url)}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-100 sm:opacity-0 sm:group-hover/modalImg:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setLightboxImage(img.url); }}
                                  className="p-2 bg-black/80 hover:bg-zinc-700 text-white rounded-lg shadow transition-colors"
                                  title="Phóng to"
                                >
                                  <Maximize2 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNote(prev => prev ? { ...prev, content: removeMarkdownImage(prev.content || '', img.url) } : null);
                                  }}
                                  className="p-2 bg-black/80 hover:bg-red-600 text-white rounded-lg shadow transition-colors"
                                  title="Gỡ ảnh khỏi bài"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Nội dung ghi chú (Spacious, full height textarea) */}
                  <div className="flex-1 flex flex-col min-h-[350px]">
                    <textarea
                      ref={modalTextareaRef}
                      value={editingNote.content || ""}
                      onChange={(e) => setEditingNote(prev => prev ? { ...prev, content: e.target.value } : null)}
                      placeholder="Bắt đầu viết nội dung ghi chú ở đây... (Hỗ trợ Ctrl+V dán nhiều hình ảnh hoặc kéo thả tệp)"
                      className="w-full flex-1 bg-transparent text-zinc-200 placeholder:text-zinc-600 text-sm sm:text-base leading-relaxed md:leading-loose resize-none outline-none font-sans p-0 min-h-[350px]"
                    />
                  </div>
                </>
              )}

              {/* Bottom footer status */}
              <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                <span>{editingNote.content ? `${editingNote.content.length} ký tự` : "0 ký tự"}</span>
                {editingNote.updated_at && (
                  <span>Cập nhật: {new Date(editingNote.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(editingNote.updated_at).toLocaleDateString('vi-VN')}</span>
                )}
              </div>
            </main>

              {/* EXPANDABLE SETTINGS / PROPERTIES DRAWER (Tuỳ chọn mở rộng) */}
              {isMetadataDrawerOpen && (
                <>
                  {/* Backdrop on mobile */}
                  <div 
                    className="md:hidden fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsMetadataDrawerOpen(false)}
                  />

                  {/* Sidebar Drawer on Desktop & Bottom Sheet on Mobile */}
                  <aside className="fixed inset-x-0 bottom-0 z-[90] md:static md:z-auto md:w-80 bg-[#14191d] border-t md:border-t-0 md:border-l border-zinc-800 p-5 space-y-5 overflow-y-auto max-h-[80vh] md:max-h-full rounded-t-2xl md:rounded-none shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-200">
                    
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                        <SlidersHorizontal size={14} className="text-blue-400" />
                        Tuỳ Chọn Ghi Chú
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsMetadataDrawerOpen(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* 1. Nhóm / Thư mục */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-400">Nhóm / Thư mục</label>
                      <AutocompleteSearchBox
                        value={editingNote.group_id || ""}
                        onChange={(val) => setEditingNote(prev => prev ? { ...prev, group_id: val || null } : null)}
                        items={groups.map(g => ({
                          id: g.id,
                          name: g.name,
                          badge: groupedNotesMap.get(g.id)?.length
                        }))}
                        placement="bottom"
                        className="w-full"
                        onCreate={handleCreateGroupOnTheFly}
                      />
                    </div>

                    {/* 2. Màu sắc thẻ */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-400">Màu sắc thẻ</label>
                      <div className="flex items-center gap-2 py-1 flex-wrap">
                        {NOTE_COLORS.map(c => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => setEditingNote(prev => prev ? { ...prev, color: c.id } : null)}
                            className={`w-7 h-7 rounded-full border transition-transform ${c.bg} ${editingNote.color === c.id ? 'scale-110 border-blue-400 ring-2 ring-blue-500/40' : 'border-zinc-700'}`}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 3. Thẻ Tags */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-400">Thẻ Tags</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {editTags.map(tagName => (
                          <span key={tagName} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30">
                            #{tagName}
                            <button type="button" onClick={() => setEditTags(prev => prev.filter(t => t !== tagName))} className="hover:text-red-400">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTagInput}
                          onChange={(e) => setEditTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editTagInput.trim()) {
                              e.preventDefault();
                              const clean = editTagInput.trim().replace(/^#/, '');
                              if (clean && !editTags.includes(clean)) {
                                setEditTags(prev => [...prev, clean]);
                                setEditTagInput("");
                              }
                            }
                          }}
                          placeholder="Gõ tag và nhấn Enter..."
                          className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = editTagInput.trim().replace(/^#/, '');
                            if (clean && !editTags.includes(clean)) {
                              setEditTags(prev => [...prev, clean]);
                              setEditTagInput("");
                            }
                          }}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>

                    {/* 4. Tệp đính kèm */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                      <label className="block text-xs font-semibold text-zinc-400">Tệp đính kèm</label>
                      <button
                        type="button"
                        onClick={() => modalImageInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Paperclip size={14} />
                        <span>{isUploading ? "Đang tải tệp lên..." : editingNote.image_url ? "Thay đổi tệp đính kèm" : "Chọn tệp từ máy / ảnh"}</span>
                      </button>
                    </div>

                    {/* 5. Nút xoá trên mobile */}
                    {editingNote.id && (
                      <div className="pt-3 border-t border-zinc-800 md:hidden">
                        <button
                          type="button"
                          onClick={() => {
                            if (editingNote) {
                              setIsNoteModalOpen(false);
                              handleDeleteNote(editingNote);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={14} />
                          Xoá ghi chú này
                        </button>
                      </div>
                    )}
                  </aside>
                </>
              )}

            </div>
          </form>
        </div>
      )}

      {/* MODAL TẠO / SỬA NHÓM (GROUPS) */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a2024] border border-zinc-700/80 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-zinc-100">
              {editingGroup.id ? "Đổi Tên Nhóm" : "Tạo Nhóm Ghi Chú Mới"}
            </h3>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Tên nhóm</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  placeholder="Ví dụ: Công việc, Ý tưởng, Cá nhân..."
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-xl text-sm text-zinc-100 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX XEM ẢNH FULL SIZE */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img src={lightboxImage} alt="Full view" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-zinc-700 text-white rounded-full"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* MOBILE SEARCH OVERLAY */}
      {isMobileSearchOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-[#13171a] flex flex-col animate-in slide-in-from-bottom-2 duration-200 pb-[72px]">
          {/* Kết quả tìm kiếm (Đẩy lên trên) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e1113]/30 pt-10">
            {searchQuery ? (
              <>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider px-1">KẾT QUẢ TÌM KIẾM</p>
                <div className="grid grid-cols-1 gap-4">
                  {sortedNotes.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500">Không tìm thấy ghi chú nào</div>
                  ) : (
                    sortedNotes.map(note => (
                      <NoteCardItem
                        key={note.id}
                        note={note}
                        groups={groups}
                        copiedId={copiedId}
                        viewMode="grid"
                        sortBy={sortBy}
                        onOpenEdit={handleOpenEdit}
                        onTogglePin={handleTogglePin}
                        onChangeColor={handleChangeColor}
                        onCopyNote={handleCopyNote}
                        onDeleteNote={handleDeleteNote}
                        onViewImage={setLightboxImage}
                        renderTags={renderNoteTags}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <Search size={40} className="mb-4 opacity-20" />
                <p className="text-sm">Gõ từ khoá để tìm kiếm ghi chú</p>
              </div>
            )}
          </div>

          {/* Thanh tìm kiếm (Nằm dưới cùng) */}
          <div className="flex items-center gap-3 p-4 border-t border-zinc-800/50 bg-[#13171a] shrink-0 pb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-zinc-500" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm nhanh..."
                className="w-full bg-[#1c2126] text-white text-sm h-10 pl-10 pr-10 rounded-full outline-none focus:bg-[#20262b] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 p-1 text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button 
              onClick={() => { setIsMobileSearchOpen(false); setSearchQuery(''); }}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-1 shrink-0"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM & ALERT MODALS */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

    </div>
  );
}

// --- SUB-COMPONENT: THẺ GHI CHÚ (NOTE CARD) ---
interface NoteCardItemProps {
  note: Note;
  groups: NoteGroup[];
  copiedId: string | null;
  viewMode: 'grid' | 'list';
  sortBy?: NoteSortOption;
  onOpenEdit: (note: Note) => void;
  onTogglePin: (note: Note, e?: React.MouseEvent) => void;
  onChangeColor: (note: Note, colorId: string, e?: React.MouseEvent) => void;
  onCopyNote: (note: Note, e?: React.MouseEvent) => void;
  onDeleteNote: (note: Note) => void;
  onViewImage: (url: string) => void;
  renderTags: (noteId: string) => React.ReactNode;
}

function NoteCardItem({
  note,
  groups,
  copiedId,
  viewMode,
  sortBy,
  onOpenEdit,
  onTogglePin,
  onChangeColor,
  onCopyNote,
  onDeleteNote,
  onViewImage,
  renderTags
}: NoteCardItemProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorCfg = getColorConfig(note.color);
  const group = groups.find(g => g.id === note.group_id);
  const contentImages = extractMarkdownImages(note.content);
  const cleanContent = stripMarkdownImages(note.content);

  return (
    <div
      onClick={() => onOpenEdit(note)}
      className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:scale-[1.01] flex flex-col overflow-hidden ${colorCfg.bg} ${colorCfg.border} ${
        viewMode === 'list' ? 'p-3 md:p-4 gap-2' : 'p-4 justify-between'
      }`}
    >
      {/* TỆP / ẢNH ĐÍNH KÈM TRONG GRID VIEW */}
      {note.image_url && viewMode === 'grid' && (
        <div className="mb-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <AttachmentDisplay 
            url={note.image_url} 
            onViewImage={onViewImage} 
            compact={true} 
          />
        </div>
      )}

      {/* ẢNH TRONG NỘI DUNG Ở GRID VIEW (LƯỚI NHIỀU ẢNH) */}
      {contentImages.length > 0 && viewMode === 'grid' && (
        <div className="mb-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          {contentImages.length === 1 ? (
            <div 
              onClick={() => onViewImage(contentImages[0].url)}
              className="rounded-xl overflow-hidden bg-black/40 border border-zinc-700/60 group/cardImg max-h-48 relative cursor-zoom-in flex items-center justify-center"
            >
              <img 
                src={contentImages[0].url} 
                alt="Content image" 
                className="w-full max-h-48 object-cover transition-transform group-hover/cardImg:scale-105" 
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/cardImg:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 size={16} className="text-white drop-shadow" />
              </div>
            </div>
          ) : contentImages.length === 2 ? (
            <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
              {contentImages.map((img, i) => (
                <div 
                  key={i} 
                  onClick={() => onViewImage(img.url)}
                  className="h-28 bg-black/40 border border-zinc-700/60 rounded-lg overflow-hidden group/cardImg relative cursor-zoom-in"
                >
                  <img src={img.url} alt="Content image" className="w-full h-full object-cover transition-transform group-hover/cardImg:scale-105" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
              {contentImages.slice(0, 3).map((img, i) => (
                <div 
                  key={i} 
                  onClick={() => onViewImage(img.url)}
                  className="h-24 bg-black/40 border border-zinc-700/60 rounded-lg overflow-hidden group/cardImg relative cursor-zoom-in"
                >
                  <img src={img.url} alt="Content image" className="w-full h-full object-cover transition-transform group-hover/cardImg:scale-105" />
                </div>
              ))}
              <div 
                onClick={() => onViewImage(contentImages[3].url)}
                className="h-24 bg-black/40 border border-zinc-700/60 rounded-lg overflow-hidden group/cardImg relative cursor-zoom-in flex items-center justify-center"
              >
                <img src={contentImages[3].url} alt="Content image" className="w-full h-full object-cover transition-transform group-hover/cardImg:scale-105" />
                {contentImages.length > 4 && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-bold text-sm">
                    +{contentImages.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* THÂN GHI CHÚ */}
      <div className={`flex-1 min-w-0 flex ${viewMode === 'list' ? 'flex-row items-center gap-3' : 'flex-col'}`}>
        
        {/* Nội dung text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex flex-col gap-0.5 min-w-0">
              {group && (
                <span className={`font-bold text-blue-400/90 uppercase tracking-wider flex items-center gap-1 ${viewMode === 'list' ? 'text-xs md:text-[11px]' : 'text-xs md:text-[11px]'}`}>
                  <Folder size={12} />
                  {group.name}
                </span>
              )}
              {note.title && (
                <h4 className={`font-bold text-zinc-100 break-words ${viewMode === 'list' ? 'text-base md:text-sm line-clamp-1' : 'text-base line-clamp-2'}`}>
                  {note.title}
                </h4>
              )}
            </div>

            {/* Nút ghim (Grid view đưa lên đây, List view đưa xuống footer) */}
            {viewMode === 'grid' && (
              <button
                onClick={(e) => onTogglePin(note, e)}
                className={`p-2 sm:p-1.5 rounded-xl transition-colors shrink-0 ${
                  note.is_pinned 
                    ? 'text-amber-400 opacity-100 bg-amber-500/10' 
                    : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-300'
                }`}
                title={note.is_pinned ? "Bỏ ghim" : "Ghim lên đầu"}
              >
                <Pin size={16} className={note.is_pinned ? "fill-amber-400" : ""} />
              </button>
            )}
          </div>

          {cleanContent && (
            <p className={`text-zinc-300 whitespace-pre-wrap break-words leading-relaxed ${viewMode === 'list' ? 'text-sm line-clamp-1' : 'text-sm line-clamp-6'}`}>
              {cleanContent}
            </p>
          )}

          {/* Tags (Ẩn trên list view mobile cho gọn) */}
          <div className={viewMode === 'list' ? 'hidden md:block mt-1.5' : ''}>
            {renderTags(note.id)}
          </div>
        </div>

        {/* TỆP / ẢNH TRONG LIST VIEW */}
        {note.image_url && viewMode === 'list' && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {getFileCategory(note.image_url) === 'image' ? (
              <div 
                onClick={(e) => { e.stopPropagation(); onViewImage(note.image_url!); }}
                className="w-14 h-14 md:w-14 md:h-14 rounded-xl overflow-hidden bg-black/30 border border-zinc-700/50 relative group/img cursor-zoom-in"
              >
                <img src={note.image_url} alt="Note image" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" />
              </div>
            ) : (
              <a
                href={note.image_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-10 md:h-10 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 hover:border-blue-500/50 flex items-center gap-2 text-xs text-zinc-200 transition-colors"
                title={getFileNameFromUrl(note.image_url)}
              >
                <FileText size={16} className="text-blue-400 shrink-0" />
                <span className="max-w-[120px] md:max-w-[140px] truncate text-xs font-medium">{getFileNameFromUrl(note.image_url)}</span>
              </a>
            )}
          </div>
        )}

        {/* ẢNH TRONG NỘI DUNG Ở LIST VIEW (KHI KHÔNG CÓ TỆP ĐÍNH KÈM) */}
        {!note.image_url && contentImages.length > 0 && viewMode === 'list' && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <div 
              onClick={(e) => { e.stopPropagation(); onViewImage(contentImages[0].url); }}
              className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-zinc-700/50 relative group/img cursor-zoom-in"
              title={`${contentImages.length} ảnh trong ghi chú`}
            >
              <img src={contentImages[0].url} alt="Content image" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" />
              {contentImages.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 px-1.5 py-0.5 bg-black/80 text-[10px] text-white font-bold rounded">
                  +{contentImages.length - 1}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER (Ngày tháng & Action buttons) */}
      <div className={`flex items-center justify-between border-zinc-800/60 pt-2.5 border-t mt-1.5 ${viewMode === 'list' ? 'md:pt-3 md:mt-2' : 'pt-3 mt-3'}`}>
        <span 
          suppressHydrationWarning 
          className="text-zinc-500 font-mono text-xs"
          title={`Ngày tạo: ${new Date(note.created_at).toLocaleString('vi-VN')}${note.updated_at && note.updated_at !== note.created_at ? `\nNgày sửa: ${new Date(note.updated_at).toLocaleString('vi-VN')}` : ''}`}
        >
          {(sortBy === 'updated_desc' || sortBy === 'updated_asc') ? (
            note.updated_at && note.updated_at !== note.created_at ? (
              <span className="flex items-center gap-1 text-blue-400">
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-sans font-medium">Đã sửa</span>
                <span>{formatRelativeTime(note.updated_at)}</span>
              </span>
            ) : (
              formatRelativeTime(note.created_at)
            )
          ) : (
            note.updated_at && note.updated_at !== note.created_at ? (
              <span className="flex items-center gap-1">
                <span>{formatRelativeTime(note.created_at)}</span>
                <span className="text-[10px] text-zinc-500 font-sans">(đã sửa)</span>
              </span>
            ) : (
              formatRelativeTime(note.created_at)
            )
          )}
        </span>

        <div className={`flex items-center transition-opacity ${viewMode === 'list' ? 'gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100' : 'gap-1.5 md:gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
          {/* Nút ghim trong List View */}
          {viewMode === 'list' && (
            <button
              onClick={(e) => onTogglePin(note, e)}
              className={`p-2 sm:p-1.5 rounded-xl transition-colors ${note.is_pinned ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 hover:text-amber-400'}`}
              title={note.is_pinned ? "Bỏ ghim" : "Ghim"}
            >
              <Pin size={15} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
              className="p-2 sm:p-1.5 hover:text-blue-400 text-zinc-400 rounded-xl transition-colors"
              title="Đổi màu"
            >
              <Palette size={15} />
            </button>
            {showColorPicker && (
              <div onClick={(e) => e.stopPropagation()} className={`absolute z-30 p-2 bg-[#20262b] border border-zinc-700 rounded-2xl shadow-2xl flex items-center gap-1.5 ${viewMode === 'list' ? 'right-0 top-full mt-1' : 'bottom-full right-0 mb-1'}`}>
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={(e) => { onChangeColor(note, c.id, e); setShowColorPicker(false); }}
                    className={`w-6 h-6 rounded-full border transition-transform ${c.bg} ${note.color === c.id ? 'scale-110 border-blue-400 ring-2 ring-blue-500/40' : 'border-zinc-600'}`}
                  />
                ))}
              </div>
            )}
          </div>
          
          <button onClick={(e) => onCopyNote(note, e)} className="p-2 sm:p-1.5 hover:text-emerald-400 text-zinc-400 rounded-xl transition-colors" title="Sao chép">
            {copiedId === note.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteNote(note); }} className="p-2 sm:p-1.5 hover:text-red-400 text-zinc-400 rounded-xl transition-colors" title="Xoá">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
