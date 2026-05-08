import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, doc, getDocs, setDoc, getDoc, addDoc, updateDoc, query, where, limit, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

var form = document.getElementById("profile-form");
var nameInput = document.getElementById("profile-name");
var emailInput = document.getElementById("profile-email");
var statusEl = document.getElementById("profile-status");
var logoutBtn = document.getElementById("logout-btn");
var tutorStatusNoteEl = document.getElementById("tutor-status-note");
var tutorNameEl = document.getElementById("tutor-name");
var tutorSubjectEl = document.getElementById("tutor-subject");
var tutorLevelEl = document.getElementById("tutor-level");
var tutorExperienceEl = document.getElementById("tutor-experience");
var tutorLocationEl = document.getElementById("tutor-location");
var tutorAvailableTimeEl = document.getElementById("tutor-available-time");
var tutorPriceEl = document.getElementById("tutor-price");
var tutorSessionHoursEl = document.getElementById("tutor-session-hours");
var tutorGenderEl = document.getElementById("tutor-gender");
var tutorActiveStateEl = document.getElementById("tutor-active-state");
var saveTutorProfileBtn = document.getElementById("save-tutor-profile-btn");
var sentHistoryEl = document.getElementById("sent-history");
var receivedHistoryEl = document.getElementById("received-history");
var walletNoteEl = document.getElementById("wallet-note");
var withdrawBtn = document.getElementById("withdraw-btn");
var disputeSelectEl = document.getElementById("dispute-request-id");
var disputeReasonEl = document.getElementById("dispute-reason");
var createDisputeBtn = document.getElementById("create-dispute-btn");
var currentUser = null;
var SERVICE_FEE = 50000;
var scheduleUnsubscribes = [];

// ── Schedule & Results DOM refs ──
var scheduleSection = document.getElementById("tutor-schedule-section");
var scheduleList = document.getElementById("teaching-schedule");
var scheduleCountEl = document.getElementById("schedule-count");
var studentScheduleSection = document.getElementById("student-schedule-section");
var studentScheduleList = document.getElementById("student-schedule-list");
var studentScheduleCountEl = document.getElementById("student-schedule-count");
var updateResultsSection = document.getElementById("tutor-update-results-section");
var resultRequestSelect = document.getElementById("result-request-select");
var resultSessionDate = document.getElementById("result-session-date");
var resultScore = document.getElementById("result-score");
var resultCommentEl = document.getElementById("result-comment");
var saveResultBtn = document.getElementById("save-result-btn");
var resultStatusEl = document.getElementById("result-status");
var studentResultsSection = document.getElementById("student-results-section");
var resultsContainer = document.getElementById("learning-results-container");
var resultsCountEl = document.getElementById("results-count");

function setStatus(message) {
  statusEl.textContent = message;
}

// ── Firestore helpers (single-doc operations, no delete-all/rewrite-all) ──

async function readRequests() {
  try {
    const snapshot = await getDocs(collection(db, 'requests'));
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return { ...data, id: docSnap.id };
    });
  } catch (e) {
    return [];
  }
}

async function readRequestsForUser(email) {
  var normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return [];

  try {
    var sentQuery = query(collection(db, 'requests'), where('studentEmail', '==', normalizedEmail));
    var receivedQuery = query(collection(db, 'requests'), where('tutorEmail', '==', normalizedEmail));
    var results = await Promise.all([getDocs(sentQuery), getDocs(receivedQuery)]);
    var byId = {};

    results.forEach(function (snapshot) {
      snapshot.docs.forEach(function (docSnap) {
        byId[docSnap.id] = { ...docSnap.data(), id: docSnap.id };
      });
    });

    return Object.keys(byId).map(function (id) {
      return byId[id];
    });
  } catch (e) {
    console.warn('Cannot read user requests', e);
    return [];
  }
}

async function readTutorRequests(email) {
  var normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return [];

  try {
    var snapshot = await getDocs(query(collection(db, 'requests'), where('tutorEmail', '==', normalizedEmail)));
    return snapshot.docs.map(function (docSnap) {
      return { ...docSnap.data(), id: docSnap.id };
    });
  } catch (e) {
    console.warn('Cannot read tutor requests', e);
    return [];
  }
}

async function updateRequestById(requestId, updates) {
  await updateDoc(doc(db, 'requests', String(requestId)), updates);
}

async function readTutorRegistrations() {
  try {
    const snapshot = await getDocs(collection(db, 'tutor_registrations'));
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return { ...data, id: docSnap.id };
    });
  } catch (e) {
    return [];
  }
}

async function findTutorDocByEmail(email) {
  const q = query(collection(db, 'tutor_registrations'), where('email', '==', String(email).toLowerCase()), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

async function readWallets() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'wallets'));
    if (!docSnap.exists()) {
      return { adminRevenue: 0, tutorBalances: {} };
    }
    const data = docSnap.data() || {};
    if (data.value && typeof data.value === "object") {
      return {
        adminRevenue: Number(data.value.adminRevenue || 0),
        tutorBalances: data.value.tutorBalances || {}
      };
    }
    return {
      adminRevenue: Number(data.adminRevenue || 0),
      tutorBalances: data.tutorBalances || {}
    };
  } catch (e) {
    return { adminRevenue: 0, tutorBalances: {} };
  }
}

