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

-- ==========================================
-- STORED PROCEDURES / RPC FUNCTIONS
-- ==========================================

-- Tạo note và liên kết tags trong 1 transaction an toàn
CREATE OR REPLACE FUNCTION public.create_note_with_tags(
  p_group_id uuid,
  p_title text,
  p_content text,
  p_type text,
  p_image_url text,
  p_source_app text,
  p_color text,
  p_is_pinned boolean,
  p_order integer,
  p_tag_ids uuid[]
)
RETURNS public.notes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_note public.notes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  INSERT INTO public.notes (
    user_id, group_id, title, content, type, image_url, source_app,
    color, is_pinned, "order"
  ) VALUES (
    auth.uid(), p_group_id, p_title, p_content, p_type, p_image_url,
    p_source_app, coalesce(p_color, 'default'), coalesce(p_is_pinned, false),
    coalesce(p_order, 0)
  )
  RETURNING * INTO v_note;

  INSERT INTO public.note_tags (note_id, tag_id)
  SELECT v_note.id, requested_tag.tag_id
  FROM unnest(coalesce(p_tag_ids, array[]::uuid[])) AS requested_tag(tag_id)
  ON CONFLICT DO NOTHING;

  RETURN v_note;
END;
$$;

-- Cập nhật note và làm mới liên kết tags trong 1 transaction an toàn
CREATE OR REPLACE FUNCTION public.update_note_with_tags(
  p_note_id uuid,
  p_group_id uuid,
  p_title text,
  p_content text,
  p_type text,
  p_image_url text,
  p_color text,
  p_is_pinned boolean,
  p_tag_ids uuid[]
)
RETURNS public.notes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_note public.notes;
BEGIN
  UPDATE public.notes
  SET title = p_title,
      content = p_content,
      group_id = p_group_id,
      color = coalesce(p_color, 'default'),
      is_pinned = coalesce(p_is_pinned, false),
      image_url = p_image_url,
      type = p_type,
      updated_at = now()
  WHERE id = p_note_id
  RETURNING * INTO v_note;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found or update not permitted' USING errcode = 'P0002';
  END IF;

  DELETE FROM public.note_tags WHERE note_id = p_note_id;

  INSERT INTO public.note_tags (note_id, tag_id)
  SELECT p_note_id, requested_tag.tag_id
  FROM unnest(coalesce(p_tag_ids, array[]::uuid[])) AS requested_tag(tag_id)
  ON CONFLICT DO NOTHING;

  RETURN v_note;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_note_with_tags(uuid, text, text, text, text, text, text, boolean, integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_note_with_tags(uuid, uuid, text, text, text, text, text, boolean, uuid[]) TO authenticated;

