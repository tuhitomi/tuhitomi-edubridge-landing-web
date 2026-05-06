import { collection, doc, setDoc, getDocs, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-config.js";

const S = "seed_";
const ago = n => new Date(Date.now() - n * 864e5).toISOString();
const day = n => ago(n).split("T")[0];
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

// ── 6 Gia sư ───────────────────────────────────────────────────────────────
const TUTORS = [
  { id: S+"t01", email: "nguyenvana.tutor@example.com", name: "Nguyễn Văn An", subject: "Toán", level: "Đại học / Cao đẳng", experience: "5 năm kinh nghiệm dạy Toán lớp 10-12, luyện thi đại học.", location: "Quận 1, TP. Hồ Chí Minh", availableTime: "Thứ 2-6: 18h-21h", price: 300000, sessionHours: 2, gender: "male" },
  { id: S+"t02", email: "tranthib.tutor@example.com", name: "Trần Thị Bình", subject: "Tiếng Anh", level: "IELTS 8.0 / Cử nhân Ngôn ngữ Anh", experience: "3 năm dạy IELTS, TOEIC. Tập trung Speaking & Writing.", location: "Online", availableTime: "Linh hoạt, hẹn trước 1 ngày", price: 350000, sessionHours: 1.5, gender: "female" },
  { id: S+"t03", email: "levancuong.tutor@example.com", name: "Lê Văn Cường", subject: "Vật Lý, Hóa Học", level: "Thạc sĩ Vật Lý", experience: "7 năm giảng dạy, chuyên ôn thi THPT Quốc gia Lý-Hóa.", location: "Quận Cầu Giấy, Hà Nội", availableTime: "Thứ 3, 5, 7: 19h-21h", price: 280000, sessionHours: 2, gender: "male" },
  { id: S+"t04", email: "phamthidung.tutor@example.com", name: "Phạm Thị Dung", subject: "Ngữ Văn", level: "Cử nhân Sư phạm Văn", experience: "4 năm dạy Văn lớp 9-12. Viết luận sáng tạo.", location: "Quận 7, TP. Hồ Chí Minh", availableTime: "Thứ 2, 4, 6: 17h30-19h30", price: 250000, sessionHours: 2, gender: "female" },
  { id: S+"t05", email: "hoangminhe.tutor@example.com", name: "Hoàng Minh Ê", subject: "Tin Học, Lập Trình", level: "Kỹ sư CNTT", experience: "6 năm dạy Python, JavaScript, C++ cho THPT và SV.", location: "Online", availableTime: "CN cả ngày, ngày thường sau 20h", price: 400000, sessionHours: 1.5, gender: "male" },
  { id: S+"t06", email: "dangthiphuong.tutor@example.com", name: "Đặng Thị Phương", subject: "Toán, Tiếng Anh", level: "SV năm 4 - ĐH Sư Phạm", experience: "2 năm dạy kèm Toán và Tiếng Anh lớp 6-9.", location: "Quận Thanh Xuân, Hà Nội", availableTime: "Thứ 2-7: 8h-11h, 14h-17h", price: 200000, sessionHours: 2, gender: "female" },
].map(t => ({ ...t, rating: 4, reviewCount: 0, activeState: "available", status: "approved", rejectReason: "", submittedAt: ago(30), updatedAt: ago(0) }));

// ── 15 Học viên ─────────────────────────────────────────────────────────────
const STUDENT_NAMES = [
  "Nguyễn Minh Tuấn","Trần Thanh Hà","Lê Hoàng Nam","Phạm Thị Lan Anh","Vũ Đức Huy",
  "Đỗ Mai Linh","Bùi Quang Khải","Ngô Thị Hương","Dương Văn Phúc","Hoàng Thị Yến",
  "Tô Minh Đức","Lý Ngọc Trâm","Mai Xuân Bách","Đinh Thị Thu","Cao Trung Kiên",
];
const STUDENTS = STUDENT_NAMES.map((name, i) => ({
  id: S + `s${String(i+1).padStart(2,"0")}`,
  email: `seed_hv${String(i+1).padStart(2,"0")}@example.com`,
  name, joinedAt: ago(25 - i), status: "active", assignedTutors: [],
}));

// ── Bình luận mẫu cho reviews ───────────────────────────────────────────────
const COMMENTS = {
  5: [
    "Dạy rất tuyệt vời, con tôi tiến bộ rõ rệt! Cảm ơn thầy/cô rất nhiều.",
    "Phương pháp dạy dễ hiểu, kiên nhẫn. Con từ sợ môn này giờ rất thích học.",
    "Gia sư cực kỳ tận tâm, chuẩn bị bài kỹ lưỡng. Recommend 100%!",
    "Sau 2 tháng học, điểm con tăng từ 5 lên 8.5. Rất hài lòng!",
    "Dạy online mà vẫn rất hiệu quả, tương tác tốt. 5 sao xứng đáng.",
    "Thầy/cô giải thích từng bước rất rõ ràng, con hiểu bài ngay.",
    "Kiến thức chuyên sâu, bài tập phong phú, con rất thích học.",
  ],
  4: [
    "Dạy tốt, tận tâm. Chỉ tiếc lịch hơi khó sắp xếp thôi.",
    "Phương pháp hay, kiến thức vững. Mong thầy/cô cho thêm bài tập về nhà.",
    "Con tiến bộ nhiều, nhưng tốc độ dạy hơi nhanh với con yếu.",
    "Tài liệu chuẩn bị rất kỹ, bài giảng dễ hiểu. Nhìn chung rất tốt.",
    "Dạy nhiệt tình, nhưng đôi khi trễ giờ một chút.",
  ],
  3: [
    "Dạy bình thường, cần cải thiện thêm phương pháp giảng dạy.",
    "Kiến thức ổn nhưng cách truyền đạt chưa cuốn hút lắm.",
  ],
};

// ── Nhận xét cho kết quả học tập ────────────────────────────────────────────
const RESULT_COMMENTS = {
  high: [
    "Xuất sắc! Nắm vững kiến thức, làm bài nhanh và chính xác.",
    "Rất tốt, tiến bộ rõ rệt so với buổi trước.",
    "Hoàn thành bài tập tốt, tư duy logic mạnh.",
    "Điểm cao, chỉ cần luyện thêm phần nâng cao.",
  ],
  mid: [
    "Nắm được lý thuyết, cần luyện thêm bài tập tổng hợp.",
    "Tiến bộ nhưng cần chú ý hơn phần trình bày.",
    "Ổn, cần cải thiện tốc độ làm bài.",
    "Hiểu bài nhưng hay nhầm lẫn ở bước cuối.",
  ],
  low: [
    "Cần ôn lại kiến thức cơ bản, làm thêm bài tập về nhà.",
    "Chưa nắm vững, cần xem lại lý thuyết tuần này.",
  ],
};

// ── Sinh reviews: mỗi gia sư 5-10 đánh giá ────────────────────────────────
function generateReviews() {
  const reviews = [];
  let idx = 0;
  for (const tutor of TUTORS) {
    const count = 5 + Math.floor(Math.random() * 6); // 5-10
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let si;
      do { si = Math.floor(Math.random() * STUDENTS.length); } while (used.has(si) && used.size < STUDENTS.length);
      used.add(si);
      const student = STUDENTS[si];
      const rating = pick([5,5,5,5,4,4,4,3]); // weighted toward 4-5
      const comment = pick(COMMENTS[rating]);
      idx++;
      reviews.push({
        id: S + `rv${String(idx).padStart(3,"0")}`,
        tutorEmail: tutor.email,
        studentEmail: student.email,
        studentName: student.name,
        rating, comment,
        requestId: null,
        createdAt: ago(Math.floor(Math.random() * 25) + 1),
        isPublic: true,
      });
    }
  }
  return reviews;
}

