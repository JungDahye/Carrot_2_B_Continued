/**
 * chat.js
 * ─────────────────────────────────────────────────────────
 * 채팅 페이지(pages/chat/chat.html) 전용 스크립트입니다.
 *
 * [사용 API]
 * - GET  /api/auth/me              → 내 닉네임 표시
 * - GET  /api/chats                → 좌측 채팅방 목록
 * - GET  /api/chats/{id}           → 우측 상단 상품/상대 정보
 * - GET  /api/chats/{id}/messages  → 메시지 목록 (+ 폴링)
 * - POST /api/chats/{id}/messages  → 메시지 전송
 * - POST /api/chats                → ?productId= 로 방 생성
 * - PATCH /api/products/{id}/status → 거래완료 처리
 * - POST /api/chats/{id}/review    → 매너 평가 남기기
 * - GET  /api/chats/{id}/review    → 이 방의 평가 현황
 *
 * [AI 챗봇]
 * API에 없는 UI 목업입니다. 좌측 목록 최상단에 고정되어 있으며,
 * 클릭하면 미리 준비된 안내 문구/추천 질문을 보여줍니다.
 */

import {
  fetchMyProfile,
  fetchChatRooms,
  fetchChatRoom,
  fetchMessages,
  sendMessage,
  createChatRoom,
  updateProductStatus,
  submitChatReview,
} from "./api/apiChat.js";

/* ───────────────────────────────────────────
   1. DOM 요소 참조
   HTML에 id/class로 마크업해 둔 요소를 JS에서 사용합니다.
   ─────────────────────────────────────────── */
const chatListTitle = document.querySelector(".chat-list-title");
const unreadOnlyToggle = document.querySelector("#unreadOnlyToggle");
const chatRoomList = document.querySelector(".chat-room-list");
const chatPartnerName = document.querySelector(".chat-partner-name");
const chatPartnerBadge = document.querySelector(".chat-partner-badge");
const chatProductThumbnail = document.querySelector(".chat-product-thumbnail img");
const chatProductName = document.querySelector(".chat-product-name");
const chatProductPrice = document.querySelector(".chat-product-price");
const dealCompleteButton = document.querySelector(".deal-complete-button");
const reviewButton = document.querySelector("#reviewButton");
const reviewDialog = document.querySelector("#reviewDialog");
const reviewForm = document.querySelector("#reviewForm");
const reviewCancelButton = document.querySelector("#reviewCancelButton");
const reviewComment = document.querySelector("#reviewComment");
const chatMessageList = document.querySelector("#chatMessageList");
const chatInputForm = document.querySelector("#chatInputForm");
const chatMessageInput = document.querySelector("#chatMessageInput");
const btnLogout = document.querySelector("#btnLogout");
const btnLogin = document.querySelector("#btnLogin");

/* ───────────────────────────────────────────
   2. 페이지 전역 상태
   현재 선택된 방, 메시지 ID, 폴링 타이머 등을 기억합니다.
   ─────────────────────────────────────────── */
const state = {
  /** @type {Object|null} GET /api/auth/me 결과의 user 객체 */
  currentUser: null,

  /** @type {Array} GET /api/chats 결과의 items 배열 */
  rooms: [],

  /** @type {number|null} 현재 열려 있는 채팅방 ID (AI 봇은 null) */
  activeRoomId: null,

  /** @type {Object|null} GET /api/chats/{id} 결과의 room 객체 */
  activeRoom: null,

  /** @type {"api"|"bot"} api=실제 채팅방, bot=AI 챗봇 UI */
  activeMode: "api",

  /** @type {number} 마지막으로 받은 메시지 ID (폴링 after 파라미터) */
  lastMessageId: 0,

  /** @type {number|null} setInterval ID */
  pollingTimer: null,
};

/** AI 챗봇 전용 추천 질문 (피그마 목업 기준) */
const AI_SUGGESTIONS = [
  "법적으로 중고 거래를 금지하는 품목이 있나요?",
  "당근 마켓에서의 중고거래 팁을 알려주세요",
  "구매한 물건을 다시 판매해도 문제가 없나요?",
];

/* ───────────────────────────────────────────
   3. 유틸 함수
   ─────────────────────────────────────────── */

