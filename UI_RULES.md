# QUY TẮC PHÁT TRIỂN GIAO DIỆN (UI/UX RULES)

> [!IMPORTANT]
> **QUY TẮC CỐT LÕI VỀ THÔNG BÁO & HỘP THOẠI (DIALOGS):**
> 1. **TUYỆT ĐỐI KHÔNG** sử dụng các hộp thoại mặc định của trình duyệt như `window.alert()`, `window.confirm()`, `window.prompt()`, `alert()`, `confirm()`.
> 2. **BẮT BUỘC** sử dụng các cửa sổ Modal / Dialog tùy chỉnh (Custom React Modals như `ConfirmModal`, `AlertModal`) có giao diện hiện đại, ăn khớp với theme sáng/tối (Dark/Light mode) và trải nghiệm người dùng cao cấp.
> 3. Mọi hành động xoá dữ liệu, xác nhận nguy hiểm hoặc thông báo kết quả/lỗi đều phải đi qua hệ thống Modal UI này.
