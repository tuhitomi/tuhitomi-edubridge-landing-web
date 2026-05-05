import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const DEFAULT_ADMIN_EMAIL = "tu620014@gmail.com";
const READ_NOTIFICATION_STORAGE_KEY = "edubridge_read_notifications";

class AdminManager {
  constructor() {
    this.currentTab = "tutor-approvals";
    this.currentUser = null;
    this.currentUserEmail = "";
    this.primaryAdminEmail = DEFAULT_ADMIN_EMAIL;
    this.isAdmin = false;
    this.canManageModerators = false;
    this.notifications = [];
    this.unsubscribes = [];

    this.initElements();
    this.setupTabs();
    this.setupFilters();
    this.setupModal();
    this.setupNotifications();
    this.setupModeratorForm();
    this.setupAuth();
  }

  initElements() {
    this.tabButtons = document.querySelectorAll(".admin-tab-btn");
    this.tabContents = document.querySelectorAll(".admin-tab-content");

    this.notificationBtn = document.getElementById("notification-btn");
    this.notificationCount = document.getElementById("notification-count");
    this.notificationDropdown = document.getElementById("notification-dropdown");
    this.notificationList = document.getElementById("notification-list");
    this.markAllReadBtn = document.getElementById("mark-all-read");
    this.clearReadStorageBtn = document.getElementById("clear-read-storage");
    this.viewAllNotificationsLink = document.getElementById("view-all-notifications");

    this.totalTutorsEl = document.getElementById("total-tutors");
    this.pendingApprovalsEl = document.getElementById("pending-approvals");
    this.successfulConnectionsEl = document.getElementById("successful-connections");
    this.totalStudentsEl = document.getElementById("total-students");

    this.tutorDetailModal = document.getElementById("tutor-detail-modal");
    this.modalTutorName = document.getElementById("modal-tutor-name");
    this.modalTutorDetails = document.getElementById("modal-tutor-details");
    this.modalApproveBtn = document.getElementById("modal-approve-btn");
    this.modalRejectBtn = document.getElementById("modal-reject-btn");
    this.modalCloseBtn = document.getElementById("modal-close-btn");
    this.closeModalBtn = document.getElementById("close-modal");

    this.filterStatus = document.getElementById("filter-status");
    this.filterKeyword = document.getElementById("filter-keyword");
    this.adminTutorList = document.getElementById("admin-tutor-list");
    this.adminEmpty = document.getElementById("admin-empty");

    this.moderatorForm = document.getElementById("moderator-form");
    this.moderatorEmailInput = document.getElementById("moderator-email-input");
    this.moderatorList = document.getElementById("moderator-list");

    this.tutorSearchKeyword = document.getElementById("tutor-search-keyword");
    this.tutorSearchStatus = document.getElementById("tutor-search-status");
    this.tutorManageList = document.getElementById("tutor-manage-list");
    this.tutorManageEmpty = document.getElementById("tutor-manage-empty");

    this.studentSearchKeyword = document.getElementById("student-search-keyword");
    this.studentManageList = document.getElementById("student-manage-list");
    this.studentManageEmpty = document.getElementById("student-manage-empty");

    this.requestSearchStatus = document.getElementById("request-search-status");
    this.requestSearchKeyword = document.getElementById("request-search-keyword");
    this.requestManageList = document.getElementById("request-manage-list");
    this.requestManageEmpty = document.getElementById("request-manage-empty");

    this.withdrawalList = document.getElementById("withdrawal-list");
    this.withdrawalEmpty = document.getElementById("withdrawal-empty");
    this.disputeList = document.getElementById("dispute-list");
    this.disputeEmpty = document.getElementById("dispute-empty");
  }

  setupAuth() {
    onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        window.location.href = "dang-nhap.html?next=" + encodeURIComponent("admin.html");
        return;
      }