/**
 * 로그인 여부를 확인하고, 미로그인 시 로그인 페이지로 보냅니다.
 * @returns {boolean} 로그인 상태면 true
 */
function ensureLoggedIn() {
  const token = localStorage.getItem("token");
  const isLogin = localStorage.getItem("isLogin") === "true";

  if (!token || !isLogin) {
    alert("채팅은 로그인 후 이용할 수 있습니다.");
    location.href = "../auth/login.html";
    return false;
  }

  return true;
}

/**
 * 숫자 가격을 "150,000원" 형식으로 변환합니다.
 * @param {number} price
 */
function formatPrice(price) {
  return `${Number(price).toLocaleString("ko-KR")}원`;
}

/**
 * ISO 날짜 문자열을 "오전 8:20" 형식으로 변환합니다.
 * @param {string} isoString
 */
function formatMessageTime(isoString) {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 || 12;

  return `${period} ${hour12}:${minutes}`;
}

/**
 * ISO 날짜를 "3주전" 같은 상대 시간으로 변환합니다.
 * 채팅 목록의 "화곡동 3주전" 표시에 사용합니다.
 * @param {string|null} isoString
 */
function formatRelativeTime(isoString) {
  if (!isoString) return "";

  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffWeeks < 5) return `${diffWeeks}주 전`;

  return `${Math.floor(diffDays / 30)}개월 전`;
}

/**
 * 상품 location에서 "화곡동"처럼 동 이름만 추출합니다.
 * @param {string} location
 */
function extractDong(location = "") {
  const parts = location.trim().split(/\s+/);
  return parts[parts.length - 1] || location;
}

/**
 * 메시지 영역을 맨 아래로 스크롤합니다.
 */
function scrollToBottom() {
  chatMessageList.scrollTop = chatMessageList.scrollHeight;
}

/* ───────────────────────────────────────────
   4. 헤더(로그인/로그아웃) 처리
   ─────────────────────────────────────────── */

/**
 * 로그인 상태에 따라 헤더 버튼 표시를 바꿉니다.
 */
function syncHeaderAuthUI() {
  const isLogin = localStorage.getItem("isLogin") === "true";

  if (isLogin) {
    btnLogin?.classList.add("hidden");
    btnLogout?.classList.remove("hidden");
  } else {
    btnLogin?.classList.remove("hidden");
    btnLogout?.classList.add("hidden");
  }
}

/**
 * 로그아웃 버튼 클릭 시 localStorage를 비우고 로그인 페이지로 이동합니다.
 */
function bindLogout() {
  btnLogout?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("isLogin");
    localStorage.removeItem("location");
    alert("로그아웃되었습니다.");
    location.href = "../auth/login.html";
  });
}

/* ───────────────────────────────────────────
   5. 채팅방 목록 렌더링 (GET /api/chats)
   ─────────────────────────────────────────── */

/**
 * API에서 받은 room 배열을 좌측 목록 HTML로 그립니다.
 * AI 챗봇 항목은 항상 맨 위에 고정됩니다.
 */
