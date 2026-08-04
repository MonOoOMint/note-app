import { createClient } from "@/lib/supabase/server";
import TodosClient from "./TodosClient";
import { redirect } from "next/navigation";

export default async function TodosPage() {
  const supabase = createClient();
  
  // Kiểm tra xem đã đăng nhập chưa, do middleware có thể đã xử lý, nhưng check lại cho chắc
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch groups
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: true });

  // Fetch todos
  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <TodosClient 
      initialGroups={groups || []} 
      initialTodos={todos || []} 
      userId={user.id}
    />
  );
}
