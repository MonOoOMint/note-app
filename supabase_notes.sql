-- ==========================================
-- BẢNG CHO MODULE QUICK NOTE
-- ==========================================

-- 1. Bảng Nhóm Note (note_groups)
CREATE TABLE IF NOT EXISTS public.note_groups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text DEFAULT 'blue',
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 2. Bảng Tags (tags)
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, name)
);

-- 3. Bảng Notes (notes)
CREATE TABLE IF NOT EXISTS public.notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id uuid REFERENCES public.note_groups(id) ON DELETE SET NULL,
    title text,
    content text,
    type text NOT NULL DEFAULT 'text', -- 'text' hoặc 'image'
    image_url text,
    source_app text,
    color text DEFAULT 'default',
    is_pinned boolean DEFAULT false,
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Bảng liên kết Note - Tag (note_tags)
CREATE TABLE IF NOT EXISTS public.note_tags (
    note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.note_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

-- note_groups policies
CREATE POLICY "Users can manage their own note groups" ON public.note_groups
    FOR ALL USING (auth.uid() = user_id);

-- tags policies
CREATE POLICY "Users can manage their own tags" ON public.tags
    FOR ALL USING (auth.uid() = user_id);

-- notes policies
CREATE POLICY "Users can manage their own notes" ON public.notes
    FOR ALL USING (auth.uid() = user_id);

-- note_tags policies
CREATE POLICY "Users can manage their own note tags" ON public.note_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.notes 
            WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
        )
    );

-- Storage bucket note-images (chạy nếu chưa có bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for note-images
CREATE POLICY "Users can upload note images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view note images" ON storage.objects
    FOR SELECT USING (bucket_id = 'note-images');

CREATE POLICY "Users can delete note images" ON storage.objects
    FOR DELETE USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