function renderChatRoomList() {
  const showUnreadOnly = unreadOnlyToggle?.checked;
  const filteredRooms = showUnreadOnly
    ? state.rooms.filter((room) => room.unreadCount > 0)
    : state.rooms;

  const roomItemsHTML = filteredRooms
    .map((room) => {
      const partnerName = room.partner?.nickname || "알 수 없음";
      const dong = extractDong(room.product?.location);
      const timeLabel = formatRelativeTime(room.lastMessageAt || room.createdAt);
      const preview = room.lastMessage?.content || "아직 메시지가 없습니다.";
      const thumb =
        room.product?.thumbnail ||
        room.product?.images?.[0] ||
        "../../images/main/no-image.png";
      const isActive =
        state.activeMode === "api" && state.activeRoomId === room.id;

      return `
        <li
          class="chat-room-item${isActive ? " is-active" : ""}"
          data-room-id="${room.id}"
          role="button"
          tabindex="0"
        >
          <div class="chat-room-avatar">
            ${
              room.partner?.profileImage
                ? `<img src="${room.partner.profileImage}" alt="${partnerName} 프로필">`
                : `<span class="chat-room-avatar__fallback" aria-hidden="true"></span>`
            }
          </div>
          <div class="chat-room-info">
            <p class="chat-room-name">
              ${partnerName}
              <span class="chat-room-time">${dong} · ${timeLabel}</span>
            </p>
            <p class="chat-room-preview">${preview}</p>
          </div>
          <div class="chat-room-product-thumb">
            <img src="${thumb}" alt="거래 상품 썸네일">
          </div>
          ${
            room.unreadCount > 0
              ? `<span class="chat-room-unread">${room.unreadCount}</span>`
              : ""
          }
        </li>
      `;
    })
    .join("");

  chatRoomList.innerHTML = `
    <li
      class="chat-room-item chat-room-item--bot${state.activeMode === "bot" ? " is-active" : ""}"
      data-room-type="bot"
      role="button"
      tabindex="0"
    >
      <div class="chat-room-avatar">
        <img src="../../images/chat/ChatBot.png" alt="AI 챗봇">
      </div>
      <div class="chat-room-info">
        <p class="chat-room-name">AI 챗봇</p>
        <p class="chat-room-preview">궁금한 내용을 물어보세요!</p>
      </div>
    </li>
    ${roomItemsHTML || `<li class="chat-room-empty">아직 채팅방이 없습니다.</li>`}
  `;

  bindChatRoomListEvents();
}

/**
 * 채팅방 목록 클릭 이벤트를 연결합니다.
 */
function bindChatRoomListEvents() {
  chatRoomList.querySelectorAll(".chat-room-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (item.dataset.roomType === "bot") {
        openAiChatbot();
        return;
      }

      const roomId = Number(item.dataset.roomId);
      if (roomId) {
        openChatRoom(roomId);
      }
    });
  });
}

/**
 * GET /api/chats 로 목록을 새로 받아 화면을 갱신합니다.
 */
async function loadChatRooms() {
  const data = await fetchChatRooms();
  state.rooms = data.items || [];
  renderChatRoomList();
}

/* ───────────────────────────────────────────
   6. 메시지 렌더링 (GET /api/chats/{id}/messages)
   ─────────────────────────────────────────── */

/**
 * 메시지 1개를 HTML 문자열로 만듭니다.
 * senderId와 내 user.id를 비교해 sent/received 클래스를 결정합니다.
 *
 * @param {Object} message - API message 객체
 */
function createMessageHTML(message) {
  const isMine = message.senderId === state.currentUser?.id;
  const typeClass = isMine ? "chat-message--sent" : "chat-message--received";

  return `
    <div class="chat-message ${typeClass}" data-message-id="${message.id}">
      <p class="chat-message-bubble">${message.content}</p>
      <span class="chat-message-time">${formatMessageTime(message.createdAt)}</span>
    </div>
  `;
}

/**
 * 메시지 배열을 채팅창에 그립니다.
 * @param {Array} messages
 * @param {"replace"|"append"} mode - replace=처음 로드, append=폴링 추가
 */
function renderMessages(messages, mode = "replace") {
  if (mode === "replace") {
    chatMessageList.innerHTML = "";
  }

  if (!messages.length && mode === "replace") {
    chatMessageList.innerHTML = `
      <p class="chat-empty-message">아직 주고받은 메시지가 없습니다.<br>첫 메시지를 보내보세요!</p>
    `;
    return;
  }

  const html = messages.map(createMessageHTML).join("");

  if (mode === "append") {
    chatMessageList.insertAdjacentHTML("beforeend", html);
  } else {
    chatMessageList.innerHTML = html;
  }

  scrollToBottom();
}

/* ───────────────────────────────────────────
   7. 채팅방 열기 / 상단 정보 갱신
   ─────────────────────────────────────────── */

/**
 * 우측 상단의 상대방·상품 정보 UI를 room 데이터로 채웁니다.
 * @param {Object} room - GET /api/chats/{id} 의 room 객체
 */
