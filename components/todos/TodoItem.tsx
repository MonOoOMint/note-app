import { Check, Trash2, Calendar, Repeat, Edit2, Folder } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface Todo {
  id: string;
  content: string;
  is_done: boolean;
  due_date?: string | null;
  recurrence?: "none" | "daily" | "weekly" | null;
  weekly_days?: number[] | null;
  last_completed_at?: string | null;
  group_id?: string | null;
}

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function TodoItem({
  todo,
  groupName,
  onToggle,
  onDelete,
  onEdit,
}: {
  todo: Todo;
  groupName?: string;
  onToggle: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
}) {
  
  const renderRecurrence = () => {
    if (!todo.recurrence || todo.recurrence === "none") return null;
    
    let text = "Daily";
    if (todo.recurrence === "weekly" && todo.weekly_days && todo.weekly_days.length > 0) {
       const sortedDays = [...todo.weekly_days].sort();
       text = `Weekly (${sortedDays.map(d => DAY_NAMES[d]).join(', ')})`;
    } else if (todo.recurrence === "weekly") {
       text = "Weekly";
    }

    return (
      <span className="text-[11px] text-violet-600 dark:text-violet-400 flex items-center bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded-md font-medium border border-violet-200 dark:border-violet-500/20 shadow-sm">
        <Repeat size={11} className="mr-1" />
        {text}
      </span>
    );
  };

  return (
    <div className="group flex items-center space-x-3 p-3 bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800/50 hover:shadow-sm transition-all hover:border-zinc-200 dark:hover:border-zinc-700 w-full">
      
      <button
        onClick={() => onToggle(todo.id, todo.is_done)}
        className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 flex-shrink-0 ${
          todo.is_done
            ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] scale-110"
            : "border-zinc-300 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-400 hover:scale-110 bg-white dark:bg-zinc-900"
        }`}
      >
        {todo.is_done && <Check size={12} className="text-white font-bold" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className={`text-sm md:text-base truncate transition-colors ${todo.is_done ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-800 dark:text-zinc-200"}`}>
          {todo.content}
        </span>
        
        {/* Meta details */}
        {(todo.due_date || (todo.recurrence && todo.recurrence !== "none") || groupName) && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {groupName && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-md font-medium border border-blue-200 dark:border-blue-500/20 shadow-sm" title="Thư mục">
                <Folder size={11} className="mr-1" />
                {groupName}
              </span>
            )}
            {todo.due_date && (
              <span className="text-[11px] text-orange-600 dark:text-orange-400 flex items-center bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded-md font-medium border border-orange-200 dark:border-orange-500/20 shadow-sm">
                <Calendar size={11} className="mr-1" />
                {(() => {
                  const d = new Date(todo.due_date);
                  // Lấy ngày theo giờ UTC để tránh lệch múi giờ giữa Server (SSR) và Client dẫn tới Hydration Error
                  const day = d.getUTCDate().toString().padStart(2, '0');
                  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                  return `${day}/${month}/${d.getUTCFullYear()}`;
                })()}
              </span>
            )}
            {renderRecurrence()}
          </div>
        )}
      </div>

      <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-blue-500 w-8 h-8"
          onClick={() => onEdit(todo)}
        >
          <Edit2 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-red-500 w-8 h-8"
          onClick={() => onDelete(todo.id)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}
