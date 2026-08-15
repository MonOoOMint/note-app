import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

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
    
    const url = new URL(request.url);
    const forceNotification = url.searchParams.get('force') === 'true';

    // Sử dụng Service Role để vượt qua RLS
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Tính toán thời gian hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
    const now = new Date();
    const vnTimeString = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnDate = new Date(vnTimeString);
    const vnHour = vnDate.getHours();
    const todayDayOfWeek = vnDate.getDay(); // 0 = Chủ nhật, 1 = T2, 2 = T3, ..., 6 = T7

    // --- CẤU HÌNH KHUNG GIỜ THÔNG BÁO THEO YÊU CẦU ---
    // - Sáng 8h (8h00)
    // - Lặp lại sau 3 tiếng: 11h (11h00)
    // - Chiều 1h (13h00)
    // - Lặp lại sau 3 tiếng: 16h (16h00)
    // - Lặp lại sau 3 tiếng: 19h (19h00)
    // - Khung giờ cấm: từ 22h tối (10h tối) đến 8h sáng hôm sau TUYỆT ĐỐI KHÔNG gửi thông báo
    const NOTIFICATION_SCHEDULE_HOURS = [8, 11, 13, 16, 19];
    const isQuietHours = vnHour >= 22 || vnHour < 8;
    const shouldSendNotification = forceNotification || (!isQuietHours && NOTIFICATION_SCHEDULE_HOURS.includes(vnHour));

    // Xác định tiêu đề thông báo phù hợp theo giờ Việt Nam
    let greetingTitle = "Nhắc nhở công việc 🔔";
    if (vnHour === 8) {
      greetingTitle = "Chào buổi sáng! ☕";
    } else if (vnHour === 11) {
      greetingTitle = "Nhắc việc trưa! 📋";
    } else if (vnHour === 13) {
      greetingTitle = "Chào buổi chiều! ☀️";
    } else if (vnHour === 16) {
      greetingTitle = "Nhắc nhở chiều! 🎯";
    } else if (vnHour === 19) {
      greetingTitle = "Tổng kết buổi tối! 🌙";
    } else if (vnHour >= 5 && vnHour < 12) {
      greetingTitle = "Chào buổi sáng! ☕";
    } else if (vnHour >= 12 && vnHour < 18) {
      greetingTitle = "Chào buổi chiều! ☀️";
    } else {
      greetingTitle = "Nhắc nhở công việc! 📋";
    }

    // --- PHASE 1: RESET RECURRING TASKS ---
    const { data: todosToResetData, error: fetchError } = await supabase
      .from('todos')
      .select('id, recurrence, weekly_days, last_completed_at')
      .eq('is_done', true)
      .neq('recurrence', 'none');

    let resetCount = 0;
    if (todosToResetData && todosToResetData.length > 0 && !fetchError) {
      // Lọc các task cần reset hôm nay theo lịch Việt Nam
      const tasksToReset = todosToResetData.filter(todo => {
        if (todo.last_completed_at) {
          const completedDate = new Date(todo.last_completed_at);
          const completedVnTimeString = completedDate.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
          const completedVnDate = new Date(completedVnTimeString);
          
          if (completedVnDate.getFullYear() === vnDate.getFullYear() && 
              completedVnDate.getMonth() === vnDate.getMonth() && 
              completedVnDate.getDate() === vnDate.getDate()) {
              return false; // Completed today in VN timezone, do not reset
          }
        }

        if (todo.recurrence === 'daily') return true;
        if (todo.recurrence === 'weekly' && todo.weekly_days) {
          return todo.weekly_days.includes(todayDayOfWeek);
        }
        return false;
      });

      if (tasksToReset.length > 0) {
        const taskIds = tasksToReset.map(t => t.id);
        const { error: updateError } = await supabase
          .from('todos')
          .update({ is_done: false, last_completed_at: null })
          .in('id', taskIds);
          
        if (updateError) throw updateError;
        resetCount = taskIds.length;
      }
    }

    // --- PHASE 2: SEND NOTIFICATIONS FOR UNCOMPLETED TASKS ---
    let pushCount = 0;

    if (shouldSendNotification) {
      const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('*');

      if (subs && subs.length > 0 && !subsError) {
        // Gom nhóm subscription theo user_id
        const subsByUser = subs.reduce((acc: any, sub: any) => {
          if (!acc[sub.user_id]) acc[sub.user_id] = [];
          acc[sub.user_id].push(sub);
          return acc;
        }, {});

        for (const userId of Object.keys(subsByUser)) {
          // Lấy số lượng công việc CHƯA HOÀN THÀNH (bỏ qua checklist)
          const { count, error } = await supabase
            .from('todos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_done', false)
            .or('type.is.null,type.eq.todo');
          
          if (error) {
            console.error("Error fetching tasks for user:", userId, error);
            continue;
          }

          if (count && count > 0) {
            const payload = JSON.stringify({
              title: greetingTitle,
              body: `Bạn đang có ${count} công việc chưa hoàn thành. Hãy kiểm tra nhé!`,
              icon: "/icon.svg"
            });

            for (const sub of subsByUser[userId]) {
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
                if (error.statusCode === 410) {
                  // Token hết hạn hoặc user hủy quyền -> Xóa khỏi DB
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                } else {
                  console.error("Push error:", error);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${resetCount} tasks. Sent ${pushCount} notifications (Hour: ${vnHour}h VN, Notification active: ${shouldSendNotification}).`,
      vnTime: `${vnHour}:${vnDate.getMinutes().toString().padStart(2, '0')}`,
      isQuietHours,
      notificationSent: shouldSendNotification,
      greeting: greetingTitle
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
