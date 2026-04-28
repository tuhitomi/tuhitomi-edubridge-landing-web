import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const STORAGE_KEY = "edubridge_tutor_filters";
const DEFAULT_ADMIN_EMAIL = "tu620014@gmail.com";
const DEBOUNCE_DELAY = 300;

function isPermissionDeniedError(error) {
  return !!(error && (error.code === "permission-denied" || String(error.message || "").toLowerCase().includes("insufficient permissions")));
}

class TutorBrowser {
  constructor() {
    this.tutors = [];
    this.activeUser = null;
    this.selectedTutor = null;
    this.debounceTimer = null;

    this.initElements();
    this.setupAuth();
    this.setupEventListeners();
    this.load().catch((error) => {
      if (!isPermissionDeniedError(error)) {
        console.error("Failed to init tutor browser:", error);
      }
      this.tutors = [];
      this.render();
    });
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

  setupAuth() {
    onAuthStateChanged(auth, (user) => {
      this.activeUser = user;
    });
  }

  setupEventListeners() {
    [
      this.keywordEl,
      this.subjectEl,
      this.modeEl,
      this.priceEl,
      this.areaEl,
      this.genderEl,
      this.ratingEl,
      this.durationEl,
      this.sortEl
    ].forEach((element) => {
      if (!element) return;
      element.addEventListener("input", () => this.debouncedRender());
      element.addEventListener("change", () => this.debouncedRender());
    });

    if (this.modalCancelBtn) {
      this.modalCancelBtn.addEventListener("click", () => this.closeModal());
    }

    if (this.modalSubmitBtn) {
      this.modalSubmitBtn.addEventListener("click", async () => {
        if (!this.validateModal()) return;
        await this.saveRequest((this.noteEl.value || "").trim());
        this.closeModal();
        alert("Da gui yeu cau ket noi.");
      });
    }
  }

  async load() {
    await this.loadTutors();
    await this.restoreFilters();
    this.render();
  }

  async loadTutors() {
    let snapshot;
    try {
      snapshot = await getDocs(collection(db, "tutor_registrations"));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        this.tutors = [];
        return;
      }
      throw error;
    }
    this.tutors = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((item) => item.status === "approved")
      .map((item) => {
        const location = String(item.location || "");
        const isOnline = location.toLowerCase().includes("online");
        return {
          id: String(item.id || item.email || item.name || Date.now()),
          docId: String(item.id || ""),
          name: item.name || "Gia su moi",
          email: item.email || "",
          subject: "custom",
          subjectLabel: item.subject || "Mon hoc khac",
          mode: isOnline ? "online" : "offline",
          modeLabel: isOnline ? "Online" : "Offline",
          area: item.location || "Chua cap nhat",
          gender: String(item.gender || "").trim().toLowerCase() || "female",
          rating: Number(item.rating || 4),
          price: Number(item.price || 250000),
          sessionHours: Number(item.sessionHours || 2),
          level: item.level || "Nhieu cap do",
          bio: item.experience || "Gia su da dang ky tren he thong EduBridge.",
          activeState: item.activeState || "available"
        };
      });
  }

