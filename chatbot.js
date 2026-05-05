/* ═══════════════════════════════════════════════════════════════
   EDUBRIDGE CHATBOT — Self-contained support widget
   Drop-in: <script src="chatbot.js"></script>
═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── FAQ Knowledge Base ──────────────────────────────────────
  const FAQ = [
    {
      keywords: ["gia sư", "tìm gia sư", "tìm", "giáo viên"],
      q: "Làm sao tìm gia sư?",
      a: "Bạn vào trang <a href='tim-gia-su.html'>Tìm gia sư</a>, lọc theo môn học, khu vực và giá. Sau đó gửi yêu cầu cho gia sư phù hợp nhất!"
    },
    {
      keywords: ["đăng ký", "tạo tài khoản", "tài khoản"],
      q: "Đăng ký tài khoản như thế nào?",
      a: "Bấm <a href='dang-ky.html'>Đăng ký</a>, điền thông tin và xác nhận email. Chỉ mất 2 phút thôi! 🎉"
    },
    {
      keywords: ["dạy", "làm gia sư", "đăng ký gia sư", "gia sư đăng ký"],
      q: "Tôi muốn đăng ký làm gia sư",
      a: "Tuyệt vời! Bạn vào <a href='dang-ky-gia-su.html'>Đăng ký gia sư</a>, điền hồ sơ KYC. Sau khi admin duyệt, bạn sẽ nhận được yêu cầu từ học viên."
    },
    {
      keywords: ["thanh toán", "escrow", "tiền", "phí", "giá"],
      q: "Thanh toán hoạt động thế nào?",
      a: "EduBridge dùng hệ thống <strong>Escrow</strong> — tiền được giữ an toàn, chỉ giải ngân khi cả hai bên hài lòng. Chia 70% cho gia sư, 30% phí dịch vụ."
    },
    {
      keywords: ["hoàn tiền", "hoàn", "không hài lòng", "tranh chấp"],
      q: "Nếu không hài lòng thì sao?",
      a: "Bạn có thể mở <strong>tranh chấp</strong> trong vòng 7 ngày. Admin sẽ xem xét và hoàn tiền nếu hợp lý. Quyền lợi bạn luôn được bảo vệ! 🛡️"
    },
    {
      keywords: ["liên hệ", "hỗ trợ", "email", "hotline", "admin"],
      q: "Liên hệ hỗ trợ ở đâu?",
      a: "Bạn gửi email về <strong>support@edubridge.vn</strong> hoặc nhắn trực tiếp qua hệ thống thông báo. Đội ngũ hỗ trợ phản hồi trong 24h."
    },
    {
      keywords: ["an toàn", "bảo mật", "uy tín"],
      q: "EduBridge có an toàn không?",
      a: "Hoàn toàn! Mọi gia sư đều được <strong>kiểm duyệt hồ sơ</strong>, thanh toán qua escrow an toàn, và bạn luôn có quyền mở tranh chấp. ✅"
    },
    {
      keywords: ["đánh giá", "review", "nhận xét"],
      q: "Đánh giá gia sư ở đâu?",
      a: "Vào trang hồ sơ gia sư, kéo xuống mục <strong>\"Đánh giá từ học viên\"</strong>. Bạn cần hoàn thành ít nhất 1 buổi học để viết đánh giá."
    },
    {
      keywords: ["online", "trực tuyến", "từ xa"],
      q: "Có hỗ trợ học online không?",
      a: "Có! Nhiều gia sư dạy online qua Zoom/Google Meet. Bạn lọc \"Online\" trong trang Tìm gia sư để xem danh sách."
    },
    {
      keywords: ["môn", "môn học", "toán", "lý", "hóa", "anh", "ielts"],
      q: "EduBridge có những môn nào?",
      a: "Hầu hết các môn: Toán, Lý, Hóa, Anh, Văn, Tin học, IELTS, TOEIC, lập trình và nhiều môn khác. Hãy tìm kiếm trên trang <a href='tim-gia-su.html'>Tìm gia sư</a>!"
    }
  ];

  const QUICK_REPLIES = [
    "Làm sao tìm gia sư?",
    "Thanh toán thế nào?",
    "Đăng ký làm gia sư",
    "Có an toàn không?"
  ];

  const GREETING = "Xin chào! 👋 Tôi là trợ lý ảo của <strong>EduBridge</strong>. Bạn cần hỗ trợ gì?";
  const FALLBACK = "Xin lỗi, tôi chưa hiểu câu hỏi này 😅. Bạn thử chọn câu hỏi bên dưới, hoặc liên hệ <strong>support@edubridge.vn</strong> để được hỗ trợ trực tiếp nhé!";

  // ── Inject CSS ──────────────────────────────────────────────
  const css = `
    .cb-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #0a5f4a 0%, #0e7a5e 100%);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(10, 95, 74, 0.35), 0 0 0 0 rgba(10, 95, 74, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s;
      animation: cb-pulse 2.5s ease-in-out infinite;
    }
    .cb-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(10, 95, 74, 0.45);
      animation: none;
    }
    .cb-fab svg { width: 26px; height: 26px; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
    .cb-fab.open svg { transform: rotate(90deg) scale(0.85); }

    @keyframes cb-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(10,95,74,0.35), 0 0 0 0 rgba(10,95,74,0.25); }
      50% { box-shadow: 0 4px 20px rgba(10,95,74,0.35), 0 0 0 10px rgba(10,95,74,0); }
    }

    /* Badge dot */
    .cb-fab-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 16px;
      height: 16px;
      background: #dc2626;
      border-radius: 50%;
      border: 2.5px solid #fff;
      animation: cb-badge-pop 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes cb-badge-pop {
      0% { transform: scale(0); }
      100% { transform: scale(1); }
    }

    /* Window */
    .cb-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      z-index: 9998;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(17,24,39,0.18), 0 0 0 1px rgba(17,24,39,0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1);
    }
    .cb-window.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .cb-header {
      background: linear-gradient(135deg, #0a5f4a 0%, #0e7a5e 100%);
      color: #fff;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .cb-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .cb-header-info { flex: 1; min-width: 0; }
    .cb-header-name {
      font-family: 'Lora', Georgia, serif;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .cb-header-status {
      font-size: 0.72rem;
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .cb-header-status::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34d399;
      flex-shrink: 0;
    }
    .cb-close {
      background: rgba(255,255,255,0.15);
      border: none;
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .cb-close:hover { background: rgba(255,255,255,0.3); }
    .cb-close svg { width: 16px; height: 16px; }

    /* Messages area */
    .cb-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f9f7f3;
    }
    .cb-messages::-webkit-scrollbar { width: 5px; }
    .cb-messages::-webkit-scrollbar-track { background: transparent; }
    .cb-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }

    /* Message bubbles */
    .cb-msg {
      max-width: 85%;
      padding: 11px 15px;
      border-radius: 16px;
      font-size: 0.875rem;
      line-height: 1.55;
      animation: cb-msg-in 0.3s cubic-bezier(0.16,1,0.3,1);
      word-break: break-word;
    }
    @keyframes cb-msg-in {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .cb-msg.bot {
      background: #fff;
      color: #374151;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .cb-msg.bot a {
      color: #0a5f4a;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .cb-msg.user {
      background: linear-gradient(135deg, #0a5f4a, #0e7a5e);
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .cb-typing {
      display: flex;
      gap: 4px;
      padding: 14px 18px;
      align-self: flex-start;
      background: #fff;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .cb-typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9ca3af;
      animation: cb-bounce 1.4s ease-in-out infinite;
    }
    .cb-typing span:nth-child(2) { animation-delay: 0.15s; }
    .cb-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cb-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* Quick replies */
    .cb-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 12px;
      background: #f9f7f3;
    }
    .cb-chip {
      padding: 7px 14px;
      border-radius: 20px;
      border: 1.5px solid rgba(10,95,74,0.25);
      background: #fff;
      color: #0a5f4a;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      font-family: 'Be Vietnam Pro', system-ui, sans-serif;
    }
    .cb-chip:hover {
      background: #e8f5f1;
      border-color: #0a5f4a;
      transform: translateY(-1px);
    }

    /* Input area */
    .cb-input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid rgba(17,24,39,0.08);
      background: #fff;
      flex-shrink: 0;
    }
    .cb-input {
      flex: 1;
      border: 1.5px solid rgba(17,24,39,0.12);
      border-radius: 22px;
      padding: 10px 16px;
      font-family: 'Be Vietnam Pro', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #111827;
      outline: none;
      background: #f9f7f3;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .cb-input::placeholder { color: #9ca3af; }
    .cb-input:focus {
      border-color: #0a5f4a;
      box-shadow: 0 0 0 3px rgba(10,95,74,0.08);
      background: #fff;
    }
    .cb-send {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #0a5f4a, #0e7a5e);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .cb-send:hover {
      transform: scale(1.06);
      box-shadow: 0 3px 12px rgba(10,95,74,0.3);
    }
    .cb-send:disabled { opacity: 0.4; pointer-events: none; }
    .cb-send svg { width: 18px; height: 18px; }

    /* Responsive */
    @media (max-width: 480px) {
      .cb-window {
        bottom: 0;
        right: 0;
        width: 100vw;
        max-width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }
      .cb-fab { bottom: 16px; right: 16px; width: 52px; height: 52px; }
    }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ── Build HTML ──────────────────────────────────────────────
  const chatIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" fill="currentColor"/></svg>`;
  const closeIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const sendIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M22 2 11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m22 2-7 20-4-9-9-4 20-7Z" fill="currentColor"/></svg>`;

  // FAB button
  const fab = document.createElement("button");
  fab.className = "cb-fab";
  fab.setAttribute("aria-label", "Mở chatbot hỗ trợ");
  fab.innerHTML = chatIcon + `<span class="cb-fab-badge"></span>`;
  document.body.appendChild(fab);

  // Chat window
  const win = document.createElement("div");
  win.className = "cb-window";
  win.innerHTML = `
    <div class="cb-header">
      <div class="cb-header-avatar">🤖</div>
      <div class="cb-header-info">
        <div class="cb-header-name">EduBridge Bot</div>
        <div class="cb-header-status">Trực tuyến</div>
      </div>
      <button class="cb-close" aria-label="Đóng">${closeIcon}</button>
    </div>
    <div class="cb-messages" id="cb-messages"></div>
    <div class="cb-quick" id="cb-quick"></div>
    <div class="cb-input-area">
      <input class="cb-input" id="cb-input" type="text" placeholder="Nhập câu hỏi..." autocomplete="off" />
      <button class="cb-send" id="cb-send" aria-label="Gửi">${sendIcon}</button>
    </div>
  `;
  document.body.appendChild(win);

  // ── Elements ────────────────────────────────────────────────
  const msgContainer = win.querySelector("#cb-messages");
  const quickContainer = win.querySelector("#cb-quick");
  const input = win.querySelector("#cb-input");
  const sendBtn = win.querySelector("#cb-send");
  const closeBtn = win.querySelector(".cb-close");
  const badge = fab.querySelector(".cb-fab-badge");

  let isOpen = false;
  let greeted = false;

  // ── Helpers ─────────────────────────────────────────────────
  function scrollBottom() {
    requestAnimationFrame(() => {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });
  }

  function addMsg(text, who) {
    const div = document.createElement("div");
    div.className = `cb-msg ${who}`;
    div.innerHTML = text;
    msgContainer.appendChild(div);
    scrollBottom();
  }

  function showTyping() {
    const t = document.createElement("div");
    t.className = "cb-typing";
    t.id = "cb-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    msgContainer.appendChild(t);
    scrollBottom();
  }

  function hideTyping() {
    const t = msgContainer.querySelector("#cb-typing");
    if (t) t.remove();
  }

  function renderQuickReplies(replies) {
    quickContainer.innerHTML = "";
    replies.forEach(text => {
      const chip = document.createElement("button");
      chip.className = "cb-chip";
      chip.textContent = text;
      chip.addEventListener("click", () => handleUserMsg(text));
      quickContainer.appendChild(chip);
    });
  }

  function findAnswer(msg) {
    const lower = msg.toLowerCase().replace(/[?!.,]/g, "").trim();
    let best = null;
    let bestScore = 0;

    for (const item of FAQ) {
      let score = 0;
      for (const kw of item.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += kw.length; // longer keyword match = better
        }
      }
      // Also check if user typed close to the question text
      if (item.q && lower.includes(item.q.toLowerCase().replace(/[?!.,]/g, "").trim().slice(0, 10))) {
        score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    return best ? best.a : null;
  }

  function getFollowupQuickReplies(answer) {
    // Pick 3 random FAQs different from current answer
    const others = FAQ.filter(f => f.a !== answer);
    const shuffled = others.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(f => f.q);
  }

  // ── Core logic ──────────────────────────────────────────────
  function handleUserMsg(text) {
    if (!text.trim()) return;

    addMsg(text, "user");
    input.value = "";
    quickContainer.innerHTML = "";

    showTyping();

    const delay = 600 + Math.random() * 800;
    setTimeout(() => {
      hideTyping();

      const answer = findAnswer(text);
      if (answer) {
        addMsg(answer, "bot");
        renderQuickReplies(getFollowupQuickReplies(answer));
      } else {
        addMsg(FALLBACK, "bot");
        renderQuickReplies(QUICK_REPLIES);
      }
    }, delay);
  }

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle("visible", isOpen);
    fab.classList.toggle("open", isOpen);

    if (isOpen) {
      badge.style.display = "none";
      if (!greeted) {
        greeted = true;
        setTimeout(() => {
          showTyping();
          setTimeout(() => {
            hideTyping();
            addMsg(GREETING, "bot");
            renderQuickReplies(QUICK_REPLIES);
          }, 800);
        }, 300);
      }
      setTimeout(() => input.focus(), 350);
    }
  }

  // ── Event listeners ─────────────────────────────────────────
  fab.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  sendBtn.addEventListener("click", () => handleUserMsg(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserMsg(input.value);
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) toggleChat();
  });

  // Auto-show badge after 3 seconds
  setTimeout(() => {
    if (!isOpen) badge.style.display = "block";
  }, 3000);
})();
