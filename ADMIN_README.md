# EduBridge Admin Dashboard - Enhanced Features

## 🚀 Tính năng mới đã được thêm vào

### 1. Hệ thống Thông báo Thời gian thực
- **Thông báo tức thời**: Hiển thị thông báo ngay khi có gia sư mới đăng ký
- **Phân loại thông báo**: Đăng ký mới, Cần phê duyệt, Hệ thống
- **Trạng thái đọc/chưa đọc**: Theo dõi thông báo đã xem
- **Thông báo trình duyệt**: Hiển thị popup khi có thông báo mới

### 2. Trang Quản trị Nâng cao
- **Bảng thống kê**: Tổng gia sư, hồ sơ chờ duyệt, kết nối thành công
- **Bảng quản lý dữ liệu**: Hiển thị danh sách gia sư với tìm kiếm và lọc
- **Nút xử lý nhanh**: Duyệt, Từ chối, Xem chi tiết trong mỗi dòng
- **Modal chi tiết**: Hiển thị đầy đủ thông tin gia sư khi click "Xem chi tiết"

### 3. Bảo mật và Kiểm soát Quyền
- **Phân quyền Admin**: Chỉ user có trong collection `admins` mới truy cập được
- **Lịch sử hoạt động**: Ghi lại tất cả hành động duyệt/từ chối của admin

## 🛠️ Cài đặt và Thiết lập

### Thiết lập Quyền Admin

1. Mở `admin-setup.js` trong trình duyệt
2. Thay thế `ADMIN_UID_HERE` bằng UID thực của user admin (lấy từ Firebase Auth)
3. Thay thế `admin@example.com` bằng email thực
4. Chạy code trong browser console

```javascript
// Trong admin-setup.js
addAdminUser("REAL_ADMIN_UID", "admin@edubridge.com");
```

### Quy tắc Firestore Security Rules

Thêm các rules sau vào Firebase Console > Firestore > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin collection - chỉ admin mới đọc được
    match /admins/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Tutor registrations - admin có thể đọc/ghi, user chỉ đọc của mình
    match /tutor_registrations/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
         request.auth.uid == resource.data.userId);
    }

    // Admin activities - chỉ admin ghi và đọc
    match /admin_activities/{document} {
      allow read, write: if request.auth != null &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Other collections...
  }
}
```

## 📱 Cách sử dụng

### Thông báo
- Click vào icon 🔔 ở header để xem thông báo
- Thông báo mới sẽ hiển thị số lượng badge đỏ
- Click vào thông báo để xem chi tiết gia sư

### Duyệt Gia sư
1. Vào tab "Duyệt gia sư"
2. Sử dụng bộ lọc để tìm gia sư cụ thể
3. Click "Xem chi tiết" để xem thông tin đầy đủ
4. Click "Duyệt" hoặc "Từ chối" để xử lý

### Thống kê
- Xem các con số tổng quan ở đầu trang
- Tự động cập nhật khi có thay đổi

## 🔧 API và Hooks

### Thông báo
```javascript
// Thêm thông báo mới
this.addNotification({
  id: "unique_id",
  type: "new_registration", // hoặc "system"
  title: "Tiêu đề",
  message: "Nội dung",
  tutorData: {...}, // dữ liệu gia sư
  createdAt: new Date(),
  isRead: false
});
```

### Activity Logging
```javascript
// Ghi lại hoạt động admin
await this.logActivity("approve_tutor", {
  tutorEmail: "tutor@example.com",
  tutorName: "Nguyễn Văn A",
  action: "approved"
});
```

## 🎨 Tùy chỉnh Giao diện

### Thay đổi Màu sắc
Sửa trong `:root` của `styles.css`:
```css
--accent: #0d6b5c;        /* Màu chính */
--coral: #c45c3e;         /* Màu phụ */
--bg: #f4f1eb;           /* Màu nền */
```

### Responsive Design
Đã tích hợp responsive cho mobile và tablet.

## 🔒 Bảo mật

- **Authentication**: Chỉ user đã đăng nhập mới truy cập
- **Authorization**: Kiểm tra quyền admin qua collection `admins`
- **Activity Logging**: Ghi lại tất cả hành động quan trọng
- **Input Validation**: Validate dữ liệu đầu vào

## 🚀 Tính năng Nâng cao (Tương lai)

- **Email Notifications**: Tích hợp EmailJS để gửi email tự động
- **Push Notifications**: Thông báo đẩy qua Firebase Cloud Messaging
- **Advanced Filtering**: Lọc theo nhiều tiêu chí cùng lúc
- **Bulk Actions**: Xử lý nhiều gia sư cùng lúc
- **Export Data**: Xuất báo cáo Excel/PDF
- **Audit Trail**: Báo cáo chi tiết hoạt động admin

## 🐛 Xử lý Sự cố

### Không thấy thông báo
- Kiểm tra console browser có lỗi không
- Đảm bảo đã thiết lập admin permissions
- Kiểm tra Firestore rules

### Không thể duyệt gia sư
- Kiểm tra kết nối internet
- Xác nhận quyền admin
- Kiểm tra Firebase permissions

### Modal không hiển thị
- Kiểm tra CSS conflicts
- Verify modal HTML structure
- Check JavaScript errors

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Browser console errors
2. Firebase console logs
3. Network requests
4. Firestore security rules