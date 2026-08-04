# Kế Hoạch Triển Khai: App Cá Nhân (Bookmark + Note + Todo)

## 1. Tổng quan

Web app cá nhân dạng PWA, chạy trên Android, gồm 3 module chính:
- **Bookmark manager** (kiểu Papaly)
- **Quick Note** (text + ảnh, nhận share từ app khác)
- **Todo list** đơn giản

**Stack:**
- Frontend + API: Next.js 14 (App Router) + Tailwind CSS
- Database + Auth + Storage: Supabase (Postgres)
- PWA: `next-pwa` + Web Share Target API
- Hosting: Vercel (free tier)
- Kéo-thả bookmark: `@dnd-kit/core`

---

## 2. Cấu trúc thư mục dự án

```
myapp/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx              # layout chung có navbar/tabbar
│   │   ├── bookmarks/
│   │   │   ├── page.tsx            # danh sách + folder bookmark
│   │   │   └── [folderId]/page.tsx
│   │   ├── notes/
│   │   │   ├── page.tsx            # danh sách note
│   │   │   └── [id]/page.tsx       # chi tiết/sửa note
│   │   └── todos/
│   │       └── page.tsx
│   ├── api/
│   │   ├── bookmarks/route.ts
│   │   ├── bookmarks/[id]/route.ts
│   │   ├── folders/route.ts
│   │   ├── notes/route.ts
│   │   ├── notes/[id]/route.ts
│   │   ├── note-groups/route.ts
│   │   ├── tags/route.ts
│   │   ├── todos/route.ts
│   │   ├── todos/[id]/route.ts
│   │   ├── todo-groups/route.ts
│   │   └── share-target/route.ts   # nhận Web Share Target từ Android
│   ├── manifest.ts                 # hoặc public/manifest.json
│   └── globals.css
├── components/
│   ├── bookmarks/
│   │   ├── BookmarkCard.tsx
│   │   ├── FolderGrid.tsx
│   │   └── AddBookmarkModal.tsx
│   ├── notes/
│   │   ├── NoteCard.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── GroupSidebar.tsx        # danh sách nhóm để lọc note
│   │   └── TagInput.tsx            # thêm/gỡ tag cho note
│   ├── todos/
│   │   ├── TodoItem.tsx
│   │   ├── TodoInput.tsx
│   │   └── TodoGroupSidebar.tsx    # danh sách nhóm để lọc/gom task
│   └── ui/                         # button, input, modal dùng chung
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # supabase client (browser)
│   │   ├── server.ts                # supabase client (server/route handler)
│   │   └── types.ts                 # types generate từ schema
│   └── utils.ts
├── public/
│   ├── icons/                       # icon PWA (192, 512px)
│   └── manifest.json
├── next.config.js                   # cấu hình next-pwa
├── .env.local
└── package.json
```

---

## 3. Thiết kế Database (Supabase / Postgres)

```sql
-- Bookmarks
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  folder_id uuid references folders on delete set null,
  title text not null,
  url text not null,
  favicon_url text,
  position int default 0,
  created_at timestamptz default now()
);

-- Notes
create table note_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  group_id uuid references note_groups on delete set null,
  type text check (type in ('text', 'image')) not null default 'text',
  content text,               -- nội dung text hoặc caption ảnh
  image_url text,             -- link Supabase Storage nếu type = image
  source_app text,            -- tên app gửi share tới (nếu có)
  created_at timestamptz default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  unique (user_id, name)
);

create table note_tags (
  note_id uuid references notes on delete cascade,
  tag_id uuid references tags on delete cascade,
  primary key (note_id, tag_id)
);

-- Todos
create table todo_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  group_id uuid references todo_groups on delete set null,
  content text not null,
  is_done boolean default false,
  due_date date,
  position int default 0,
  created_at timestamptz default now()
);

-- Row Level Security: mỗi user chỉ thấy dữ liệu của mình
alter table folders enable row level security;
alter table bookmarks enable row level security;
alter table note_groups enable row level security;
alter table notes enable row level security;
alter table tags enable row level security;
alter table note_tags enable row level security;
alter table todo_groups enable row level security;
alter table todos enable row level security;

create policy "user_access" on folders for all using (auth.uid() = user_id);
create policy "user_access" on bookmarks for all using (auth.uid() = user_id);
create policy "user_access" on note_groups for all using (auth.uid() = user_id);
create policy "user_access" on notes for all using (auth.uid() = user_id);
create policy "user_access" on tags for all using (auth.uid() = user_id);
create policy "user_access" on note_tags for all using (
  exists (select 1 from notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
);
create policy "user_access" on todo_groups for all using (auth.uid() = user_id);
create policy "user_access" on todos for all using (auth.uid() = user_id);
```

