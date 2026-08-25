# Báo cáo Functional & Database Audit

Ngày audit: 19/08/2026  
Phạm vi: lỗi chức năng, database, tính nhất quán field và lỗi khi dữ liệu tăng trưởng. Không đánh giá security/authentication/authorization theo yêu cầu.

## 1. Phạm vi và phương pháp

### Stack thực tế

- Frontend/backend: Next.js 14 App Router, React 18, TypeScript.
- Data access: Supabase JS/PostgREST; một số Next.js Route Handler cho upload, share target, metadata và cron.
- Database: Supabase PostgreSQL; Supabase Storage cho tệp đính kèm.
- PWA/Web Push: `@ducanh2912/next-pwa`, service worker và `web-push`.
- Chuỗi trace được điều chỉnh theo kiến trúc thực tế: JSX/HTML → React handler → Supabase client hoặc Next.js Route Handler → PostgreSQL/Storage.

### Luồng chính đã trace

1. Đăng nhập email/password và redirect.
2. Todo/checklist: CRUD, nhóm, hoàn thành hàng loạt, lặp hằng ngày/hằng tuần, kéo-thả, push notification.
3. Bookmark: board → folder → bookmark, lấy metadata, tìm kiếm, kéo-thả, import/export.
4. Note: CRUD, nhóm, tag N-N, pin/màu, upload/paste/share tệp, lọc/tìm kiếm.
5. Cron: reset todo lặp lại và gửi thông báo.

### Xác minh đã chạy

- `npm run build`: thành công; cấu hình hiện vẫn chủ động bỏ qua TypeScript và ESLint trong riêng bước build.
- `tsc --noEmit`: ban đầu thất bại với 14 lỗi; sau vòng sửa lỗi mức Cao và dọn quality gate đã đạt.
- `npm run lint`: ban đầu thất bại; sau sửa không còn error, còn 5 warning không chặn build về hook dependency và thẻ `<img>`.
- Ban đầu không có test; đã bổ sung 4 regression test cho migration và các RPC transaction mức Cao.
- Đối chiếu read-only OpenAPI schema Supabase và các chỉ số toàn vẹn, không đọc nội dung người dùng.
- Snapshot cấu trúc hiện tại: 2 boards, 38 folders, 485 bookmarks, 2 groups, 5 todos, 4 note groups, 11 notes, 1 tag, 1 note-tag, 3 push subscriptions.
- Đã xác nhận 1 bản ghi bookmark dư do trùng `order` trong cùng `folder_id`; chưa thấy URL thiếu scheme, weekly todo không có ngày, tag mồ côi, endpoint push trùng hoặc attachment base64 trong snapshot hiện tại.

## 2. Danh sách lỗi