async function writeWallets(wallets) {
  await setDoc(doc(db, 'settings', 'wallets'), {
    adminRevenue: Number(wallets.adminRevenue || 0),
    tutorBalances: wallets.tutorBalances || {}
  });
}

async function readWithdrawals() {
  try {
    const snapshot = await getDocs(collection(db, 'withdrawals'));
    return snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
  } catch (e) {
    return [];
  }
}

async function readDisputes() {
  try {
    const snapshot = await getDocs(collection(db, 'disputes'));
    return snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
  } catch (e) {
    return [];
  }
}

async function getAdminEmail() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'edubridge_admin_email'));
    return (docSnap.exists() ? docSnap.data().value : "tu620014@gmail.com").trim().toLowerCase();
  } catch (e) {
    return "tu620014@gmail.com";
  }
}

async function getModeratorEmails() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'edubridge_moderator_emails'));
    const emails = docSnap.exists() ? docSnap.data().value : [];
    if (!Array.isArray(emails)) return [];
    return emails.map(email => String(email || "").trim().toLowerCase()).filter(email => email);
  } catch (e) {
    return [];
  }
}

async function getReviewerEmails() {
  var adminEmail = await getAdminEmail();
  var moderators = await getModeratorEmails();
  var all = [adminEmail].concat(moderators).map(function (item) {
    return String(item || "").trim().toLowerCase();
  });
  return all.filter(function (item, index, arr) {
    return item && arr.indexOf(item) === index;
  });
}

// ── UI helpers ──

function formatTutorStatus(status) {
  if (status === "approved") return "Đã duyệt (đang hiển thị trên bảng tìm gia sư)";
  if (status === "rejected") return "Bị từ chối (vui lòng cập nhật hồ sơ theo lý do và gửi lại)";
  return "Đang chờ admin duyệt";
}

function requestStatusLabel(status) {
  if (status === "waiting_tutor") return "Đang chờ gia sư phản hồi";
  if (status === "declined") return "Gia sư đã từ chối";
  if (status === "expired") return "Quá hạn phản hồi 24h";
  if (status === "accepted_waiting_funds") return "Đã chấp nhận - chờ nạp tiền";
  if (status === "in_teaching") return "Đang học";
  if (status === "completed") return "Hoàn thành";
  if (status === "refunded") return "Đã hoàn tiền";
  return "Chưa xác định";
}

function requestStatusClass(status) {
  if (status === "waiting_tutor") return "status-waiting";
  if (status === "accepted_waiting_funds") return "status-pending-funds";
  if (status === "in_teaching") return "status-teaching";
  if (status === "completed") return "status-completed";
  if (status === "declined" || status === "expired") return "status-declined";
  if (status === "refunded") return "status-refunded";
  return "status-default";
}

async function getTutorProfileByEmail(email) {
  var tutorDoc = await findTutorDocByEmail(email);
  if (!tutorDoc) return null;
  return { ...tutorDoc.data(), id: tutorDoc.id };
}

