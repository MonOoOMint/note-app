import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Thử upload lên Supabase Storage bucket 'note-images'
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${user.id}/${Date.now()}-${sanitizedName}`;
      const mimeType = file.type || 'application/octet-stream';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('note-images')
          .getPublicUrl(fileName);

        return NextResponse.json({ 
          url: publicUrl,
          name: file.name,
          size: file.size,
          type: mimeType
        });
      }
    } catch (storageErr) {
      console.warn("Storage upload failed, falling back to base64:", storageErr);
    }

    // Fallback: nếu storage bucket chưa tạo, trả về data URL base64 an toàn để không gián đoạn người dùng
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ 
      url: dataUrl,
      name: file.name,
      size: file.size,
      type: mimeType
    });
  } catch (error: any) {
    console.error("Upload note attachment error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
}