| STT | Mức độ | Loại | Vị trí | Mô tả lỗi | Cách tái hiện / bằng chứng | Đề xuất sửa |
|---:|---|---|---|---|---|---|
| 1 | Cao | Database | `bookmark_setup.sql:6-25`; toàn repo không có migration todo/push | Migration trong repo không thể tái tạo database mà ứng dụng đang dùng. SQL bookmark thiếu bảng `bookmark_boards` và thiếu `bookmark_folders.color`, `bookmark_folders.board_id`; không có migration cho `groups`, `todos`, `push_subscriptions`. | Chạy SQL trên project Supabase mới rồi mở `/bookmarks` hoặc `/todos`: query bảng/cột không tồn tại. OpenAPI production xác nhận các bảng/cột này đang tồn tại ngoài migration trong repo. | Tạo migration versioned đầy đủ từ schema production, có thứ tự up/down hoặc migration bất biến; thêm kiểm tra deploy trên database rỗng trong CI. |
| 2 | Thông tin | Platform Constraint — đã có biện pháp | `vercel.json:2-6`; `.github/workflows/cron.yml:3-7`; `app/api/cron/reset/route.ts:36-45` | Vercel gói miễn phí chỉ giữ một cron hằng ngày lúc 08:00 VN, nhưng GitHub Actions đã gọi endpoint vào đủ 08:00, 11:00, 13:00, 16:00 và 19:00. Đây không còn là lỗi chức năng; workflow ngoài đang bù giới hạn của Vercel. | GitHub workflow dùng cron `0 1,4,6,9,12 * * *`, tương ứng đủ năm khung giờ GMT+7. | Giữ workflow hiện tại và theo dõi job failure; cân nhắc idempotency để tránh gửi trùng khi Vercel Cron và GitHub Actions cùng gọi lúc 08:00. |
| 3 | Cao | Database / Field Consistency | `NotesClient.tsx:733-775` | Sửa note cập nhật bản ghi note trước, sau đó xóa toàn bộ `note_tags`, rồi chèn lại ngoài transaction. Chèn tag lỗi sẽ làm mất liên kết tag cũ trong DB, trong khi note đã lưu. | Gây lỗi insert `note_tags` sau khi delete (mất mạng/constraint); tải lại trang và thấy tag cũ biến mất. | Đưa update note + replace tag links vào một PostgreSQL function/transaction; chỉ cập nhật UI khi toàn bộ transaction thành công. |
| 4 | Cao | Database / Data Growth | `BookmarksClient.tsx:903-943` | Import bookmark tạo folders trước rồi insert bookmark theo từng chunk 200, không có transaction/rollback/idempotency. Lỗi ở chunk sau để lại folders và các chunk trước trong DB nhưng UI báo import thất bại; retry tạo dữ liệu trùng. | Import file lớn, làm một chunk giữa chừng thất bại; reload sẽ thấy dữ liệu đã được ghi một phần. | Dùng RPC transaction hoặc staging/import job có `import_id`; rollback toàn bộ khi lỗi và trả tiến độ rõ ràng. |
| 5 | Trung bình | Functional / Field Consistency | `BookmarksClient.tsx:413-488`, `:1400-1404`; `fetch-metadata/route.ts:11-15,53-57` | Metadata API chuẩn hóa `example.com` thành `https://example.com` và trả `meta.url`, nhưng client bỏ qua field này và vẫn lưu chuỗi gốc. Anchor dùng trực tiếp `href={bm.url}`, nên URL không scheme trở thành đường dẫn tương đối trong app. | Thêm bookmark `example.com`; bấm bookmark có thể mở `/bookmarks/example.com`, favicon/domain cũng không parse được. | Chuẩn hóa và validate URL một lần trước insert/update; lưu `meta.url` hoặc helper dùng `new URL` với scheme mặc định. Dùng input `type="url"` kèm lỗi hiển thị. |
| 6 | Trung bình | Database / Data Growth | `BookmarksClient.tsx:474-482`, `:499-501`, `:718-745` | `order` mới được tính bằng số phần tử hiện tại. Xóa/chuyển item không compact thứ tự nguồn, nên lần thêm sau có thể trùng `order` đang tồn tại; DB không có unique constraint theo parent. | Dữ liệu production hiện có 1 bookmark dư do trùng `(folder_id, order)`. Ví dụ order `[0,1,2]`, xóa/chuyển item `1`, thêm mới nhận `length=2`, trùng item order `2`. | Dùng `max(order)+1` trong transaction hoặc rank có khoảng cách; compact nguồn/đích atomically; thêm unique `(folder_id, order)` sau khi dọn dữ liệu. Áp dụng tương tự board/folder/group. |
| 7 | Trung bình | Functional | `TodosClient.tsx:221-305,403-419`; `NotesClient.tsx:782-809`; `BookmarksClient.tsx:316-395,499-501,775-782` | Nhiều thao tác cập nhật/xóa UI optimistic nhưng không rollback khi Supabase lỗi; một số lỗi chỉ `console.error` hoặc bị bỏ qua. Người dùng thấy thành công tạm thời, sau reload dữ liệu cũ quay lại. | Ngắt mạng rồi toggle/xóa todo, note, bookmark hoặc chuyển folder; UI đổi ngay, không có rollback nhất quán. | Tạo mutation helper chung: lưu snapshot, await kết quả, rollback + alert khi lỗi; khóa thao tác đang chạy. |
| 8 | Trung bình | Functional / Database | `PushNotificationButton.tsx:42-66,88-107`; `cron/reset/route.ts:153-160` | Nếu cron xóa subscription hết hạn (410), browser vẫn có local PushSubscription. Lần tải sau nút chỉ kiểm tra browser, đặt `isSubscribed=true` và bị disable, không tái tạo row DB; người dùng không thể bật lại notification trong UI. Insert DB cũng bỏ qua `error`. | Xóa row `push_subscriptions` nhưng giữ browser subscription, reload `/todos`: nút hiện “đã bật” nhưng không nhận push. | Khi mount, đối chiếu endpoint với DB; nếu thiếu thì upsert lại. Thêm nút unsubscribe/resubscribe và unique constraint `endpoint`. |
| 9 | Trung bình | Field Consistency | `NotesClient.tsx:78-91,588-603,686-701`; `share-target/route.ts:24,34,83-96`; `supabase_notes.sql:31` | UI type cho phép `'file'`, share handler tính `noteType='file'`, nhưng khi insert lại map mọi file không phải ảnh thành `'text'`; composer map mọi attachment thành `'image'`. Vì vậy `notes.type='file'` không bao giờ được set và semantics khác nhau giữa các lớp. | Snapshot production: `notes.type='file'` = 0. Đính kèm PDF qua composer tạo type `image`; qua share target tạo type `text`. | Chuẩn hóa enum `text/image/file`, thêm CHECK DB, dùng MIME/category để set type và dùng cùng helper ở composer/share target. |
| 10 | Trung bình | Functional / Data Growth | `notes/upload/route.ts:13-61`; `share-target/route.ts:27-72,98-104`; `NotesClient.tsx:657-665,781-793` | Upload không giới hạn kích thước/type, buffer toàn bộ file; lỗi Storage bị chuyển sang data URL base64 và có thể nhét tệp lớn vào `notes.image_url`. Xóa/thay attachment hoặc note không xóa object Storage. Share insert lỗi cũng làm object vừa upload bị mồ côi và fallback redirect không giữ attachment. | Làm Storage upload lỗi hoặc upload file lớn; API trả JSON chứa toàn bộ base64. Xóa note có attachment rồi kiểm tra bucket: object vẫn còn. | Đặt giới hạn size/MIME; nếu Storage lỗi thì trả lỗi rõ ràng thay vì base64 file lớn; lưu storage path riêng và xóa object khi replace/delete hoặc qua cleanup job. |
| 11 | Trung bình | Data Growth | `bookmarks/page.tsx:14-18`; `notes/page.tsx:18-23`; `todos/page.tsx:14-24` | Mỗi trang tải toàn bộ bảng của user bằng `select('*')`, không pagination/limit. Sau đó toàn bộ filter/sort/count chạy ở client. Với lịch sử lớn, SSR/API có thể timeout hoặc trả thiếu theo giới hạn PostgREST, khiến UI hiển thị kết quả không đầy đủ như thể là đầy đủ. | Tăng số bản ghi vượt giới hạn response của project; mở trang và so số item DB với UI. Hiện bookmark đã ở 485 bản ghi. | Pagination/cursor theo `(order,id)` hoặc `(created_at,id)`; lazy-load theo board/group; count riêng; hiển thị trạng thái tải thêm. |
| 12 | Trung bình | Database / Data Growth | `BookmarksClient.tsx:678-687,741-746`; `TodosClient.tsx:440-492`; `NotesClient.tsx:916-938` | Reorder phát một update cho từng bản ghi, có nơi tuần tự, có nơi `Promise.all`, không transaction và hầu như không kiểm tra lỗi từng update. Lỗi giữa chừng lưu thứ tự nửa cũ/nửa mới; thời gian tăng tuyến tính và dễ timeout khi danh sách lớn. | Kéo-thả trong danh sách lớn rồi ngắt mạng giữa quá trình; reload có thứ tự hỗn hợp/trùng. | RPC nhận danh sách `{id,order}` và update trong một transaction; optimistic rollback khi RPC lỗi. |
| 13 | Trung bình | Functional / Database | `TodoInput.tsx:29-40,139-158`; `EditTodoModal.tsx:44-53,174-190`; `cron/reset/route.ts:90-94` | UI cho chọn recurrence weekly nhưng không bắt buộc chọn ít nhất một ngày. Bản ghi weekly với `weekly_days=[]/null` không bao giờ reset. | Chọn “Hàng tuần”, không chọn ngày, lưu và hoàn thành todo; task không tái mở. | Validate `weeklyDays.length > 0` ở UI và DB CHECK; hiển thị lỗi cạnh selector. |
| 14 | Trung bình | Functional | `bookmarks/page.tsx:14-25`; `notes/page.tsx:18-28`; `todos/page.tsx:14-29`; `BookmarksClient.tsx:235-263` | Query khởi tạo không kiểm tra `error`; lỗi DB/network được đổi thành mảng rỗng. Bookmark client cũng không hiển thị lỗi fetch. Người dùng thấy empty state và có thể tưởng dữ liệu bị mất. | Chặn request Supabase hoặc đổi tên cột; mở trang: UI rỗng thay vì error/retry. | Kiểm tra mọi result error ở server; render error boundary/retry. Không dùng `data || []` khi request thất bại. |
| 15 | Trung bình | Field Consistency | `NotesClient.tsx:733-743,797-809,1837-1838`; `supabase_notes.sql:37-38` | `updated_at` chỉ được set trong form sửa note. Pin nhanh và đổi màu cập nhật dữ liệu nhưng không cập nhật timestamp; DB cũng không có trigger trong migration. UI hiển thị “Cập nhật” cũ. | Pin/đổi màu note rồi mở modal: thời gian cập nhật không đổi. | Trigger `BEFORE UPDATE` set `updated_at=now()`; bỏ việc tự set rải rác ở client. |
| 16 | Trung bình | Functional / Quality Gate | `next.config.mjs:27-32`; `SortableNoteGroupWrapper.tsx:34`; `worker/index.ts:1-37` | Production build báo thành công dù TypeScript và lint bị bỏ qua. Chạy kiểm tra độc lập thất bại; service worker đang được compile trong trạng thái type-invalid. Đây là cơ chế che lỗi chức năng trước deploy. | `tsc --noEmit` trả 14 lỗi; `npm run lint` thất bại, còn `npm run build` vẫn xanh. | Sửa lỗi type/lint, bỏ `ignoreBuildErrors` và `ignoreDuringBuilds`, thêm CI bắt buộc build + typecheck + lint + test. |
| 17 | Trung bình | Functional / Database | `TodoInput.tsx:29-40`; `TodosClient.tsx:165-218`; `BookmarksClient.tsx:283-379`; `NotesClient.tsx:824-881` | Nhiều form create không có trạng thái `saving`/idempotency. Todo/checklist xóa nội dung form ngay vì callback async không được await; nếu insert lỗi người dùng mất nội dung đã nhập. Double click create board/group có thể tạo bản ghi trùng và order trùng. | Giảm tốc mạng, submit liên tục hoặc làm insert lỗi; quan sát duplicate hoặc form đã trắng dù không lưu. | Callback trả Promise và form await; disable submit khi pending; khôi phục input khi lỗi; thêm unique phù hợp hoặc idempotency key. |
| 18 | Thấp | Field Consistency | `BookmarksClient.tsx:27-35,474-480`; `NotesClient.tsx:62-92,588-603`; schema live | Các field mồ côi/bán mồ côi: bookmark `description` chỉ ghi lúc create nhưng không hiển thị/sửa/export; note `source_app` chỉ share-target ghi nhưng UI không đọc; `notes.order` luôn ghi 0 và không dùng sort; `note_groups.color` luôn default; production xác nhận `source_app` populated=0, `notes.order!=0`=0, note group color khác default=0. | Theo dõi field từ UI đến DB hoặc xem snapshot metadata. | Xóa field nếu không còn roadmap, hoặc hoàn thiện UI/read/write/sort; thêm migration dữ liệu và test field mapping. |
| 19 | Thấp | Database | OpenAPI schema production; `supabase_notes.sql:25-38`; `bookmark_setup.sql:6-25` | Nhiều cột logic quan trọng cho phép NULL (`user_id`, parent FK, booleans/order trong schema live) và các field enum tự do (`type`, `recurrence`, `color`) không có CHECK. Giá trị lạ có thể làm record biến mất khỏi filter hoặc không reset. | Insert/import row `todos.type='other'` hoặc recurrence lạ; UI loại khỏi cả todo/checklist hoặc cron bỏ qua. | Đặt NOT NULL/default cho field bắt buộc và CHECK/enum cho type, recurrence, color; validate migration trước khi siết constraint. |
| 20 | Thấp | Data Growth | `NotesClient.tsx:563-585,621-629`; `supabase_notes.sql:15-22,41-46` | Có create/reuse tag nhưng không có luồng xóa tag; tag không còn note liên kết sẽ tích lũy. Race tạo cùng tag bị unique constraint chặn nhưng error bị bỏ qua, có thể làm note thiếu tag. | Hai client cùng tạo cùng tag hoặc gỡ tag khỏi note cuối cùng; không có cleanup/UI xóa tag. Snapshot hiện chưa có tag mồ côi. | Dùng upsert/select lại khi conflict; thêm quản lý/xóa tag hoặc job xóa tag không liên kết. |