async function renderTutorProfile(email) {
  var profile = await getTutorProfileByEmail(email);
  if (!profile) {
    tutorStatusNoteEl.textContent = "Bạn chưa gửi hồ sơ gia sư. Hãy điền thông tin và bấm Lưu hồ sơ gia sư để gửi admin duyệt.";
    tutorNameEl.value = nameInput.value || "";
    tutorSubjectEl.value = "";
    tutorLevelEl.value = "";
    tutorExperienceEl.value = "";
    tutorLocationEl.value = "";
    tutorAvailableTimeEl.value = "";
    tutorPriceEl.value = "";
    tutorSessionHoursEl.value = "";
    tutorGenderEl.value = "female";
    tutorActiveStateEl.value = "available";
    return;
  }

  var rejectReason = profile.status === "rejected" && profile.rejectReason
    ? " • Lý do: " + profile.rejectReason
    : "";
  tutorStatusNoteEl.textContent = "Trạng thái hồ sơ: " + formatTutorStatus(profile.status || "pending") + rejectReason;
  tutorNameEl.value = profile.name || "";
  tutorSubjectEl.value = profile.subject || "";
  tutorLevelEl.value = profile.level || "";
  tutorExperienceEl.value = profile.experience || "";
  tutorLocationEl.value = profile.location || "";
  tutorAvailableTimeEl.value = profile.availableTime || "";
  tutorPriceEl.value = profile.price ? Number(profile.price) : "";
  tutorSessionHoursEl.value = profile.sessionHours ? Number(profile.sessionHours) : "";
  tutorGenderEl.value = profile.gender || "female";
  tutorActiveStateEl.value = profile.activeState || "available";
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch (e) {
    return "";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isConnectedRequest(item) {
  return item.status === "accepted_waiting_funds" || item.status === "in_teaching";
}

function formatDateInput(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function buildDefaultWeeklySchedule() {
  var labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var days = [];

  for (var i = 0; i < 7; i++) {
    var date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      date: formatDateInput(date),
      label: labels[date.getDay()],
      content: ""
    });
  }
  return days;
}

function normalizeWeeklySchedule(schedule) {
  var defaults = buildDefaultWeeklySchedule();
  if (!Array.isArray(schedule)) return defaults;

  return defaults.map(function (day, index) {
    var saved = schedule[index] || {};
    return {
      date: saved.date || day.date,
      label: saved.label || day.label,
      content: String(saved.content || "")
    };
  });
}

function formatScheduleDate(value) {
  try {
    return new Date(value + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch (e) {
    return value || "";
  }
}

function renderWeeklyScheduleTable(item, editable) {
  var schedule = normalizeWeeklySchedule(item.weeklySchedule);
  var cells = schedule.map(function (day, index) {
    var content = escapeHtml(day.content);
    if (editable) {
      return (
        '<td>' +
        '<textarea class="weekly-schedule-input" data-day-index="' + index + '" rows="4" placeholder="Giờ học, nội dung, ghi chú...">' + content + '</textarea>' +
        '</td>'
      );
    }
    return '<td><div class="weekly-schedule-readonly">' + (content ? content.replace(/\n/g, "<br>") : '<span>Chưa cập nhật</span>') + '</div></td>';
  }).join("");

  var headers = schedule.map(function (day) {
    return '<th><span>' + escapeHtml(day.label) + '</span><small>' + escapeHtml(formatScheduleDate(day.date)) + '</small></th>';
  }).join("");

  return (
    '<div class="weekly-schedule-wrap">' +
    '<table class="weekly-schedule-table">' +
    '<thead><tr>' + headers + '</tr></thead>' +
    '<tbody><tr>' + cells + '</tr></tbody>' +
    '</table>' +
    '</div>'
  );
}

function renderConnectedScheduleCard(item, mode) {
  var isTutor = mode === "tutor";
  var counterpartLabel = isTutor ? "Học viên" : "Gia sư";
  var counterpartName = isTutor ? (item.studentName || "Học viên") : (item.tutorName || "Gia sư");
  var updatedAt = item.weeklyScheduleUpdatedAt ? '<small>Cập nhật: ' + formatTime(item.weeklyScheduleUpdatedAt) + '</small>' : "";
  var saveButton = isTutor
    ? '<div class="weekly-schedule-actions"><button type="button" class="btn btn-primary btn-sm save-weekly-schedule-btn" data-id="' + item.id + '">Lưu lịch 7 ngày</button><span class="weekly-schedule-status" data-id="' + item.id + '"></span></div>'
    : "";

  return (
    '<li class="schedule-card weekly-schedule-card" data-request-id="' + item.id + '">' +
    '<div class="schedule-card-body">' +
    '<div class="sc-name">' + escapeHtml(counterpartLabel + ": " + counterpartName) + '</div>' +
    '<div class="sc-detail"><strong>Môn:</strong> ' + escapeHtml(item.subject || "—") + ' · <strong>Trạng thái:</strong> ' + escapeHtml(requestStatusLabel(item.status)) + '</div>' +
    updatedAt +
    renderWeeklyScheduleTable(item, isTutor) +
    saveButton +
    '</div>' +
    '</li>'
  );
}

// ── FIX: renderHistories — update expired individually, not rewrite-all ──

async function renderHistories(email) {
  email = String(email || "").trim().toLowerCase();
  var requests = await readRequestsForUser(email);
  // Update expired requests individually
  for (var i = 0; i < requests.length; i++) {
    if (String(requests[i].tutorEmail || "").toLowerCase() === email && requests[i].status === "waiting_tutor" && requests[i].respondBy && new Date(requests[i].respondBy).getTime() < Date.now()) {
      requests[i].status = "expired";
      try { await updateRequestById(requests[i].id, { status: "expired" }); } catch (e) { console.warn('Cannot update expired', e); }
    }
  }
  var sent = requests.filter(function (item) {
    return String(item.studentEmail || "").toLowerCase() === email;
  });
  var received = requests.filter(function (item) {
    return String(item.tutorEmail || "").toLowerCase() === email;
  });
  var disputable = requests.filter(function (item) {
    var involved = item.studentEmail === email || item.tutorEmail === email;
    var refundable = item.status === "in_teaching" || item.status === "accepted_waiting_funds";
    return involved && refundable;
  });

  sentHistoryEl.innerHTML = sent.length
    ? sent.map(function (item) {
        var payButton = item.status === "accepted_waiting_funds"
          ? '<div class="request-modal-actions"><button type="button" class="btn btn-primary pay-hold-btn" data-id="' + item.id + '">Nạp tiền vào ví trung gian</button></div>'
          : "";
        return '<li class="history-item"><strong>Gia sư:</strong> ' + item.tutorName + '<br><strong>Môn:</strong> ' + item.subject + '<br><strong>Trạng thái:</strong> <span class="status-badge ' + requestStatusClass(item.status) + '">' + requestStatusLabel(item.status) + "</span><br><strong>Ghi chú:</strong> " + (item.note || "Không có") + '<br><small>' + formatTime(item.createdAt) + "</small>" + payButton + "</li>";
      }).join("")
    : '<li class="history-item">Chưa có yêu cầu nào được gửi.</li>';

  receivedHistoryEl.innerHTML = received.length
    ? received.map(function (item) {
        var actionButtons = "";
        if (item.status === "waiting_tutor") {
          actionButtons = '<div class="request-modal-actions"><button type="button" class="btn btn-primary tutor-accept-btn" data-id="' + item.id + '">Chấp nhận</button><button type="button" class="btn btn-secondary tutor-decline-btn" data-id="' + item.id + '">Từ chối</button></div>';
        } else if (item.status === "in_teaching") {
          actionButtons = '<div class="request-modal-actions"><button type="button" class="btn btn-primary tutor-release-btn" data-id="' + item.id + '">Xác nhận hoàn thành tuần đầu</button></div>';
        }
        return '<li class="history-item"><strong>Học viên:</strong> ' + item.studentName + '<br><strong>Môn:</strong> ' + item.subject + '<br><strong>Trạng thái:</strong> <span class="status-badge ' + requestStatusClass(item.status) + '">' + requestStatusLabel(item.status) + "</span><br><strong>Ghi chú:</strong> " + (item.note || "Không có") + '<br><small>' + formatTime(item.createdAt) + "</small>" + actionButtons + "</li>";
      }).join("")
    : '<li class="history-item">Chưa có yêu cầu nào gửi đến bạn.</li>';

  disputeSelectEl.innerHTML = '<option value="">-- Chọn yêu cầu --</option>' + disputable.map(function (item) {
    return '<option value="' + item.id + '">#' + item.id + " - " + item.subject + " (" + requestStatusLabel(item.status) + ")</option>";
  }).join("");

  bindRequestActions(email);
}

// ── FIX: pushNotification — use addDoc (single write) instead of read-all/rewrite-all ──

async function pushNotification(userEmail, text, type, payload) {
  await addDoc(collection(db, 'notifications'), {
    userEmail: String(userEmail || "").toLowerCase(),
    type: type || "general",
    read: false,
    createdAt: new Date().toISOString(),
    text: text,
    payload: payload || {}
  });
  window.dispatchEvent(new Event("edubridge-notifications-updated"));
}

// ── FIX: All button handlers — use string IDs + single-doc getDoc/updateDoc ──

async function bindRequestActions(email) {
  document.querySelectorAll(".tutor-accept-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
      var requestId = button.getAttribute("data-id");
      var snap = await getDoc(doc(db, 'requests', requestId));
      if (!snap.exists() || String(snap.data().tutorEmail || "").toLowerCase() !== email) return;
      var req = snap.data();
      await updateRequestById(requestId, { status: "accepted_waiting_funds", tutorRespondedAt: new Date().toISOString() });
      await pushNotification(req.studentEmail, "Gia sư " + req.tutorName + " đã chấp nhận yêu cầu. Vui lòng nạp tiền để bắt đầu.", "matching-status", { requestId: requestId, status: "accepted_waiting_funds" });
      await renderHistories(email);
      await renderTeachingSchedule(email);
    });
  });

  document.querySelectorAll(".tutor-decline-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
      var requestId = button.getAttribute("data-id");
      var reason = prompt("Lý do từ chối yêu cầu (tùy chọn):", "") || "";
      var snap = await getDoc(doc(db, 'requests', requestId));
      if (!snap.exists() || String(snap.data().tutorEmail || "").toLowerCase() !== email) return;
      var req = snap.data();
      await updateRequestById(requestId, { status: "declined", tutorRespondedAt: new Date().toISOString(), declineReason: reason.trim() });
      await pushNotification(req.studentEmail, "Gia sư " + req.tutorName + " đã từ chối yêu cầu của bạn.", "matching-status", { requestId: requestId, status: "declined" });
      await renderHistories(email);
      await renderStudentSchedule(email);
    });
  });

  document.querySelectorAll(".pay-hold-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
      var requestId = button.getAttribute("data-id");
      var snap = await getDoc(doc(db, 'requests', requestId));
      if (!snap.exists() || String(snap.data().studentEmail || "").toLowerCase() !== email) return;
      var item = snap.data();
      var monthlyTuition = Number(item.pricePerSession || 0) * Number(item.monthlySessions || 8);
      var escrow = {
        holdAmount: monthlyTuition + SERVICE_FEE,
        monthlyTuition: monthlyTuition,
        serviceFee: SERVICE_FEE,
        adminAmount: Math.round(monthlyTuition * 0.3 + SERVICE_FEE),
        tutorAmount: Math.round(monthlyTuition * 0.7),
        heldAt: new Date().toISOString()
      };
      await updateRequestById(requestId, { escrow: escrow, status: "in_teaching" });
      await pushNotification(item.tutorEmail, "Phụ huynh đã nạp tiền vào ví trung gian cho lớp " + item.subject + ". Bạn có thể bắt đầu dạy.", "escrow-update", { requestId: requestId, status: "in_teaching" });
      await renderHistories(email);
      await renderStudentSchedule(email);
    });
  });

  document.querySelectorAll(".tutor-release-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
      var requestId = button.getAttribute("data-id");
      var snap = await getDoc(doc(db, 'requests', requestId));
      if (!snap.exists() || String(snap.data().tutorEmail || "").toLowerCase() !== email) return;
      var item = snap.data();
      if (!item.escrow) return;
      await updateRequestById(requestId, { status: "completed", releasedAt: new Date().toISOString() });

      var wallets = await readWallets();
      wallets.adminRevenue = Number(wallets.adminRevenue || 0) + Number(item.escrow.adminAmount || 0);
      wallets.tutorBalances = wallets.tutorBalances || {};
      wallets.tutorBalances[email] = Number(wallets.tutorBalances[email] || 0) + Number(item.escrow.tutorAmount || 0);
      await writeWallets(wallets);

      await pushNotification(item.studentEmail, "Lớp học với gia sư " + item.tutorName + " đã được hoàn thành và giải ngân thành công.", "escrow-update", { requestId: requestId, status: "completed" });
      await pushNotification(email, "Hệ thống đã giải ngân " + Number(item.escrow.tutorAmount || 0).toLocaleString("vi-VN") + " VND vào ví của bạn.", "escrow-update", { requestId: requestId, status: "completed" });
      await renderHistories(email);
      await renderWalletInfo(email);
    });
  });
}

