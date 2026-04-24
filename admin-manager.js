import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebase-config.js";

class AdminManager {
  constructor() {
    this.currentTab = "tutor-approvals";
    this.initElements();
    this.setupAuth();
    this.setupTabs();
    this.setupFilters();
  }

  initElements() {
    this.tabButtons = document.querySelectorAll(".admin-tab-btn");
    this.tabContents = document.querySelectorAll(".admin-tab-content");
    
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
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "dang-nhap.html?next=" + encodeURIComponent("admin.html");
      }
    });
  }

  setupTabs() {
    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.getAttribute("data-tab");
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
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
    if (tabName === "tutor-list") {
      this.renderTutors();
    } else if (tabName === "student-list") {
      this.renderStudents();
    } else if (tabName === "requests") {
      this.renderRequests();
    }
  }

  readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  }

  writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
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

  // === TUTOR APPROVALS ===
  renderApprovals() {
    const registrations = this.readJson("edubridge_tutor_registrations");
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
        <div class="request-modal-actions">${buttons}</div>
      </article>
    `;
  }

  attachTutorApprovalListeners() {
    const approveButtons = document.querySelectorAll(".admin-approve-btn");
    const rejectButtons = document.querySelectorAll(".admin-reject-btn");

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
  }

  approveTutorRegistration(email) {
    const registrations = this.readJson("edubridge_tutor_registrations");
    registrations.forEach((item) => {
      if (item.email?.toLowerCase() === email.toLowerCase()) {
        item.status = "approved";
        item.updatedAt = new Date().toISOString();
      }
    });
    this.writeJson("edubridge_tutor_registrations", registrations);
    this.renderApprovals();
    alert("Đã duyệt gia sư!");
  }

  rejectTutorRegistration(email, reason) {
    const registrations = this.readJson("edubridge_tutor_registrations");
    registrations.forEach((item) => {
      if (item.email?.toLowerCase() === email.toLowerCase()) {
        item.status = "rejected";
        item.rejectReason = reason;
        item.updatedAt = new Date().toISOString();
      }
    });
    this.writeJson("edubridge_tutor_registrations", registrations);
    this.renderApprovals();
    alert("Đã từ chối gia sư!");
  }

  // === TUTOR MANAGEMENT ===
  renderTutors() {
    const registrations = this.readJson("edubridge_tutor_registrations");
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
  renderStudents() {
    const students = this.readJson("edubridge_students") || [];
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
  renderRequests() {
    const requests = this.readJson("edubridge_requests") || [];
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
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        this.approveRequest(id);
      });
    });

    rejectButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        this.rejectRequest(id);
      });
    });

    deleteButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        if (confirm("Bạn chắc chắn muốn xóa yêu cầu này?")) {
          this.deleteRequest(id);
        }
      });
    });
  }

  approveRequest(requestId) {
    const requests = this.readJson("edubridge_requests") || [];
    const request = requests.find((item) => item.id === requestId);
    
    if (request) {
      // Add tutor to tutor registrations with approved status
      const registrations = this.readJson("edubridge_tutor_registrations") || [];
      
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
        this.writeJson("edubridge_tutor_registrations", registrations);
      }
      
      // Add tutor to student's profile
      const students = this.readJson("edubridge_students") || [];
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
        this.writeJson("edubridge_students", students);
      }
      
      // DELETE the request
      const filtered = requests.filter((item) => item.id !== requestId);
      this.writeJson("edubridge_requests", filtered);
      
      this.renderRequests();
      this.renderTutors();
      alert("Đã duyệt yêu cầu! Gia sư được thêm vào danh sách quản lý.");
    }
  }

  rejectRequest(requestId) {
    const requests = this.readJson("edubridge_requests") || [];
    // DELETE the request immediately when rejected
    const filtered = requests.filter((item) => item.id !== requestId);
    this.writeJson("edubridge_requests", filtered);
    this.renderRequests();
    alert("Đã từ chối yêu cầu!");
  }

  deleteRequest(requestId) {
    const requests = this.readJson("edubridge_requests") || [];
    const filtered = requests.filter((item) => item.id !== requestId);
    this.writeJson("edubridge_requests", filtered);
    this.renderRequests();
    alert("Đã xóa yêu cầu!");
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new AdminManager();
});
