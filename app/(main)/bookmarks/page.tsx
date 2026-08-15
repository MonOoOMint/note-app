import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookmarksClient } from "./BookmarksClient";

export default async function BookmarksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch initial data on server for instant 0ms rendering
  const [boardsRes, foldersRes, bookmarksRes] = await Promise.all([
    supabase.from('bookmark_boards').select('*').order('order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('bookmark_folders').select('*').order('order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('bookmarks').select('*').order('order', { ascending: true }).order('created_at', { ascending: true })
  ]);

  return (
    <BookmarksClient 
      userId={user.id} 
      initialBoards={boardsRes.data || []}
      initialFolders={foldersRes.data || []}
      initialBookmarks={bookmarksRes.data || []}
    />
  );
}
