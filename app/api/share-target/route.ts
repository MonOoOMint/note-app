import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const baseUrl = new URL(req.url).origin;

    if (!user) {
      // Nếu chưa đăng nhập, chuyển hướng đến trang đăng nhập
      return NextResponse.redirect(`${baseUrl}/login?redirect=/notes`, 303);
    }

    const formData = await req.formData();
    const title = (formData.get("title") as string | null) || "";
    const text = (formData.get("text") as string | null) || "";
    const url = (formData.get("url") as string | null) || "";
    
    // Thu thập các tệp được gửi (ảnh, tài liệu, screenshot...)
    const files = formData.getAll("files") as File[];
    let uploadedFileUrl: string | null = null;
    let noteType: "text" | "image" | "file" = "text";
    let defaultTitle = title.trim();

    if (files && files.length > 0 && files[0].size > 0) {
      const file = files[0];
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const mimeType = file.type || "application/octet-stream";
      const isImage = mimeType.startsWith("image/");
      noteType = isImage ? "image" : "file";

      if (!defaultTitle) {
        if (isImage) {
          const vnDateStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
          defaultTitle = `Ảnh chia sẻ (${vnDateStr})`;
        } else {
          defaultTitle = file.name || "Tệp đính kèm";
        }
      }

      // Upload lên Supabase Storage
      try {
        const sanitizedName = (file.name || "shared_file").replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${user.id}/${Date.now()}-${sanitizedName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("note-images")
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("note-images")
            .getPublicUrl(fileName);

          uploadedFileUrl = publicUrl;
        }
      } catch (storageErr) {
        console.warn("Storage upload failed, falling back to base64:", storageErr);
      }

      // Fallback base64 nếu bucket chưa sẵn sàng
      if (!uploadedFileUrl) {
        const base64 = buffer.toString("base64");
        uploadedFileUrl = `data:${mimeType};base64,${base64}`;
      }
    }

    // Ghép nội dung mô tả
    const contentParts = [text.trim(), url.trim()].filter(Boolean);
    const content = contentParts.join("\n\n") || null;

    if (!defaultTitle && !content && !uploadedFileUrl) {
      return NextResponse.redirect(`${baseUrl}/notes`, 303);
    }

    // Tự động lưu thẳng vào bảng notes trong Supabase
    const { error: insertError } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title: defaultTitle || null,
        content: content,
        type: noteType === "image" ? "image" : "text",
        image_url: uploadedFileUrl,
        source_app: "Chia sẻ từ thiết bị",
        color: "default",
        is_pinned: false,
        order: 0
      });

    if (insertError) {
      console.error("Insert shared note error:", insertError);
      // Nếu có lỗi, chuyển hướng kèm query params để người dùng tự lưu
      const params = new URLSearchParams();
      if (defaultTitle) params.set("share_title", defaultTitle);
      if (content) params.set("share_text", content);
      return NextResponse.redirect(`${baseUrl}/notes?${params.toString()}`, 303);
    }

    // Thành công: chuyển hướng về trang Ghi chú
    return NextResponse.redirect(`${baseUrl}/notes?shared=success`, 303);
  } catch (error: any) {
    console.error("Share target POST handler error:", error);
    const baseUrl = new URL(req.url).origin;
    return NextResponse.redirect(`${baseUrl}/notes`, 303);
  }
}
