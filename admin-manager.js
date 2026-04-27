import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  writeBatch,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

class AdminManager {
  constructor() {
    this.currentTab = "tutor-approvals";
    this.notifications = [];
    this.unreadCount = 0;
    this.currentUser = null;
    this.isAdmin = false;
    this.initElements();
    this.setupAuth();
    this.setupTabs();
    this.setupFilters();
    this.setupNotifications();
    this.setupModal();
    this.initAsync();
  }

  async initAsync() {
    //await this.renderApprovals();
  }

  initElements() {
    this.tabButtons = document.querySelectorAll(".admin-tab-btn");
    this.tabContents = document.querySelectorAll(".admin-tab-content");
    
    // Notification elements
    this.notificationBtn = document.getElementById("notification-btn");
    this.notificationCount = document.getElementById("notification-count");
    this.notificationDropdown = document.getElementById("notification-dropdown");
    this.notificationList = document.getElementById("notification-list");
    this.markAllReadBtn = document.getElementById("mark-all-read");
    
    // Dashboard cards
    this.totalTutorsEl = document.getElementById("total-tutors");
    this.pendingApprovalsEl = document.getElementById("pending-approvals");
    this.successfulConnectionsEl = document.getElementById("successful-connections");
    this.totalStudentsEl = document.getElementById("total-students");
    
    // Modal elements
    this.tutorDetailModal = document.getElementById("tutor-detail-modal");
    this.modalTutorName = document.getElementById("modal-tutor-name");
    this.modalTutorDetails = document.getElementById("modal-tutor-details");
    this.modalApproveBtn = document.getElementById("modal-approve-btn");
    this.modalRejectBtn = document.getElementById("modal-reject-btn");
    this.modalCloseBtn = document.getElementById("modal-close-btn");
    this.closeModalBtn = document.getElementById("close-modal");
    
    // Tab: Tutor Approvals
    this.filterStatus = document.getElementById("filter-status");
    this.filterKeyword = document.getElementById("filter-keyword");
    this.adminTutorList = document.getElementById("admin-tutor-list");
    this.adminEmpty = document.getElementById("admin-empty");
    
    // Tab: Tutor List
    this.tutorSearchKeyword = document.getElementById("tutor-search-keyword");
    this.tutorSearchStatus = document.getElementById("tutor-search-status");
    this.tutorManageList = document.getElementById("tutor-manage-list");
    this.tutorManageEmpty = document.getElementById("tutor-manage-empty");
    
    // Tab: Student List
    this.studentSearchKeyword = document.getElementById("student-search-keyword");
    this.studentManageList = document.getElementById("student-manage-list");
    this.studentManageEmpty = document.getElementById("student-manage-empty");
    
    // Tab: Requests
    this.requestSearchStatus = document.getElementById("request-search-status");
    this.requestSearchKeyword = document.getElementById("request-search-keyword");
    this.requestManageList = document.getElementById("request-manage-list");
    this.requestManageEmpty = document.getElementById("request-manage-empty");
  }

