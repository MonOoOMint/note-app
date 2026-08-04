import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotesClient } from "./NotesClient";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Pre-fetch dữ liệu phía server để nạp ngay tức thì (0ms loading delay)
  const [groupsRes, notesRes, tagsRes, noteTagsRes] = await Promise.all([
    supabase.from('note_groups').select('*').order('order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('notes').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('tags').select('*').order('name', { ascending: true }),
    supabase.from('note_tags').select('*')
  ]);

  let loadedGroups = groupsRes.data || [];
  let loadedNotes = notesRes.data || [];
  let loadedTags = tagsRes.data || [];
  let loadedNoteTags = noteTagsRes.data || [];

  return (
    <NotesClient
      userId={user.id}
      initialGroups={loadedGroups}
      initialNotes={loadedNotes}
      initialTags={loadedTags}
      initialNoteTags={loadedNoteTags}
      initialSharedTitle={typeof searchParams.share_title === 'string' ? searchParams.share_title : undefined}
      initialSharedText={
        [
          typeof searchParams.share_text === 'string' ? searchParams.share_text : '',
          typeof searchParams.share_url === 'string' ? searchParams.share_url : ''
        ].filter(Boolean).join('\n\n') || undefined
      }
    />
  );
}