## 3. Bảng ánh xạ field xuyên suốt các lớp

Ký hiệu: `✓` có đọc/ghi hoặc hiển thị đúng; `P` chỉ có một phần; `—` không có ở lớp đó; `G` field hệ thống/generated. “API/handler” gồm React Supabase mutation, server page và Next Route Handler vì dự án không có `api.php`.

### Bookmark Board

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ chọn/drag/edit/delete | ✓ query/filter | uuid PK | Nhất quán. |
| `user_id` | — | G từ session prop | ✓ insert | uuid, nullable | Nên NOT NULL về mặt toàn vẹn. |
| `name` | ✓ | ✓ | ✓ | text NOT NULL | Nhất quán. |
| `order` | drag | ✓ | ✓ | int default 0 | Không unique; race/order partial. |
| `created_at` | — | — | ✓ dùng secondary sort | timestamptz default now | Không hiển thị. |

### Bookmark Folder

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ insert/upsert | uuid, nullable | Nên NOT NULL. |
| `board_id` | ✓ chọn board | ✓ filter/move | ✓ | uuid FK, nullable | Thiếu trong SQL repo; NULL làm folder không hiện ở board nào. |
| `name` | ✓ | ✓ | ✓ | text NOT NULL | Nhất quán. |
| `color` | ✓ | ✓ | ✓ | text default blue | Thiếu trong SQL repo; không CHECK. |
| `order` | drag | ✓ | ✓ upsert | int default 0 | Có encoding `column*1000+row`, không constraint. |
| `created_at` | — | — | ✓ secondary sort | timestamptz | Chỉ dùng ổn định sort ban đầu. |

