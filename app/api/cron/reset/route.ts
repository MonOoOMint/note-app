import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure Web Push
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Cần điền email liên hệ thực tế sau này
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    // Sử dụng Service Role để vượt qua RLS
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Tính toán thời gian hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
    const now = new Date();
    const vnTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnDate = new Date(vnTimeString);
    const vnHour = vnDate.getHours();
    const todayDayOfWeek = vnDate.getDay(); // 0 = Chủ nhật, 1 = T2, 2 = T3, ..., 6 = T7

    // Xác định lời chào phù hợp theo giờ Việt Nam
    let greetingTitle = "Nhắc nhở công việc 🔔";
    if (vnHour >= 5 && vnHour < 12) {
      greetingTitle = "Chào buổi sáng! ☕";
    } else if (vnHour >= 12 && vnHour < 18) {
      greetingTitle = "Chào buổi chiều! ☀️";
    } else if (vnHour >= 18 && vnHour < 22) {
      greetingTitle = "Chào buổi tối! 🌙";
    } else {
      greetingTitle = "Nhắc nhở công việc! 🌙";
    }

    // 2. Lấy tất cả task lặp lại đã hoàn thành (chỉ áp dụng cho todo, bỏ qua checklist)
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select('*')
      .eq('is_done', true)
      .neq('recurrence', 'none');

    if (todosError) throw todosError;
    if (!todos || todos.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No tasks to reset',
        vnTime: `${vnHour}:${vnDate.getMinutes().toString().padStart(2, '0')}`,
        greeting: greetingTitle
      });
    }

    // 3. Lọc các task cần reset hôm nay theo lịch Việt Nam
    const tasksToReset = todos.filter(todo => {
      if (todo.recurrence === 'daily') return true;
      if (todo.recurrence === 'weekly' && todo.weekly_days) {
        return todo.weekly_days.includes(todayDayOfWeek);
      }
      return false;
    });

    if (tasksToReset.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No tasks match today\'s rule',
        vnTime: `${vnHour}:${vnDate.getMinutes().toString().padStart(2, '0')}`,
        greeting: greetingTitle
      });
    }

    const taskIds = tasksToReset.map(t => t.id);

    // 4. Update database: Mở lại các task lặp lại
    const { error: updateError } = await supabase
      .from('todos')
      .update({ is_done: false, last_completed_at: null })
      .in('id', taskIds);
      
    if (updateError) throw updateError;

    // 5. Gom nhóm theo User để gửi thông báo Push Notification
    const usersToNotify = new Set(tasksToReset.map(t => t.user_id));
    
    let pushCount = 0;
    
    for (const userId of Array.from(usersToNotify)) {
      const userTasksCount = tasksToReset.filter(t => t.user_id === userId).length;
      
      // Lấy danh sách thiết bị của user này
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);
        
      if (!subs || subs.length === 0) continue;
      
      const payload = JSON.stringify({
        title: greetingTitle,
        body: `Bạn có ${userTasksCount} công việc lặp lại cần hoàn thành hôm nay.`,
        icon: "/icon512_maskable.png"
      });

      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          pushCount++;
        } catch (error: any) {
          // Gỡ bỏ token nếu user đã tắt quyền (statusCode 410)
          if (error.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error("Push error:", error);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${tasksToReset.length} tasks and sent ${pushCount} notifications.`,
      vnTime: `${vnHour}:${vnDate.getMinutes().toString().padStart(2, '0')}`,
      greeting: greetingTitle
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
