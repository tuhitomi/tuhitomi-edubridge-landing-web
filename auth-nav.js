import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const navAuthLink = document.getElementById("nav-auth-link");
const nav = navAuthLink ? (navAuthLink.closest(".nav") || navAuthLink.closest("nav") || navAuthLink.parentElement) : null;
const DEFAULT_ADMIN_EMAIL = "tu620014@gmail.com";

<<<<<<< HEAD
function isPermissionDeniedError(error) {
  return !!(error && (error.code === "permission-denied" || String(error.message || "").toLowerCase().includes("insufficient permissions")));
}

=======
// Global variable to store unsubscribe function for notifications listener
>>>>>>> parent of 066b3bf (.)
let notificationsUnsubscribe = null;

const avatarIconSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />' +
  "</svg>";

const bellIconSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-1l-1.5-1.5V10a5.5 5.5 0 0 0-11 0v3.5L5 15v1h14Z" />' +
  "</svg>";

<<<<<<< HEAD
=======
async function readNotifications(userEmail) {
  try {
    if (!userEmail) return [];
    const normalizedEmail = userEmail.toLowerCase().trim();
    const q = query(
      collection(db, 'notifications'),
      where('userEmail', '==', normalizedEmail),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Error reading notifications:', e);
    return [];
  }
}

>>>>>>> parent of 066b3bf (.)
async function getAdminEmail() {
  try {
    const docSnap = await getDoc(doc(db, "settings", "edubridge_admin_email"));
    if (docSnap.exists()) {
      const email = String(docSnap.data().value || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
      localStorage.setItem("edubridge_admin_email", email);
      return email;
    }
<<<<<<< HEAD
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.error("Firestore error:", error);
    }
=======
  } catch (e) {
    console.error('Firestore Error:', e);
>>>>>>> parent of 066b3bf (.)
  }
  return DEFAULT_ADMIN_EMAIL.trim().toLowerCase();
}

async function getModeratorEmails() {
  try {
    const docSnap = await getDoc(doc(db, "settings", "edubridge_moderator_emails"));
    const value = docSnap.exists() ? docSnap.data().value : [];
    if (!Array.isArray(value)) return [];
    return value
<<<<<<< HEAD
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item, index, arr) => item && arr.indexOf(item) === index);
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.error("Error getting moderator emails:", error);
    }
=======
      .map(function (item) { return String(item || "").trim().toLowerCase(); })
      .filter(function (item, index, arr) { return item && arr.indexOf(item) === index; });
  } catch (e) {
    console.error('Error getting moderator emails:', e);
>>>>>>> parent of 066b3bf (.)
    return [];
  }
}

function ensureAdminLink() {
  if (!nav) return null;
  let adminLink = document.getElementById("nav-admin-link");
  if (!adminLink) {
    adminLink = document.createElement("a");
    adminLink.id = "nav-admin-link";
    adminLink.href = "admin.html";
    adminLink.className = "nav-cta";
    adminLink.textContent = "Quan tri";
    adminLink.setAttribute("hidden", "");
    nav.appendChild(adminLink);
  }
  return adminLink;
}

function ensureBellLink() {
  if (!nav) return null;
  let bellLink = document.getElementById("nav-bell-link");
  if (!bellLink) {
    bellLink = document.createElement("a");
    bellLink.id = "nav-bell-link";
    bellLink.href = "thong-bao.html";
    bellLink.className = "nav-bell-link";
    bellLink.innerHTML = bellIconSvg + '<span id="nav-bell-badge" class="nav-bell-badge" hidden>0</span>';
    bellLink.setAttribute("aria-label", "Thong bao");
    bellLink.title = "Thong bao";
    nav.appendChild(bellLink);
  }
  return bellLink;
}

async function updateBellBadge(user) {
  const bellLink = document.getElementById("nav-bell-link");
  const badge = document.getElementById("nav-bell-badge");
  if (!bellLink || !badge) return;

  if (notificationsUnsubscribe) {
    notificationsUnsubscribe();
    notificationsUnsubscribe = null;
  }

  if (!user || !user.email) {
    bellLink.setAttribute("hidden", "");
    return;
  }

  bellLink.removeAttribute("hidden");

  const normalizedEmail = user.email.toLowerCase().trim();
  const q = query(
    collection(db, "notifications"),
    where("userEmail", "==", normalizedEmail),
    orderBy("createdAt", "desc")
  );

  notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
    try {
      const unreadCount = snapshot.docs.filter((docItem) => {
        const data = docItem.data();
        return data.read === false || data.read === undefined;
      }).length;

      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
    } catch (error) {
      console.error("Error updating notification badge:", error);
      badge.textContent = "0";
      badge.hidden = true;
    }
  }, (error) => {
<<<<<<< HEAD
    if (!isPermissionDeniedError(error)) {
      console.error("Error listening to notifications:", error);
    }
=======
    console.error('Error listening to notifications:', error);
>>>>>>> parent of 066b3bf (.)
    badge.textContent = "0";
    badge.hidden = true;
  });
}

async function updateAdminLink(user) {
  const adminLink = document.getElementById("nav-admin-link");
  if (!adminLink) return;

  const normalized = String((user && user.email) || "").toLowerCase().trim();
  const adminEmail = await getAdminEmail();
  const moderatorEmails = await getModeratorEmails();
  const isAdmin = !!(user && normalized === adminEmail);
  const isModerator = !!(user && moderatorEmails.includes(normalized));

  if (isAdmin || isModerator) {
    adminLink.textContent = isAdmin ? "Quan tri" : "Kiem duyet";
    adminLink.removeAttribute("hidden");
    return;
  }

  adminLink.setAttribute("hidden", "");
}

if (navAuthLink) {
  ensureAdminLink();
  ensureBellLink();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (user.emailVerified) {
        navAuthLink.href = "profile.html";
        navAuthLink.innerHTML = avatarIconSvg;
        navAuthLink.classList.add("nav-auth-icon");
        navAuthLink.setAttribute("aria-label", "Trang ca nhan");
        navAuthLink.title = "Trang ca nhan";
      } else {
        navAuthLink.href = "dang-nhap.html";
        navAuthLink.textContent = "Dang nhap";
        navAuthLink.classList.remove("nav-auth-icon");
        navAuthLink.removeAttribute("aria-label");
        navAuthLink.removeAttribute("title");
      }

      await updateBellBadge(user);
      await updateAdminLink(user);
      return;
    }

    navAuthLink.href = "dang-nhap.html";
    navAuthLink.textContent = "Dang nhap";
    navAuthLink.classList.remove("nav-auth-icon");
    navAuthLink.removeAttribute("aria-label");
    navAuthLink.removeAttribute("title");

    if (notificationsUnsubscribe) {
      notificationsUnsubscribe();
      notificationsUnsubscribe = null;
    }

    await updateBellBadge(null);
    await updateAdminLink(null);
  });

  window.addEventListener("storage", async () => {
    await updateBellBadge(auth.currentUser);
    await updateAdminLink(auth.currentUser);
  });

  window.addEventListener("edubridge-notifications-updated", async () => {
    await updateBellBadge(auth.currentUser);
    await updateAdminLink(auth.currentUser);
  });

  window.addEventListener("beforeunload", () => {
    if (notificationsUnsubscribe) {
      notificationsUnsubscribe();
      notificationsUnsubscribe = null;
    }
  });
}