**Storage bucket:** tạo bucket `note-images` (private, truy cập qua signed URL hoặc RLS policy theo `user_id` trong path).

---

## 4. Danh sách tính năng theo module

### 4.1 Bookmark Manager
| Tính năng | Mô tả |
|---|---|
| Tạo folder | Đặt tên, sắp xếp thứ tự |
| Thêm bookmark | Nhập URL → tự fetch title + favicon |
| Kéo-thả | Di chuyển bookmark giữa các folder, sắp xếp lại vị trí |
| Sửa/xoá | Đổi tên, đổi folder, xoá bookmark |
| Bookmarklet | Nút "Save to MyApp" kéo vào thanh bookmark trình duyệt, click để lưu trang đang mở |
| Tìm kiếm | Lọc theo tên/URL |

### 4.2 Quick Note
| Tính năng | Mô tả |
|---|---|
| Tạo note nhanh | Ô nhập text ở đầu trang, gõ + Enter là lưu |
| Note ảnh | Upload ảnh trực tiếp hoặc qua share |
| **Nhận Share từ Android** | Share text/ảnh từ Chrome, Gallery, Zalo... → mở app → tự tạo note |
| **Nhóm (Group)** | Gom note vào từng nhóm/chủ đề (ví dụ: "Công việc", "Ý tưởng", "Cá nhân"), lọc theo nhóm |
| **Tag** | Gắn nhiều tag cho 1 note (ví dụ: #quan-trong, #can-lam), lọc/tìm theo tag |
| Xem dạng lưới/list | Toggle 2 kiểu hiển thị |
| Sửa/xoá | Chỉnh caption, đổi nhóm, thêm/bớt tag, xoá note |
| Tìm kiếm | Full-text search nội dung note, kết hợp lọc theo nhóm hoặc tag |

### 4.3 Todo List
| Tính năng | Mô tả |
|---|---|
| Thêm task | Nhập nhanh, Enter để thêm |
| Check hoàn thành | Click checkbox, gạch ngang |
| Due date (tuỳ chọn) | Gắn ngày hạn |
| **Nhóm (Group)** | Gom task vào từng nhóm/danh mục (ví dụ: "Công việc", "Nhà cửa", "Học tập"), lọc theo nhóm |
| Sắp xếp | Kéo-thả đổi thứ tự ưu tiên trong cùng 1 nhóm hoặc giữa các nhóm |
| Xoá task đã xong | Nút "Clear completed" (có thể xoá theo từng nhóm hoặc toàn bộ) |

### 4.4 Chung
- Đăng nhập bằng email hoặc Google (Supabase Auth)
- Cài đặt như PWA (Add to Home Screen trên Android / Install app trên desktop)
- Giao diện responsive, dùng tốt cả trên điện thoại lẫn máy tính
- Dark mode (tuỳ chọn, làm sau)

### 4.5 Tính năng riêng cho Desktop (máy tính)

App chạy như web bình thường trên trình duyệt máy tính (Chrome, Edge, Firefox), không cần cài đặt gì thêm. Vì máy tính không có "Share Sheet" như Android, cần bổ sung các cách nhập liệu thay thế:

| Tính năng | Mô tả |
|---|---|
| **Dán ảnh bằng Ctrl+V** | Copy ảnh từ bất kỳ đâu (web, file explorer, Snipping Tool...) → focus vào ô Quick Note → Ctrl+V → tự tạo note ảnh |
| **Kéo-thả file (Drag & Drop)** | Kéo file ảnh từ File Explorer thả vào khung Quick Note → tự upload và tạo note |
| **Dán text nhanh** | Ctrl+V đoạn text đã copy vào ô nhập note → lưu ngay, giữ định dạng dòng xuống dòng |
| **Bookmarklet "Save to MyApp"** | Kéo nút vào thanh bookmark trình duyệt → khi đang lướt web, click 1 phát để lưu URL trang hiện tại vào Bookmark Manager (tiện hơn cả trên desktop vì thanh bookmark luôn hiển thị) |
| **Phím tắt bàn phím** | `N` = tạo note mới, `T` = tạo todo mới, `/` = focus vào ô tìm kiếm (tối ưu thao tác bằng bàn phím) |
| **Cài app lên desktop (PWA Install)** | Chrome/Edge hiện icon "Install" trên thanh địa chỉ → mở app như ứng dụng riêng, không có thanh URL, có icon trên Taskbar/Desktop |
| **Kéo-thả bookmark bằng chuột** | Sắp xếp lại bookmark giữa các folder mượt hơn trên desktop (dùng `@dnd-kit`, đã có sẵn từ module Bookmark) |

**Chi tiết kỹ thuật cho paste & drag-drop ảnh:**
```
- Lắng nghe sự kiện `onPaste` trên ô nhập note:
    → kiểm tra clipboardData.items có type "image/*" không
    → nếu có, lấy Blob, upload lên Supabase Storage, tạo note type="image"
    → nếu là text thuần, lấy clipboardData.getData('text') và lưu note type="text"

- Lắng nghe `onDrop` trên vùng khung Quick Note:
    → e.preventDefault() để chặn browser mở file trực tiếp
    → lấy e.dataTransfer.files, upload từng file ảnh lên Storage
```

Các tính năng này dùng chung 1 API endpoint `/api/notes` (POST) như upload ảnh thủ công bình thường — không cần route riêng như `/api/share-target` (route đó chỉ dành riêng cho Web Share Target trên Android).

---

## 5. Cấu hình PWA + Web Share Target

**`public/manifest.json`:**
```json
{
  "name": "MyApp",
  "short_name": "MyApp",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "share_target": {
    "action": "/api/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [{ "name": "image", "accept": ["image/*"] }]
    }
  }
}
```

**`app/api/share-target/route.ts`** (logic tóm tắt):
1. Parse `multipart/form-data`.
2. Nếu có `image` file → upload lên Supabase Storage → lấy URL.
3. Nếu có `text`/`url` → gán vào `content`.
4. Insert vào bảng `notes` với `type` tương ứng.
5. Redirect về `/notes` để user thấy note vừa tạo.

**Lưu ý:** cần `next-pwa` để đăng ký service worker, và user phải **Add to Home Screen** trước thì app mới hiện trong share sheet Android.

---

## 6. Lộ trình triển khai (gợi ý theo tuần)

| Giai đoạn | Nội dung | Thời gian ước tính |
|---|---|---|
| **1. Khởi tạo** | Setup Next.js, Tailwind, kết nối Supabase, tạo schema DB, cấu hình Auth | 1–2 ngày |
| **2. Todo list** | Module đơn giản nhất, làm trước để quen luồng CRUD + RLS | 1–2 ngày |
| **3. Bookmark manager** | Folder, thêm/sửa/xoá, kéo-thả, bookmarklet | 3–4 ngày |
| **4. Quick Note (cơ bản)** | Tạo/sửa/xoá note text + ảnh (upload thủ công) | 2–3 ngày |
| **5. PWA + Share Target** | manifest, service worker, API share-target, test trên Android thật | 2–3 ngày |
| **6. Tính năng Desktop** | Ctrl+V dán ảnh/text, drag-drop file, bookmarklet, phím tắt, PWA install desktop | 1–2 ngày |
| **7. Polish** | Tìm kiếm, dark mode, tối ưu UI mobile/desktop, xử lý lỗi, loading state | 3–5 ngày |
| **8. Deploy** | Push lên Vercel, gắn domain (tuỳ chọn), test toàn bộ luồng trên cả Android và desktop | 1 ngày |

Tổng: khoảng **2–3 tuần** nếu làm part-time buổi tối/cuối tuần.

---

## 7. Chi phí (free tier)

| Dịch vụ | Giới hạn free | Đủ dùng cho cá nhân? |
|---|---|---|
| Vercel | 100GB bandwidth/tháng | Dư dùng |
| Supabase | 500MB DB, 1GB Storage, 50k monthly active users | Dư dùng nhiều năm |
| Domain | Không bắt buộc, dùng `*.vercel.app` miễn phí | OK |

---

## 8. Bước tiếp theo

1. Tạo project Supabase, chạy script SQL ở mục 3.
2. Khởi tạo Next.js project, cài `@supabase/supabase-js`, `next-pwa`, `@dnd-kit/core`.
3. Bắt đầu từ module Todo để làm quen luồng trước khi vào phần phức tạp hơn (bookmark, share target).

---

*Tài liệu này là bản kế hoạch tham khảo — có thể điều chỉnh linh hoạt trong quá trình code thực tế.*