function renderRoomHeader(room) {
  const partner = room.partner;
  const partnerName = partner?.nickname || "상대방";
  const product = room.product;
  const mannerTemp = partner?.mannerTemp ?? 36.5;
  const mannerColor = partner?.mannerLevel?.color || "#ff6f0e";

  chatPartnerName.textContent = partnerName;
  chatPartnerBadge.textContent = `${mannerTemp}℃`;
  chatPartnerBadge.style.backgroundColor = mannerColor;
  chatProductName.textContent = product?.title || "상품 정보 없음";
  chatProductPrice.textContent = formatPrice(product?.price || 0);

  const imageUrl =
    product?.thumbnail || product?.images?.[0] || "../../images/main/no-image.png";

  chatProductThumbnail.src = imageUrl;
  chatProductThumbnail.alt = product?.title || "거래 상품";

  const isSeller = room.myRole === "seller";
  const isSold = product?.status === "sold";

  // 판매자: 거래완료 버튼 항상 표시. 구매자: 거래가 끝난 뒤에만 "거래완료됨"으로 표시
  dealCompleteButton.hidden = !(isSeller || isSold);
  dealCompleteButton.disabled = isSold;
  dealCompleteButton.textContent = isSold ? "거래완료됨" : "거래완료";

  const alreadyReviewed = Boolean(room.myReview);
  reviewButton.hidden = !isSold;
  reviewButton.disabled = alreadyReviewed;
  reviewButton.textContent = alreadyReviewed ? "평가완료" : "리뷰 남기기";
}

/**
 * 실제 API 채팅방을 선택했을 때 실행됩니다.
 * 1) 방 상세 조회  2) 메시지 조회  3) 폴링 시작
 *
 * @param {number} roomId
 */
async function openChatRoom(roomId) {
  stopPolling();
  state.activeMode = "api";
  state.activeRoomId = roomId;
  state.lastMessageId = 0;

  try {
    const roomData = await fetchChatRoom(roomId);
    state.activeRoom = roomData.room;
    renderRoomHeader(state.activeRoom);

    const messageData = await fetchMessages(roomId);
    renderMessages(messageData.items || [], "replace");

    state.lastMessageId = messageData.lastMessageId || 0;
    renderChatRoomList();
    // startPolling();                                         API 호출 횟수 소모를 막기 위해 막아둠 (주석 해제하면 다시 폴링 시작됨)
  } catch (error) {
    console.error(error);
    alert(error.message || "채팅방을 불러오지 못했습니다.");
  }
}

/* ───────────────────────────────────────────
   8. AI 챗봇 (API 없음, UI 목업)
   ─────────────────────────────────────────── */

/**
 * AI 챗봇 화면을 표시합니다.
 * 실제 API 호출 없이 정적 안내 UI만 보여줍니다.
 */
function openAiChatbot() {
  stopPolling();
  state.activeMode = "bot";
  state.activeRoomId = null;
  state.activeRoom = null;

  chatPartnerName.textContent = "AI 챗봇";
  chatPartnerBadge.textContent = "BOT";
  chatPartnerBadge.style.backgroundColor = "#ff6f0e";
  chatProductName.textContent = "당근마켓 이용 안내";
  chatProductPrice.textContent = "무엇이든 물어보세요";
  chatProductThumbnail.src = "../../images/chat/ChatBot.png";
  chatProductThumbnail.alt = "AI 챗봇";
  dealCompleteButton.hidden = true;
  reviewButton.hidden = true;

  const nickname = state.currentUser?.nickname || "회원";

  chatMessageList.innerHTML = `
    <div class="chat-message chat-message--received">
      <p class="chat-message-bubble">
        안녕하세요 ${nickname} 님! 궁금한 점을 빠르게 도와드릴게요.
        어떤 점이 궁금하신가요?
      </p>
      <span class="chat-message-time">${formatMessageTime(new Date().toISOString())}</span>
    </div>
    <div class="chat-suggest-list">
      ${AI_SUGGESTIONS.map(
        (text) => `
          <button type="button" class="chat-suggest-button" data-suggest="${text}">
            ${text}
          </button>
        `
      ).join("")}
    </div>
  `;

  chatMessageList.querySelectorAll(".chat-suggest-button").forEach((button) => {
    button.addEventListener("click", () => {
      appendBotConversation(button.dataset.suggest);
    });
  });

  renderChatRoomList();
  scrollToBottom();
}

