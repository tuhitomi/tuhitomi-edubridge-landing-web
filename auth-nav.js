import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebase-config.js";

const navAuthLink = document.getElementById("nav-auth-link");
const avatarIconSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />' +
  "</svg>";

if (navAuthLink) {
  onAuthStateChanged(auth, function (user) {
    if (user && user.emailVerified) {
      navAuthLink.href = "profile.html";
      navAuthLink.innerHTML = avatarIconSvg;
      navAuthLink.classList.add("nav-auth-icon");
      navAuthLink.setAttribute("aria-label", "Trang cá nhân");
      navAuthLink.title = "Trang cá nhân";
      return;
    }

    navAuthLink.href = "dang-nhap.html";
    navAuthLink.textContent = "Đăng nhập";
    navAuthLink.classList.remove("nav-auth-icon");
    navAuthLink.removeAttribute("aria-label");
    navAuthLink.removeAttribute("title");
  });
}