### Bookmark

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ | uuid, nullable | Nên NOT NULL. |
| `folder_id` | chọn qua vị trí/modal | ✓ filter/move | ✓ | uuid FK, nullable | NULL làm bookmark không hiển thị. |
| `title` | ✓ nhập/hiển thị | ✓ | metadata route + Supabase | text NOT NULL | Nhất quán. |
| `url` | ✓ nhập/link | ✓ nhưng không normalize | metadata trả normalized URL bị bỏ qua | text NOT NULL | Lỗi #5. |
| `favicon_url` | hiển thị; không input riêng | ✓ tự tính | metadata route | text nullable | Nhất quán một phần. |
| `description` | — | P chỉ nhận khi create | metadata route ghi | text nullable | Mồ côi đầu ra; không hiển thị/sửa/export. |
| `order` | drag | ✓ | ✓ | int default 0 | Đã có trùng production; lỗi #6. |
| `created_at` | — | — | ✓ secondary sort | timestamptz | Không hiển thị. |

### Todo Group

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ insert | uuid nullable | Nên NOT NULL. |
| `name` | ✓ | ✓ | ✓ | text NOT NULL | Nhất quán. |
| `description` | ✓ | ✓ | ✓ | text nullable | Nhất quán. |
| `type` | G từ mode | ✓ filter | ✓ | text default todo | Không CHECK. |
| `order` | drag | ✓ | ✓ nhiều update | int default 0 | Không atomic. |
| `created_at` | — | — | ✓ page sort | timestamptz | Không hiển thị. |

