import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebase-config.js";

const STORAGE_KEY = "edubridge_tutor_filters";
const DEBOUNCE_DELAY = 500;

class TutorBrowser {
  constructor() {
    this.tutors = [];
    this.activeUser = null;
    this.selectedTutor = null;
    this.debounceTimer = null;

    this.initElements();
    this.loadTutors();
    this.setupAuth();
    this.setupEventListeners();
    this.restoreFilters();
    this.render();
  }

  initElements() {
    this.listEl = document.getElementById("tutor-list");
    this.emptyEl = document.getElementById("tutor-empty");
    this.keywordEl = document.getElementById("filter-keyword");
    this.subjectEl = document.getElementById("filter-subject");
    this.modeEl = document.getElementById("filter-mode");
    this.priceEl = document.getElementById("filter-price");
    this.areaEl = document.getElementById("filter-area");
    this.genderEl = document.getElementById("filter-gender");
    this.ratingEl = document.getElementById("filter-rating");
    this.durationEl = document.getElementById("filter-duration");
    this.sortEl = document.getElementById("filter-sort");
    this.modalEl = document.getElementById("request-modal");
    this.modalTitleEl = document.getElementById("request-modal-title");
    this.noteEl = document.getElementById("request-note");
    this.modalSubmitBtn = document.getElementById("request-submit-btn");
    this.modalCancelBtn = document.getElementById("request-cancel-btn");
  }

  loadTutors() {
    const registered = this.readJson("edubridge_tutor_registrations")
      .filter((item) => item && item.status === "approved")
      .map((item, index) => ({
        id: 1000 + index,
        name: item.name || "Gia sư mới",
        email: item.email || "",
        subject: "custom",
        subjectLabel: item.subject || "Môn học khác",
        mode: item.location && item.location.toLowerCase().includes("online") ? "online" : "offline",
        modeLabel: item.location && item.location.toLowerCase().includes("online") ? "Online" : "Offline",
        area: item.location || "Chưa cập nhật",
        gender: String(item.gender || "").toLowerCase() || "male",
        rating: Number(item.rating || 4),
        price: Number(item.price || 250000),
        sessionHours: Number(item.sessionHours || 2),
        level: item.level || "Nhiều cấp độ",
        bio: item.experience || "Gia sư đã đăng ký trên hệ thống EduBridge.",
        activeState: item.activeState || "available"
      }));

    this.tutors = registered;
  }

  setupAuth() {
    onAuthStateChanged(auth, (user) => {
      this.activeUser = user;
    });
  }

  setupEventListeners() {
    [this.keywordEl, this.subjectEl, this.modeEl, this.priceEl, this.areaEl, this.genderEl, this.ratingEl, this.durationEl, this.sortEl].forEach(
      (el) => {
        if (el) {
          el.addEventListener("input", () => this.debouncedRender());
          el.addEventListener("change", () => {
            this.saveFilters();
            this.render();
          });
        }
      }
    );

    if (this.modalCancelBtn) this.modalCancelBtn.addEventListener("click", () => this.closeModal());
    if (this.modalSubmitBtn)
      this.modalSubmitBtn.addEventListener("click", () => {
        if (!this.selectedTutor) return;
        if (!this.validateAndSubmit()) return;

        const note = (this.noteEl.value || "").trim();
        this.saveRequest(note);
        this.closeModal();
        alert("Đã gửi yêu cầu học với gia sư " + this.selectedTutor.name + ".");
      });
  }

