import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebase-config.js";

const navAuthLink = document.getElementById("nav-auth-link");
const nav = navAuthLink ? navAuthLink.closest(".nav") : null;
const DEFAULT_ADMIN_EMAIL = "tu620014@gmail.com";
const MODERATOR_KEY = "edubridge_moderator_emails";
const avatarIconSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />' +
  "</svg>";
const bellIconSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-1l-1.5-1.5V10a5.5 5.5 0 0 0-11 0v3.5L5 15v1h14Z" />' +
  "</svg>";

function readNotifications() {
  try {
    return JSON.parse(localStorage.getItem("edubridge_notifications") || "[]");
  } catch (e) {
    return [];
  }
}

function getAdminEmail() {
  var custom = localStorage.getItem("edubridge_admin_email");
  return (custom || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

function getModeratorEmails() {
  try {
    var value = JSON.parse(localStorage.getItem(MODERATOR_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .map(function (item) { return String(item || "").trim().toLowerCase(); })
      .filter(function (item, index, arr) { return item && arr.indexOf(item) === index; });
  } catch (e) {
    return [];
  }
}

function ensureAdminLink() {
  if (!nav) return null;
  var adminLink = document.getElementById("nav-admin-link");
  if (!adminLink) {
    adminLink = document.createElement("a");
    adminLink.id = "nav-admin-link";
    adminLink.href = "admin.html";
    adminLink.className = "nav-cta";
    adminLink.textContent = "Quản trị";
    adminLink.setAttribute("hidden", "");
    nav.insertBefore(adminLink, navAuthLink);
  }
  return adminLink;
}

function ensureBellLink() {
  if (!nav) return null;
  var bellLink = document.getElementById("nav-bell-link");
  if (!bellLink) {
    bellLink = document.createElement("a");
    bellLink.id = "nav-bell-link";
    bellLink.href = "thong-bao.html";
    bellLink.className = "nav-bell-link";
    bellLink.innerHTML = bellIconSvg + '<span id="nav-bell-badge" class="nav-bell-badge" hidden>0</span>';
    bellLink.setAttribute("aria-label", "Thông báo");
    bellLink.title = "Thông báo";
    nav.insertBefore(bellLink, navAuthLink);
  }
  return bellLink;
}

function updateBellBadge(user) {
  var bellLink = document.getElementById("nav-bell-link");
  var badge = document.getElementById("nav-bell-badge");
  if (!bellLink || !badge) return;

  if (!user) {
    bellLink.setAttribute("hidden", "");
    return;
  }

  bellLink.removeAttribute("hidden");
  var unread = readNotifications().filter(function (item) {
    return item.userEmail === user.email && !item.read;
  }).length;
  badge.textContent = String(unread);
  badge.hidden = unread === 0;
}

function updateAdminLink(user) {
  var adminLink = document.getElementById("nav-admin-link");
  if (!adminLink) return;

  var normalized = String((user && user.email) || "").toLowerCase();
  var isAdmin = !!(user && normalized === getAdminEmail());
  var isModerator = !!(user && getModeratorEmails().includes(normalized));
  if (isAdmin || isModerator) {
    adminLink.textContent = isAdmin ? "Quản trị" : "Kiểm duyệt";
    adminLink.removeAttribute("hidden");
    return;
  }
  adminLink.setAttribute("hidden", "");
}

if (navAuthLink) {
  ensureAdminLink();
  ensureBellLink();
  onAuthStateChanged(auth, function (user) {
    if (user) {
      if (user.emailVerified) {
        navAuthLink.href = "profile.html";
        navAuthLink.innerHTML = avatarIconSvg;
        navAuthLink.classList.add("nav-auth-icon");
        navAuthLink.setAttribute("aria-label", "Trang cá nhân");
        navAuthLink.title = "Trang cá nhân";
      } else {
        navAuthLink.href = "dang-nhap.html";
        navAuthLink.textContent = "Đăng nhập";
        navAuthLink.classList.remove("nav-auth-icon");
        navAuthLink.removeAttribute("aria-label");
        navAuthLink.removeAttribute("title");
      }
      updateBellBadge(user);
      updateAdminLink(user);
      return;
    }

    navAuthLink.href = "dang-nhap.html";
    navAuthLink.textContent = "Đăng nhập";
    navAuthLink.classList.remove("nav-auth-icon");
    navAuthLink.removeAttribute("aria-label");
    navAuthLink.removeAttribute("title");
    updateBellBadge(null);
    updateAdminLink(null);
  });

  window.addEventListener("storage", function () {
    updateBellBadge(auth.currentUser);
    updateAdminLink(auth.currentUser);
  });
  window.addEventListener("edubridge-notifications-updated", function () {
    updateBellBadge(auth.currentUser);
    updateAdminLink(auth.currentUser);
  });
}
