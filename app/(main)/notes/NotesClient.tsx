"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Plus, 
  Search, 
  X, 
  Pin, 
  Image as ImageIcon, 
  Tag as TagIcon, 
  FolderPlus, 
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
  SlidersHorizontal,
  Maximize2,
  FileText,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SortableNoteGroupWrapper } from "@/components/notes/SortableNoteGroupWrapper";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PushNotificationButton } from "@/components/ui/PushNotificationButton";
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
  type: 'text' | 'image';
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

interface NotesClientProps {
  userId: string;
  initialGroups?: NoteGroup[];
  initialNotes?: Note[];
  initialTags?: Tag[];
  initialNoteTags?: NoteTag[];
  initialSharedTitle?: string;
  initialSharedText?: string;
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
  } catch (e) {
    return '';
  }
}

export function NotesClient({
  userId,
  initialGroups = [],
  initialNotes = [],
  initialTags = [],
  initialNoteTags = [],
  initialSharedTitle,
  initialSharedText
}: NotesClientProps) {
  const [groups, setGroups] = useState<NoteGroup[]>(initialGroups);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [noteTags, setNoteTags] = useState<NoteTag[]>(initialNoteTags);

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<string>('all'); // 'all' | 'pinned' | 'images' | `group:${groupId}` | `tag:${tagId}`
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Accordion State
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});
  const toggleAccordion = (id: string) => {
    setExpandedAccordions(prev => ({ ...prev, [id]: prev[id] === true ? false : true }));
  };
  const isAccordionOpen = (id: string) => expandedAccordions[id] === true;

  const handleQuickAddNote = (groupId: string = "") => {
    setNewGroupId(groupId);
    setIsComposerExpanded(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Composer State (Khung nhập ghi chú nhanh)
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newSelectedTags, setNewSelectedTags] = useState<string[]>([]);
  const [newColor, setNewColor] = useState("default");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ id?: string; name: string } | null>(null);

  // Drag & Drop State cho việc sắp xếp Group
  const dragGroupRef = useRef<string | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  // Global fallback để chống kẹt trạng thái kéo thả (đặc biệt trên giả lập mobile)
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (dragGroupRef.current) {
        dragGroupRef.current = null;
        setDraggedGroup(null);
        setDragOverGroup(null);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalDragEnd);
    window.addEventListener('touchend', handleGlobalDragEnd);
    window.addEventListener('dragend', handleGlobalDragEnd);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalDragEnd);
      window.removeEventListener('touchend', handleGlobalDragEnd);
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

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
      const savedView = localStorage.getItem('notes_view_mode');
      if (savedView === 'grid' || savedView === 'list') {
        setViewMode(savedView);
      }
    } catch (e) {}
  }, []);

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { localStorage.setItem('notes_view_mode', mode); } catch {}
  };

  // Close composer when clicking outside if empty
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        if (!newTitle.trim() && !newContent.trim() && !newImageUrl) {
          setIsComposerExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newTitle, newContent, newImageUrl]);

  // Xử lý upload ảnh
  const uploadImageFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
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
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Lỗi tải ảnh",
        message: err.message || "Không thể tải ảnh lên",
        type: "error"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Xử lý Dán ảnh bằng Ctrl + V
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        setIsComposerExpanded(true);
        const file = items[i].getAsFile();
        if (file) {
          const url = await uploadImageFile(file);
          if (url) setNewImageUrl(url);
        }
        return;
      }
    }
  };

  // Xử lý Kéo thả ảnh (Drag and Drop)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setIsComposerExpanded(true);
        const url = await uploadImageFile(file);
        if (url) setNewImageUrl(url);
      }
    }
  };

  // Tạo thẻ tag mới hoặc lấy tag đã có
  const getOrCreateTags = async (tagNames: string[]): Promise<Tag[]> => {
    const resultTags: Tag[] = [];
    for (const rawName of tagNames) {
      const cleanName = rawName.trim().replace(/^#/, '').toLowerCase();
      if (!cleanName) continue;

      let existing = tags.find(t => t.name.toLowerCase() === cleanName);
      if (existing) {
        resultTags.push(existing);
      } else {
        const { data, error } = await supabase.from('tags').insert({
          user_id: userId,
          name: cleanName
        }).select().single();

        if (data) {
          resultTags.push(data);
          setTags(prev => [...prev, data]);
        }
      }
    }
    return resultTags;
  };

  // --- LƯU GHI CHÚ MỚI ---
  const handleCreateNote = async () => {
    if (!newTitle.trim() && !newContent.trim() && !newImageUrl) return;

    const noteType = newImageUrl ? 'image' : 'text';
    const notePayload = {
      user_id: userId,
      group_id: newGroupId || null,
      title: newTitle.trim() || null,
      content: newContent.trim() || null,
      type: noteType,
      image_url: newImageUrl,
      color: newColor,
      is_pinned: newIsPinned,
      order: 0
    };

    const { data: createdNote, error } = await supabase
      .from('notes')
      .insert(notePayload)
      .select()
      .single();

    if (error) {
      setAlertConfig({
        isOpen: true,
        title: "Lỗi lưu ghi chú",
        message: error.message,
        type: "error"
      });
      return;
    }

    if (createdNote) {
      // Xử lý lưu Tags
      if (newSelectedTags.length > 0) {
        const resolvedTags = await getOrCreateTags(newSelectedTags);
        const tagInserts = resolvedTags.map(t => ({ note_id: createdNote.id, tag_id: t.id }));
        if (tagInserts.length > 0) {
          await supabase.from('note_tags').insert(tagInserts);
          setNoteTags(prev => [...prev, ...tagInserts]);
        }
      }

      setNotes(prev => [createdNote, ...prev]);

      // Reset form
      setNewTitle("");
      setNewContent("");
      setNewImageUrl(null);
      setNewSelectedTags([]);
      setNewTagInput("");
      setNewColor("default");
      setNewIsPinned(false);
      setIsComposerExpanded(false);
    }
  };

  // --- SỬA GHI CHÚ ---
  const handleOpenEdit = (note: Note) => {
    setEditingNote({ ...note });
    const currentTagIds = noteTags.filter(nt => nt.note_id === note.id).map(nt => nt.tag_id);
    const currentTagNames = tags.filter(t => currentTagIds.includes(t.id)).map(t => t.name);
    setEditTags(currentTagNames);
    setEditTagInput("");
    setIsNoteModalOpen(true);
  };

  const handleSaveEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    const { data: updatedNote, error } = await supabase
      .from('notes')
      .update({
        title: editingNote.title?.trim() || null,
        content: editingNote.content?.trim() || null,
        group_id: editingNote.group_id || null,
        color: editingNote.color || 'default',
        is_pinned: editingNote.is_pinned || false,
        image_url: editingNote.image_url || null,
        type: editingNote.image_url ? 'image' : 'text',
        updated_at: new Date().toISOString()
      })
      .eq('id', editingNote.id)
      .select()
      .single();

    if (error) {
      setAlertConfig({
        isOpen: true,
        title: "Lỗi cập nhật",
        message: error.message,
        type: "error"
      });
      return;
    }

    if (updatedNote) {
      // Cập nhật Tags
      await supabase.from('note_tags').delete().eq('note_id', editingNote.id);
      let newLinks: NoteTag[] = [];
      if (editTags.length > 0) {
        const resolvedTags = await getOrCreateTags(editTags);
        newLinks = resolvedTags.map(t => ({ note_id: editingNote.id, tag_id: t.id }));
        if (newLinks.length > 0) {
          await supabase.from('note_tags').insert(newLinks);
        }
      }

      setNoteTags(prev => [
        ...prev.filter(nt => nt.note_id !== editingNote.id),
        ...newLinks
      ]);
      setNotes(prev => prev.map(n => n.id === editingNote.id ? updatedNote : n));
      setIsNoteModalOpen(false);
      setEditingNote(null);
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
    if (selectedFilter === 'images' && !note.image_url) return false;
    if (selectedFilter.startsWith('group:')) {
      const targetGroupId = selectedFilter.replace('group:', '');
      if (note.group_id !== targetGroupId) return false;
    }
    if (selectedFilter.startsWith('tag:')) {
      const targetTagId = selectedFilter.replace('tag:', '');
      const noteHasTag = noteTags.some(nt => nt.note_id === note.id && nt.tag_id === targetTagId);
      if (!noteHasTag) return false;
    }

    // Lọc theo thanh tìm kiếm (Tiêu đề, nội dung, tên tag)
    if (isSearching) {
      const titleMatch = normalizeText(note.title || '').includes(normalizedQuery);
      const contentMatch = normalizeText(note.content || '').includes(normalizedQuery);
      
      const currentTagIds = noteTags.filter(nt => nt.note_id === note.id).map(nt => nt.tag_id);
      const tagMatch = tags
        .filter(t => currentTagIds.includes(t.id))
        .some(t => normalizeText(t.name).includes(normalizedQuery));

      if (!titleMatch && !contentMatch && !tagMatch) return false;
    }

    return true;
  });

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
  const otherNotes = filteredNotes.filter(n => !n.is_pinned);

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

  // Helper render danh sách thẻ ghi chú
  const renderNotesGrid = (notesToRender: Note[], extraClass: string = "") => {
    if (notesToRender.length === 0) return null;
    return (
      <div className={`${viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-3"} ${extraClass}`}>
        {notesToRender.map(note => (
          <NoteCardItem
            key={note.id}
            note={note}
            groups={groups}
            copiedId={copiedId}
            viewMode={viewMode}
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
            className="text-xs md:text-[11px] font-medium px-2.5 md:px-2 py-1 md:py-0.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 border border-zinc-700/50 transition-colors cursor-pointer"
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
                <ImageIcon size={15} />
                <span>Có hình ảnh</span>
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
                                <LayoutGrid size={12} className="pointer-events-none" />
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
      </aside>

      {/* NỘI DUNG CHÍNH (DANH SÁCH GHI CHÚ) */}
      <div className="flex-1 w-full md:w-auto shrink-0 md:shrink flex flex-col min-w-0 bg-[#0e1113] relative overflow-hidden transition-all duration-300">
        
        {/* Header trên cùng */}
        <header className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between bg-[#181d20] relative z-30 shrink-0 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ${isSidebarOpen ? 'bg-zinc-800 text-blue-400' : ''}`}
              title={isSidebarOpen ? "Ẩn danh mục" : "Hiện danh mục"}
            >
              <Menu size={18} />
            </button>
            <h1 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              {selectedFilter === 'all' && 'Tất cả ghi chú'}
              {selectedFilter === 'pinned' && 'Ghi chú đã ghim ⭐'}
              {selectedFilter === 'images' && 'Ghi chú có ảnh 🖼️'}
              {selectedFilter.startsWith('group:') && (groups.find(g => g.id === selectedFilter.replace('group:', ''))?.name || 'Nhóm ghi chú')}
              {selectedFilter.startsWith('tag:') && `#${tags.find(t => t.id === selectedFilter.replace('tag:', ''))?.name || 'Tag'}`}
            </h1>
          </div>

          {/* Thanh tìm kiếm Note (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl relative mx-2">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề, nội dung, #tag..."
                className="w-full h-10 pl-10 pr-10 bg-[#20262b] hover:bg-[#283036] focus:bg-[#151a1e] text-zinc-100 placeholder:text-zinc-500 rounded-xl text-[13px] transition-all border border-zinc-700/80 focus:border-blue-500/80 focus:ring-4 focus:ring-blue-500/15 shadow-sm outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-700/50"
                  title="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Controls: Đổi chế độ xem Lưới / Danh sách */}
          <div className="flex items-center gap-1.5 shrink-0 bg-[#20262b] p-1 rounded-xl border border-zinc-700/80">
            <button
              onClick={() => changeViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Chế độ Lưới (Grid)"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => changeViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Chế độ Danh sách (List)"
            >
              <List size={16} />
            </button>
          </div>
        </header>

        {/* Nội dung danh sách ghi chú & Ô nhập nhanh */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
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
              {/* Preview ảnh đính kèm nếu có */}
              {newImageUrl && (
                <div className="relative mb-3 rounded-xl overflow-hidden bg-black/40 border border-zinc-700/60 group max-h-72 flex items-center justify-center">
                  <img src={newImageUrl} alt="Attached" className="w-full object-contain max-h-72 rounded-lg" />
                  <button
                    onClick={() => setNewImageUrl(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors shadow-md"
                    title="Gỡ ảnh"
                  >
                    <X size={14} />
                  </button>
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
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onFocus={() => setIsComposerExpanded(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCreateNote();
                  }
                }}
                placeholder={isComposerExpanded ? "Nội dung ghi chú... (Hỗ trợ paste ảnh)" : "Tạo ghi chú nhanh... (Hỗ trợ paste ảnh)"}
                rows={isComposerExpanded ? 3 : 1}
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none resize-none"
              />

              {/* Tags đang chọn */}
              {isComposerExpanded && newSelectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-2">
                  {newSelectedTags.map(tagName => (
                    <span key={tagName} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30">
                      #{tagName}
                      <button onClick={() => setNewSelectedTags(prev => prev.filter(t => t !== tagName))} className="hover:text-red-400">
                        <X size={10} />
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
                    
                    {/* Nút Upload Ảnh */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={imageInputRef}
                      className="hidden"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const url = await uploadImageFile(e.target.files[0]);
                          if (url) setNewImageUrl(url);
                        }
                      }}
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
                      title="Tải ảnh lên"
                    >
                      <ImageIcon size={16} />
                      {isUploading && <span className="text-[10px]">Đang tải...</span>}
                    </button>

                    {/* Chọn Nhóm (Custom) */}
                    <CustomGroupSelect
                      value={newGroupId}
                      onChange={setNewGroupId}
                      groups={groups}
                      placement="top"
                      className="h-7 min-w-[150px]"
                    />

                    {/* Thêm Tag nhanh */}
                    <div className="flex items-center bg-zinc-800/80 border border-zinc-700 rounded-lg h-7 px-2">
                      <TagIcon size={12} className="text-zinc-500 mr-1" />
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
                        className="bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 w-20 outline-none"
                      />
                    </div>

                    {/* Bảng chọn màu */}
                    <div className="flex items-center gap-1 ml-1">
                      {NOTE_COLORS.slice(0, 5).map(c => (
                        <button
                          key={c.id}
                          onClick={() => setNewColor(c.id)}
                          className={`w-4 h-4 rounded-full border transition-transform ${c.bg} ${newColor === c.id ? 'scale-125 border-blue-400' : 'border-zinc-600'}`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Nút Đóng & Lưu Note bên phải */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsComposerExpanded(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={handleCreateNote}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1"
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

          {selectedFilter === 'all' ? (
            /* ========================================================
               CHẾ ĐỘ ACCORDION (KHI XEM TẤT CẢ)
               ======================================================== */
            <div className="space-y-4 pb-10">
              
              {/* 1. ACCORDION: ĐÃ GHIM */}
              {pinnedNotes.length > 0 && (
                <div className="bg-[#13171a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  <div 
                    onClick={() => toggleAccordion('pinned')}
                    className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-amber-400">
                      <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                        {isAccordionOpen('pinned') ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <Pin size={16} />
                      <span className="font-bold text-sm uppercase tracking-wider">Đã ghim</span>
                      <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/50 px-2 py-0.5 rounded-full">{pinnedNotes.length}</span>
                    </div>
                  </div>
                  {isAccordionOpen('pinned') && (
                    <div className="p-3 md:p-4 pt-0 border-t border-zinc-800/50">
                      {renderNotesGrid(pinnedNotes, "mt-3 md:mt-4")}
                    </div>
                  )}
                </div>
              )}

              {/* 2. ACCORDION: CÁC NHÓM CHỦ ĐỀ */}
              <DndContext id="notes-accordion-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEndDndKit}>
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
                            <div className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors">
                              <div className="flex items-center gap-3 text-blue-400 flex-1 min-w-0" onClick={() => toggleAccordion(group.id)}>
                                <div 
                                  {...attributes} 
                                  {...listeners} 
                                  className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-zinc-800 touch-none" 
                                  title="Kéo để sắp xếp"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LayoutGrid size={14} className="pointer-events-none" />
                                </div>
                                <button className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                                  {isAccordionOpen(group.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                                <Folder size={16} className="shrink-0" />
                                <span className="font-bold text-sm truncate">{group.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/50 px-2 py-0.5 rounded-full shrink-0">{groupNotes.length}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setIsGroupModalOpen(true); }}
                                  className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                  title="Sửa nhóm"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Xoá nhóm"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleQuickAddNote(group.id); }}
                                  className="text-xs text-zinc-400 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800 shrink-0 ml-2"
                                  title="Thêm ghi chú vào nhóm này"
                                >
                                  <Plus size={14} /> <span className="hidden sm:inline">Thêm</span>
                                </button>
                              </div>
                            </div>
                            
                            {isAccordionOpen(group.id) && groupNotes.length > 0 && (
                              <div className="p-3 md:p-4 pt-0 border-t border-zinc-800/50">
                                {renderNotesGrid(groupNotes, "mt-3 md:mt-4")}
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
                    className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-zinc-400 flex-1 min-w-0">
                      <button className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                        {isAccordionOpen('ungrouped') ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <FileText size={16} className="shrink-0" />
                      <span className="font-bold text-sm uppercase tracking-wider truncate">Không phân nhóm</span>
                      <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800/50 px-2 py-0.5 rounded-full shrink-0">{ungroupedNotes.length}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleQuickAddNote(""); }}
                      className="text-xs text-zinc-400 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800 shrink-0 ml-2"
                    >
                      <Plus size={14} /> <span className="hidden sm:inline">Thêm ghi chú</span>
                    </button>
                  </div>
                  {isAccordionOpen('ungrouped') && (
                    <div className="p-3 md:p-4 pt-0 border-t border-zinc-800/50">
                      {renderNotesGrid(ungroupedNotes, "mt-3 md:mt-4")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               CHẾ ĐỘ LỌC (FLAT VIEW - GIỮ NGUYÊN NHƯ CŨ)
               ======================================================== */
            <>
              {/* DANH SÁCH GHI CHÚ ĐÃ GHIM */}
              {pinnedNotes.length > 0 && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400/80 uppercase tracking-wider">
                    <Pin size={13} />
                    <span>Đã ghim</span>
                  </div>
                  {renderNotesGrid(pinnedNotes)}
                </div>
              )}

              {/* DANH SÁCH GHI CHÚ KHÁC */}
              <div className="space-y-3 pb-10">
                {pinnedNotes.length > 0 && otherNotes.length > 0 && (
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Khác
                  </div>
                )}

                {filteredNotes.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
                      <FileText size={24} />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">
                      {isSearching ? "Không tìm thấy ghi chú nào khớp với từ khóa" : "Chưa có ghi chú nào trong mục này"}
                    </p>
                    <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                      Hãy dùng khung soạn thảo phía trên để tạo ghi chú nhanh, paste ảnh chụp màn hình (Ctrl+V) hoặc kéo thả file.
                    </p>
                  </div>
                ) : (
                  renderNotesGrid(otherNotes)
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* MODAL SỬA CHI TIẾT GHI CHÚ */}
      {isNoteModalOpen && editingNote && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a2024] border border-zinc-700/80 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <Edit2 size={16} className="text-blue-400" />
                Chỉnh Sửa Ghi Chú
              </h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditNote} className="space-y-4 flex-1 overflow-y-auto pr-1">
              
              {/* Preview Ảnh */}
              {editingNote.image_url && (
                <div className="relative rounded-xl overflow-hidden bg-black/40 border border-zinc-700 max-h-64 flex items-center justify-center">
                  <img src={editingNote.image_url} alt="Attached" className="w-full object-contain max-h-64" />
                  <button
                    type="button"
                    onClick={() => setEditingNote(prev => prev ? { ...prev, image_url: null } : null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full shadow"
                    title="Gỡ ảnh"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={editingNote.title || ""}
                  onChange={(e) => setEditingNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="Tiêu đề ghi chú"
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-xl text-sm text-zinc-100 outline-none focus:border-blue-500"
                />
              </div>

              {/* Nội dung */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Nội dung</label>
                <textarea
                  value={editingNote.content || ""}
                  onChange={(e) => setEditingNote(prev => prev ? { ...prev, content: e.target.value } : null)}
                  placeholder="Nội dung ghi chú..."
                  rows={5}
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-xl text-sm text-zinc-100 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Nhóm & Màu sắc */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Nhóm</label>
                  <CustomGroupSelect
                    value={editingNote.group_id || ""}
                    onChange={(val) => setEditingNote(prev => prev ? { ...prev, group_id: val || null } : null)}
                    groups={groups}
                    className="w-full py-2 bg-zinc-900/80 border-zinc-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Màu sắc thẻ</label>
                  <div className="flex items-center gap-1.5 py-1">
                    {NOTE_COLORS.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setEditingNote(prev => prev ? { ...prev, color: c.id } : null)}
                        className={`w-6 h-6 rounded-full border transition-transform ${c.bg} ${editingNote.color === c.id ? 'scale-125 border-blue-400 ring-2 ring-blue-500/30' : 'border-zinc-600'}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Thẻ Tags</label>
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
                    className="flex-1 px-3 py-1.5 bg-zinc-900/80 border border-zinc-700 rounded-xl text-xs text-zinc-100 outline-none"
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
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-xl"
                  >
                    + Thêm
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    if (editingNote) {
                      setIsNoteModalOpen(false);
                      handleDeleteNote(editingNote);
                    }
                  }}
                  className="px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Xoá ghi chú
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md"
                  >
                    Lưu Thay Đổi
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO / SỬA NHÓM (GROUPS) */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
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
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
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
                  {filteredNotes.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500">Không tìm thấy ghi chú nào</div>
                  ) : (
                    filteredNotes.map(note => (
                      <NoteCardItem
                        key={note.id}
                        note={note}
                        groups={groups}
                        copiedId={copiedId}
                        viewMode="grid"
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

  return (
    <div
      onClick={() => onOpenEdit(note)}
      className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:scale-[1.01] flex flex-col overflow-hidden ${colorCfg.bg} ${colorCfg.border} ${
        viewMode === 'list' ? 'p-3 md:p-4 gap-2' : 'p-4 justify-between'
      }`}
    >
      {/* ẢNH TRONG GRID VIEW (Hiện ở trên cùng) */}
      {note.image_url && viewMode === 'grid' && (
        <div 
          onClick={(e) => { e.stopPropagation(); onViewImage(note.image_url!); }}
          className="mb-3 rounded-xl overflow-hidden bg-black/30 border border-zinc-700/50 max-h-52 relative group/img cursor-zoom-in shrink-0"
        >
          <img src={note.image_url} alt="Note image" className="w-full object-cover max-h-52 rounded-lg transition-transform group-hover/img:scale-105" />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 size={18} className="text-white drop-shadow" />
          </div>
        </div>
      )}

      {/* THÂN GHI CHÚ */}
      <div className={`flex-1 min-w-0 flex ${viewMode === 'list' ? 'flex-row items-center gap-3' : 'flex-col'}`}>
        
        {/* Nội dung text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              {group && (
                <span className={`font-bold text-blue-400/90 uppercase tracking-wider flex items-center gap-1 ${viewMode === 'list' ? 'text-[10px] md:text-[11px]' : 'text-[11px] md:text-[10px]'}`}>
                  <Folder size={11} />
                  {group.name}
                </span>
              )}
              {note.title && (
                <h4 className={`font-bold text-zinc-100 break-words ${viewMode === 'list' ? 'text-base md:text-sm line-clamp-1' : 'text-base md:text-sm line-clamp-2'}`}>
                  {note.title}
                </h4>
              )}
            </div>

            {/* Nút ghim (Grid view đưa lên đây, List view đưa xuống footer) */}
            {viewMode === 'grid' && (
              <button
                onClick={(e) => onTogglePin(note, e)}
                className={`p-1 rounded-lg transition-colors shrink-0 ${
                  note.is_pinned 
                    ? 'text-amber-400 opacity-100 bg-amber-500/10' 
                    : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-300'
                }`}
                title={note.is_pinned ? "Bỏ ghim" : "Ghim lên đầu"}
              >
                <Pin size={14} />
              </button>
            )}
          </div>

          {note.content && (
            <p className={`text-zinc-300 whitespace-pre-wrap break-words leading-relaxed ${viewMode === 'list' ? 'text-sm line-clamp-1' : 'text-sm md:text-xs line-clamp-6'}`}>
              {note.content}
            </p>
          )}

          {/* Tags (Ẩn trên list view mobile cho gọn) */}
          <div className={viewMode === 'list' ? 'hidden md:block mt-1' : ''}>
            {renderTags(note.id)}
          </div>
        </div>

        {/* ẢNH TRONG LIST VIEW (Thumbnail nhỏ gọn) */}
        {note.image_url && viewMode === 'list' && (
          <div 
            onClick={(e) => { e.stopPropagation(); onViewImage(note.image_url!); }}
            className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-lg overflow-hidden bg-black/30 border border-zinc-700/50 relative group/img cursor-zoom-in"
          >
            <img src={note.image_url} alt="Note image" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" />
          </div>
        )}
      </div>

      {/* FOOTER (Ngày tháng & Action buttons) */}
      <div className={`flex items-center justify-between border-zinc-800/60 pt-2 border-t mt-1 ${viewMode === 'list' ? 'md:pt-3 md:mt-2' : 'pt-3 mt-3'}`}>
        <span suppressHydrationWarning className={`text-zinc-500 font-mono ${viewMode === 'list' ? 'text-[11px]' : 'text-xs md:text-[11px]'}`}>
          {formatRelativeTime(note.created_at)}
        </span>

        <div className={`flex items-center transition-opacity ${viewMode === 'list' ? 'gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100' : 'gap-1.5 md:gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
          {/* Nút ghim trong List View */}
          {viewMode === 'list' && (
            <button
              onClick={(e) => onTogglePin(note, e)}
              className={`p-1 rounded transition-colors ${note.is_pinned ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 hover:text-amber-400'}`}
              title={note.is_pinned ? "Bỏ ghim" : "Ghim"}
            >
              <Pin size={13} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
              className="p-1 hover:text-blue-400 text-zinc-400 rounded transition-colors"
              title="Đổi màu"
            >
              <Palette size={13} />
            </button>
            {showColorPicker && (
              <div onClick={(e) => e.stopPropagation()} className={`absolute z-30 p-1.5 bg-[#20262b] border border-zinc-700 rounded-xl shadow-xl flex items-center gap-1 ${viewMode === 'list' ? 'right-0 top-full mt-1' : 'bottom-full right-0 mb-1'}`}>
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={(e) => { onChangeColor(note, c.id, e); setShowColorPicker(false); }}
                    className={`w-4 h-4 rounded-full border transition-transform ${c.bg} ${note.color === c.id ? 'scale-125 border-blue-400' : 'border-zinc-600'}`}
                  />
                ))}
              </div>
            )}
          </div>
          
          <button onClick={(e) => onCopyNote(note, e)} className="p-1 hover:text-emerald-400 text-zinc-400 rounded transition-colors" title="Sao chép">
            {copiedId === note.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteNote(note); }} className="p-1 hover:text-red-400 text-zinc-400 rounded transition-colors" title="Xoá">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: CUSTOM GROUP SELECT (Tìm kiếm & Chọn nhóm) ---
function CustomGroupSelect({ 
  value, 
  onChange, 
  groups, 
  className = "",
  placement = "bottom"
}: { 
  value: string | null; 
  onChange: (val: string) => void; 
  groups: NoteGroup[];
  className?: string;
  placement?: "top" | "bottom";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedGroup = groups.find(g => g.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700/80 rounded-lg text-xs text-zinc-300 transition-colors outline-none min-w-[140px] ${className}`}
      >
        <span className="truncate">
          {selectedGroup ? selectedGroup.name : "Không phân nhóm"}
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''} shrink-0 ml-1`} />
      </button>

      {isOpen && (
        <div className={`absolute ${placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} left-0 w-64 max-w-[80vw] bg-[#1a2024] border border-zinc-700/80 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150`}>
          <div className="p-2 border-b border-zinc-800/80">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                autoFocus
                placeholder="Tìm tên nhóm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/80 text-zinc-200 text-xs h-8 pl-8 pr-3 rounded-lg outline-none border border-zinc-700 focus:border-blue-500/50"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => { onChange(""); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between ${!value ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
            >
              Không phân nhóm
              {!value && <Check size={14} className="shrink-0" />}
            </button>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-600">Không tìm thấy nhóm "{searchTerm}"</div>
            ) : (
              filteredGroups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { onChange(g.id); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between mt-1 ${value === g.id ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'}`}
                >
                  <span className="truncate">{g.name}</span>
                  {value === g.id && <Check size={14} className="shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