// ── Sinh learning results: mỗi gia sư 5-10 kết quả, học viên học nhiều môn ─
function generateResults() {
  const results = [];
  let idx = 0;
  const subjectMap = {
    "Toán": ["Hàm số","Đạo hàm","Tích phân","Hình học","Xác suất"],
    "Tiếng Anh": ["Speaking","Writing","Reading","Listening","Grammar"],
    "Vật Lý, Hóa Học": ["Động lực học","Điện từ","Hóa hữu cơ","Nhiệt học","Hóa vô cơ"],
    "Ngữ Văn": ["Nghị luận XH","Phân tích thơ","Truyện ngắn","Văn biểu cảm","Đọc hiểu"],
    "Tin Học, Lập Trình": ["Python cơ bản","JavaScript","HTML/CSS","Thuật toán","C++"],
    "Toán, Tiếng Anh": ["Toán lớp 8","Toán lớp 9","Anh ngữ giao tiếp","Anh ngữ ngữ pháp","Toán hình học"],
  };
  for (const tutor of TUTORS) {
    const count = 5 + Math.floor(Math.random() * 6);
    const topics = subjectMap[tutor.subject] || [tutor.subject];
    for (let i = 0; i < count; i++) {
      const student = pick(STUDENTS);
      const topic = pick(topics);
      const score = rand(5, 10);
      const bucket = score >= 8 ? "high" : score >= 6.5 ? "mid" : "low";
      idx++;
      results.push({
        id: S + `rs${String(idx).padStart(3,"0")}`,
        requestId: S + `rq_${tutor.id}_${student.id}`,
        tutorEmail: tutor.email,
        tutorName: tutor.name,
        studentEmail: student.email,
        subject: topic,
        sessionDate: day(Math.floor(Math.random() * 20) + 1),
        score,
        comment: pick(RESULT_COMMENTS[bucket]),
        createdAt: ago(Math.floor(Math.random() * 20) + 1),
      });
    }
  }
  return results;
}