      try {
        this.currentUser = user;
        this.currentUserEmail = String(user.email || "").trim().toLowerCase();
        this.primaryAdminEmail = await this.getAdminEmail();
        const moderatorEmails = await this.getModeratorEmails();

        this.isAdmin = this.currentUserEmail === this.primaryAdminEmail || moderatorEmails.includes(this.currentUserEmail);
        this.canManageModerators = this.currentUserEmail === this.primaryAdminEmail;

        if (!this.isAdmin) {
          alert("Bạn không có quyền truy cập trang quản trị.");
          window.location.href = "index.html";
          return;
        }

        this.applyLogoutLink();
        this.toggleModeratorForm();
        this.startRealtimeNotifications();

        await this.loadDashboardStats();
        await this.switchTab(this.currentTab);
      } catch (error) {
        console.error("Error checking admin permissions:", error);
        alert("Không thể kiểm tra quyền quản trị.");
        window.location.href = "index.html";
      }
    });

    window.addEventListener("beforeunload", () => this.cleanupListeners());
  }

  applyLogoutLink() {
    const logoutLink = document.getElementById("nav-auth-link");
    if (!logoutLink) return;

    logoutLink.textContent = "Đăng xuất";
    logoutLink.href = "#";
    logoutLink.onclick = async (event) => {
      event.preventDefault();
      await signOut(auth);
      localStorage.removeItem(READ_NOTIFICATION_STORAGE_KEY);
      window.location.href = "index.html";
    };
  }

  setupTabs() {
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const tabName = button.getAttribute("data-tab");
        if (!tabName) return;
        await this.switchTab(tabName);
      });
    });
  }

  async switchTab(tabName) {
    this.currentTab = tabName;

    this.tabButtons.forEach((button) => {
      button.classList.toggle("admin-tab-btn-active", button.getAttribute("data-tab") === tabName);
    });

    this.tabContents.forEach((content) => {
      content.classList.toggle("admin-tab-content-active", content.id === `tab-${tabName}`);
    });

    if (tabName === "tutor-approvals") {
      await this.renderApprovals();
      await this.renderModerators();
      return;
    }
    if (tabName === "tutor-list") {
      await this.renderTutors();
      return;
    }
    if (tabName === "student-list") {
      await this.renderStudents();
      return;
    }
    if (tabName === "requests") {
      await this.renderRequests();
      return;
    }
    if (tabName === "withdrawals") {
      await this.renderWithdrawals();
      return;
    }
    if (tabName === "disputes") {
      await this.renderDisputes();
    }
  }

  setupFilters() {
    if (this.filterStatus) this.filterStatus.addEventListener("change", async () => this.renderApprovals());
    if (this.filterKeyword) this.filterKeyword.addEventListener("input", async () => this.renderApprovals());
    if (this.tutorSearchKeyword) this.tutorSearchKeyword.addEventListener("input", async () => this.renderTutors());
    if (this.tutorSearchStatus) this.tutorSearchStatus.addEventListener("change", async () => this.renderTutors());
    if (this.studentSearchKeyword) this.studentSearchKeyword.addEventListener("input", async () => this.renderStudents());
    if (this.requestSearchStatus) this.requestSearchStatus.addEventListener("change", async () => this.renderRequests());
    if (this.requestSearchKeyword) this.requestSearchKeyword.addEventListener("input", async () => this.renderRequests());
  }

  setupModal() {
    if (this.closeModalBtn) this.closeModalBtn.addEventListener("click", () => this.closeTutorDetailModal());
    if (this.modalCloseBtn) this.modalCloseBtn.addEventListener("click", () => this.closeTutorDetailModal());

    if (this.modalApproveBtn) {
      this.modalApproveBtn.addEventListener("click", async () => {
        const email = this.modalApproveBtn.getAttribute("data-email");
        if (!email) return;
        await this.approveTutorRegistration(email);
        this.closeTutorDetailModal();
      });
    }

    if (this.modalRejectBtn) {
      this.modalRejectBtn.addEventListener("click", async () => {
        const email = this.modalRejectBtn.getAttribute("data-email");
        if (!email) return;
        const reason = prompt("Nhap ly do tu choi:", "") || "";
        await this.rejectTutorRegistration(email, reason.trim());
        this.closeTutorDetailModal();
      });
    }

    if (this.tutorDetailModal) {
      this.tutorDetailModal.addEventListener("click", (event) => {
        if (event.target === this.tutorDetailModal) {
          this.closeTutorDetailModal();
        }
      });
    }
  }

  setupNotifications() {
    if (this.notificationBtn) {
      this.notificationBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleNotificationDropdown();
      });
    }

    if (this.markAllReadBtn) {
      this.markAllReadBtn.addEventListener("click", () => this.markAllNotificationsAsRead());
    }

    if (this.clearReadStorageBtn) {
      this.clearReadStorageBtn.addEventListener("click", () => this.clearReadNotificationsStorage());
    }

    if (this.viewAllNotificationsLink) {
      this.viewAllNotificationsLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = "thong-bao.html";
      });
    }

    document.addEventListener("click", (event) => {
      if (!this.notificationDropdown || !this.notificationBtn) return;
      const clickedInsideButton = this.notificationBtn.contains(event.target);
      const clickedInsideDropdown = this.notificationDropdown.contains(event.target);
      if (!clickedInsideButton && !clickedInsideDropdown) {
        this.notificationDropdown.style.display = "none";
      }
    });
  }

  setupModeratorForm() {
    if (!this.moderatorForm) return;

    this.moderatorForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!this.canManageModerators) return;

      const email = String(this.moderatorEmailInput?.value || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        alert("Nhập email moderator hợp lệ.");
        return;
      }
      if (email === this.primaryAdminEmail) {
        alert("Không thể thêm email admin chính vào danh sách moderator.");
        return;
      }

      const moderators = await this.getModeratorEmails();
      if (!moderators.includes(email)) {
        moderators.unshift(email);
        await this.saveModeratorEmails(moderators);
      }

      this.moderatorEmailInput.value = "";
      await this.renderModerators();
      alert("Đã thêm moderator mới.");
    });
  }

  toggleModeratorForm() {
    if (!this.moderatorForm) return;
    this.moderatorForm.hidden = !this.canManageModerators;
  }

  cleanupListeners() {
    this.unsubscribes.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("Cannot unsubscribe cleanly:", error);
      }
    });
    this.unsubscribes = [];
  }

  async getAdminEmail() {
    try {
      const adminDoc = await getDoc(doc(db, "settings", "edubridge_admin_email"));
      if (!adminDoc.exists()) return DEFAULT_ADMIN_EMAIL;
      return String(adminDoc.data().value || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    } catch (error) {
      console.error("Error getting admin email:", error);
      return DEFAULT_ADMIN_EMAIL;
    }
  }

  async getModeratorEmails() {
    try {
      const modDoc = await getDoc(doc(db, "settings", "edubridge_moderator_emails"));
      const value = modDoc.exists() ? modDoc.data().value : [];
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((item, index, list) => item && list.indexOf(item) === index);
    } catch (error) {
      console.error("Error getting moderator emails:", error);
      return [];
    }
  }

  async saveModeratorEmails(emails) {
    await setDoc(doc(db, "settings", "edubridge_moderator_emails"), { value: emails });
  }

  async readCollection(name) {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }

  async readJson(key) {
    try {
      if (key === "edubridge_wallets") {
        const walletsDoc = await getDoc(doc(db, "settings", "wallets"));
        if (!walletsDoc.exists()) {
          return { adminRevenue: 0, tutorBalances: {} };
        }
        const data = walletsDoc.data();
        if (data && typeof data.value === "object" && data.value) {
          return {
            adminRevenue: Number(data.value.adminRevenue || 0),
            tutorBalances: data.value.tutorBalances || {}
          };
        }
        return {
          adminRevenue: Number(data.adminRevenue || 0),
          tutorBalances: data.tutorBalances || {}
        };
      }

      const collectionName = key.replace("edubridge_", "");
      return await this.readCollection(collectionName);
    } catch (error) {
      console.error("Error reading", key, error);
      return key === "edubridge_wallets" ? { adminRevenue: 0, tutorBalances: {} } : [];
    }
  }

  async writeJson(key, value) {
    if (key === "edubridge_wallets") {
      await setDoc(doc(db, "settings", "wallets"), {
        adminRevenue: Number(value.adminRevenue || 0),
        tutorBalances: value.tutorBalances || {}
      });
      return;
    }

    const collectionName = key.replace("edubridge_", "");
    const batch = writeBatch(db);
    const snapshot = await getDocs(collection(db, collectionName));
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    value.forEach((item) => {
      const id = String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      batch.set(doc(db, collectionName, id), { ...item, id });
    });
    await batch.commit();
  }

  startRealtimeNotifications() {
    this.cleanupListeners();

    const pendingTutorsQuery = query(collection(db, "tutor_registrations"), limit(100));
    const unsubscribe = onSnapshot(
      pendingTutorsQuery,
      (snapshot) => {
        const readIds = this.getReadNotificationsFromStorage();
        const items = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => String(item.status || "pending").toLowerCase() === "pending")
          .sort((a, b) => this.getComparableDate(b.submittedAt || b.updatedAt) - this.getComparableDate(a.submittedAt || a.updatedAt))
          .map((item) => ({
            id: item.id,
            title: "Hồ sơ gia sư mới",
            message: `${item.name || item.email || "Gia sư"} đang chờ duyệt`,
            createdAt: item.submittedAt || item.updatedAt || new Date().toISOString(),
            tutorData: item,
            isRead: readIds.includes(item.id)
          }));

        this.notifications = items;
        this.updateNotificationUI();
        this.loadDashboardStats().catch((error) => console.error("Error refreshing dashboard stats:", error));
      },
      (error) => console.error("Error in tutor registration notifications:", error)
    );

    this.unsubscribes.push(unsubscribe);
  }

  toggleNotificationDropdown() {
    if (!this.notificationDropdown) return;
    this.notificationDropdown.style.display = this.notificationDropdown.style.display === "block" ? "none" : "block";
  }

  updateNotificationUI() {
    const unreadCount = this.notifications.filter((item) => !item.isRead).length;
    if (this.notificationCount) {
      this.notificationCount.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      this.notificationCount.style.display = unreadCount > 0 ? "inline" : "none";
    }

    if (!this.notificationList) return;
    const recent = this.notifications.slice(0, 10);
    this.notificationList.innerHTML = recent.length
      ? recent.map((item) => this.renderNotification(item)).join("")
      : '<div class="notification-item"><div class="notification-content"><div class="notification-title">Không có thông báo mới</div></div></div>';

    this.notificationList.querySelectorAll(".notification-item").forEach((element, index) => {
      element.addEventListener("click", () => {
        const item = recent[index];
        if (!item) return;
        this.markNotificationAsRead(item.id);
        this.showTutorDetailModal(item.tutorData);
        if (this.notificationDropdown) this.notificationDropdown.style.display = "none";
      });
    });
  }

  renderNotification(notification) {
    const unreadClass = notification.isRead ? "" : " notification-unread";
    return `
      <div class="notification-item${unreadClass}" data-id="${notification.id}">
        <div class="notification-icon">GS</div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${this.getTimeAgo(notification.createdAt)}</div>
        </div>
      </div>
    `;
  }

  getReadNotificationsFromStorage() {
    try {
      const value = localStorage.getItem(READ_NOTIFICATION_STORAGE_KEY);
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error("Error reading notification read state:", error);
      return [];
    }
  }

  saveReadNotificationToStorage(notificationId) {
    const ids = this.getReadNotificationsFromStorage();
    if (ids.includes(notificationId)) return;
    ids.push(notificationId);
    localStorage.setItem(READ_NOTIFICATION_STORAGE_KEY, JSON.stringify(ids));
  }

  markNotificationAsRead(notificationId) {
    const item = this.notifications.find((notification) => notification.id === notificationId);
    if (!item) return;
    item.isRead = true;
    this.saveReadNotificationToStorage(notificationId);
    this.updateNotificationUI();
  }

  markAllNotificationsAsRead() {
    this.notifications.forEach((item) => {
      item.isRead = true;
      this.saveReadNotificationToStorage(item.id);
    });
    this.updateNotificationUI();
  }

  clearReadNotificationsStorage() {
    localStorage.removeItem(READ_NOTIFICATION_STORAGE_KEY);
    this.notifications.forEach((item) => {
      item.isRead = false;
    });
    this.updateNotificationUI();
  }

  getTimeAgo(value) {
    const date = this.toDate(value);
    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 60) return "Vừa xong";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`;
    return `${Math.floor(diffSeconds / 86400)} ngày trước`;
  }

  toDate(value) {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    return new Date(value);
  }

  getComparableDate(value) {
    return this.toDate(value).getTime();
  }

  formatDateTime(value) {
    const date = this.toDate(value);
    return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : date.toLocaleString("vi-VN");
  }

  async loadDashboardStats() {
    const [tutors, students, requests] = await Promise.all([
      this.readJson("edubridge_tutor_registrations"),
      this.readJson("edubridge_students"),
      this.readJson("edubridge_requests")
    ]);

    const totalTutors = tutors.filter((item) => item.status === "approved").length;
    const pendingApprovals = tutors.filter((item) => (item.status || "pending") === "pending").length;
    const activeConnections = requests.filter((item) => ["accepted_waiting_funds", "in_teaching", "completed"].includes(item.status)).length;

    if (this.totalTutorsEl) this.totalTutorsEl.textContent = String(totalTutors);
    if (this.pendingApprovalsEl) this.pendingApprovalsEl.textContent = String(pendingApprovals);
    if (this.successfulConnectionsEl) this.successfulConnectionsEl.textContent = String(activeConnections);
    if (this.totalStudentsEl) this.totalStudentsEl.textContent = String(students.length);
  }

  showTutorDetailModal(tutorData) {
    if (!this.tutorDetailModal || !tutorData) return;

    this.modalTutorName.textContent = `Chi tiết: ${tutorData.name || tutorData.email || "Gia sư"}`;
    this.modalTutorDetails.innerHTML = this.renderTutorDetails(tutorData);
    this.modalApproveBtn?.setAttribute("data-email", tutorData.email || "");
    this.modalRejectBtn?.setAttribute("data-email", tutorData.email || "");
    this.tutorDetailModal.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  closeTutorDetailModal() {
    if (!this.tutorDetailModal) return;
    this.tutorDetailModal.style.display = "none";
    document.body.style.overflow = "";
  }

  renderTutorDetails(tutorData) {
    const priceText = tutorData.price ? `${Number(tutorData.price).toLocaleString("vi-VN")} VND/buổi` : "Chưa cập nhật";
    return `
      <div class="tutor-detail-grid">
        <div class="detail-section">
          <h3>Thông tin cá nhân</h3>
          <p><strong>Họ tên:</strong> ${tutorData.name || "Chưa cập nhật"}</p>
          <p><strong>Email:</strong> ${tutorData.email || "Chưa cập nhật"}</p>
          <p><strong>Số điện thoại:</strong> ${tutorData.phone || "Chưa cập nhật"}</p>
          <p><strong>Khu vực:</strong> ${tutorData.location || "Chưa cập nhật"}</p>
        </div>
        <div class="detail-section">
          <h3>Thông tin giảng dạy</h3>
          <p><strong>Môn học:</strong> ${tutorData.subject || "Chưa cập nhật"}</p>
          <p><strong>Trình độ:</strong> ${tutorData.level || "Chưa cập nhật"}</p>
          <p><strong>Kinh nghiệm:</strong> ${tutorData.experience || "Chưa cập nhật"}</p>
          <p><strong>Học phí:</strong> ${priceText}</p>
          <p><strong>Thời gian rảnh:</strong> ${tutorData.availableTime || tutorData.schedule || "Chưa cập nhật"}</p>
        </div>
        <div class="detail-section">
          <h3>Trạng thái</h3>
          <p><strong>Duyệt:</strong> ${this.getTutorStatusLabel(tutorData.status)}</p>
          <p><strong>Hoạt động:</strong> ${tutorData.activeState === "busy" ? "Bận" : "Sẵn sàng"}</p>
          <p><strong>Gửi lúc:</strong> ${this.formatDateTime(tutorData.submittedAt || tutorData.createdAt)}</p>
          ${tutorData.rejectReason ? `<p><strong>Lý do từ chối:</strong> ${tutorData.rejectReason}</p>` : ""}
        </div>
      </div>
    `;
  }

  getTutorStatusLabel(status) {
    if (status === "approved") return "Đã duyệt";
    if (status === "rejected") return "Từ chối";
    return "Chờ duyệt";
  }

  async findTutorDocumentByEmail(email) {
    const q = query(collection(db, "tutor_registrations"), where("email", "==", String(email || "").trim().toLowerCase()), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0];
  }

  async pushNotification(userEmail, text, type, payload = {}) {
    await addDoc(collection(db, "notifications"), {
      userEmail: String(userEmail || "").trim().toLowerCase(),
      text,
      type,
      payload,
      read: false,
      createdAt: new Date().toISOString()
    });
    window.dispatchEvent(new Event("edubridge-notifications-updated"));
  }

  async logActivity(action, details) {
    if (!this.currentUser) return;
    await addDoc(collection(db, "admin_activities"), {
      action,
      adminId: this.currentUser.uid,
      adminEmail: this.currentUser.email,
      details,
      timestamp: serverTimestamp()
    });
  }

  async renderApprovals() {
    const registrations = await this.readJson("edubridge_tutor_registrations");
    const statusFilter = (this.filterStatus?.value || "").trim().toLowerCase();
    const keywordFilter = (this.filterKeyword?.value || "").trim().toLowerCase();

    const filtered = registrations
      .filter((item) => {
        const itemStatus = String(item.status || "pending").toLowerCase();
        if (statusFilter && itemStatus !== statusFilter) return false;
        if (
          keywordFilter &&
          !String(item.name || "").toLowerCase().includes(keywordFilter) &&
          !String(item.email || "").toLowerCase().includes(keywordFilter) &&
          !String(item.subject || "").toLowerCase().includes(keywordFilter)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => this.getComparableDate(b.submittedAt || b.updatedAt) - this.getComparableDate(a.submittedAt || a.updatedAt));

    this.adminTutorList.innerHTML = filtered.map((item) => this.tutorApprovalCard(item)).join("");
    this.adminEmpty.hidden = filtered.length !== 0;
    this.attachTutorApprovalListeners();
  }

  tutorApprovalCard(item) {
    const status = String(item.status || "pending").toLowerCase();
    const price = Number(item.price || 0).toLocaleString("vi-VN");
    const statusClass = status === "approved" ? "tutor-status-available" : status === "rejected" ? "tutor-status-busy" : "tutor-status-pending";
    const actionButtons = status === "pending"
      ? `
          <button type="button" class="btn btn-primary admin-approve-btn" data-email="${item.email}">Duyệt</button>
          <button type="button" class="btn btn-secondary admin-reject-btn" data-email="${item.email}">Từ chối</button>
        `
      : "";

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>${item.name || "Gia sư"}</h3>
          <span class="tutor-status ${statusClass}">${this.getTutorStatusLabel(status)}</span>
        </div>
        <p class="tutor-meta">${item.subject || "Chưa cập nhật"} | ${item.level || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Email:</strong> ${item.email || ""}</p>
        <p class="tutor-duration"><strong>Khu vực:</strong> ${item.location || "Chưa cập nhật"}</p>
        <p class="tutor-duration"><strong>Giá:</strong> ${price} VND/buổi</p>
        ${item.rejectReason ? `<p class="tutor-duration"><strong>Lý do từ chối:</strong> ${item.rejectReason}</p>` : ""}
        <div class="request-modal-actions">
          ${actionButtons}
          <button type="button" class="btn btn-secondary admin-view-btn" data-email="${item.email}">Xem chi tiết</button>
        </div>
      </article>
    `;
  }

  attachTutorApprovalListeners() {
    document.querySelectorAll(".admin-approve-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.approveTutorRegistration(button.getAttribute("data-email"));
      });
    });

    document.querySelectorAll(".admin-reject-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const email = button.getAttribute("data-email");
        const reason = prompt("Nhập lý do từ chối:", "") || "";
        await this.rejectTutorRegistration(email, reason.trim());
      });
    });

    document.querySelectorAll(".admin-view-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.viewTutorDetails(button.getAttribute("data-email"));
      });
    });
  }

  async approveTutorRegistration(email) {
    if (!email) return;
    const tutorDoc = await this.findTutorDocumentByEmail(email);
    if (!tutorDoc) {
      alert("Không tìm thấy hồ sơ gia sư.");
      return;
    }

    const tutor = tutorDoc.data();
    await updateDoc(tutorDoc.ref, {
      status: "approved",
      rejectReason: "",
      updatedAt: new Date().toISOString()
    });

    await this.pushNotification(
      email,
      "Hồ sơ gia sư của bạn đã được duyệt và hiển thị trên hệ thống.",
      "tutor-approval-status",
      { status: "approved" }
    );
    await this.logActivity("approve_tutor", { tutorEmail: email, tutorName: tutor.name || "" });

    this.markNotificationAsRead(tutorDoc.id);
    await this.loadDashboardStats();
    await this.renderApprovals();
    if (this.currentTab === "tutor-list") await this.renderTutors();
    alert("Đã duyệt hồ sơ gia sư.");
  }

  async rejectTutorRegistration(email, reason) {
    if (!email) return;
    const tutorDoc = await this.findTutorDocumentByEmail(email);
    if (!tutorDoc) {
      alert("Không tìm thấy hồ sơ gia sư.");
      return;
    }

    const tutor = tutorDoc.data();
    await updateDoc(tutorDoc.ref, {
      status: "rejected",
      rejectReason: String(reason || "").trim(),
      updatedAt: new Date().toISOString()
    });

    await this.pushNotification(
      email,
      "Hồ sơ gia sư của bạn chưa được duyệt. Vui lòng cập nhật lại thông tin và gửi lại.",
      "tutor-approval-status",
      { status: "rejected", reason: String(reason || "").trim() }
    );
    await this.logActivity("reject_tutor", {
      tutorEmail: email,
      tutorName: tutor.name || "",
      reason: String(reason || "").trim()
    });

    this.markNotificationAsRead(tutorDoc.id);
    await this.loadDashboardStats();
    await this.renderApprovals();
    alert("Đã từ chối hồ sơ gia sư.");
  }

  async viewTutorDetails(email) {
    if (!email) return;
    const registrations = await this.readJson("edubridge_tutor_registrations");
    const tutor = registrations.find((item) => String(item.email || "").toLowerCase() === String(email).toLowerCase());
    if (!tutor) {
      alert("Không tìm thấy thông tin gia sư.");
      return;
    }
    this.showTutorDetailModal(tutor);
  }

  async renderModerators() {
    if (!this.moderatorList) return;
    if (!this.canManageModerators) {
      this.moderatorList.innerHTML = "";
      return;
    }

    const moderators = await this.getModeratorEmails();
    this.moderatorList.innerHTML = moderators.length
      ? moderators.map((email) => `
          <li class="history-item">
            <strong>${email}</strong>
            <div class="request-modal-actions">
              <button type="button" class="btn btn-secondary remove-moderator-btn" data-email="${email}">Xoa quyen</button>
            </div>
          </li>
        `).join("")
      : '<li class="history-item">Chưa có moderator nào.</li>';

    this.moderatorList.querySelectorAll(".remove-moderator-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const email = String(button.getAttribute("data-email") || "").toLowerCase();
        const next = (await this.getModeratorEmails()).filter((item) => item !== email);
        await this.saveModeratorEmails(next);
        await this.renderModerators();
      });
    });
  }

  async renderTutors() {
    const registrations = await this.readJson("edubridge_tutor_registrations");
    const tutors = registrations.filter((item) => item.status === "approved");
    const keywordFilter = String(this.tutorSearchKeyword?.value || "").trim().toLowerCase();
    const statusFilter = String(this.tutorSearchStatus?.value || "").trim().toLowerCase();

    const filtered = tutors.filter((item) => {
      if (statusFilter && String(item.activeState || "available").toLowerCase() !== statusFilter) return false;
      if (
        keywordFilter &&
        !String(item.name || "").toLowerCase().includes(keywordFilter) &&
        !String(item.email || "").toLowerCase().includes(keywordFilter) &&
        !String(item.subject || "").toLowerCase().includes(keywordFilter)
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
    const isBusy = String(item.activeState || "available").toLowerCase() === "busy";
    const badge = isBusy
      ? '<span class="tutor-status tutor-status-busy">Bận</span>'
      : '<span class="tutor-status tutor-status-available">Sẵn sàng</span>';

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>${item.name || "Gia sư"}</h3>
          ${badge}
        </div>
        <p class="tutor-meta">${item.subject || "Chưa cập nhật"} | ${item.level || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Email:</strong> ${item.email || ""}</p>
        <p class="tutor-duration"><strong>Khu vực:</strong> ${item.location || "Chưa cập nhật"}</p>
        <p class="tutor-duration"><strong>Giá:</strong> ${Number(item.price || 0).toLocaleString("vi-VN")} VND/buổi</p>
        <div class="request-modal-actions">
          <button type="button" class="btn btn-secondary tutor-toggle-status-btn" data-email="${item.email}">
            ${isBusy ? "Mở lại" : "Đánh dấu bận"}
          </button>
          <button type="button" class="btn btn-secondary tutor-remove-btn" data-email="${item.email}">Xóa</button>
        </div>
      </article>
    `;
  }

  attachTutorManageListeners() {
    document.querySelectorAll(".tutor-toggle-status-btn").forEach((button) => {
      button.addEventListener("click", async () => this.toggleTutorStatus(button.getAttribute("data-email")));
    });

    document.querySelectorAll(".tutor-remove-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const email = button.getAttribute("data-email");
        if (!email) return;
        if (!confirm("Bạn chắc chắn muốn xóa gia sư này?")) return;
        await this.removeTutor(email);
      });
    });
  }

  async toggleTutorStatus(email) {
    const tutorDoc = await this.findTutorDocumentByEmail(email);
    if (!tutorDoc) return;
    const current = String(tutorDoc.data().activeState || "available").toLowerCase();
    await updateDoc(tutorDoc.ref, {
      activeState: current === "busy" ? "available" : "busy",
      updatedAt: new Date().toISOString()
    });
    await this.renderTutors();
  }

  async removeTutor(email) {
    const tutorDoc = await this.findTutorDocumentByEmail(email);
    if (!tutorDoc) {
      alert("Không tìm thấy gia sư.");
      return;
    }

    await deleteDoc(tutorDoc.ref);
    await this.logActivity("remove_tutor", { tutorEmail: email });
    await this.loadDashboardStats();
    await this.renderTutors();
    await this.renderApprovals();
    alert("Đã xóa gia sư.");
  }

  async renderStudents() {
    const students = await this.readJson("edubridge_students");
    const keywordFilter = String(this.studentSearchKeyword?.value || "").trim().toLowerCase();

    const filtered = students.filter((item) => {
      if (!keywordFilter) return true;
      return (
        String(item.name || "").toLowerCase().includes(keywordFilter) ||
        String(item.email || "").toLowerCase().includes(keywordFilter)
      );
    });

    this.studentManageList.innerHTML = filtered.map((item) => this.studentCard(item)).join("");
    this.studentManageEmpty.hidden = filtered.length !== 0;
  }

  studentCard(item) {
    const assignedCount = Array.isArray(item.assignedTutors) ? item.assignedTutors.length : 0;
    return `
      <article class="tutor-card">
        <h3>${item.name || "Học viên"}</h3>
        <p class="tutor-meta">${item.email || ""}</p>
        <p class="tutor-duration"><strong>Tham gia:</strong> ${this.formatDateTime(item.joinedAt)}</p>
        <p class="tutor-duration"><strong>Trạng thái:</strong> ${item.status || "active"}</p>
        <p class="tutor-duration"><strong>Gia sư đã kết nối:</strong> ${assignedCount}</p>
      </article>
    `;
  }

  async renderRequests() {
    const requests = await this.readJson("edubridge_requests");
    const statusFilter = String(this.requestSearchStatus?.value || "").trim();
    const keywordFilter = String(this.requestSearchKeyword?.value || "").trim().toLowerCase();

    const filtered = requests.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (
        keywordFilter &&
        !String(item.tutorName || "").toLowerCase().includes(keywordFilter) &&
        !String(item.studentName || "").toLowerCase().includes(keywordFilter) &&
        !String(item.tutorEmail || "").toLowerCase().includes(keywordFilter) &&
        !String(item.studentEmail || "").toLowerCase().includes(keywordFilter)
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => this.getComparableDate(b.createdAt) - this.getComparableDate(a.createdAt));

    this.requestManageList.innerHTML = filtered.map((item) => this.requestCard(item)).join("");
    this.requestManageEmpty.hidden = filtered.length !== 0;
    this.attachRequestListeners();
  }

  requestCard(item) {
    const statusLabel = this.getRequestStatusLabel(item.status);
    const buttons = item.status === "waiting_tutor"
      ? `
          <button type="button" class="btn btn-primary request-approve-btn" data-id="${item.id}">Duyệt thủ công</button>
          <button type="button" class="btn btn-secondary request-reject-btn" data-id="${item.id}">Từ chối</button>
          <button type="button" class="btn btn-secondary request-delete-btn" data-id="${item.id}">Xóa</button>
        `
      : '<button type="button" class="btn btn-secondary request-delete-btn" data-id="' + item.id + '">Xóa</button>';

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>Yêu cầu từ ${item.studentName || "Học viên"}</h3>
          <span class="tutor-status tutor-status-available">${statusLabel}</span>
        </div>
        <p class="tutor-meta"><strong>Gia sư:</strong> ${item.tutorName || "Chưa cập nhật"}</p>
        <p class="tutor-bio"><strong>Học viên:</strong> ${item.studentEmail || ""}</p>
        <p class="tutor-duration"><strong>Môn:</strong> ${item.subject || ""}</p>
        <p class="tutor-duration"><strong>Giá/buổi:</strong> ${Number(item.pricePerSession || 0).toLocaleString("vi-VN")} VND</p>
        <p class="tutor-duration"><strong>Ghi chú:</strong> ${item.note || "(không có)"}</p>
        <p class="tutor-duration"><small>Tạo lúc: ${this.formatDateTime(item.createdAt)}</small></p>
        <div class="request-modal-actions">${buttons}</div>
      </article>
    `;
  }

  getRequestStatusLabel(status) {
    if (status === "waiting_tutor") return "Chờ gia sư phản hồi";
    if (status === "accepted_waiting_funds") return "Chờ nộp tiền";
    if (status === "in_teaching") return "Đang học";
    if (status === "completed") return "Hoàn thành";
    if (status === "declined") return "Từ chối";
    if (status === "expired") return "Hết hạn";
    if (status === "refunded") return "Đã hoàn tiền";
    return status || "Không rõ";
  }

  attachRequestListeners() {
    document.querySelectorAll(".request-approve-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.approveRequest(button.getAttribute("data-id"));
      });
    });

    document.querySelectorAll(".request-reject-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.rejectRequest(button.getAttribute("data-id"));
      });
    });

    document.querySelectorAll(".request-delete-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-id");
        if (!confirm("Bạn chắc chắn muốn xóa yêu cầu này?")) return;
        await this.deleteRequest(id);
      });
    });
  }

  async updateRequestStatus(requestId, updater) {
    const requestRef = doc(db, "requests", String(requestId));
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) return null;
    const current = { id: requestSnap.id, ...requestSnap.data() };
    const next = updater(current);
    await setDoc(requestRef, next);
    return next;
  }

  async approveRequest(requestId) {
    const next = await this.updateRequestStatus(requestId, (request) => ({
      ...request,
      status: "accepted_waiting_funds",
      adminReviewedAt: new Date().toISOString()
    }));
    if (!next) return;

    await this.pushNotification(
      next.studentEmail,
      `Yêu cầu kết nối với gia sư ${next.tutorName || ""} đã được admin duyệt.`,
      "matching-status",
      { requestId: next.id, status: "accepted_waiting_funds" }
    );
    await this.pushNotification(
      next.tutorEmail,
      `Admin đã duyệt yêu cầu học từ ${next.studentName || ""}.`,
      "matching-status",
      { requestId: next.id, status: "accepted_waiting_funds" }
    );

    await this.loadDashboardStats();
    await this.renderRequests();
    alert("Đã duyệt yêu cầu kết nối.");
  }

  async rejectRequest(requestId) {
    const next = await this.updateRequestStatus(requestId, (request) => ({
      ...request,
      status: "declined",
      adminReviewedAt: new Date().toISOString()
    }));
    if (!next) return;

    await this.pushNotification(
      next.studentEmail,
      `Yêu cầu kết nối với gia sư ${next.tutorName || ""} đã bị từ chối.`,
      "matching-status",
      { requestId: next.id, status: "declined" }
    );
    await this.pushNotification(
      next.tutorEmail,
      `Yêu cầu học từ ${next.studentName || ""} đã bị admin từ chối.`,
      "matching-status",
      { requestId: next.id, status: "declined" }
    );

    await this.renderRequests();
    alert("Đã từ chối yêu cầu kết nối.");
  }

  async deleteRequest(requestId) {
    await deleteDoc(doc(db, "requests", String(requestId)));
    await this.loadDashboardStats();
    await this.renderRequests();
  }

  async renderWithdrawals() {
    const withdrawals = await this.readJson("edubridge_withdrawals");
    const sorted = withdrawals.sort((a, b) => this.getComparableDate(b.createdAt) - this.getComparableDate(a.createdAt));

    this.withdrawalList.innerHTML = sorted.map((item) => this.withdrawalCard(item)).join("");
    this.withdrawalEmpty.hidden = sorted.length !== 0;

    this.withdrawalList.querySelectorAll(".approve-withdraw-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.approveWithdrawal(button.getAttribute("data-id"));
      });
    });
  }

  withdrawalCard(item) {
    const status = item.status === "approved" ? "Đã duyệt" : "Chờ duyệt";
    const action = item.status === "pending"
      ? `<button type="button" class="btn btn-primary approve-withdraw-btn" data-id="${item.id}">Duyệt rút tiền</button>`
      : "";

    return `
      <article class="tutor-card">
        <h3>${item.tutorName || item.tutorEmail || "Gia sư"}</h3>
        <p class="tutor-meta">${item.tutorEmail || ""}</p>
        <p class="tutor-duration"><strong>Số tiền:</strong> ${Number(item.amount || 0).toLocaleString("vi-VN")} VND</p>
        <p class="tutor-duration"><strong>Trạng thái:</strong> ${status}</p>
        <p class="tutor-duration"><small>Tạo lúc: ${this.formatDateTime(item.createdAt)}</small></p>
        <div class="request-modal-actions">${action}</div>
      </article>
    `;
  }

  async approveWithdrawal(withdrawalId) {
    const withdrawalRef = doc(db, "withdrawals", String(withdrawalId));
    const withdrawalSnap = await getDoc(withdrawalRef);
    if (!withdrawalSnap.exists()) return;

    const withdrawal = { id: withdrawalSnap.id, ...withdrawalSnap.data() };
    await updateDoc(withdrawalRef, {
      status: "approved",
      approvedAt: new Date().toISOString()
    });

    await this.pushNotification(
      withdrawal.tutorEmail,
      `Yêu cầu rút tiền ${Number(withdrawal.amount || 0).toLocaleString("vi-VN")} VND đã được duyệt.`,
      "withdrawal-approved",
      { amount: withdrawal.amount || 0 }
    );

    await this.renderWithdrawals();
    alert("Đã duyệt yêu cầu rút tiền.");
  }

  async renderDisputes() {
    const disputes = await this.readJson("edubridge_disputes");
    const openDisputes = disputes
      .filter((item) => item.status === "open")
      .sort((a, b) => this.getComparableDate(b.createdAt) - this.getComparableDate(a.createdAt));

    this.disputeList.innerHTML = openDisputes.map((item) => this.disputeCard(item)).join("");
    this.disputeEmpty.hidden = openDisputes.length !== 0;

    this.disputeList.querySelectorAll(".dispute-refund-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.resolveWithRefund(button.getAttribute("data-id"));
      });
    });

    this.disputeList.querySelectorAll(".dispute-close-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await this.resolveWithoutRefund(button.getAttribute("data-id"));
      });
    });
  }

  disputeCard(item) {
    return `
      <article class="tutor-card">
        <h3>Yêu cầu #${item.requestId || item.id}</h3>
        <p class="tutor-meta">${item.reporterEmail || ""} (${item.reporterRole || "unknown"})</p>
        <p class="tutor-bio">${item.reason || "Không có nội dung"}</p>
        <p class="tutor-duration"><small>Tạo lúc: ${this.formatDateTime(item.createdAt)}</small></p>
        <div class="request-modal-actions">
          <button type="button" class="btn btn-primary dispute-refund-btn" data-id="${item.id}">Refund cho học viên</button>
          <button type="button" class="btn btn-secondary dispute-close-btn" data-id="${item.id}">Đóng không refund</button>
        </div>
      </article>
    `;
  }

  async resolveWithRefund(disputeId) {
    const disputeRef = doc(db, "disputes", String(disputeId));
    const disputeSnap = await getDoc(disputeRef);
    if (!disputeSnap.exists()) return;
    const dispute = { id: disputeSnap.id, ...disputeSnap.data() };

    const requestRef = doc(db, "requests", String(dispute.requestId));
    const requestSnap = await getDoc(requestRef);
    const requestData = requestSnap.exists() ? { id: requestSnap.id, ...requestSnap.data() } : null;

    if (requestData) {
      await updateDoc(requestRef, {
        status: "refunded",
        refundedAt: new Date().toISOString()
      });
    }

    if (requestData?.escrow) {
      const wallets = await this.readJson("edubridge_wallets");
      const tutorEmail = String(requestData.tutorEmail || "").toLowerCase();
      wallets.adminRevenue = Math.max(0, Number(wallets.adminRevenue || 0) - Number(requestData.escrow.adminAmount || 0));
      wallets.tutorBalances = wallets.tutorBalances || {};
      wallets.tutorBalances[tutorEmail] = Math.max(
        0,
        Number(wallets.tutorBalances[tutorEmail] || 0) - Number(requestData.escrow.tutorAmount || 0)
      );
      await this.writeJson("edubridge_wallets", wallets);
    }

    await updateDoc(disputeRef, {
      status: "resolved_refunded",
      resolvedAt: new Date().toISOString()
    });

    await this.pushNotification(
      dispute.studentEmail,
      `Tranh chấp của yêu cầu #${dispute.requestId} đã được xử lý và hoàn tiền.`,
      "dispute-resolved",
      { requestId: dispute.requestId, result: "refunded" }
    );
    await this.pushNotification(
      dispute.tutorEmail,
      `Tranh chấp của yêu cầu #${dispute.requestId} đã được admin xử lý theo hướng hoàn tiền.`,
      "dispute-resolved",
      { requestId: dispute.requestId, result: "refunded" }
    );

    await this.renderDisputes();
    await this.renderRequests();
    alert("Đã xử lý tranh chấp và hoàn tiền.");
  }

  async resolveWithoutRefund(disputeId) {
    const disputeRef = doc(db, "disputes", String(disputeId));
    const disputeSnap = await getDoc(disputeRef);
    if (!disputeSnap.exists()) return;
    const dispute = { id: disputeSnap.id, ...disputeSnap.data() };

    await updateDoc(disputeRef, {
      status: "resolved_no_refund",
      resolvedAt: new Date().toISOString()
    });

    await this.pushNotification(
      dispute.reporterEmail,
      `Tranh chấp của yêu cầu #${dispute.requestId} đã được đóng không refund.`,
      "dispute-resolved",
      { requestId: dispute.requestId, result: "closed" }
    );

    await this.renderDisputes();
    alert("Đã đóng tranh chấp.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AdminManager();
});