async function renderWalletInfo(email) {
  var wallets = await readWallets();
  var adminRevenue = Number(wallets.adminRevenue || 0);
  var tutorBalance = Number((wallets.tutorBalances && wallets.tutorBalances[email]) || 0);
  walletNoteEl.textContent = "Admin revenue: " + adminRevenue.toLocaleString("vi-VN") + " VND • Ví gia sư của bạn: " + tutorBalance.toLocaleString("vi-VN") + " VND";
  withdrawBtn.disabled = tutorBalance <= 0;
}

// ── Teaching schedule rendering (for tutors) ──

async function renderTeachingSchedule(email) {
  if (!scheduleSection || !scheduleList) return;
  email = String(email || "").trim().toLowerCase();
  var requests = await readTutorRequests(email);
  var teaching = requests.filter(function (item) {
    return String(item.tutorEmail || "").toLowerCase() === email && isConnectedRequest(item);
  });

  if (teaching.length === 0) {
    scheduleSection.style.display = "block";
    scheduleCountEl.textContent = "0";
    scheduleList.innerHTML =
      '<li class="schedule-empty">' +
      '<div class="schedule-empty-icon">📭</div>' +
      '<p>Bạn chưa có lớp nào đang dạy.<br>Khi học viên nạp tiền, lớp sẽ xuất hiện tại đây.</p>' +
      '</li>';
    return;
  }

  scheduleSection.style.display = "block";
  scheduleCountEl.textContent = String(teaching.length);
  scheduleList.innerHTML = teaching.map(function (item) {
    return renderConnectedScheduleCard(item, "tutor");
  }).join("");
  bindWeeklyScheduleActions(email);
}

