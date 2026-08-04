-- ==========================================
-- BẢNG CHO BOOKMARK MANAGER (GIAO DIỆN PAPALY)
-- ==========================================

-- 1. Tạo bảng Bookmark Folders (Các cột danh mục)
CREATE TABLE IF NOT EXISTS public.bookmark_folders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 2. Tạo bảng Bookmarks (Các link lưu trữ)
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id uuid REFERENCES public.bookmark_folders(id) ON DELETE CASCADE,
    title text NOT NULL,
    url text NOT NULL,
    favicon_url text,
    description text,
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- BẢO MẬT BẰNG ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Bật RLS
ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies cho bookmark_folders
CREATE POLICY "Users can manage their own bookmark folders" ON public.bookmark_folders
    FOR ALL USING (auth.uid() = user_id);

-- Policies cho bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON public.bookmarks
    FOR ALL USING (auth.uid() = user_id);
