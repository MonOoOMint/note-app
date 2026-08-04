"use client";

import { useState, useEffect } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/ui/AlertModal";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationButton({ userId }: { userId: string }) {
  const [mounted, setMounted] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "info" | "warning" | "error" | "success";
  }>({
    isOpen: false,
    message: "",
  });

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (window as any).workbox !== undefined) {
      // Ignore if next-pwa handles it, or register manually if needed
    }
    
    // Register SW manually for Push if next-pwa didn't expose it easily
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        setRegistration(reg);
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setIsSubscribed(true);
            setSubscription(sub);
          }
          setLoading(false);
        });
      }).catch(err => {
        console.error("SW registration failed", err);
        setLoading(false);
      });
    } else {
      setLoading(false); // Not supported
    }
  }, []);

  const handleSubscribe = async () => {
    if (!registration) return;
    setLoading(true);

    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("Missing VAPID Public Key");
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Save to Supabase
      const subJson = sub.toJSON();
      
      if (subJson.endpoint && subJson.keys) {
        // Kiểm tra xem đã có trong DB chưa để tránh trùng lặp
        const { data: existing } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', subJson.endpoint)
          .single();
          
        if (!existing) {
          await supabase.from('push_subscriptions').insert({
            user_id: userId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          });
        }

        setIsSubscribed(true);
        setSubscription(sub);
      }
    } catch (err) {
      console.error("Failed to subscribe", err);
      setAlertConfig({
        isOpen: true,
        title: "Yêu cầu quyền Thông báo",
        message: "Bạn cần cấp quyền Thông báo (Notification) trên trình duyệt để kích hoạt tính năng nhắc việc này!",
        type: "warning"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !('serviceWorker' in navigator && 'PushManager' in window)) {
    return null; // Trình duyệt không hỗ trợ Push hoặc đang render SSR
  }

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={isSubscribed ? undefined : handleSubscribe} 
        className={`relative shrink-0 transition-all ${isSubscribed ? 'text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-zinc-500 hover:text-blue-600'}`}
        title={isSubscribed ? "Đã bật thông báo" : "Bật thông báo nhắc việc"}
        disabled={loading || isSubscribed}
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isSubscribed ? (
          <BellRing size={20} className="drop-shadow-sm" />
        ) : (
          <Bell size={20} />
        )}
        
        {!isSubscribed && !loading && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        )}
        {!isSubscribed && !loading && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </Button>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