async function renderStudentSchedule(email) {
  if (!studentScheduleSection || !studentScheduleList) return;
  email = String(email || "").trim().toLowerCase();
  var requests = await readRequestsForUser(email);
  var connected = requests.filter(function (item) {
    return String(item.studentEmail || "").toLowerCase() === email && isConnectedRequest(item);
  });

  if (connected.length === 0) {
    studentScheduleSection.style.display = "none";
    studentScheduleCountEl.textContent = "0";
    studentScheduleList.innerHTML = "";
    return;
  }

  studentScheduleSection.style.display = "block";
  studentScheduleCountEl.textContent = String(connected.length);
  studentScheduleList.innerHTML = connected.map(function (item) {
    return renderConnectedScheduleCard(item, "student");
  }).join("");
}

async function bindWeeklyScheduleActions(email) {
  document.querySelectorAll(".save-weekly-schedule-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
      var requestId = button.getAttribute("data-id");
      var card = document.querySelector('.weekly-schedule-card[data-request-id="' + requestId + '"]');
      var statusEl = document.querySelector('.weekly-schedule-status[data-id="' + requestId + '"]');
      if (!card) return;

      var snap = await getDoc(doc(db, 'requests', requestId));
      if (!snap.exists() || String(snap.data().tutorEmail || "").toLowerCase() !== email) return;

      var nextSchedule = normalizeWeeklySchedule(snap.data().weeklySchedule);
      card.querySelectorAll(".weekly-schedule-input").forEach(function (input) {
        var index = Number(input.getAttribute("data-day-index"));
        if (nextSchedule[index]) nextSchedule[index].content = input.value.trim();
      });

      button.disabled = true;
      button.textContent = "Đang lưu...";
      if (statusEl) statusEl.textContent = "";

      try {
        await updateRequestById(requestId, {
          weeklySchedule: nextSchedule,
          weeklyScheduleUpdatedAt: new Date().toISOString()
        });
        var item = snap.data();
        await pushNotification(item.studentEmail, "Gia sư " + (item.tutorName || email) + " đã cập nhật lịch học 7 ngày cho môn " + (item.subject || "lớp học") + ".", "schedule-updated", { requestId: requestId });
        if (statusEl) statusEl.textContent = "Đã lưu";
        await renderTeachingSchedule(email);
      } catch (error) {
        console.error("Cannot save weekly schedule", error);
        if (statusEl) statusEl.textContent = "Không lưu được";
      } finally {
        button.disabled = false;
        button.textContent = "Lưu lịch 7 ngày";
      }
    });
  });
}