/**
 * AI 챗봇에서 추천 질문 클릭 또는 사용자 입력 시
 * 질문/답변 말풍선을 화면에 추가합니다.
 * @param {string} question
 */
function appendBotConversation(question) {
  const answerMap = {
    "법적으로 중고 거래를 금지하는 품목이 있나요?":
      "주류·담배·의약품·쿠폰·계정 등 법적으로 거래가 제한되거나 사기 위험이 큰 품목은 거래를 피하는 것이 좋습니다.",
    "당근 마켓에서의 중고거래 팁을 알려주세요":
      "직거래는 밝고 사람 많은 곳에서, 택배 거래는 송장·포장 상태를 꼭 확인하세요. 채팅으로 거래 조건을 명확히 남겨두면 좋습니다.",
    "구매한 물건을 다시 판매해도 문제가 없나요?":
      "본인 소유 물건이라면 재판매가 가능합니다. 다만 상표권·저작권이 있는 디지털 콘텐츠 등은 약관을 확인하세요.",
  };

  const answer =
    answerMap[question] ||
    "좋은 질문이에요! 팀 프로젝트에서는 실제 AI 연동 대신 안내 문구로 대체했습니다.";

  chatMessageList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="chat-message chat-message--sent">
        <p class="chat-message-bubble">${question}</p>
        <span class="chat-message-time">${formatMessageTime(new Date().toISOString())}</span>
      </div>
      <div class="chat-message chat-message--received">
        <p class="chat-message-bubble">${answer}</p>
        <span class="chat-message-time">${formatMessageTime(new Date().toISOString())}</span>
      </div>
    `
  );

  scrollToBottom();
}

/* ───────────────────────────────────────────
   9. 메시지 전송 (POST /api/chats/{id}/messages)
   ─────────────────────────────────────────── */

/**
 * 입력창 내용으로 메시지를 전송합니다.
 * AI 봇 모드일 때는 API 대신 로컬 UI만 갱신합니다.
 */
async function handleSendMessage(event) {
  event.preventDefault();

  const content = chatMessageInput.value.trim();
  if (!content) return;

  // AI 챗봇 모드
  if (state.activeMode === "bot") {
    appendBotConversation(content);
    chatMessageInput.value = "";
    return;
  }

  if (!state.activeRoomId) {
    alert("채팅방을 먼저 선택해주세요.");
    return;
  }

  try {
    const data = await sendMessage(state.activeRoomId, content);
    const newMessage = data.message;

    // 빈 상태 문구가 있으면 제거 후 메시지 추가
    const emptyMessage = chatMessageList.querySelector(".chat-empty-message");
    emptyMessage?.remove();

    chatMessageList.insertAdjacentHTML("beforeend", createMessageHTML(newMessage));
    state.lastMessageId = Math.max(state.lastMessageId, newMessage.id);

    chatMessageInput.value = "";
    scrollToBottom();
    await loadChatRooms();
  } catch (error) {
    console.error(error);
    alert(error.message || "메시지 전송에 실패했습니다.");
  }
}

/* ───────────────────────────────────────────
   10. 메시지 폴링 (GET /api/chats/{id}/messages?after=)
   API 문서: 3~5초 간격 권장 (호출 1회 = 일일 한도 1 차감)
   ─────────────────────────────────────────── */

/**
 * 주기적으로 새 메시지만 가져옵니다.
 */
function startPolling() {
  stopPolling();

  state.pollingTimer = window.setInterval(async () => {
    if (!state.activeRoomId || state.activeMode !== "api") return;

    try {
      const data = await fetchMessages(state.activeRoomId, state.lastMessageId);

      if (data.items?.length) {
        renderMessages(data.items, "append");
        state.lastMessageId = data.lastMessageId || state.lastMessageId;
        await loadChatRooms();
      }
    } catch (error) {
      console.error("폴링 오류:", error);
    }
  }, 4000);
}

/** 폴링 타이머를 중지합니다. */
function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

/* ───────────────────────────────────────────
   11. 거래완료 (PATCH /api/products/{id}/status)
   ─────────────────────────────────────────── */

/**
 * 판매자가 "거래완료"를 누르면 상품 status를 sold로 변경합니다.
 */
async function handleDealComplete() {
  const product = state.activeRoom?.product;
  if (!product || state.activeRoom?.myRole !== "seller") return;

  const confirmed = confirm("이 상품을 거래완료 처리할까요?");
  if (!confirmed) return;

  try {
    await updateProductStatus(product.id, "sold");
    alert("거래완료 처리되었습니다. 상대방에게 매너 평가를 남길 수 있습니다.");
    await openChatRoom(state.activeRoomId);
  } catch (error) {
    console.error(error);
    alert(error.message || "거래 상태 변경에 실패했습니다.");
  }
}

/* ───────────────────────────────────────────
   11-2. 매너 평가 (POST /api/chats/{id}/review)
   ─────────────────────────────────────────── */

function openReviewDialog() {
  if (reviewButton.hidden || reviewButton.disabled) return;

  reviewForm.reset();
  reviewDialog?.showModal();
}

function closeReviewDialog() {
  reviewDialog?.close();
}

/**
 * 매너 평가를 전송합니다. 대상은 서버가 채팅 상대방으로 정합니다.
 */
async function handleSubmitReview(event) {
  event.preventDefault();

  if (!state.activeRoomId || state.activeMode !== "api") return;

  const rating = reviewForm.querySelector('input[name="reviewRating"]:checked')?.value;
  const comment = reviewComment.value.trim();

  if (!rating) {
    alert("평가 등급을 선택해주세요.");
    return;
  }

  try {
    const data = await submitChatReview(state.activeRoomId, rating, comment);

    if (state.activeRoom) {
      state.activeRoom.myReview = data.review;
      state.activeRoom.canReview = false;

      if (data.partner) {
        state.activeRoom.partner = data.partner;
      }
    }

    closeReviewDialog();
    renderRoomHeader(state.activeRoom);
    alert("매너 평가를 남겼습니다.");
  } catch (error) {
    console.error(error);
    alert(error.message || "매너 평가에 실패했습니다.");
  }
}

/* ───────────────────────────────────────────
   12. URL 쿼리 처리
   ?productId=5  → 채팅방 생성 후 해당 방 열기
   ?roomId=4     → 특정 채팅방 바로 열기
   ─────────────────────────────────────────── */

/**
 * 상품 상세 등 다른 페이지에서 넘어온 query parameter를 처리합니다.
 */
async function handleQueryParams() {
  const params = new URLSearchParams(location.search);
  const productId = params.get("productId");
  const roomId = params.get("roomId");

  if (productId) {
    const data = await createChatRoom(productId);
    await loadChatRooms();
    await openChatRoom(data.room.id);
    return;
  }

  if (roomId) {
    await openChatRoom(Number(roomId));
    return;
  }

  // 기본: AI 챗봇 또는 첫 번째 방
  if (state.rooms.length > 0) {
    await openChatRoom(state.rooms[0].id);
  } else {
    openAiChatbot();
  }
}

/* ───────────────────────────────────────────
   13. 페이지 초기화
   ─────────────────────────────────────────── */

/**
 * 페이지 로드 시 한 번 실행되는 진입 함수입니다.
 */
async function initChatPage() {
  if (!ensureLoggedIn()) return;

  syncHeaderAuthUI();
  bindLogout();

  chatInputForm?.addEventListener("submit", handleSendMessage);
  dealCompleteButton?.addEventListener("click", handleDealComplete);
  reviewButton?.addEventListener("click", openReviewDialog);
  reviewCancelButton?.addEventListener("click", closeReviewDialog);
  reviewForm?.addEventListener("submit", handleSubmitReview);

  unreadOnlyToggle?.addEventListener("change", renderChatRoomList);

  try {
    const profileData = await fetchMyProfile();
    state.currentUser = profileData.user;
    chatListTitle.textContent = state.currentUser.nickname || "내 아이디";

    await loadChatRooms();
    await handleQueryParams();
  } catch (error) {
    console.error(error);
    alert("사용자 정보를 불러오지 못했습니다. 다시 로그인해주세요.");
    location.href = "../auth/login.html";
  }
}

window.addEventListener("beforeunload", stopPolling);

initChatPage();