### Todo / Checklist Item

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ insert/cron filter | uuid nullable | Nên NOT NULL. |
| `group_id` | chọn qua active group | ✓ | ✓ | uuid FK nullable | Delete group phụ thuộc FK action không nằm trong migration repo. |
| `content` | ✓ | ✓ | ✓ | text NOT NULL | Không có max length. |
| `is_done` | ✓ | ✓ | ✓ + cron | boolean default false | Optimistic không rollback. |
| `due_date` | ✓ date input/display | ✓ | ✓ | date nullable | Không dùng để lọc notification; hiện chỉ metadata hiển thị. |
| `recurrence` | ✓ | ✓ | ✓ + cron | text default none | Không CHECK. |
| `weekly_days` | ✓ | ✓ | ✓ + cron | integer[] nullable | Cho weekly rỗng; lỗi #13. |
| `last_completed_at` | — | G khi toggle | ✓ + cron | timestamptz nullable | Hai nơi client/cron cùng reset. |
| `type` | mode todo/checklist | ✓ filter | ✓ + cron | text default todo | Không CHECK; giá trị lạ bị ẩn. |
| `order` | drag | ✓ | ✓ nhiều update | int default 0 | Không atomic/unique. |
| `created_at` | — | — | ✓ initial sort | timestamptz | Không hiển thị. |