    setupAuth() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "dang-nhap.html?next=" + encodeURIComponent("admin.html");
        return;
      }

      this.currentUser = user;

      try {
        const userEmail = (user.email || "").toLowerCase().trim();

        // Lấy Email Admin từ Firestore
        const adminDoc = await getDoc(doc(db, 'settings', 'edubridge_admin_email'));
        const adminEmailFromDb = adminDoc.exists() ? adminDoc.data().value.toLowerCase().trim() : "tu620014@gmail.com";

        // Kiểm tra quyền
        this.isAdmin = (userEmail === adminEmailFromDb);

        if (!this.isAdmin) {
          // Kiểm tra thêm danh sách Moderator
          const modDoc = await getDoc(doc(db, 'settings', 'edubridge_moderator_emails'));
          if (modDoc.exists() && Array.isArray(modDoc.data().value)) {
            const moderators = modDoc.data().value.map(e => String(e).toLowerCase().trim());
            if (moderators.includes(userEmail)) {
              this.isAdmin = true;
            }
          }
        }

        if (!this.isAdmin) {
          alert("Bạn không có quyền truy cập trang quản trị!");
          window.location.href = "index.html";
          return;
        }
        
        // 1. Cập nhật nút đăng xuất
        const logoutLink = document.getElementById("nav-auth-link");
        if (logoutLink) {
          logoutLink.textContent = "Đăng xuất";
          logoutLink.href = "#";
          logoutLink.onclick = async (e) => {
            e.preventDefault();
            await auth.signOut();
            localStorage.removeItem('edubridge_read_notifications');
            window.location.href = "index.html";
          };
        }

        // 2. Tải dữ liệu thống kê
        await this.loadDashboardStats();

        // --- PHẦN SỬA ĐỔI CHÍNH ---
        // 3. Tự động render dữ liệu cho tab đang được chọn (thường là tutor-approvals)
        // Điều này đảm bảo khi vào trang lần đầu, sau khi check Auth xong sẽ thấy dữ liệu ngay
        if (this.currentTab === "tutor-approvals") {
          await this.renderApprovals();
        } else {
          // Hoặc tổng quát hơn, gọi switchTab với tab hiện tại
          await this.switchTab(this.currentTab);
        }
        // --------------------------

      } catch (error) {
        console.error("Error checking admin permissions:", error);
        alert("Có lỗi khi kiểm tra quyền truy cập!");
        window.location.href = "index.html";
      }
    });
  }

  setupTabs() {
    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tabName = btn.getAttribute("data-tab");
        await this.switchTab(tabName);
      });
    });
  }

  async switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update button states
    this.tabButtons.forEach((btn) => {
      btn.classList.remove("admin-tab-btn-active");
      if (btn.getAttribute("data-tab") === tabName) {
        btn.classList.add("admin-tab-btn-active");
      }
    });
    
    // Update content visibility
    this.tabContents.forEach((content) => {
      content.classList.remove("admin-tab-content-active");
      if (content.id === `tab-${tabName}`) {
        content.classList.add("admin-tab-content-active");
      }
    });
    
    // Render tab content
    if (tabName === "tutor-approvals") {
      await this.renderApprovals();
    } else if (tabName === "tutor-list") {
      await this.renderTutors();
    } else if (tabName === "student-list") {
      await this.renderStudents();
    } else if (tabName === "requests") {
      await this.renderRequests();
    }
  }

  async readJson(key) {
    try {
      if (key === "edubridge_wallets") {
        const docRef = doc(db, 'settings', 'wallets');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().value : {"adminRevenue":0,"tutorBalances":{}};
      } else {
        const collectionName = key.replace('edubridge_', '');
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      }
    } catch (e) {
      return key === "edubridge_wallets" ? {"adminRevenue":0,"tutorBalances":{}} : [];
    }
  }

  async writeJson(key, value) {
    try {
      if (key === "edubridge_wallets") {
        await setDoc(doc(db, 'settings', 'wallets'), {value});
      } else {
        const collectionName = key.replace('edubridge_', '');
        const batch = writeBatch(db);
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
        } catch (e) {
          console.warn('Không thể đọc trước khi ghi', collectionName, e);
        }
        value.forEach(item => {
          // Đảm bảo id luôn là string bằng cách dùng String()
          const id = item.id ? String(item.id) : Date.now().toString() + Math.random().toString(36).substr(2, 5);
          const docRef = doc(db, collectionName, id);
          batch.set(docRef, item);
        });
        await batch.commit();
      }
    } catch (e) {
      console.error(e);
    }
  }

  setupFilters() {
    // Tutor approvals filters
    if (this.filterStatus && this.filterKeyword) {
      this.filterStatus.addEventListener("change", () => this.renderApprovals());
      this.filterKeyword.addEventListener("input", () => this.renderApprovals());
    }
    
    // Tutor list filters
    if (this.tutorSearchKeyword && this.tutorSearchStatus) {
      this.tutorSearchKeyword.addEventListener("input", () => this.renderTutors());
      this.tutorSearchStatus.addEventListener("change", () => this.renderTutors());
    }
    
    // Student list filters
    if (this.studentSearchKeyword) {
      this.studentSearchKeyword.addEventListener("input", () => this.renderStudents());
    }
    
    // Request filters
    if (this.requestSearchStatus && this.requestSearchKeyword) {
      this.requestSearchStatus.addEventListener("change", () => this.renderRequests());
      this.requestSearchKeyword.addEventListener("input", () => this.renderRequests());
    }
  }

  // === NOTIFICATIONS ===
  setupNotifications() {
    // Notification button click
    if (this.notificationBtn) {
      this.notificationBtn.addEventListener("click", () => {
        this.toggleNotificationDropdown();
      });
    }
    
    // Mark all as read
    if (this.markAllReadBtn) {
      this.markAllReadBtn.addEventListener("click", () => {
        this.markAllNotificationsAsRead();
      });
    }
    
    // Clear read storage (reset button)
    const clearReadStorageBtn = document.getElementById("clear-read-storage");
    if (clearReadStorageBtn) {
      clearReadStorageBtn.addEventListener("click", () => {
        this.clearReadNotificationsStorage();
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.notificationBtn.contains(e.target) && !this.notificationDropdown.contains(e.target)) {
        this.notificationDropdown.style.display = "none";
      }
    });
    
    // Setup real-time listener for tutor registrations
    this.setupRealtimeNotifications();
  }
  
  setupRealtimeNotifications() {
    const q = query(
      collection(db, "tutor_registrations"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    
    onSnapshot(q, (snapshot) => {
      // Clear existing notifications to avoid duplicates
      this.notifications = [];
      
      // Process all current documents
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === "pending") {
          // Check if this notification was previously marked as read
          const readNotifications = this.getReadNotificationsFromStorage();
          const isRead = readNotifications.includes(doc.id);
          
          this.notifications.push({
            id: doc.id,
            type: "new_registration",
            title: "Gia sư mới đăng ký",
            message: `${data.name} đã đăng ký làm gia sư môn ${data.subject}`,
            tutorData: data,
            createdAt: data.createdAt?.toDate() || new Date(),
            isRead: isRead
          });
        }
      });
      
      // Update UI with current notifications
      this.updateNotificationUI();
      
      // Update dashboard stats when data changes
      this.loadDashboardStats();
    }, (error) => {
      console.error("Error in realtime notifications:", error);
    });
  }
  
  addNotification(notification) {
    this.notifications.unshift(notification);
    this.updateNotificationUI();
    this.showBrowserNotification(notification);
  }
  
  updateNotificationUI() {
    this.unreadCount = this.notifications.filter(n => !n.isRead).length;
    
    // Update notification count
    if (this.unreadCount > 0) {
      this.notificationCount.textContent = this.unreadCount > 99 ? "99+" : this.unreadCount;
      this.notificationCount.style.display = "inline";
    } else {
      this.notificationCount.style.display = "none";
    }
    
    // Update notification list
    const recentNotifications = this.notifications.slice(0, 10);
    this.notificationList.innerHTML = recentNotifications.map(n => this.renderNotification(n)).join("");
    
    // Add click listeners for notifications
    this.notificationList.querySelectorAll(".notification-item").forEach((item, index) => {
      item.addEventListener("click", () => {
        this.markNotificationAsRead(recentNotifications[index].id);
        this.showTutorDetailModal(recentNotifications[index].tutorData);
        this.notificationDropdown.style.display = "none";
      });
    });
  }
  
  renderNotification(notification) {
    const timeAgo = this.getTimeAgo(notification.createdAt);
    const unreadClass = notification.isRead ? "" : "notification-unread";
    
    return `
      <div class="notification-item ${unreadClass}" data-id="${notification.id}">
        <div class="notification-icon">
          ${notification.type === "new_registration" ? "👨‍🏫" : "⚠️"}
        </div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }
  
  toggleNotificationDropdown() {
    this.notificationDropdown.style.display = 
      this.notificationDropdown.style.display === "block" ? "none" : "block";
  }
  
  markNotificationAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      this.saveReadNotificationToStorage(notificationId);
      this.updateNotificationUI();
    }
  }
  
  markNotificationAsReadByEmail(email) {
    const notification = this.notifications.find(n => 
      n.tutorData && n.tutorData.email?.toLowerCase() === email.toLowerCase()
    );
    if (notification) {
      notification.isRead = true;
      this.saveReadNotificationToStorage(notification.id);
      this.updateNotificationUI();
    }
  }
  
  markAllNotificationsAsRead() {
    this.notifications.forEach(n => {
      n.isRead = true;
      this.saveReadNotificationToStorage(n.id);
    });
    this.updateNotificationUI();
  }
  
  getReadNotificationsFromStorage() {
    try {
      const readNotifications = localStorage.getItem('edubridge_read_notifications');
      return readNotifications ? JSON.parse(readNotifications) : [];
    } catch (error) {
      console.error("Error reading read notifications from storage:", error);
      return [];
    }
  }
  
  saveReadNotificationToStorage(notificationId) {
    try {
      const readNotifications = this.getReadNotificationsFromStorage();
      if (!readNotifications.includes(notificationId)) {
        readNotifications.push(notificationId);
        localStorage.setItem('edubridge_read_notifications', JSON.stringify(readNotifications));
      }
    } catch (error) {
      console.error("Error saving read notification to storage:", error);
    }
  }
  
  // Debug method to check notification state
  debugNotifications() {
    console.log("Current notifications:", this.notifications);
    console.log("Unread count:", this.unreadCount);
    console.log("Read notifications from storage:", this.getReadNotificationsFromStorage());
  }
  
  clearReadNotificationsStorage() {
    try {
      localStorage.removeItem('edubridge_read_notifications');
      // Reset all notifications to unread
      this.notifications.forEach(n => n.isRead = false);
      this.updateNotificationUI();
      console.log("Read notifications storage cleared");
    } catch (error) {
      console.error("Error clearing read notifications storage:", error);
    }
  }
  
  showBrowserNotification(notification) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico"
      });
    }
  }
  
  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Vừa xong";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  }

  // === DASHBOARD STATS ===
  async loadDashboardStats() {
    try {
      const [tutors, students, requests] = await Promise.all([
        this.readJson("edubridge_tutor_registrations"),
        this.readJson("edubridge_students"),
        this.readJson("edubridge_requests")
      ]);
      
      // Total tutors (approved)
      const totalTutors = tutors.filter(t => t.status === "approved").length;
      this.totalTutorsEl.textContent = totalTutors;
      
      // Pending approvals
      const pendingApprovals = tutors.filter(t => t.status === "pending").length;
      this.pendingApprovalsEl.textContent = pendingApprovals;
      
      // Successful connections (approved requests)
      const successfulConnections = requests.filter(r => r.status === "approved").length;
      this.successfulConnectionsEl.textContent = successfulConnections;
      
      // Total students
      this.totalStudentsEl.textContent = students.length;
      
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  }

  // === MODAL MANAGEMENT ===
  setupModal() {
    // Close modal events
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener("click", () => this.closeTutorDetailModal());
    }
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener("click", () => this.closeTutorDetailModal());
    }
    
    // Modal action buttons
    if (this.modalApproveBtn) {
      this.modalApproveBtn.addEventListener("click", () => {
        const email = this.modalApproveBtn.getAttribute("data-email");
        if (email) {
          this.approveTutorRegistration(email);
          this.closeTutorDetailModal();
        }
      });
    }
    
    if (this.modalRejectBtn) {
      this.modalRejectBtn.addEventListener("click", () => {
        const email = this.modalRejectBtn.getAttribute("data-email");
        if (email) {
          const reason = prompt("Nhập lý do từ chối:");
          if (reason !== null) {
            this.rejectTutorRegistration(email, reason);
            this.closeTutorDetailModal();
          }
        }
      });
    }
    
    // Close modal when clicking outside
    this.tutorDetailModal.addEventListener("click", (e) => {
      if (e.target === this.tutorDetailModal) {
        this.closeTutorDetailModal();
      }
    });
  }
  
  showTutorDetailModal(tutorData) {
    this.modalTutorName.textContent = `Chi tiết: ${tutorData.name}`;
    this.modalTutorDetails.innerHTML = this.renderTutorDetails(tutorData);
    
    // Set data attributes for action buttons
    this.modalApproveBtn.setAttribute("data-email", tutorData.email);
    this.modalRejectBtn.setAttribute("data-email", tutorData.email);
    
    this.tutorDetailModal.style.display = "block";
    document.body.style.overflow = "hidden";
  }
  
  closeTutorDetailModal() {
    this.tutorDetailModal.style.display = "none";
    document.body.style.overflow = "auto";
  }
  
  renderTutorDetails(tutorData) {
    return `
      <div class="tutor-detail-grid">
        <div class="detail-section">
          <h3>Thông tin cá nhân</h3>
          <p><strong>Họ tên:</strong> ${tutorData.name || "Chưa cập nhật"}</p>
          <p><strong>Email:</strong> ${tutorData.email || "Chưa cập nhật"}</p>
          <p><strong>Số điện thoại:</strong> ${tutorData.phone || "Chưa cập nhật"}</p>
          <p><strong>Địa chỉ:</strong> ${tutorData.address || "Chưa cập nhật"}</p>
          <p><strong>Khu vực:</strong> ${tutorData.location || "Chưa cập nhật"}</p>
        </div>
        
        <div class="detail-section">
          <h3>Thông tin giảng dạy</h3>
          <p><strong>Môn học:</strong> ${tutorData.subject || "Chưa cập nhật"}</p>
          <p><strong>Cấp độ:</strong> ${tutorData.level || "Chưa cập nhật"}</p>
          <p><strong>Kinh nghiệm:</strong> ${tutorData.experience || "Chưa cập nhật"}</p>
          <p><strong>Giá cả:</strong> ${tutorData.price ? tutorData.price.toLocaleString("vi-VN") + " VND/buổi" : "Chưa cập nhật"}</p>
          <p><strong>Lịch học:</strong> ${tutorData.schedule || "Chưa cập nhật"}</p>
        </div>
        
        <div class="detail-section">
          <h3>Chứng chỉ & Học vấn</h3>
          <p><strong>Trình độ:</strong> ${tutorData.degree || "Chưa cập nhật"}</p>
          <p><strong>Trường học:</strong> ${tutorData.school || "Chưa cập nhật"}</p>
          <p><strong>Chứng chỉ:</strong> ${tutorData.certificates || "Chưa cập nhật"}</p>
        </div>
        
        <div class="detail-section">
          <h3>Giới thiệu</h3>
          <p>${tutorData.bio || "Chưa có giới thiệu"}</p>
        </div>
        
        <div class="detail-section">
          <h3>Trạng thái</h3>
          <p><strong>Trạng thái duyệt:</strong> ${this.getStatusLabel(tutorData.status)}</p>
          <p><strong>Ngày đăng ký:</strong> ${tutorData.createdAt ? new Date(tutorData.createdAt.seconds * 1000).toLocaleDateString("vi-VN") : "Chưa cập nhật"}</p>
          ${tutorData.rejectReason ? `<p><strong>Lý do từ chối:</strong> ${tutorData.rejectReason}</p>` : ""}
        </div>
      </div>
    `;
  }
  
  getStatusLabel(status) {
    switch (status) {
      case "pending": return "Chờ duyệt";
      case "approved": return "Đã duyệt";
      case "rejected": return "Từ chối";
      default: return "Chưa cập nhật";
    }
  }

  // === TUTOR APPROVALS ===
  async renderApprovals() {
    const registrations = await this.readJson("edubridge_tutor_registrations");
    const statusFilter = this.filterStatus?.value || "";
    const keywordFilter = (this.filterKeyword?.value || "").toLowerCase();

    let filtered = registrations.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (
        keywordFilter &&
        !item.name?.toLowerCase().includes(keywordFilter) &&
        !item.email?.toLowerCase().includes(keywordFilter) &&
        !item.subject?.toLowerCase().includes(keywordFilter)
      ) {
        return false;
      }
      return true;
    });

    this.adminTutorList.innerHTML = filtered.map((item) => this.tutorApprovalCard(item)).join("");
    this.adminEmpty.hidden = filtered.length !== 0;
    this.attachTutorApprovalListeners();
  }

  tutorApprovalCard(item) {
    const status = item.status || "pending";
    const statusLabel = status === "approved" ? "Đã duyệt" : status === "rejected" ? "Từ chối" : "Chờ duyệt";
    const buttons = 
      status === "approved"
        ? `<button type="button" class="btn btn-secondary admin-reject-btn" data-email="${item.email}">Từ chối</button>`
        : `<button type="button" class="btn btn-primary admin-approve-btn" data-email="${item.email}">Duyệt</button>
           <button type="button" class="btn btn-secondary admin-reject-btn" data-email="${item.email}">Từ chối</button>`;
    const rejectReason = status === "rejected" && item.rejectReason
      ? `<p class="tutor-duration"><strong>Lý do:</strong> ${item.rejectReason}</p>`
      : "";

    return `
      <article class="tutor-card">
        <h3>${item.name || "Gia sư"}</h3>
        <p class="tutor-meta">${item.subject || "Chưa cập nhật"} • ${item.level || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Email:</strong> ${item.email}</p>
        <p class="tutor-duration"><strong>Khu vực:</strong> ${item.location || "Chưa cập nhật"}</p>
        <p class="tutor-duration"><strong>Trạng thái:</strong> ${statusLabel}</p>
        ${rejectReason}
        <div class="request-modal-actions">
          <button type="button" class="btn btn-outline admin-view-btn" data-email="${item.email}">Xem chi tiết</button>
          ${buttons}
        </div>
      </article>
    `;
  }

  attachTutorApprovalListeners() {
    const approveButtons = document.querySelectorAll(".admin-approve-btn");
    const rejectButtons = document.querySelectorAll(".admin-reject-btn");
    const viewButtons = document.querySelectorAll(".admin-view-btn");

    approveButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        this.approveTutorRegistration(email);
      });
    });

    rejectButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        const reason = prompt("Nhập lý do từ chối:");
        if (reason !== null) {
          this.rejectTutorRegistration(email, reason);
        }
      });
    });
    
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        this.viewTutorDetails(email);
      });
    });
  }

  async approveTutorRegistration(email) {
    try {
      // 1. Tìm bản ghi gia sư trong Firestore dựa trên email
      const registrationsCol = collection(db, "tutor_registrations");
      const q = query(registrationsCol, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("Không tìm thấy thông tin gia sư!");
        return;
      }

      // Lấy document reference và dữ liệu hiện tại
      const tutorDoc = querySnapshot.docs[0];
      const docRef = doc(db, "tutor_registrations", tutorDoc.id);
      const tutorData = tutorDoc.data();

      // 2. Cập nhật TRỰC TIẾP trạng thái vào Firestore (Không dùng writeJson nữa)
      await updateDoc(docRef, {
        status: "approved",
        updatedAt: new Date().toISOString()
      });

      // 3. Xử lý các logic bổ trợ
      
      // Đánh dấu thông báo liên quan là đã đọc
      this.markNotificationAsReadByEmail(email);

      // Ghi nhật ký hoạt động (Activity Log)
      await this.logActivity("approve_tutor", {
        tutorEmail: email,
        tutorName: tutorData.name || "Gia sư",
        action: "approved"
      });

      // Thêm thông báo vào hệ thống UI admin
      this.addNotification({
        id: Date.now().toString(),
        type: "system",
        title: "Gia sư đã được duyệt",
        message: `${tutorData.name || email} đã được duyệt thành công`,
        createdAt: new Date(),
        isRead: false
      });

      // 4. Cập nhật lại giao diện ngay lập tức
      await this.renderApprovals();
      await this.loadDashboardStats();
      
      alert("Đã duyệt gia sư thành công!");

    } catch (error) {
      console.error("Error approving tutor:", error);
      alert("Có lỗi xảy ra: " + error.message);
    }
  }

  async rejectTutorRegistration(email, reason) {
    try {
      const registrations = await this.readJson("edubridge_tutor_registrations");
      const tutor = registrations.find((item) => item.email?.toLowerCase() === email.toLowerCase());
      
      if (tutor) {
        tutor.status = "rejected";
        tutor.rejectReason = reason;
        tutor.updatedAt = new Date().toISOString();
        await this.writeJson("edubridge_tutor_registrations", registrations);
        
        // Mark related notification as read
        this.markNotificationAsReadByEmail(email);
        
        // Log activity
        await this.logActivity("reject_tutor", {
          tutorEmail: email,
          tutorName: tutor.name,
          action: "rejected",
          reason: reason
        });
        
        await this.renderApprovals();
        await this.loadDashboardStats();
        alert("Đã từ chối gia sư!");
      }
    } catch (error) {
      console.error("Error rejecting tutor:", error);
      alert("Có lỗi xảy ra khi từ chối gia sư!");
    }
  }

  async viewTutorDetails(email) {
    try {
      const registrations = await this.readJson("edubridge_tutor_registrations");
      const tutor = registrations.find((item) => item.email?.toLowerCase() === email.toLowerCase());
      
      if (tutor) {
        this.showTutorDetailModal(tutor);
      }
    } catch (error) {
      console.error("Error viewing tutor details:", error);
      alert("Có lỗi xảy ra khi xem chi tiết gia sư!");
    }
  }

  async logActivity(action, details) {
    try {
      if (!this.currentUser) return;
      
      const activityData = {
        action: action,
        adminId: this.currentUser.uid,
        adminEmail: this.currentUser.email,
        details: details,
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, "admin_activities"), activityData);
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  }

  // === TUTOR MANAGEMENT ===
  async renderTutors() {
    const registrations = await this.readJson("edubridge_tutor_registrations");
    const tutors = registrations.filter((item) => item.status === "approved");
    
    const keywordFilter = (this.tutorSearchKeyword?.value || "").toLowerCase();
    const statusFilter = this.tutorSearchStatus?.value || "";

    let filtered = tutors.filter((item) => {
      if (statusFilter && item.activeState !== statusFilter) return false;
      if (
        keywordFilter &&
        !item.name?.toLowerCase().includes(keywordFilter) &&
        !item.email?.toLowerCase().includes(keywordFilter) &&
        !item.subject?.toLowerCase().includes(keywordFilter)
      ) {
        return false;
      }
      return true;
    });

    this.tutorManageList.innerHTML = filtered.map((item) => this.tutorManageCard(item)).join("");
    this.tutorManageEmpty.hidden = filtered.length !== 0;
    this.attachTutorManageListeners();
  }

  tutorManageCard(item) {
    const status = item.activeState || "available";
    const price = (item.price || 0).toLocaleString("vi-VN");
    const statusBadge = status === "busy"
      ? `<span class="tutor-status tutor-status-busy">Đang bận</span>`
      : `<span class="tutor-status tutor-status-available">Có sẵn</span>`;

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>${item.name || "Gia sư"}</h3>
          ${statusBadge}
        </div>
        <p class="tutor-meta">${item.subject || "Chưa cập nhật"} • ${item.level || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Email:</strong> ${item.email}</p>
        <p class="tutor-duration"><strong>Khu vực:</strong> ${item.location || "Chưa cập nhật"}</p>
        <p class="tutor-duration"><strong>Giá:</strong> ${price} VND/buổi</p>
        <div class="request-modal-actions">
          <button type="button" class="btn btn-secondary tutor-toggle-status-btn" data-email="${item.email}">
            ${status === "busy" ? "Mở lại" : "Đánh dấu bận"}
          </button>
          <button type="button" class="btn btn-secondary tutor-remove-btn" data-email="${item.email}">Xóa</button>
        </div>
      </article>
    `;
  }

  attachTutorManageListeners() {
    const toggleButtons = document.querySelectorAll(".tutor-toggle-status-btn");
    const removeButtons = document.querySelectorAll(".tutor-remove-btn");

    toggleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        this.toggleTutorStatus(email);
      });
    });

    removeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        if (confirm("Bạn chắc chắn muốn xóa gia sư này?")) {
          this.removeTutor(email);
        }
      });
    });
  }

  toggleTutorStatus(email) {
    const registrations = this.readJson("edubridge_tutor_registrations");
    registrations.forEach((item) => {
      if (item.email?.toLowerCase() === email.toLowerCase()) {
        item.activeState = item.activeState === "busy" ? "available" : "busy";
      }
    });
    this.writeJson("edubridge_tutor_registrations", registrations);
    this.renderTutors();
  }

  removeTutor(email) {
    const registrations = this.readJson("edubridge_tutor_registrations");
    const filtered = registrations.filter((item) => item.email?.toLowerCase() !== email.toLowerCase());
    this.writeJson("edubridge_tutor_registrations", filtered);
    this.renderTutors();
    alert("Đã xóa gia sư!");
  }

  // === STUDENT MANAGEMENT ===
  async renderStudents() {
    const students = await this.readJson("edubridge_students") || [];
    const keywordFilter = (this.studentSearchKeyword?.value || "").toLowerCase();

    let filtered = students.filter((item) => {
      if (
        keywordFilter &&
        !item.name?.toLowerCase().includes(keywordFilter) &&
        !item.email?.toLowerCase().includes(keywordFilter)
      ) {
        return false;
      }
      return true;
    });

    this.studentManageList.innerHTML = filtered.map((item) => this.studentCard(item)).join("");
    this.studentManageEmpty.hidden = filtered.length !== 0;
  }

  studentCard(item) {
    const joinedAt = item.joinedAt ? new Date(item.joinedAt).toLocaleDateString("vi-VN") : "Chưa cập nhật";
    return `
      <article class="tutor-card">
        <h3>${item.name || "Học viên"}</h3>
        <p class="tutor-meta">${item.email}</p>
        <p class="tutor-duration"><strong>Tham gia:</strong> ${joinedAt}</p>
        <p class="tutor-duration"><strong>Trạng thái:</strong> ${item.status || "active"}</p>
      </article>
    `;
  }

  // === REQUEST MANAGEMENT ===
  async renderRequests() {
    const requests = await this.readJson("edubridge_requests") || [];
    const statusFilter = this.requestSearchStatus?.value || "";
    const keywordFilter = (this.requestSearchKeyword?.value || "").toLowerCase();

    let filtered = requests.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (
        keywordFilter &&
        !item.tutorName?.toLowerCase().includes(keywordFilter) &&
        !item.studentName?.toLowerCase().includes(keywordFilter) &&
        !item.tutorEmail?.toLowerCase().includes(keywordFilter) &&
        !item.studentEmail?.toLowerCase().includes(keywordFilter)
      ) {
        return false;
      }
      return true;
    });

    this.requestManageList.innerHTML = filtered.map((item) => this.requestCard(item)).join("");
    this.requestManageEmpty.hidden = filtered.length !== 0;
    this.attachRequestListeners();
  }

  requestCard(item) {
    const statusLabel = this.getRequestStatusLabel(item.status);
    const pricePerSession = (item.pricePerSession || 0).toLocaleString("vi-VN");
    const buttons = item.status === "waiting_tutor"
      ? `<button type="button" class="btn btn-primary request-approve-btn" data-id="${item.id}">Duyệt</button>
         <button type="button" class="btn btn-secondary request-reject-btn" data-id="${item.id}">Từ chối</button>`
      : `<button type="button" class="btn btn-secondary request-delete-btn" data-id="${item.id}">Xóa</button>`;

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>Yêu cầu từ ${item.studentName || "Học viên"}</h3>
          <span class="tutor-status tutor-status-available">${statusLabel}</span>
        </div>
        <p class="tutor-meta"><strong>Gia sư:</strong> ${item.tutorName || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Học viên:</strong> ${item.studentEmail}</p>
        <p class="tutor-duration"><strong>Môn:</strong> ${item.subject}</p>
        <p class="tutor-duration"><strong>Giá/buổi:</strong> ${pricePerSession} VND • ${item.sessionHours} giờ</p>
        <p class="tutor-duration"><strong>Ghi chú:</strong> ${item.note || "(không có)"}</p>
        <p class="tutor-duration"><small>Gửi lúc: ${new Date(item.createdAt).toLocaleString("vi-VN")}</small></p>
        <div class="request-modal-actions">${buttons}</div>
      </article>
    `;
  }

  getRequestStatusLabel(status) {
    if (status === "approved") return "Đã duyệt";
    if (status === "rejected") return "Từ chối";
    return "Chờ trả lời";
  }

  attachRequestListeners() {
    const approveButtons = document.querySelectorAll(".request-approve-btn");
    const rejectButtons = document.querySelectorAll(".request-reject-btn");
    const deleteButtons = document.querySelectorAll(".request-delete-btn");

    approveButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        await this.approveRequest(id);
      });
    });

    rejectButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        await this.rejectRequest(id);
      });
    });

    deleteButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        if (confirm("Bạn chắc chắn muốn xóa yêu cầu này?")) {
          await this.deleteRequest(id);
        }
      });
    });
  }

  async approveRequest(requestId) {
    const requests = await this.readJson("edubridge_requests") || [];
    const request = requests.find((item) => item.id === requestId);
    
    if (request) {
      // Add tutor to tutor registrations with approved status
      const registrations = await this.readJson("edubridge_tutor_registrations") || [];
      
      // Check if tutor already exists
      const existingTutor = registrations.find((r) => r.email?.toLowerCase() === request.tutorEmail?.toLowerCase());
      if (!existingTutor) {
        registrations.push({
          id: Date.now(),
          email: request.tutorEmail,
          name: request.tutorName,
          subject: request.subject,
          level: "Chưa cập nhật",
          experience: "Gia sư được kết nối qua yêu cầu học viên",
          location: "Chưa cập nhật",
          availableTime: "Chưa cập nhật",
          price: request.pricePerSession || 250000,
          sessionHours: request.sessionHours || 2,
          gender: "female",
          rating: 4,
          activeState: "available",
          status: "approved",
          rejectReason: "",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        await this.writeJson("edubridge_tutor_registrations", registrations);
      }
      
      // Add tutor to student's profile
      const students = await this.readJson("edubridge_students") || [];
      const student = students.find((s) => s.email?.toLowerCase() === request.studentEmail?.toLowerCase());
      if (student) {
        student.assignedTutors = student.assignedTutors || [];
        if (!student.assignedTutors.find((t) => t.email?.toLowerCase() === request.tutorEmail?.toLowerCase())) {
          student.assignedTutors.push({
            name: request.tutorName,
            email: request.tutorEmail,
            subject: request.subject,
            connectedAt: new Date().toISOString()
          });
        }
        await this.writeJson("edubridge_students", students);
      }
      
      // DELETE the request
      const filtered = requests.filter((item) => item.id !== requestId);
      await this.writeJson("edubridge_requests", filtered);
      
      await this.renderRequests();
      await this.renderTutors();
      alert("Đã duyệt yêu cầu! Gia sư được thêm vào danh sách quản lý.");
    }
  }

  async rejectRequest(requestId) {
    const requests = await this.readJson("edubridge_requests") || [];
    // DELETE the request immediately when rejected
    const filtered = requests.filter((item) => item.id !== requestId);
    await this.writeJson("edubridge_requests", filtered);
    await this.renderRequests();
    alert("Đã từ chối yêu cầu!");
  }

  async deleteRequest(requestId) {
    const requests = await this.readJson("edubridge_requests") || [];
    const filtered = requests.filter((item) => item.id !== requestId);
    await this.writeJson("edubridge_requests", filtered);
    await this.renderRequests();
    alert("Đã xóa yêu cầu!");
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new AdminManager();
});
