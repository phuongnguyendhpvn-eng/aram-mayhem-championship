# ARAM MAYHEM CHAMPIONSHIP — Hướng dẫn triển khai

Bộ website gồm giao diện công khai, bảng xếp hạng, quản trị Admin và đồng bộ dữ liệu online qua Supabase.

## A. Tạo repository GitHub

1. Đăng nhập https://github.com
2. Chọn New repository.
3. Repository name: `aram-mayhem-championship`
4. Chọn Public (GitHub Pages miễn phí cho repo public).
5. Tạo repository, sau đó upload toàn bộ nội dung thư mục này lên nhánh `main`.
6. Đảm bảo file `index.html` nằm ngay thư mục gốc repo, không nằm trong thư mục con.

## B. Tạo database Supabase

1. Vào https://supabase.com và tạo project mới.
2. Mở SQL Editor > New query.
3. Mở file `supabase-schema.sql`, copy toàn bộ và chạy.
4. Vào Project Settings > API (hoặc API Keys) và lấy:
   - Project URL
   - anon/public key (không lấy service_role/secret key)
5. Mở `config.js` trên GitHub, thay:
   - `PASTE_SUPABASE_PROJECT_URL_HERE` bằng Project URL
   - `PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE` bằng anon/public key
6. Commit thay đổi.

## C. Tạo duy nhất một tài khoản Admin

1. Trong Supabase, mở Authentication > Providers > Email.
2. Tắt Allow new users to sign up / Enable email signups (tên mục có thể thay đổi theo giao diện).
3. Vào Authentication > Users > Add user / Create new user.
4. Tạo một email quản trị và mật khẩu mạnh, riêng biệt. Không dùng mật khẩu ngắn hoặc mật khẩu đã chia sẻ trong chat.
5. Sao chép UUID của user vừa tạo.
6. Mở SQL Editor và chạy câu lệnh (thay UUID):
   `insert into public.admin_users (user_id) values ('UUID_CUA_ADMIN');`
7. Không tạo thêm user Admin. Không cho người khác quyền truy cập Supabase project owner.

Ghi chú: giao diện đăng nhập dùng email + mật khẩu Supabase. Có thể đặt email quản trị theo quy ước nội bộ của bro; chữ “admin” là vai trò, không phải tên đăng nhập độc lập. Không hardcode mật khẩu vào mã nguồn.

## D. Bật GitHub Pages

1. Mở repository > Settings > Pages.
2. Ở Build and deployment, chọn Source: GitHub Actions.
3. Vào tab Actions, chờ workflow “Deploy ARAM Mayhem to GitHub Pages” chạy thành công.
4. Website sẽ có địa chỉ:
   `https://TEN_GITHUB_CUA_BRO.github.io/aram-mayhem-championship/`

## E. Sử dụng website

1. Mở website, chọn ADMIN LOGIN và đăng nhập bằng email/mật khẩu Admin.
2. Vào tab Tuyển thủ, thêm đủ 15 nickname.
3. Chọn “BỐC THĂM 3 ĐỘI”. Hệ thống chia ngẫu nhiên 5 người/đội và tạo lịch:
   - Trận 1: Đội 1 vs Đội 2
   - Trận 2: Đội 2 vs Đội 3
   - Trận 3: Đội 3 vs Đội 1
4. Vào tab Đội tuyển để đổi tên đội nếu cần.
5. Vào tab Kết quả, chọn đội thắng sau mỗi trận.
6. Bảng xếp hạng tự tính: thắng 3 điểm, thua 0 điểm.

## F. Quyền truy cập và bảo mật

- Người xem không cần đăng nhập; chỉ được SELECT dữ liệu công khai.
- Chỉ UUID có trong `admin_users` được INSERT/UPDATE/DELETE.
- RLS trong Supabase là lớp bảo vệ thực tế; ẩn nút trên giao diện không được xem là bảo mật.
- Chỉ dùng anon/public key trong `config.js`. Tuyệt đối không dùng service_role key ở frontend.
- Tắt đăng ký công khai trong Supabase Auth.
- Bật MFA cho tài khoản sở hữu Supabase/GitHub nếu có thể.

## G. Giới hạn phiên bản đầu

- Chưa có upload ảnh đại diện, logo đội hoặc nhập ảnh.
- Chưa có lịch sử thao tác chi tiết.
- Tie-break đang xử lý điểm, đối đầu trực tiếp và hiệu số thắng-thua. Với giải 3 đội vòng tròn, nếu hòa ba bên hoặc thiếu dữ liệu đối đầu, Admin nên tổ chức trận BO1 phân định theo quy định giải.
- Tên đội mặc định là ĐỘI TÍM, ĐỘI HỒNG, ĐỘI XANH.
- Xóa đội hình/bốc thăm lại sẽ thay đổi dữ liệu đội và xóa kết quả 3 trận hiện tại.

## Troubleshooting

- Nếu thấy “Website đang chờ kết nối cơ sở dữ liệu”: kiểm tra `config.js` và commit lại.
- Nếu đăng nhập được nhưng không chỉnh sửa được: kiểm tra UUID Admin đã được insert đúng vào `admin_users`.
- Nếu không thấy thay đổi realtime: kiểm tra Realtime publication đã có bảng `players`, `teams`, `matches`.
- Nếu GitHub Pages chưa có trang: vào Actions xem log deploy; kiểm tra Pages Source đang là GitHub Actions.
