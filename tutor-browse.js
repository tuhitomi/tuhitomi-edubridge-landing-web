import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc, collection, doc, getDoc, getDocs,
  query, where, orderBy, limit, setDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const STORAGE_KEY     = "edubridge_tutor_filters";
const DEFAULT_ADMIN   = "tu620014@gmail.com";
const DEBOUNCE_DELAY  = 300;

// Avatar colour palettes (banner bg + avatar gradient)
const PALETTES = [
  { banner: "linear-gradient(135deg,#d1fae5,#a7f3d0)", avatar: "linear-gradient(135deg,#34d399,#059669)" },
  { banner: "linear-gradient(135deg,#dbeafe,#bfdbfe)", avatar: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  { banner: "linear-gradient(135deg,#fef3c7,#fde68a)", avatar: "linear-gradient(135deg,#f59e0b,#d97706)" },
  { banner: "linear-gradient(135deg,#fce7f3,#fbcfe8)", avatar: "linear-gradient(135deg,#ec4899,#db2777)" },
  { banner: "linear-gradient(135deg,#ede9fe,#ddd6fe)", avatar: "linear-gradient(135deg,#8b5cf6,#7c3aed)" },
  { banner: "linear-gradient(135deg,#ffedd5,#fed7aa)", avatar: "linear-gradient(135deg,#f97316,#ea580c)" },
];

function isPermDenied(err) {
  return !!(err && (err.code === "permission-denied" ||
    String(err.message || "").toLowerCase().includes("insufficient permissions")));
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "GS";
}

function renderStars(rating) {
  const r = Math.round(Math.max(0, Math.min(5, Number(rating) || 0)));
  return `<span style="color:#f59e0b">${"★".repeat(r)}</span><span style="color:var(--border-strong)">${"☆".repeat(5 - r)}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
class TutorBrowser {
  constructor() {
    this.tutors       = [];
    this.activeUser   = null;
    this.selectedTutor = null;
    this.debounceTimer = null;

    this.initElements();
    this.setupAuth();
    this.setupEventListeners();
    this.load().catch(err => {
      if (!isPermDenied(err)) console.error("TutorBrowser init error:", err);
      this.tutors = [];
      this.render();
    });
  }

  // ── DOM references ───────────────────────────────────────────────────────
  initElements() {
    this.listEl         = document.getElementById("tutor-list");
    this.emptyEl        = document.getElementById("tutor-empty");
    this.keywordEl      = document.getElementById("filter-keyword");
    this.subjectEl      = document.getElementById("filter-subject");
    this.modeEl         = document.getElementById("filter-mode");
    this.priceEl        = document.getElementById("filter-price");
    this.areaEl         = document.getElementById("filter-area");
    this.genderEl       = document.getElementById("filter-gender");
    this.ratingEl       = document.getElementById("filter-rating");
    this.durationEl     = document.getElementById("filter-duration");
    this.sortEl         = document.getElementById("filter-sort");
    this.modalEl        = document.getElementById("request-modal");
    this.modalTitleEl   = document.getElementById("request-modal-title");
    this.noteEl         = document.getElementById("request-note");
    this.modalSubmitBtn = document.getElementById("request-submit-btn");
    this.modalCancelBtn = document.getElementById("request-cancel-btn");
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  setupAuth() {
    onAuthStateChanged(auth, user => { this.activeUser = user; });
  }

  // ── Events ───────────────────────────────────────────────────────────────
  setupEventListeners() {
    const debounced = () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => { this.saveFilters(); this.render(); }, DEBOUNCE_DELAY);
    };

    [this.keywordEl, this.subjectEl, this.modeEl, this.priceEl,
     this.areaEl, this.genderEl, this.ratingEl, this.durationEl, this.sortEl]
      .forEach(el => { if (!el) return; el.addEventListener("input", debounced); el.addEventListener("change", debounced); });

    this.modalCancelBtn?.addEventListener("click", () => this.closeModal());

    this.modalSubmitBtn?.addEventListener("click", async () => {
      if (!this.validateModal()) return;
      const btn = this.modalSubmitBtn;
      btn.disabled = true;
      btn.textContent = "Đang gửi…";
      try {
        await this.saveRequest((this.noteEl?.value || "").trim());
        this.closeModal();
        this.showToast("✅ Yêu cầu đã được gửi thành công!");
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra. Vui lòng thử lại.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Gửi yêu cầu";
      }
    });
  }

  // ── Load ─────────────────────────────────────────────────────────────────
  async load() {
    // Show skeleton
    if (this.listEl) {
      this.listEl.innerHTML = Array(3).fill(`<div class="tutor-card-skeleton"></div>`).join("");
    }

    await this.loadTutors();
    await this.restoreFilters();
    this.render();
  }

  async loadTutors() {
    let snap;
    try {
      snap = await getDocs(query(
        collection(db, "tutor_registrations"),
        where("status", "==", "approved")
      ));
    } catch (err) {
      if (isPermDenied(err)) { this.tutors = []; return; }
      throw err;
    }

    this.tutors = snap.docs
      .map((d, idx) => {
        const item = { docId: d.id, ...d.data() };
        const loc  = String(item.location || "");
        const isOnline = loc.toLowerCase().includes("online");
        return {
          // Keep original Firestore ID as string for lookups
          id:           String(item.id || d.id),
          docId:        d.id,
          email:        item.email || "",
          name:         item.name || "Gia sư",
          subject:      "custom",
          subjectLabel: item.subject || "Môn học khác",
          mode:         isOnline ? "online" : "offline",
          modeLabel:    isOnline ? "Online" : "Offline",
          area:         item.location || "Chưa cập nhật",
          gender:       String(item.gender || "").toLowerCase() || "female",
          // Prefer real Firestore avgRating, fallback to legacy rating field
          rating:       Number(item.avgRating || item.rating || 4),
          reviewCount:  Number(item.reviewCount || 0),
          price:        Number(item.price || 250000),
          sessionHours: Number(item.sessionHours || 2),
          level:        item.level || "Nhiều cấp độ",
          bio:          item.experience || "Gia sư đã đăng ký trên hệ thống EduBridge.",
          activeState:  item.activeState || "available",
          paletteIdx:   idx % PALETTES.length,
        };
      })
      .filter(t => t.activeState !== "busy" || true); // keep busy ones but show badge
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  saveFilters() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      keyword:  this.keywordEl?.value  || "",
      subject:  this.subjectEl?.value  || "",
      mode:     this.modeEl?.value     || "",
      price:    this.priceEl?.value    || "",
      area:     this.areaEl?.value     || "",
      gender:   this.genderEl?.value   || "",
      rating:   this.ratingEl?.value   || "",
      duration: this.durationEl?.value || "",
      sort:     this.sortEl?.value     || "default",
    }));
  }

  async restoreFilters() {
    try {
      const f = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (this.keywordEl)  this.keywordEl.value  = f.keyword  || "";
      if (this.subjectEl)  this.subjectEl.value  = f.subject  || "";
      if (this.modeEl)     this.modeEl.value     = f.mode     || "";
      if (this.priceEl)    this.priceEl.value    = f.price    || "";
      if (this.areaEl)     this.areaEl.value     = f.area     || "";
      if (this.genderEl)   this.genderEl.value   = f.gender   || "";
      if (this.ratingEl)   this.ratingEl.value   = f.rating   || "";
      if (this.durationEl) this.durationEl.value = f.duration || "";
      if (this.sortEl)     this.sortEl.value     = f.sort     || "default";
    } catch { /* ignore */ }
  }

  getFilteredTutors() {
    const keyword      = (this.keywordEl?.value  || "").trim().toLowerCase();
    const mode         = (this.modeEl?.value     || "").trim();
    const maxPrice     = Number(this.priceEl?.value    || 0);
    const area         = (this.areaEl?.value     || "").trim().toLowerCase();
    const gender       = (this.genderEl?.value   || "").trim().toLowerCase();
    const minRating    = Number(this.ratingEl?.value   || 0);
    const duration     = Number(this.durationEl?.value || 0);
    const sortValue    = this.sortEl?.value || "default";

    let list = this.tutors.filter(t => {
      // Hide busy tutors from results
      if ((t.activeState || "available") === "busy") return false;
      if (keyword   && !t.name.toLowerCase().includes(keyword) && !t.subjectLabel.toLowerCase().includes(keyword)) return false;
      if (mode      && t.mode !== mode) return false;
      if (maxPrice  && t.price > maxPrice) return false;
      if (area      && !String(t.area || "").toLowerCase().includes(area)) return false;
      if (gender    && t.gender !== gender) return false;
      if (minRating && Number(t.rating || 0) < minRating) return false;
      if (duration  && Number(t.sessionHours || 0) !== duration) return false;
      return true;
    });

    switch (sortValue) {
      case "rating-high": list.sort((a, b) => b.rating - a.rating); break;
      case "price-low":   list.sort((a, b) => a.price - b.price);   break;
      case "price-high":  list.sort((a, b) => b.price - a.price);   break;
    }
    return list;
  }

  // ── Card template (new design) ───────────────────────────────────────────
  cardTemplate(tutor) {
    const pal         = PALETTES[tutor.paletteIdx || 0];
    const avg         = Number(tutor.rating || 4).toFixed(1);
    const count       = tutor.reviewCount || 0;
    const price       = Number(tutor.price || 0).toLocaleString("vi-VN");
    const tags        = (tutor.subjectLabel || "").split(/[,、\/]/).slice(0, 3)
                         .map(s => `<span class="subject-tag">${s.trim()}</span>`).join("");
    const profileUrl  = `tutor-profile.html?email=${encodeURIComponent(tutor.email)}`;

    return `
      <article class="tutor-card" data-id="${tutor.id}">
        <!-- Banner + avatar -->
        <a href="${profileUrl}" class="tutor-card-banner-link">
          <div class="tutor-card-banner" style="background:${pal.banner}"></div>
        </a>

        <div class="tutor-card-body">
          <!-- Avatar -->
          <a href="${profileUrl}" class="tutor-avatar" style="background:${pal.avatar};text-decoration:none">
            ${initials(tutor.name)}
          </a>

          <!-- Name + verified -->
          <div class="tutor-name-row">
            <a href="${profileUrl}" class="tutor-name" style="text-decoration:none">${tutor.name}</a>
            <svg class="verified-badge" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7.25" fill="#0a5f4a" stroke="white" stroke-width="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Meta -->
          <div style="font-size:12px;color:var(--ink-40);margin-bottom:4px;line-height:1.4">
            ${[tutor.level, tutor.modeLabel, tutor.area].filter(Boolean).join(" • ")}
          </div>

          <!-- Subject tags -->
          <div class="tutor-subjects">${tags || '<span class="subject-tag">Nhiều môn</span>'}</div>

          <!-- Rating + price -->
          <div class="tutor-meta-row">
            <div class="tutor-rating">
              <div class="stars">${renderStars(avg)}</div>
              <span style="font-weight:700;color:var(--ink-100)">${avg}</span>
              <span style="font-size:11px;font-weight:400;color:var(--ink-40)">
                ${count > 0 ? `(${count})` : "Mới"}
              </span>
            </div>
            <div class="tutor-price">${price}đ <span>/buổi</span></div>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:8px;margin-top:10px">
            <a href="${profileUrl}" class="btn btn-ghost btn-sm" style="flex:1;text-align:center">Xem hồ sơ</a>
            <button
              type="button"
              class="btn btn-primary btn-sm tutor-request-btn"
              data-id="${tutor.id}"
              style="flex:1"
            >Gửi yêu cầu</button>
          </div>
        </div>
      </article>`;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  render() {
    const filtered = this.getFilteredTutors();
    if (!this.listEl) return;

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:var(--ink-40)">
          <div style="font-size:2.5rem;margin-bottom:0.75rem">🔍</div>
          <p style="font-size:var(--text-base);margin-bottom:1rem">Không có gia sư phù hợp với bộ lọc hiện tại.</p>
          <button class="btn btn-ghost btn-sm" onclick="location.reload()">Xóa bộ lọc</button>
        </div>`;
      if (this.emptyEl) this.emptyEl.hidden = true;
      return;
    }

    this.listEl.innerHTML = filtered.map(t => this.cardTemplate(t)).join("");
    if (this.emptyEl) this.emptyEl.hidden = true;
    this.attachButtonListeners(filtered);
  }

  attachButtonListeners(filteredTutors) {
    this.listEl.querySelectorAll(".tutor-request-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.activeUser || !this.activeUser.emailVerified) {
          window.location.href = `dang-nhap.html?next=${encodeURIComponent("tim-gia-su.html")}`;
          return;
        }
        const id    = btn.getAttribute("data-id");
        const tutor = filteredTutors.find(t => t.id === id);
        if (!tutor) { alert("Không tìm thấy gia sư."); return; }
        this.openModal(tutor);
      });
    });
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  openModal(tutor) {
    this.selectedTutor = tutor;
    if (this.modalTitleEl)
      this.modalTitleEl.textContent = `Gửi yêu cầu: ${tutor.name} (${tutor.subjectLabel})`;
    if (this.noteEl) this.noteEl.value = "";
    if (this.modalEl) this.modalEl.hidden = false;
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    this.selectedTutor = null;
    if (this.modalEl) this.modalEl.hidden = true;
    document.body.style.overflow = "";
  }

  validateModal() {
    if (!this.selectedTutor) { alert("Vui lòng chọn gia sư."); return false; }
    if (!this.activeUser || !this.activeUser.emailVerified) {
      window.location.href = `dang-nhap.html?next=${encodeURIComponent("tim-gia-su.html")}`;
      return false;
    }
    if ((this.noteEl?.value || "").trim().length > 500) {
      alert("Ghi chú không được vượt quá 500 ký tự."); return false;
    }
    return true;
  }

  // ── Save request to Firestore ────────────────────────────────────────────
  async saveRequest(note) {
    if (!this.selectedTutor || !this.activeUser) return;

    const studentEmail = this.activeUser.email.toLowerCase();
    const studentName  = this.activeUser.displayName || this.activeUser.email;
    const tutorEmail   = String(this.selectedTutor.email || "").toLowerCase();
    const tutorName    = this.selectedTutor.name;
    const nowIso       = new Date().toISOString();

    // Ensure student record exists
    const stuSnap = await getDocs(query(
      collection(db, "students"),
      where("email", "==", studentEmail),
      limit(1)
    ));
    if (stuSnap.empty) {
      await setDoc(doc(db, "students", studentEmail), {
        id:        studentEmail,
        email:     this.activeUser.email,
        name:      studentName,
        joinedAt:  nowIso,
        status:    "active",
        assignedTutors: [],
      });
    }

    // Add request doc
    const reqRef = await addDoc(collection(db, "requests"), {
      tutorId:        this.selectedTutor.id,
      tutorName,
      tutorEmail,
      subject:        this.selectedTutor.subjectLabel,
      studentEmail:   this.activeUser.email,
      studentName,
      note,
      createdAt:      nowIso,
      respondBy:      new Date(Date.now() + 86400000).toISOString(),
      status:         "waiting_tutor",
      pricePerSession: Number(this.selectedTutor.price || 0),
      sessionHours:   Number(this.selectedTutor.sessionHours || 2),
      monthlySessions: 8,
    });

    // Push notifications
    const pushNote = (userEmail, text, type, payload = {}) =>
      addDoc(collection(db, "notifications"), {
        userEmail: userEmail.toLowerCase(),
        text, type, payload,
        read: false, createdAt: nowIso,
      }).catch(() => {});

    await pushNote(tutorEmail,
      `Bạn có yêu cầu mới từ ${studentName} cho môn ${this.selectedTutor.subjectLabel}.`,
      "tutor-request", { requestId: reqRef.id });

    await pushNote(studentEmail,
      `Bạn đã gửi yêu cầu đến gia sư ${tutorName}.`,
      "student-request", { requestId: reqRef.id });

    const [adminEmail, modSnap] = await Promise.all([
      this.getAdminEmail(),
      this.getModeratorEmails(),
    ]);
    for (const email of [...new Set([adminEmail, ...modSnap])]) {
      await pushNote(email,
        `Học viên ${studentName} đã gửi yêu cầu đến gia sư ${tutorName}.`,
        "admin-request", { requestId: reqRef.id, tutorEmail, studentEmail });
    }

    window.dispatchEvent(new Event("edubridge-notifications-updated"));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  async getAdminEmail() {
    try {
      const s = await getDoc(doc(db, "settings", "edubridge_admin_email"));
      return (s.exists() ? s.data().value : DEFAULT_ADMIN).trim().toLowerCase();
    } catch { return DEFAULT_ADMIN; }
  }

  async getModeratorEmails() {
    try {
      const s = await getDoc(doc(db, "settings", "edubridge_moderator_emails"));
      const v = s.exists() ? s.data().value : [];
      return Array.isArray(v) ? v.map(e => String(e).trim().toLowerCase()).filter(Boolean) : [];
    } catch { return []; }
  }

  showToast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)",
      background: "var(--ink-100)", color: "white",
      padding: "12px 22px", borderRadius: "999px",
      fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "600",
      boxShadow: "var(--shadow-xl)", zIndex: "2000",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ── Sticky header ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  new TutorBrowser();

  const hdr = document.getElementById("site-header");
  if (hdr) {
    window.addEventListener("scroll", () =>
      hdr.classList.toggle("scrolled", window.scrollY > 10), { passive: true });
  }
});