### Note Group

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ | uuid nullable | Nên NOT NULL. |
| `name` | ✓ | ✓ | ✓ | text NOT NULL | Nhất quán. |
| `color` | — | P trong type, không dùng | — | text default blue | Mồ côi; production toàn default. |
| `order` | drag | ✓ | ✓ nhiều update | int default 0 | Không atomic. |
| `created_at` | — | — | ✓ secondary sort | timestamptz | Không hiển thị. |

### Note

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | ✓ | ✓ | uuid PK | Nhất quán. |
| `user_id` | — | G | ✓ | uuid nullable | Nên NOT NULL. |
| `group_id` | ✓ autocomplete | ✓ | ✓ | uuid FK nullable, SET NULL theo SQL repo | Nhất quán. |
| `title` | ✓ | ✓ | ✓ | text nullable | Note được phép chỉ có content/attachment. |
| `content` | ✓ | ✓ | ✓ | text nullable | Nhất quán. |
| `type` | P suy từ attachment | P `'file'` khai báo nhưng không ghi | composer/share ghi khác nhau | text NOT NULL default text | Lỗi #9; không CHECK. |
| `image_url` | ✓ attachment | ✓ | upload/share | text nullable | Tên field không còn đúng vì chứa mọi loại file/base64. |
| `source_app` | — | P chỉ có trong interface | share-target ghi | text nullable | Không hiển thị; production hiện luôn NULL. |
| `color` | ✓ | ✓ | ✓ | text default default | Không CHECK. |
| `is_pinned` | ✓ | ✓ | ✓ | boolean default false | Quick update không đổi `updated_at`. |
| `order` | — | luôn ghi 0 | ✓ | int default 0 | Mồ côi; production toàn 0. |
| `created_at` | hiển thị thời gian tương đối | ✓ | ✓ sort | timestamptz | Nhất quán. |
| `updated_at` | hiển thị modal | ✓ chỉ full edit | ✓ | timestamptz default now | Stale khi pin/màu; lỗi #15. |