function clearScheduleRealtime() {
  scheduleUnsubscribes.forEach(function (unsubscribe) {
    try { unsubscribe(); } catch (e) {}
  });
  scheduleUnsubscribes = [];
}

function setupScheduleRealtime(email, canEditTutorSchedule) {
  clearScheduleRealtime();
  email = String(email || "").trim().toLowerCase();
  if (!email) return;

  var studentQuery = query(collection(db, 'requests'), where('studentEmail', '==', email));
  scheduleUnsubscribes.push(onSnapshot(studentQuery, function () {
    renderStudentSchedule(email).catch(function (error) {
      console.warn("Cannot refresh student schedule", error);
    });
  }, function (error) {
    console.warn("Cannot listen to student schedule", error);
  }));

  if (canEditTutorSchedule) {
    var tutorQuery = query(collection(db, 'requests'), where('tutorEmail', '==', email));
    scheduleUnsubscribes.push(onSnapshot(tutorQuery, function () {
      renderTeachingSchedule(email).catch(function (error) {
        console.warn("Cannot refresh tutor schedule", error);
      });
    }, function (error) {
      console.warn("Cannot listen to tutor schedule", error);
    }));
  }
}

// ── Update results form (for tutors) ──

async function renderUpdateResultForm(email) {
  if (!updateResultsSection || !resultRequestSelect) return;
  email = String(email || "").trim().toLowerCase();
  var requests = await readTutorRequests(email);
  var teaching = requests.filter(function (item) {
    return String(item.tutorEmail || "").toLowerCase() === email && item.status === "in_teaching";
  });

  if (teaching.length === 0) {
    updateResultsSection.style.display = "none";
    return;
  }

  updateResultsSection.style.display = "block";
  resultRequestSelect.innerHTML =
    '<option value="">-- Chọn lớp học --</option>' +
    teaching.map(function (item) {
      return '<option value="' + item.id + '" data-student="' + (item.studentEmail || "") + '" data-subject="' + (item.subject || "") + '">' +
        (item.studentName || "Học viên") + ' — ' + (item.subject || "Môn học") +
        '</option>';
    }).join("");

  // Set default date to today
  if (resultSessionDate) {
    resultSessionDate.value = new Date().toISOString().split("T")[0];
  }
}

// ── Learning results table (for students/parents) ──