  debouncedRender() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.saveFilters();
      this.render();
    }, DEBOUNCE_DELAY);
  }

  formatPrice(price) {
    return price.toLocaleString("vi-VN") + " VND/buổi";
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

  getStatusBadge(activeState) {
    const state = (activeState || "available").toLowerCase();
    if (state === "busy") {
      return '<span class="tutor-status tutor-status-busy">Đang bận</span>';
    }
    return '<span class="tutor-status tutor-status-available">Có sẵn</span>';
  }

  cardTemplate(tutor) {
    const isBusy = (tutor.activeState || "available").toLowerCase() === "busy";
    const disabledClass = isBusy ? " disabled" : "";
    const disabledAttr = isBusy ? ' disabled' : '';

    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>${tutor.name}</h3>
          ${this.getStatusBadge(tutor.activeState)}
        </div>
        <p class="tutor-meta">${tutor.subjectLabel} • ${tutor.modeLabel} • ${tutor.level}</p>
        <p class="tutor-bio">${tutor.bio}</p>
        <div class="tutor-details">
          <p class="tutor-duration">Khu vực: ${tutor.area || "Chưa cập nhật"} • ⭐ ${Number(tutor.rating || 0).toFixed(1)} sao</p>
          <p class="tutor-duration">1 buổi: ${tutor.sessionHours} giờ</p>
        </div>
        <p class="tutor-price">${this.formatPrice(tutor.price)}</p>
        <button type="button" class="btn btn-primary btn-block tutor-request-btn${disabledClass}" data-id="${tutor.id}" data-name="${tutor.name}"${disabledAttr}>
          ${isBusy ? "Gia sư đang bận" : "Gửi yêu cầu gia sư"}
        </button>
      </article>
    `;
  }

  getFilteredTutors() {
    const keyword = (this.keywordEl.value || "").toLowerCase().trim();
    const subject = this.subjectEl.value;
    const mode = this.modeEl.value;
    const maxPrice = Number(this.priceEl.value || 0);
    const area = (this.areaEl.value || "").toLowerCase().trim();
    const gender = this.genderEl.value;
    const minRating = Number(this.ratingEl.value || 0);
    const sessionHours = Number(this.durationEl.value || 0);

    let filtered = this.tutors.filter((tutor) => {
      if ((tutor.activeState || "available") === "busy") return false;

      const byKeyword = !keyword || tutor.name.toLowerCase().includes(keyword) || tutor.subjectLabel.toLowerCase().includes(keyword);
      const bySubject = !subject || tutor.subject === subject;
      const byMode = !mode || tutor.mode === mode;
      const byPrice = !maxPrice || tutor.price <= maxPrice;
      const byArea = !area || String(tutor.area || "").toLowerCase().includes(area);
      const byGender = !gender || tutor.gender === gender;
      const byRating = !minRating || Number(tutor.rating || 0) >= minRating;
      const byDuration = !sessionHours || tutor.sessionHours === sessionHours;

      return byKeyword && bySubject && byMode && byPrice && byArea && byGender && byRating && byDuration;
    });

    // Apply sorting
    const sortValue = this.sortEl?.value || "default";
    switch (sortValue) {
      case "rating-high":
        filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        break;
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      default:
        // Keep original order
        break;
    }

    return filtered;
  }

  saveFilters() {
    const filters = {
      keyword: this.keywordEl.value,
      subject: this.subjectEl.value,
      mode: this.modeEl.value,
      price: this.priceEl.value,
      area: this.areaEl.value,
      gender: this.genderEl.value,
      rating: this.ratingEl.value,
      duration: this.durationEl.value,
      sort: this.sortEl?.value || "default"
    };
    this.writeJson(STORAGE_KEY, filters);
  }

  restoreFilters() {
    const filters = this.readJson(STORAGE_KEY);
    if (filters && Object.keys(filters).length > 0) {
      if (filters.keyword) this.keywordEl.value = filters.keyword;
      if (filters.subject) this.subjectEl.value = filters.subject;
      if (filters.mode) this.modeEl.value = filters.mode;
      if (filters.price) this.priceEl.value = filters.price;
      if (filters.area) this.areaEl.value = filters.area;
      if (filters.gender) this.genderEl.value = filters.gender;
      if (filters.rating) this.ratingEl.value = filters.rating;
      if (filters.duration) this.durationEl.value = filters.duration;
      if (this.sortEl && filters.sort) this.sortEl.value = filters.sort;
    }
  }

  openModal(tutor) {
    this.selectedTutor = tutor;
    this.modalTitleEl.textContent = `Gửi yêu cầu: ${tutor.name} (${tutor.subjectLabel})`;
    this.noteEl.value = "";
    this.modalEl.hidden = false;
  }

  closeModal() {
    this.selectedTutor = null;
    this.modalEl.hidden = true;
  }

  validateAndSubmit() {
    if (!this.selectedTutor) {
      alert("Vui lòng chọn gia sư.");
      return false;
    }

    if (!this.activeUser || !this.activeUser.emailVerified) {
      const next = encodeURIComponent("tim-gia-su.html");
      window.location.href = `dang-nhap.html?next=${next}`;
      return false;
    }

    const note = (this.noteEl.value || "").trim();
    if (note.length > 500) {
      alert("Ghi chú không được vượt quá 500 ký tự.");
      return false;
    }

    return true;
  }

  saveRequest(note) {
    if (!this.selectedTutor || !this.activeUser) return;

    const requests = this.readJson("edubridge_requests");
    requests.unshift({
      id: Date.now(),
      tutorId: this.selectedTutor.id,
      tutorName: this.selectedTutor.name,
      tutorEmail: this.selectedTutor.email,
      subject: this.selectedTutor.subjectLabel,
      studentEmail: this.activeUser.email,
      studentName: this.activeUser.displayName || this.activeUser.email,
      note: note,
      createdAt: new Date().toISOString(),
      respondBy: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "waiting_tutor",
      pricePerSession: Number(this.selectedTutor.price || 0),
      sessionHours: Number(this.selectedTutor.sessionHours || 2),
      monthlySessions: 8
    });
    this.writeJson("edubridge_requests", requests);

    const notifications = this.readJson("edubridge_notifications");
    notifications.unshift({
      id: Date.now() + 1,
      userEmail: this.selectedTutor.email,
      text: `Bạn có yêu cầu mới từ ${this.activeUser.displayName || this.activeUser.email} cho môn ${this.selectedTutor.subjectLabel}.`,
      read: false,
      createdAt: new Date().toISOString()
    });
    notifications.unshift({
      id: Date.now() + 2,
      userEmail: this.activeUser.email,
      text: `Bạn đã gửi yêu cầu đến gia sư ${this.selectedTutor.name}.`,
      read: false,
      createdAt: new Date().toISOString()
    });
    this.writeJson("edubridge_notifications", notifications);
    window.dispatchEvent(new Event("edubridge-notifications-updated"));
  }

  attachButtonListeners() {
    const buttons = document.querySelectorAll(".tutor-request-btn");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;

        if (!this.activeUser || !this.activeUser.emailVerified) {
          const next = encodeURIComponent("tim-gia-su.html");
          window.location.href = `dang-nhap.html?next=${next}`;
          return;
        }

        const tutorId = Number(button.getAttribute("data-id") || 0);
        const tutor = this.tutors.find((item) => item.id === tutorId);

        if (!tutor) {
          alert("Không tìm thấy thông tin gia sư.");
          return;
        }

        this.openModal(tutor);
      });
    });
  }

  render() {
    const filtered = this.getFilteredTutors();
    this.listEl.innerHTML = filtered.map((tutor) => this.cardTemplate(tutor)).join("");
    this.emptyEl.hidden = filtered.length !== 0;
    this.attachButtonListeners();
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TutorBrowser();
});