  debouncedRender() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.saveFilters();
      this.render();
    }, DEBOUNCE_DELAY);
  }

  async readStoredFilters() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  async saveFilters() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      keyword: this.keywordEl?.value || "",
      subject: this.subjectEl?.value || "",
      mode: this.modeEl?.value || "",
      price: this.priceEl?.value || "",
      area: this.areaEl?.value || "",
      gender: this.genderEl?.value || "",
      rating: this.ratingEl?.value || "",
      duration: this.durationEl?.value || "",
      sort: this.sortEl?.value || "default"
    }));
  }

  async restoreFilters() {
    const filters = await this.readStoredFilters();
    if (this.keywordEl) this.keywordEl.value = filters.keyword || "";
    if (this.subjectEl) this.subjectEl.value = filters.subject || "";
    if (this.modeEl) this.modeEl.value = filters.mode || "";
    if (this.priceEl) this.priceEl.value = filters.price || "";
    if (this.areaEl) this.areaEl.value = filters.area || "";
    if (this.genderEl) this.genderEl.value = filters.gender || "";
    if (this.ratingEl) this.ratingEl.value = filters.rating || "";
    if (this.durationEl) this.durationEl.value = filters.duration || "";
    if (this.sortEl) this.sortEl.value = filters.sort || "default";
  }

  formatPrice(price) {
    return `${Number(price || 0).toLocaleString("vi-VN")} VND/buoi`;
  }

  getStatusBadge(activeState) {
    if (String(activeState || "available").toLowerCase() === "busy") {
      return '<span class="tutor-status tutor-status-busy">Dang ban</span>';
    }
    return '<span class="tutor-status tutor-status-available">Co san</span>';
  }

  getFilteredTutors() {
    const keyword = String(this.keywordEl?.value || "").trim().toLowerCase();
    const mode = String(this.modeEl?.value || "").trim();
    const maxPrice = Number(this.priceEl?.value || 0);
    const area = String(this.areaEl?.value || "").trim().toLowerCase();
    const gender = String(this.genderEl?.value || "").trim().toLowerCase();
    const minRating = Number(this.ratingEl?.value || 0);
    const duration = Number(this.durationEl?.value || 0);

    const tutors = this.tutors.filter((tutor) => {
      if (String(tutor.activeState || "available").toLowerCase() === "busy") return false;
      if (keyword && !tutor.name.toLowerCase().includes(keyword) && !tutor.subjectLabel.toLowerCase().includes(keyword)) return false;
      if (mode && tutor.mode !== mode) return false;
      if (maxPrice && tutor.price > maxPrice) return false;
      if (area && !String(tutor.area || "").toLowerCase().includes(area)) return false;
      if (gender && tutor.gender !== gender) return false;
      if (minRating && Number(tutor.rating || 0) < minRating) return false;
      if (duration && Number(tutor.sessionHours || 0) !== duration) return false;
      return true;
    });

    const sortValue = this.sortEl?.value || "default";
    if (sortValue === "rating-high") {
      tutors.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (sortValue === "price-low") {
      tutors.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortValue === "price-high") {
      tutors.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    return tutors;
  }

  cardTemplate(tutor) {
    return `
      <article class="tutor-card">
        <div class="tutor-header">
          <h3>${tutor.name}</h3>
          ${this.getStatusBadge(tutor.activeState)}
        </div>
        <p class="tutor-meta">${tutor.subjectLabel} | ${tutor.modeLabel} | ${tutor.level}</p>
        <p class="tutor-bio">${tutor.bio}</p>
        <div class="tutor-details">
          <p class="tutor-duration">Khu vuc: ${tutor.area} | ${Number(tutor.rating || 0).toFixed(1)} sao</p>
          <p class="tutor-duration">1 buoi: ${tutor.sessionHours} gio</p>
        </div>
        <p class="tutor-price">${this.formatPrice(tutor.price)}</p>
        <button type="button" class="btn btn-primary btn-block tutor-request-btn" data-id="${tutor.id}">
          Gui yeu cau gia su
        </button>
      </article>
    `;
  }

  attachButtonListeners(filteredTutors) {
    this.listEl.querySelectorAll(".tutor-request-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-id");
        const tutor = filteredTutors.find((item) => item.id === id);
        if (!tutor) return;

        if (!this.activeUser || !this.activeUser.emailVerified) {
          const next = encodeURIComponent("tim-gia-su.html");
          window.location.href = `dang-nhap.html?next=${next}`;
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
    this.attachButtonListeners(filtered);
  }

  openModal(tutor) {
    this.selectedTutor = tutor;
    this.modalTitleEl.textContent = `Gui yeu cau: ${tutor.name} (${tutor.subjectLabel})`;
    this.noteEl.value = "";
    this.modalEl.hidden = false;
  }

  closeModal() {
    this.selectedTutor = null;
    if (this.modalEl) this.modalEl.hidden = true;
  }

  validateModal() {
    if (!this.selectedTutor) {
      alert("Vui long chon gia su.");
      return false;
    }

    if (!this.activeUser || !this.activeUser.emailVerified) {
      const next = encodeURIComponent("tim-gia-su.html");
      window.location.href = `dang-nhap.html?next=${next}`;
      return false;
    }

    const note = String(this.noteEl?.value || "").trim();
    if (note.length > 500) {
      alert("Ghi chu khong duoc vuot qua 500 ky tu.");
      return false;
    }

    return true;
  }

  async ensureStudentRecord() {
    const email = String(this.activeUser?.email || "").trim().toLowerCase();
    if (!email) return;

    let existingStudent = null;
    try {
      existingStudent = await getDoc(doc(db, "students", email));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        return;
      }
      throw error;
    }

    if (existingStudent?.exists()) return;

    const payload = {
      id: email,
      email: this.activeUser.email,
      name: this.activeUser.displayName || this.activeUser.email,
      joinedAt: new Date().toISOString(),
      status: "active",
      assignedTutors: []
    };
    await setDoc(doc(db, "students", email), payload);
  }

  async readCollection(name) {
    try {
      const snapshot = await getDocs(collection(db, name));
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        return [];
      }
      throw error;
    }
  }

  async getAdminEmail() {
    try {
      const docSnap = await getDoc(doc(db, "settings", "edubridge_admin_email"));
      return String(docSnap.exists() ? docSnap.data().value : DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    } catch (error) {
      return DEFAULT_ADMIN_EMAIL;
    }
  }

  async getModeratorEmails() {
    try {
      const docSnap = await getDoc(doc(db, "settings", "edubridge_moderator_emails"));
      const emails = docSnap.exists() ? docSnap.data().value : [];
      if (!Array.isArray(emails)) return [];
      return emails.map((item) => String(item || "").trim().toLowerCase()).filter((item) => item);
    } catch (error) {
      return [];
    }
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

  async saveRequest(note) {
    if (!this.selectedTutor || !this.activeUser || !this.activeUser.email) return;

    await this.ensureStudentRecord();

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const request = {
      id: requestId,
      tutorId: String(this.selectedTutor.id),
      tutorName: this.selectedTutor.name,
      tutorEmail: this.selectedTutor.email,
      subject: this.selectedTutor.subjectLabel,
      studentEmail: this.activeUser.email,
      studentName: this.activeUser.displayName || this.activeUser.email,
      note,
      createdAt: new Date().toISOString(),
      respondBy: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "waiting_tutor",
      pricePerSession: Number(this.selectedTutor.price || 0),
      sessionHours: Number(this.selectedTutor.sessionHours || 2),
      monthlySessions: 8
    };

    await setDoc(doc(db, "requests", requestId), request);

    const studentEmail = String(this.activeUser.email || "").trim().toLowerCase();
    const tutorEmail = String(this.selectedTutor.email || "").trim().toLowerCase();
    const studentName = this.activeUser.displayName || this.activeUser.email;
    const tutorName = this.selectedTutor.name;

    await this.pushNotification(
      tutorEmail,
      `Ban co yeu cau moi tu ${studentName} cho mon ${this.selectedTutor.subjectLabel}.`,
      "tutor-request",
      { requestId: request.id }
    );
    await this.pushNotification(
      studentEmail,
      `Ban da gui yeu cau den gia su ${tutorName}.`,
      "student-request",
      { requestId: request.id }
    );

    const recipients = [await this.getAdminEmail()].concat(await this.getModeratorEmails())
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item, index, list) => item && list.indexOf(item) === index);

    for (const email of recipients) {
      await this.pushNotification(
        email,
        `Hoc vien ${studentName} da gui yeu cau den gia su ${tutorName}.`,
        "admin-request",
        { requestId: request.id, tutorEmail, studentEmail }
      );
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new TutorBrowser();
});