### Tag và liên kết Note–Tag

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `tags.id` | G | ✓ map | ✓ | uuid PK | Nhất quán. |
| `tags.user_id` | — | G | ✓ | uuid nullable | Nên NOT NULL. |
| `tags.name` | ✓ | normalize lowercase | ✓ insert | text NOT NULL, unique `(user_id,name)` theo SQL | Race conflict bị bỏ qua. |
| `tags.created_at` | — | — | ✓ sort/name không dùng date | timestamptz | Không hiển thị. |
| `note_tags.note_id` | — | ✓ map | ✓ replace | uuid PK/FK | Replace không transaction. |
| `note_tags.tag_id` | — | ✓ map | ✓ replace | uuid PK/FK | Replace không transaction. |

### Push Subscription

| Field | JSX/UI | React/client | API/handler | PostgreSQL | Ghi chú |
|---|---|---|---|---|---|
| `id` | G | P query existing | cron delete 410 | uuid PK | Nhất quán. |
| `user_id` | G từ prop | ✓ | cron group/count | uuid nullable | Nên NOT NULL. |
| `endpoint` | G từ browser | ✓ | cron gửi | text NOT NULL | Chưa thấy unique trong metadata; client check-then-insert race. |
| `p256dh` | G | ✓ | cron gửi | text NOT NULL | Nhất quán. |
| `auth` | G | ✓ | cron gửi | text NOT NULL | Nhất quán. |
| `created_at` | — | — | — | timestamptz | Không dùng cleanup/rotation. |

## 4. Trường mồ côi và hậu quả

1. `bookmarks.description`: tồn tại ở DB, metadata API và create payload; thiếu UI đọc/sửa/export. Hậu quả: dữ liệu đã lưu không tạo giá trị cho người dùng và bị mất khi export/import.
2. `notes.source_app`: share-target có ghi, interface có field; UI không đọc/hiển thị. Hậu quả: không biết nguồn chia sẻ; snapshot hiện tại cho thấy field chưa từng được set trên 11 notes.
3. `notes.order`: DB và payload có field nhưng mọi create ghi 0, page sort theo pin/created_at. Hậu quả: cột chết, không có chức năng sắp xếp note; snapshot toàn 0.
4. `note_groups.color`: DB/interface có field nhưng UI và mutation không đọc/ghi màu nhóm. Hậu quả: luôn default; snapshot không có giá trị khác `blue`.
5. `Note.type='file'`: có trong TypeScript nhưng không handler nào persist đúng; share-target đổi file thành text, composer đổi thành image. Hậu quả: filter/logic theo loại file không đáng tin cậy.
6. `initialSharedImage`: UI nhận query fallback nhưng share-target khi insert lỗi không truyền URL file đã upload. Hậu quả: attachment rơi giữa route và composer, đồng thời để object Storage mồ côi.

## 5. Database, quan hệ và data growth

