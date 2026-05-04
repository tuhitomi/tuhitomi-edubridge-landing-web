/**
 * EduBridge — Review System
 * Collection: "reviews"
 * Schema: { id, tutorEmail, studentEmail, studentName,
 *           rating (1-5), comment, requestId, createdAt, isPublic }
 *
 * Firestore indexes needed:
 *   reviews: tutorEmail ASC + createdAt DESC
 *   reviews: tutorEmail ASC + isPublic ASC + createdAt DESC
 */
import {
  addDoc, collection, doc, getDoc, getDocs,
  query, where, orderBy, limit,
  serverTimestamp, updateDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-config.js";

/* ─────────────────────────────────────────────
   WRITE — submit a new review
───────────────────────────────────────────── */
export async function submitReview({ tutorEmail, studentEmail, studentName, rating, comment, requestId }) {
  if (!tutorEmail || !studentEmail || !rating) throw new Error("Thiếu thông tin đánh giá.");
  if (rating < 1 || rating > 5) throw new Error("Điểm đánh giá phải từ 1–5.");

  // Prevent duplicate review for same request
  if (requestId) {
    const dup = await getDocs(query(
      collection(db, "reviews"),
      where("requestId", "==", String(requestId)),
      where("studentEmail", "==", studentEmail.toLowerCase()),
      limit(1)
    ));
    if (!dup.empty) throw new Error("Bạn đã đánh giá gia sư này rồi.");
  }

  const reviewData = {
    tutorEmail:   tutorEmail.toLowerCase().trim(),
    studentEmail: studentEmail.toLowerCase().trim(),
    studentName:  studentName || "Học viên ẩn danh",
    rating:       Number(rating),
    comment:      (comment || "").trim().slice(0, 1000),
    requestId:    requestId ? String(requestId) : null,
    createdAt:    new Date().toISOString(),
    isPublic:     true,
  };

  const ref = await addDoc(collection(db, "reviews"), reviewData);

  // Recalculate avgRating + reviewCount on tutor doc
  await recalcTutorRating(tutorEmail.toLowerCase());

  return ref.id;
}

/* ─────────────────────────────────────────────
   READ — get reviews for one tutor
───────────────────────────────────────────── */
export async function getTutorReviews(tutorEmail, maxCount = 20) {
  const email = tutorEmail.toLowerCase().trim();
  try {
    const snap = await getDocs(query(
      collection(db, "reviews"),
      where("tutorEmail", "==", email),
      where("isPublic", "==", true),
      orderBy("createdAt", "desc"),
      limit(maxCount)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback without compound index
    const snap = await getDocs(query(
      collection(db, "reviews"),
      where("tutorEmail", "==", email),
      limit(maxCount)
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.isPublic !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/* ─────────────────────────────────────────────
   CALC — recompute avgRating on tutor_registrations
───────────────────────────────────────────── */
export async function recalcTutorRating(tutorEmail) {
  const email = tutorEmail.toLowerCase().trim();
  const snap = await getDocs(query(
    collection(db, "reviews"),
    where("tutorEmail", "==", email),
    where("isPublic", "==", true)
  ));

  const reviews = snap.docs.map(d => d.data());
  if (reviews.length === 0) return;

  const avg = reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;

  // Find tutor doc by email
  const tutorSnap = await getDocs(query(
    collection(db, "tutor_registrations"),
    where("email", "==", email),
    limit(1)
  ));
  if (tutorSnap.empty) return;

  await updateDoc(tutorSnap.docs[0].ref, {
    avgRating:   Math.round(avg * 10) / 10,
    reviewCount: reviews.length,
  });
}

/* ─────────────────────────────────────────────
   UI — render star picker (interactive)
───────────────────────────────────────────── */
export function renderStarPicker(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let selected = 0;

  container.innerHTML = `
    <div class="star-picker" role="radiogroup" aria-label="Chọn điểm đánh giá">
      ${[1,2,3,4,5].map(n => `
        <button type="button" class="star-btn" data-value="${n}" aria-label="${n} sao">★</button>
      `).join("")}
    </div>
    <span class="star-picker-label">Chạm vào sao để chọn điểm</span>
  `;

  const btns = container.querySelectorAll(".star-btn");

  function paint(hovered) {
    btns.forEach(b => {
      const v = Number(b.dataset.value);
      b.classList.toggle("active", v <= (hovered || selected));
    });
  }

  btns.forEach(btn => {
    btn.addEventListener("mouseenter", () => paint(Number(btn.dataset.value)));
    btn.addEventListener("mouseleave", () => paint(0));
    btn.addEventListener("click", () => {
      selected = Number(btn.dataset.value);
      paint(0);
      const label = container.querySelector(".star-picker-label");
      const labels = ["", "Rất tệ", "Không tốt", "Bình thường", "Tốt", "Xuất sắc"];
      if (label) label.textContent = labels[selected] || "";
      if (onChange) onChange(selected);
    });
  });

  return { getValue: () => selected };
}

/* ─────────────────────────────────────────────
   UI — render review cards list
───────────────────────────────────────────── */
export function renderReviewCards(reviews, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="reviews-empty">
        <div class="reviews-empty-icon">💬</div>
        <p>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
      </div>`;
    return;
  }

  container.innerHTML = reviews.map(r => renderOneReview(r)).join("");
}

export function renderOneReview(r) {
  const stars = "★".repeat(Math.max(0, Math.min(5, r.rating || 0)))
              + "☆".repeat(5 - Math.max(0, Math.min(5, r.rating || 0)));
  const time = r.createdAt
    ? new Date(r.createdAt).toLocaleDateString("vi-VN", { day:"numeric", month:"long", year:"numeric" })
    : "";
  const initials = (r.studentName || "?").trim().split(/\s+/).slice(-2)
                     .map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return `
    <article class="review-card">
      <div class="review-header">
        <div class="review-avatar">${initials}</div>
        <div class="review-meta">
          <span class="review-name">${r.studentName || "Học viên"}</span>
          <span class="review-time">${time}</span>
        </div>
        <div class="review-stars">${stars}</div>
      </div>
      ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ""}
    </article>`;
}

/* ─────────────────────────────────────────────
   UI — render rating summary bar chart
───────────────────────────────────────────── */
export function renderRatingSummary(reviews, containerId) {
  const container = document.getElementById(containerId);
  if (!container || reviews.length === 0) return;

  const total = reviews.length;
  const avg   = reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / total;
  const counts = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }));

  const stars5 = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));

  container.innerHTML = `
    <div class="rating-summary">
      <div class="rating-big">
        <span class="rating-number">${avg.toFixed(1)}</span>
        <div class="rating-stars-big">${stars5}</div>
        <span class="rating-count">${total} đánh giá</span>
      </div>
      <div class="rating-bars">
        ${counts.map(({ star, count }) => `
          <div class="rating-bar-row">
            <span class="rating-bar-label">${star}★</span>
            <div class="rating-bar-track">
              <div class="rating-bar-fill" style="width:${total > 0 ? Math.round(count/total*100) : 0}%"></div>
            </div>
            <span class="rating-bar-count">${count}</span>
          </div>`).join("")}
      </div>
    </div>`;
}
