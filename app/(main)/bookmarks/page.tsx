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

  let loadedBoards = boardsRes.data || [];
  let loadedFolders = foldersRes.data || [];

  // Auto Migrate (Create default board if zero boards exist)
  if (loadedBoards.length === 0) {
    const { data: defaultBoard } = await supabase.from('bookmark_boards').insert({
      user_id: user.id,
      name: 'Trang chủ',
      order: 0
    }).select().single();
    
    if (defaultBoard) {
      loadedBoards = [defaultBoard];
      const foldersToUpdate = loadedFolders.filter(f => !f.board_id);
      if (foldersToUpdate.length > 0) {
        const updates = foldersToUpdate.map(f => ({ ...f, board_id: defaultBoard.id }));
        await supabase.from('bookmark_folders').upsert(updates);
        loadedFolders = loadedFolders.map(f => ({ ...f, board_id: defaultBoard.id }));
      }
    }
  }

  return (
    <BookmarksClient 
      userId={user.id} 
      initialBoards={loadedBoards}
      initialFolders={loadedFolders}
      initialBookmarks={bookmarksRes.data || []}
    />
  );
}