- Quan hệ chính production được OpenAPI xác nhận: `bookmark_folders.board_id → bookmark_boards.id`, `bookmarks.folder_id → bookmark_folders.id`, `todos.group_id → groups.id`, `notes.group_id → note_groups.id`, `note_tags` nối `notes`–`tags`.
- SQL repo chỉ mô tả một phần quan hệ bookmark và note; không đủ để xác nhận/rebuild cascade cho board/todo production.
- UUID tránh overflow ID. `order` dùng int32 nhưng rủi ro thực tế trước overflow là trùng/partial update.
- Không có pagination/cursor; các màn hình load toàn bộ quan hệ 1-N và N-N.
- Import, replace tags và reorder thiếu transaction.
- Storage không có lifecycle cleanup được thể hiện trong repo.
- Cache PWA dùng NetworkFirst cho page/API GET; không thấy cache mutation. Rủi ro stale chính đến từ optimistic state không rollback và full-list SSR, không phải invalidate cache ghi.

## 6. Tổng kết

### Số lỗi theo mức độ

- Cao: 3
- Trung bình: 13
- Thấp: 3
- Thông tin/đã có biện pháp: 1
- Tổng lỗi cần xử lý: 19

### Ưu tiên sửa trước

1. Đồng bộ và version hóa toàn bộ schema/migration production; dựng được database mới từ repo.
2. Chuyển import bookmark và replace note-tags sang transaction/RPC.
3. Sửa cơ chế `order` và dọn bản ghi trùng đã xác nhận trong production.
4. Chuẩn hóa URL bookmark, attachment type và lifecycle Storage.
5. Thêm idempotency cho endpoint notification để tránh hai scheduler gửi trùng lúc 08:00.

### Test/coverage cần bổ sung

- Migration smoke test trên database rỗng và test rollback.
- Integration test Supabase cho CRUD, cascade/SET NULL, unique/order và transaction.
- E2E bookmark: URL thiếu scheme, delete/move/add, import lỗi giữa chunk, retry import.
- E2E todo: weekly không chọn ngày, timezone reset, đủ 5 lịch notification, offline mutation rollback.
- E2E note: create/edit tag khi insert link lỗi, PDF/file share, upload quá giới hạn, delete/replace attachment cleanup.
- Contract test cho field mapping giữa TypeScript payload, Route Handler và OpenAPI schema.
- CI bắt buộc `tsc --noEmit`, lint, build và test; không bỏ qua lỗi trong production build.

## 7. Giới hạn audit

- Không thực hiện kiểm tra security/RLS/auth policy theo chỉ dẫn.
- Không mutate dữ liệu production; kiểm tra Supabase chỉ đọc metadata và chỉ số cấu trúc/toàn vẹn.
- Không thể xác nhận index/cascade của các bảng thiếu migration chỉ từ PostgREST OpenAPI; cần bổ sung migration hoặc quyền đọc catalog PostgreSQL trong vòng sửa tiếp theo.

## 8. Trạng thái khắc phục lỗi mức Cao

Ngày cập nhật: 19/08/2026.

| Lỗi | Trạng thái mã nguồn | Thay đổi |
|---|---|---|
| #1 — thiếu migration đầy đủ | Đã sửa | Thêm migration baseline versioned `supabase/migrations/20260819000100_functional_database_baseline.sql`, bao phủ toàn bộ 10 bảng, quan hệ, index, RLS, Storage và RPC cần thiết. |
| #3 — note/tag không atomic | Đã sửa | Create/update note dùng `create_note_with_tags` và `update_note_with_tags`; note và toàn bộ tag links commit/rollback trong cùng transaction. |
| #4 — import bookmark ghi dở | Đã sửa | Import dùng `import_bookmarks_transactional` trong một RPC; bỏ insert folder trước và bỏ vòng lặp chunk ở client. |

Kết quả kiểm tra sau sửa: regression test 4/4 đạt, `tsc --noEmit` đạt, ESLint không còn error và production build đạt. Các RPC chỉ hoạt động trên môi trường đã áp dụng migration mới.