async function renderLearningResults(email) {
  if (!studentResultsSection || !resultsContainer) return;
  try {
    var snapshot;
    try {
      // Try compound query (needs Firestore composite index)
      var q = query(
        collection(db, 'learning_results'),
        where('studentEmail', '==', email),
        orderBy('createdAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (indexErr) {
      // Fallback: query without orderBy (no composite index needed), sort client-side
      console.warn('Firestore index not ready, using fallback query:', indexErr.message);
      var qFallback = query(
        collection(db, 'learning_results'),
        where('studentEmail', '==', email)
      );
      snapshot = await getDocs(qFallback);
    }
    var results = snapshot.docs.map(function (docSnap) {
      return { id: docSnap.id, ...docSnap.data() };
    });
    // Sort by createdAt desc (client-side, ensures order even without index)
    results.sort(function (a, b) {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    if (results.length === 0) {
      studentResultsSection.style.display = "block";
      resultsCountEl.textContent = "0";
      resultsContainer.innerHTML =
        '<div class="results-empty">' +
        '<div class="results-empty-icon">📊</div>' +
        '<p>Chưa có kết quả học tập nào.<br>Kết quả sẽ được gia sư cập nhật sau mỗi buổi học.</p>' +
        '</div>';
      return;
    }

    studentResultsSection.style.display = "block";
    resultsCountEl.textContent = String(results.length);

    var rows = results.map(function (r) {
      var score = Number(r.score || 0);
      var pct = Math.round((score / 10) * 100);
      var scoreClass = score >= 7 ? "score-high" : (score >= 5 ? "score-mid" : "score-low");
      var dateStr = "";
      try {
        dateStr = r.sessionDate
          ? new Date(r.sessionDate + "T00:00:00").toLocaleDateString("vi-VN")
          : new Date(r.createdAt).toLocaleDateString("vi-VN");
      } catch (e) {}
      return (
        '<tr>' +
        '<td style="font-weight:600;color:var(--ink-100)">' + (r.subject || "—") + '</td>' +
        '<td>' + (r.tutorName || r.tutorEmail || "—") + '</td>' +
        '<td>' + dateStr + '</td>' +
        '<td><div class="score-cell">' +
        '<span class="score-value">' + score.toFixed(1) + '</span>' +
        '<div class="score-bar"><div class="score-bar-fill ' + scoreClass + '" style="width:' + pct + '%"></div></div>' +
        '</div></td>' +
        '<td><span class="result-comment" title="' + (r.comment || "").replace(/"/g, '&quot;') + '">' + (r.comment || "Không có nhận xét") + '</span></td>' +
        '</tr>'
      );
    }).join("");

    resultsContainer.innerHTML =
      '<div class="results-table-wrap">' +
      '<table class="results-table">' +
      '<thead><tr>' +
      '<th>Môn</th><th>Gia sư</th><th>Ngày</th><th>Điểm</th><th>Nhận xét</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>';

  } catch (e) {
    console.warn('Error loading learning results:', e);
    studentResultsSection.style.display = "block";
    resultsContainer.innerHTML =
      '<div class="results-empty">' +
      '<div class="results-empty-icon">⚠️</div>' +
      '<p>Không thể tải kết quả học tập.</p>' +
      '</div>';
  }
}

// ── Auth state ──

onAuthStateChanged(auth, async function (user) {
  if (!user || !user.emailVerified) {
    window.location.href = "dang-nhap.html?next=profile.html";
    return;
  }

  currentUser = user;
  nameInput.value = user.displayName || "";
  emailInput.value = user.email || "";
  var emailLower = String(user.email || "").toLowerCase();
  await renderHistories(emailLower);
  await renderTutorProfile(emailLower);
  await renderWalletInfo(emailLower);
  await renderStudentSchedule(emailLower);

  // ── Schedule & Results ──
  // Check if this user is a tutor
  var tutorProfile = await getTutorProfileByEmail(emailLower);
  var canEditTutorSchedule = !!(tutorProfile && tutorProfile.status === "approved");
  if (canEditTutorSchedule) {
    await renderTeachingSchedule(emailLower);
    await renderUpdateResultForm(emailLower);
  }
  setupScheduleRealtime(emailLower, canEditTutorSchedule);
  // Always show learning results for any user (student/parent)
  await renderLearningResults(emailLower);
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  setStatus("");
  if (!currentUser) return;

  try {
    await updateProfile(currentUser, { displayName: nameInput.value.trim() });
    setStatus("Đã cập nhật hồ sơ thành công.");
  } catch (error) {
    setStatus("Không cập nhật được hồ sơ: " + (error && error.message ? error.message : "lỗi không xác định."));
  }
});

logoutBtn.addEventListener("click", async function () {
  clearScheduleRealtime();
  await signOut(auth);
  window.location.href = "dang-nhap.html";
});

window.addEventListener("beforeunload", clearScheduleRealtime);

// ── FIX: saveTutorProfile — use setDoc on single doc instead of delete-all/rewrite-all ──

saveTutorProfileBtn.addEventListener("click", async function () {
  if (!currentUser || !currentUser.email) return;

  var email = String(currentUser.email || "").toLowerCase();
  var nowIso = new Date().toISOString();
  var currentProfile = await getTutorProfileByEmail(email);
  var nextStatus = currentProfile && currentProfile.status === "approved" ? "approved" : "pending";
  var docId = currentProfile ? currentProfile.id : currentUser.uid;
  var profile = {
    email: email,
    name: (tutorNameEl.value || "").trim() || (nameInput.value || "").trim() || email,
    subject: (tutorSubjectEl.value || "").trim(),
    level: (tutorLevelEl.value || "").trim(),
    experience: (tutorExperienceEl.value || "").trim(),
    location: (tutorLocationEl.value || "").trim(),
    availableTime: (tutorAvailableTimeEl.value || "").trim(),
    price: Number(tutorPriceEl.value || 0),
    sessionHours: Number(tutorSessionHoursEl.value || 0),
    gender: tutorGenderEl.value || "female",
    rating: currentProfile ? (currentProfile.rating || 4) : 4,
    activeState: tutorActiveStateEl.value || "available",
    status: nextStatus,
    rejectReason: "",
    submittedAt: currentProfile && currentProfile.submittedAt ? currentProfile.submittedAt : nowIso,
    updatedAt: nowIso
  };

  // Write only this tutor's doc (not delete-all/rewrite-all)
  await setDoc(doc(db, 'tutor_registrations', docId), profile);

  if (nextStatus !== "approved") {
    var reviewerEmails = await getReviewerEmails();
    for (var i = 0; i < reviewerEmails.length; i++) {
      await pushNotification(reviewerEmails[i], "Gia sư " + profile.name + " (" + email + ") vừa cập nhật hồ sơ và cần duyệt.", "tutor-approval-request", { tutorEmail: email, tutorName: profile.name });
    }
    await pushNotification(email, "Bạn đã cập nhật hồ sơ gia sư. Hồ sơ đang chờ admin duyệt.", "tutor-approval-status", { status: "pending" });
  }

  window.dispatchEvent(new Event("edubridge-notifications-updated"));
  await renderTutorProfile(email);
  setStatus(nextStatus === "approved"
    ? "Đã cập nhật hồ sơ gia sư thành công."
    : "Đã lưu hồ sơ gia sư và gửi kiểm duyệt.");
});

// ── FIX: withdraw — use addDoc instead of delete-all/rewrite-all ──

withdrawBtn.addEventListener("click", async function () {
  if (!currentUser || !currentUser.email) return;
  var email = String(currentUser.email || "").toLowerCase();
  var wallets = await readWallets();
  wallets.tutorBalances = wallets.tutorBalances || {};
  var amount = Number(wallets.tutorBalances[email] || 0);
  if (amount <= 0) {
    alert("Ví của bạn hiện không có số dư để rút.");
    return;
  }
  wallets.tutorBalances[email] = 0;
  await writeWallets(wallets);

  await addDoc(collection(db, 'withdrawals'), {
    tutorEmail: email,
    tutorName: currentUser.displayName || email,
    amount: amount,
    status: "pending",
    createdAt: new Date().toISOString()
  });
  await pushNotification(email, "Yêu cầu rút tiền " + amount.toLocaleString("vi-VN") + " VND đã được gửi admin duyệt.", "withdrawal-request", { amount: amount });

  var adminEmail = await getAdminEmail();
  await pushNotification(adminEmail, "Có yêu cầu rút tiền mới từ " + (currentUser.displayName || email) + " (" + amount.toLocaleString("vi-VN") + " VND).", "withdrawal-admin", { tutorEmail: email, amount: amount });

  await renderWalletInfo(email);
  alert("Đã tạo yêu cầu rút tiền. Chờ admin duyệt.");
});

// ── FIX: dispute — use string requestId + addDoc instead of Number() + delete-all/rewrite-all ──

createDisputeBtn.addEventListener("click", async function () {
  if (!currentUser || !currentUser.email) return;
  var email = String(currentUser.email || "").toLowerCase();
  var requestId = disputeSelectEl.value || "";
  var reason = String(disputeReasonEl.value || "").trim();
  if (!requestId) {
    alert("Vui lòng chọn yêu cầu cần report.");
    return;
  }
  if (!reason) {
    alert("Vui lòng nhập nội dung báo cáo.");
    return;
  }
  // FIX: Use string comparison instead of Number() which produced NaN for Firestore IDs
  var snap = await getDoc(doc(db, 'requests', requestId));
  if (!snap.exists()) {
    alert("Không tìm thấy yêu cầu.");
    return;
  }
  var request = snap.data();

  await addDoc(collection(db, 'disputes'), {
    requestId: requestId,
    reporterEmail: email,
    reporterRole: String(request.studentEmail || "").toLowerCase() === email ? "student" : "tutor",
    tutorEmail: request.tutorEmail,
    studentEmail: request.studentEmail,
    reason: reason,
    status: "open",
    createdAt: new Date().toISOString()
  });

  var adminEmail = await getAdminEmail();
  await pushNotification(adminEmail, "Có report tranh chấp mới cho yêu cầu #" + requestId + ".", "dispute-opened", { requestId: requestId });
  disputeReasonEl.value = "";
  alert("Đã gửi report tranh chấp. Admin sẽ xử lý sớm.");
});

// ── Save learning result (tutor) ──

if (saveResultBtn) {
  saveResultBtn.addEventListener("click", async function () {
    if (!currentUser || !currentUser.email) return;
    var email = String(currentUser.email || "").toLowerCase();
    var requestId = resultRequestSelect.value || "";
    if (!requestId) {
      resultStatusEl.textContent = "Vui lòng chọn lớp học.";
      return;
    }
    var sessionDate = (resultSessionDate.value || "").trim();
    var score = resultScore.value;
    var comment = (resultCommentEl.value || "").trim();

    if (!sessionDate) {
      resultStatusEl.textContent = "Vui lòng chọn ngày buổi học.";
      return;
    }
    if (score === "" || score === null || score === undefined) {
      resultStatusEl.textContent = "Vui lòng nhập điểm số.";
      return;
    }
    var scoreNum = Number(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      resultStatusEl.textContent = "Điểm số phải từ 0 đến 10.";
      return;
    }

    // Get selected option data
    var selectedOption = resultRequestSelect.options[resultRequestSelect.selectedIndex];
    var studentEmail = selectedOption.getAttribute("data-student") || "";
    var subject = selectedOption.getAttribute("data-subject") || "";

    saveResultBtn.disabled = true;
    saveResultBtn.textContent = "Đang lưu…";
    resultStatusEl.textContent = "";

    try {
      await addDoc(collection(db, 'learning_results'), {
        requestId: requestId,
        tutorEmail: email,
        tutorName: currentUser.displayName || email,
        studentEmail: studentEmail,
        subject: subject,
        sessionDate: sessionDate,
        score: scoreNum,
        comment: comment,
        createdAt: new Date().toISOString()
      });

      // Notify student
      if (studentEmail) {
        await pushNotification(
          studentEmail,
          "Gia sư " + (currentUser.displayName || email) + " đã cập nhật kết quả học môn " + subject + ": " + scoreNum.toFixed(1) + " điểm.",
          "learning-result",
          { requestId: requestId, score: scoreNum, subject: subject }
        );
      }

      // Reset form
      resultScore.value = "";
      resultCommentEl.value = "";
      resultSessionDate.value = new Date().toISOString().split("T")[0];
      resultStatusEl.textContent = "Đã lưu kết quả thành công!";
      resultStatusEl.style.color = "var(--success)";

      // Briefly flash the status then clear
      setTimeout(function () {
        resultStatusEl.textContent = "";
        resultStatusEl.style.color = "";
      }, 3000);

    } catch (err) {
      console.error('Error saving result:', err);
      resultStatusEl.textContent = "Lỗi: Không thể lưu kết quả. Vui lòng thử lại.";
      resultStatusEl.style.color = "var(--danger)";
    } finally {
      saveResultBtn.disabled = false;
      saveResultBtn.textContent = "Lưu kết quả";
    }
  });
}