// ── Log ─────────────────────────────────────────────────────────────────────
const logEl = document.getElementById("log");
function log(text, cls = "log-info") {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = `[${new Date().toLocaleTimeString("vi-VN")}] ${text}`;
  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Seed functions ──────────────────────────────────────────────────────────
async function seedTutors() {
  log("Thêm 6 gia sư…");
  for (const t of TUTORS) {
    await setDoc(doc(db, "tutor_registrations", t.id), { ...t });
    log(`  ✓ ${t.name}`, "log-ok");
  }
  log(`Hoàn tất ${TUTORS.length} gia sư.`, "log-ok");
}

async function seedStudents() {
  log("Thêm 15 học viên…");
  for (const s of STUDENTS) {
    await setDoc(doc(db, "students", s.id), { ...s });
    log(`  ✓ ${s.name}`, "log-ok");
  }
  log(`Hoàn tất ${STUDENTS.length} học viên.`, "log-ok");
}

async function seedReviews() {
  const reviews = generateReviews();
  log(`Thêm ${reviews.length} đánh giá (5-10/gia sư)…`);
  for (const r of reviews) {
    await setDoc(doc(db, "reviews", r.id), { ...r });
  }
  // Summary per tutor
  for (const t of TUTORS) {
    const cnt = reviews.filter(r => r.tutorEmail === t.email).length;
    const avg = reviews.filter(r => r.tutorEmail === t.email).reduce((s, r) => s + r.rating, 0) / cnt;
    log(`  ✓ ${t.name}: ${cnt} đánh giá, TB ${avg.toFixed(1)}★`, "log-ok");
    // Update tutor avgRating + reviewCount
    await setDoc(doc(db, "tutor_registrations", t.id), { ...t, avgRating: Math.round(avg * 10) / 10, reviewCount: cnt }, { merge: true });
  }
  log(`Hoàn tất ${reviews.length} đánh giá.`, "log-ok");
}

async function seedResults() {
  const results = generateResults();
  log(`Thêm ${results.length} kết quả học tập (5-10/gia sư)…`);
  for (const r of results) {
    await setDoc(doc(db, "learning_results", r.id), { ...r });
  }
  for (const t of TUTORS) {
    const cnt = results.filter(r => r.tutorEmail === t.email).length;
    log(`  ✓ ${t.name}: ${cnt} kết quả`, "log-ok");
  }
  log(`Hoàn tất ${results.length} kết quả học tập.`, "log-ok");
}

async function clearSeedData() {
  log("Đang xóa dữ liệu mẫu…", "log-warn");
  for (const [col, label] of [["tutor_registrations","gia sư"],["students","học viên"],["reviews","đánh giá"],["learning_results","kết quả"]]) {
    const snap = await getDocs(collection(db, col));
    let n = 0;
    for (const d of snap.docs) { if (d.id.startsWith(S)) { await deleteDoc(d.ref); n++; } }
    log(`  Xóa ${n} ${label} mẫu.`, "log-warn");
  }
  log("Hoàn tất xóa.", "log-ok");
}

// ── Buttons ─────────────────────────────────────────────────────────────────
const dis = s => document.querySelectorAll("button").forEach(b => b.disabled = s);

document.getElementById("btn-tutors").addEventListener("click", async () => { dis(true); await seedTutors(); dis(false); });
document.getElementById("btn-students").addEventListener("click", async () => { dis(true); await seedStudents(); dis(false); });
document.getElementById("btn-reviews").addEventListener("click", async () => { dis(true); await seedReviews(); dis(false); });
document.getElementById("btn-results").addEventListener("click", async () => { dis(true); await seedResults(); dis(false); });
document.getElementById("btn-both").addEventListener("click", async () => {
  dis(true);
  await seedTutors();
  await seedStudents();
  await seedReviews();
  await seedResults();
  log("🎉 Đã thêm tất cả dữ liệu mẫu!", "log-ok");
  dis(false);
});
document.getElementById("btn-clear").addEventListener("click", async () => {
  if (!confirm("Xóa tất cả dữ liệu mẫu?")) return;
  dis(true); await clearSeedData(); dis(false);
});

log("Sẵn sàng. Nhấn nút để thêm dữ liệu mẫu.", "log-info");
