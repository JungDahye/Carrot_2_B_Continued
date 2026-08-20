/**
 * chat.js
 * ─────────────────────────────────────────────────────────
 * pages/chat/chat.html 전용 화면 스크립트입니다.
 * 서버 요청은 apiChat.js가 하고, 이 파일은 결과를 DOM에 그립니다.
 *
 * [사용 API]
 * - GET    /api/auth/me                 → 내 닉네임
 * - GET    /api/chats                   → 왼쪽 채팅방 목록
 * - GET    /api/chats/{id}              → 오른쪽 위 상대/상품
 * - GET    /api/chats/{id}/messages     → 말풍선
 * - POST   /api/chats/{id}/messages     → 전송
 * - POST   /api/chats                   → ?productId= 로 방 만들기
 * - PATCH  /api/products/{id}/status    → 거래완료
 * - POST   /api/chats/{id}/review       → 매너 평가
 * - DELETE /api/chats/{id}              → 채팅방 나가기
 *
 * [AI 챗봇]
 * API에 없는 목업입니다. 목록 맨 위에 고정이고, 클릭해도 서버를 치지 않습니다.
 *
 * [폴링]
 * startPolling()은 4초마다 새 메시지를 조회합니다.
 * 일일 API 한도를 아끼려고 openChatRoom() 안에서는 호출하지 않습니다.
 */
// 채팅에 필요한 API 함수만 apiChat.js에서 가져옵니다.
import {
  fetchMyProfile,
  fetchChatRooms,
  fetchChatRoom,
  fetchMessages,
  sendMessage,
  createChatRoom,
  updateProductStatus,
  submitChatReview,
  leaveChatRoom,
} from "./api/apiChat.js";

/* ───────────────────────────────────────────
   1. DOM 요소 참조
   querySelector는 페이지에서 해당 요소를 찾아 변수에 저장합니다.
   ─────────────────────────────────────────── */
const chatListTitle = document.querySelector(".chat-list-title"); // 왼쪽 위 "내 아이디" 자리
const unreadOnlyToggle = document.querySelector("#unreadOnlyToggle"); // 읽지 않은 항목 토글
const chatRoomList = document.querySelector(".chat-room-list"); // 왼쪽 방 목록 ul
const chatRoomHeader = document.querySelector(".chat-room-header"); // 오른쪽 상단 헤더
const chatPartnerName = document.querySelector(".chat-partner-name"); // 상대 닉네임
const chatPartnerBadge = document.querySelector(".chat-partner-badge"); // 매너온도 뱃지
const chatProductThumbnail = document.querySelector(".chat-product-thumbnail img"); // 상품 썸네일 img
const chatProductName = document.querySelector(".chat-product-name"); // 상품 제목
const chatProductPrice = document.querySelector(".chat-product-price"); // 가격
const dealCompleteButton = document.querySelector(".deal-complete-button"); // 거래완료 버튼
const reviewButton = document.querySelector("#reviewButton"); // 리뷰 남기기 버튼
const reviewDialog = document.querySelector("#reviewDialog"); // 매너 평가 모달
const reviewForm = document.querySelector("#reviewForm"); // 모달 안의 폼
const reviewCancelButton = document.querySelector("#reviewCancelButton"); // 모달 취소
const reviewComment = document.querySelector("#reviewComment"); // 후기 textarea
const chatMessageList = document.querySelector("#chatMessageList"); // 말풍선이 쌓이는 영역
const chatInputForm = document.querySelector("#chatInputForm"); // 하단 입력 폼
const chatMessageInput = document.querySelector("#chatMessageInput"); // 메시지 textarea
const leaveChatButton = document.querySelector("#leaveChatButton"); // 채팅방 나가기
const leaveConfirmDialog = document.querySelector("#leaveConfirmDialog"); // 나가기 확인
const leaveConfirmCancel = document.querySelector("#leaveConfirmCancel"); // 나가기 "취소"
const leaveConfirmOk = document.querySelector("#leaveConfirmOk"); // 나가기 "네"
const leaveDoneDialog = document.querySelector("#leaveDoneDialog"); // 나가기 완료
const leaveDoneOk = document.querySelector("#leaveDoneOk"); // 나가기 완료 "확인"
const dealConfirmDialog = document.querySelector("#dealConfirmDialog"); // 거래완료 확인
const dealConfirmCancel = document.querySelector("#dealConfirmCancel"); // 거래완료 "취소"
const dealConfirmOk = document.querySelector("#dealConfirmOk"); // 거래완료 "확인"
const dealDoneDialog = document.querySelector("#dealDoneDialog"); // 거래완료 안내
const dealDoneOk = document.querySelector("#dealDoneOk"); // 거래완료 안내 "확인"
const reviewDoneDialog = document.querySelector("#reviewDoneDialog"); // 매너 평가 완료
const reviewDoneOk = document.querySelector("#reviewDoneOk"); // 평가 완료 "확인"

/* ───────────────────────────────────────────
   2. 페이지 전역 상태
   화면이 바뀌어도 기억해야 하는 값들을 한 객체에 모읍니다.
   ─────────────────────────────────────────── */
const state = {
  currentUser: null, // GET /api/auth/me 의 user. 내 id/닉네임
  rooms: [], // GET /api/chats 의 items. 왼쪽 목록 데이터
  activeRoomId: null, // 지금 열린 방 번호. 챗봇이면 null
  activeRoom: null, // GET /api/chats/{id} 의 room 객체
  activeMode: "api", // "api" = 실제 채팅, "bot" = AI 목업
  lastMessageId: 0, // 폴링 때 after= 로 넘길 마지막 메시지 id
  pollingTimer: null, // setInterval이 돌려 준 타이머 id
};

// 챗봇 화면에 미리 넣어 둘 추천 질문 3개 (서버와 무관)
const AI_SUGGESTIONS = [
  "법적으로 중고 거래를 금지하는 품목이 있나요?",
  "당근 마켓에서의 중고거래 팁을 알려주세요",
  "구매한 물건을 다시 판매해도 문제가 없나요?",
];

/* ───────────────────────────────────────────
   3. 유틸 함수
   ─────────────────────────────────────────── */

/**
 * localStorage의 token만 보고 로그인 여부를 판단합니다.
 * 토큰이 없으면 알림 후 로그인 페이지로 보냅니다.
 */
function ensureLoggedIn() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("채팅은 로그인 후 이용할 수 있습니다.");
    location.href = "../auth/login.html";
    return false; // initChatPage가 여기서 중단되도록
  }

  return true;
}

/**
 * 550000 → "550,000원"
 */
function formatPrice(price) {
  return `${Number(price).toLocaleString("ko-KR")}원`;
}

/**
 * "2026-08-19T08:20:00.000Z" → "오전 8:20"
 */
function formatMessageTime(isoString) {
  const date = new Date(isoString); // ISO 문자열을 Date 객체로
  const hours = date.getHours(); // 0~23시
  const minutes = String(date.getMinutes()).padStart(2, "0"); // 8 → "08"
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 || 12; // 0시는 12시로, 13시는 1시로

  return `${period} ${hour12}:${minutes}`;
}

/**
 * 목록의 "화곡동 · 3주 전" 에서 시간 부분만 만듭니다.
 */
function formatRelativeTime(isoString) {
  if (!isoString) return ""; // 날짜가 없으면 빈 글자

  const diffMs = Date.now() - new Date(isoString).getTime(); // 지금과 차이(밀리초)
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
 * "서울시 강서구 화곡동" → "화곡동" (공백으로 나눈 마지막 토큰)
 */
function extractDong(location = "") {
  const parts = location.trim().split(/\s+/);
  return parts[parts.length - 1] || location;
}

/**
 * 말풍선 영역을 맨 아래로 스크롤해서 최신 메시지가 보이게 합니다.
 */
function scrollToBottom() {
  chatMessageList.scrollTop = chatMessageList.scrollHeight;
}

/* ───────────────────────────────────────────
   4. 헤더(로그인/로그아웃) 처리
   실제 로그아웃 클릭은 header.js가 처리합니다.
   여기서는 data-login만 token 기준으로 맞춥니다.
   ─────────────────────────────────────────── */
function syncHeaderAuthUI() {
  const isLogin = Boolean(localStorage.getItem("token")); // 토큰 있으면 true
  const header = document.querySelector("header");

  if (header) {
    // header.css가 [data-login="true"] 로 로그인/로그아웃 버튼을 보여 줌
    header.dataset.login = String(isLogin);
  }
}

/* ───────────────────────────────────────────
   5. 채팅방 목록 렌더링 (GET /api/chats)
   ─────────────────────────────────────────── */

/**
 * state.rooms를 왼쪽 ul HTML로 그립니다.
 * AI 챗봇 li는 API 결과가 아니라 항상 맨 위에 직접 넣습니다.
 */
function renderChatRoomList() {
  const showUnreadOnly = unreadOnlyToggle?.checked; // 토글이 켜져 있으면 true
  const filteredRooms = showUnreadOnly
    ? state.rooms.filter((room) => room.unreadCount > 0) // 안 읽은 것만
    : state.rooms;

  // 각 방을 <li> 문자열로 만든 뒤 하나로 이어 붙입니다.
  const roomItemsHTML = filteredRooms
    .map((room) => {
      const partnerName = room.partner?.nickname || "알 수 없음";
      const dong = extractDong(room.product?.location);
      const timeLabel = formatRelativeTime(room.lastMessageAt || room.createdAt);
      const preview = room.lastMessage?.content || "아직 메시지가 없습니다.";
      const thumb =
        room.product?.thumbnail ||
        room.product?.images?.[0] ||
        "../../images/search/no-image.png"; // 이미지 없으면 기본 그림
      const isActive =
        state.activeMode === "api" && state.activeRoomId === room.id;

      return `
        <li
          class="chat-room-item${isActive ? " is-active" : ""}"
          data-room-id="${room.id}"
          role="button"
          tabindex="0"
        >
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

  // 챗봇 항목 + 방 목록. 방이 하나도 없으면 빈 안내 li를 넣습니다.
  chatRoomList.innerHTML = `
    <li
      class="chat-room-item chat-room-item--bot${state.activeMode === "bot" ? " is-active" : ""}"
      data-room-type="bot"
      role="button"
      tabindex="0"
    >
      <div class="chat-bot-icon">
        <img src="../../images/chat/icon-chatbot.png" alt="AI 챗봇">
      </div>
      <div class="chat-room-info">
        <p class="chat-room-name">AI 챗봇</p>
        <p class="chat-bot-preview">궁금한 내용을 물어보세요!</p>
      </div>
    </li>
    ${roomItemsHTML || `<li class="chat-room-empty">아직 채팅방이 없습니다.</li>`}
  `;

  // innerHTML로 새로 그렸으므로 클릭 이벤트를 다시 달아야 합니다.
  bindChatRoomListEvents();
}

/**
 * 방 목록 각 li에 클릭 리스너를 붙입니다.
 */
function bindChatRoomListEvents() {
  chatRoomList.querySelectorAll(".chat-room-item").forEach((item) => {
    item.addEventListener("click", () => {
      // 챗봇은 data-room-type="bot" 이라 API 방을 열지 않습니다.
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
 * 서버에서 목록을 다시 받아 state.rooms를 갱신한 뒤 화면을 그립니다.
 */
async function loadChatRooms() {
  const data = await fetchChatRooms();
  state.rooms = data.items || []; // items가 없으면 빈 배열
  renderChatRoomList();
}

/* ───────────────────────────────────────────
   6. 메시지 렌더링
   ─────────────────────────────────────────── */

/**
 * 메시지 1개를 말풍선 HTML로 만듭니다.
 * 보낸 사람이 나면 주황(sent), 아니면 회색(received)
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
 * messages 배열을 채팅창에 넣습니다.
 * replace: 방을 처음 열 때 통째로 교체
 * append: 폴링으로 온 새 메시지만 뒤에 추가
 */
function renderMessages(messages, mode = "replace") {
  if (mode === "replace") {
    chatMessageList.innerHTML = ""; // 기존 말풍선 비우기
  }

  // 처음 열었는데 메시지가 하나도 없으면 안내 문구만
  if (!messages.length && mode === "replace") {
    chatMessageList.innerHTML = `
      <p class="chat-empty-message">아직 주고받은 메시지가 없습니다.<br>첫 메시지를 보내보세요!</p>
    `;
    return;
  }

  const html = messages.map(createMessageHTML).join("");

  if (mode === "append") {
    chatMessageList.insertAdjacentHTML("beforeend", html); // 맨 아래에 이어 붙임
  } else {
    chatMessageList.innerHTML = html;
  }

  scrollToBottom();
}

/* ───────────────────────────────────────────
   7. 채팅방 열기 / 상단 정보 갱신
   ─────────────────────────────────────────── */

/**
 * 오른쪽 위 상대 이름, 매너온도, 상품 정보, 거래완료/리뷰 버튼을 room으로 채웁니다.
 */
function renderRoomHeader(room) {
  const partner = room.partner;
  const partnerName = partner?.nickname || "상대방";
  const product = room.product;
  const mannerTemp = partner?.mannerTemp ?? 36.5; // 없으면 기본 36.5
  const mannerColor = partner?.mannerLevel?.color || "#ff6f0e"; // 서버가 준 레벨 색

  // 챗봇 전용 클래스 제거 → 상품 줄·뱃지가 다시 보임
  chatRoomHeader?.classList.remove("chat-room-header--bot");
  chatPartnerName.textContent = partnerName;
  chatPartnerBadge.textContent = `${mannerTemp}℃`;
  chatPartnerBadge.style.backgroundColor = mannerColor; // 인라인으로 레벨 색 적용
  chatProductName.textContent = product?.title || "상품 정보 없음";
  chatProductPrice.textContent = formatPrice(product?.price || 0);

  const imageUrl =
    product?.thumbnail || product?.images?.[0] || "../../images/search/no-image.png";

  chatProductThumbnail.src = imageUrl;
  chatProductThumbnail.alt = product?.title || "거래 상품";

  const isSeller = room.myRole === "seller"; // 이 방에서의 내 역할
  const isSold = product?.status === "sold";

  // 판매자는 항상 버튼 보임. 구매자는 거래완료된 뒤에만 "거래완료됨" 표시
  dealCompleteButton.hidden = !(isSeller || isSold);
  dealCompleteButton.disabled = isSold; // 이미 완료면 다시 못 누름
  dealCompleteButton.textContent = isSold ? "거래완료됨" : "거래완료";

  const alreadyReviewed = Boolean(room.myReview);
  reviewButton.hidden = !isSold; // 거래완료 전에는 리뷰 버튼 숨김
  reviewButton.disabled = alreadyReviewed; // 이미 남겼으면 비활성
  reviewButton.textContent = alreadyReviewed ? "평가완료" : "리뷰 남기기";
  if (leaveChatButton) leaveChatButton.hidden = false; // 실제 채팅방이면 나가기 버튼 표시
}

/**
 * 실제 API 채팅방을 엽니다.
 * 방 상세 → 메시지 → 목록 하이라이트 순서로 진행합니다.
 */
async function openChatRoom(roomId) {
  stopPolling(); // 이전 방 폴링이 남아 있으면 끔
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
    renderChatRoomList(); // 현재 방 is-active 표시를 위해 목록 다시 그림
    // startPolling(); // 일일 API 한도를 아끼려고 꺼 둠. 켜면 4초마다 새 메시지 조회
  } catch (error) {
    console.error(error);
    alert(error.message || "채팅방을 불러오지 못했습니다.");
  }
}

/* ───────────────────────────────────────────
   8. AI 챗봇 (API 없음, UI 목업)
   ─────────────────────────────────────────── */

/**
 * 챗봇 화면. fetch를 하지 않고 고정 HTML만 넣습니다.
 */
function openAiChatbot() {
  stopPolling();
  state.activeMode = "bot";
  state.activeRoomId = null;
  state.activeRoom = null;

  // CSS에서 상품 줄·매너 뱃지를 숨기고 챗봇 아이콘만 보여 줌
  chatRoomHeader?.classList.add("chat-room-header--bot");
  chatPartnerName.textContent = "AI 챗봇";
  dealCompleteButton.hidden = true;
  reviewButton.hidden = true;
  if (leaveChatButton) leaveChatButton.hidden = true; // 챗봇은 API 방이 아니므로 나가기 숨김

  const nickname = state.currentUser?.nickname || "회원";

  chatMessageList.innerHTML = `
    <div class="chat-message chat-message--received">
      <p class="chat-message-bubble">안녕하세요 ${nickname} 님! 궁금한 점을 빠르게 도와드릴게요.
어떤 점이 궁금하신가요?</p>
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

  // 추천 질문 버튼을 누르면 그 문구로 질문/답변 말풍선을 추가
  chatMessageList.querySelectorAll(".chat-suggest-button").forEach((button) => {
    button.addEventListener("click", () => {
      appendBotConversation(button.dataset.suggest);
    });
  });

  renderChatRoomList();
  scrollToBottom();
}

/**
 * 챗봇 대화 한 턴을 화면에만 추가합니다. 서버로 보내지 않습니다.
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

  // 준비된 질문이 아니면 기본 안내 문구
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
   9. 메시지 전송
   ─────────────────────────────────────────── */

/**
 * 입력 폼 submit. 챗봇이면 로컬 UI만, 실제 방이면 POST /messages
 */
async function handleSendMessage(event) {
  event.preventDefault(); // 폼이 페이지를 새로고침하지 않게

  const content = chatMessageInput.value.trim();
  if (!content) return; // 빈 문자열이면 보내지 않음

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

    const emptyMessage = chatMessageList.querySelector(".chat-empty-message");
    emptyMessage?.remove(); // "아직 메시지가 없습니다" 안내 제거

    chatMessageList.insertAdjacentHTML("beforeend", createMessageHTML(newMessage));
    state.lastMessageId = Math.max(state.lastMessageId, newMessage.id);

    chatMessageInput.value = "";
    scrollToBottom();
    await loadChatRooms(); // 왼쪽 미리보기(마지막 메시지) 갱신
  } catch (error) {
    console.error(error);
    alert(error.message || "메시지 전송에 실패했습니다.");
  }
}

/* ───────────────────────────────────────────
   10. 메시지 폴링
   호출 1회 = 일일 한도 1회. 지금은 openChatRoom에서 시작하지 않음.
   다시 쓰려면 openChatRoom()의 startPolling() 주석을 해제하면 됩니다.
   ─────────────────────────────────────────── */

/** 4초마다 after=lastMessageId 로 새 메시지만 가져옵니다. */
function startPolling() {
  stopPolling(); // 타이머가 두 개 돌지 않게 기존 것을 먼저 제거

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
  }, 4000); // 4초마다
}

/** 방 전환·페이지 종료 때 타이머를 끊어 중복 요청을 막습니다. */
function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

/* ───────────────────────────────────────────
   11. 거래완료 (판매자만 확인창을 염)
   ─────────────────────────────────────────── */

/** 거래완료 버튼을 누르면 확인 모달을 엽니다. 판매자가 아니면 무시합니다. */
function openDealConfirmDialog() {
  const product = state.activeRoom?.product;
  if (!product || state.activeRoom?.myRole !== "seller") return;
  dealConfirmDialog?.showModal();
}

function closeDealConfirmDialog() {
  dealConfirmDialog?.close();
}

/**
 * 확인 모달에서 "확인"을 누르면 상품 status를 sold로 바꿉니다.
 */
async function confirmDealComplete() {
  const product = state.activeRoom?.product;
  if (!product || state.activeRoom?.myRole !== "seller") return;

  try {
    await updateProductStatus(product.id, "sold");
    closeDealConfirmDialog();
    dealDoneDialog?.showModal();
  } catch (error) {
    console.error(error);
    closeDealConfirmDialog();
    alert(error.message || "거래 상태 변경에 실패했습니다.");
  }
}

/**
 * 완료 모달에서 "확인"을 누르면 방 정보를 다시 불러 리뷰 버튼을 보여 줍니다.
 */
async function finishDealComplete() {
  dealDoneDialog?.close();
  await openChatRoom(state.activeRoomId);
}

/* ───────────────────────────────────────────
   12. 매너 평가
   거래완료(sold) 뒤에만 리뷰 버튼이 보입니다.
   ─────────────────────────────────────────── */

/** 리뷰 버튼이 보이면 평가 모달을 엽니다. */
function openReviewDialog() {
  if (reviewButton.hidden || reviewButton.disabled) return;

  reviewForm.reset(); // 이전에 고른 등급/후기 초기화
  reviewDialog?.showModal(); // <dialog>를 화면 가운데 모달로 염
}

function closeReviewDialog() {
  reviewDialog?.close();
}

/**
 * 매너 평가 모달 제출. POST /api/chats/{id}/review
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
      state.activeRoom.myReview = data.review; // 다시 못 남기도록 저장
      state.activeRoom.canReview = false;

      if (data.partner) {
        state.activeRoom.partner = data.partner; // 상대 매너온도가 바뀐 객체
      }
    }

    closeReviewDialog();
    renderRoomHeader(state.activeRoom); // 뱃지 색/평가완료 버튼 갱신
    reviewDoneDialog?.showModal();
  } catch (error) {
    console.error(error);
    alert(error.message || "매너 평가에 실패했습니다.");
  }
}

/* ───────────────────────────────────────────
   13. 채팅방 나가기
   ─────────────────────────────────────────── */

/** 나가기 확인 모달을 화면 가운데에 엽니다. 챗봇 화면에서는 열리지 않습니다. */
function openLeaveConfirmDialog() {
  if (!state.activeRoomId || state.activeMode !== "api") return;
  leaveConfirmDialog?.showModal();
}

function closeLeaveConfirmDialog() {
  leaveConfirmDialog?.close();
}

/**
 * 확인 모달에서 "네"를 누르면 DELETE /api/chats/{id} 를 호출합니다.
 */
async function confirmLeaveChat() {
  if (!state.activeRoomId || state.activeMode !== "api") return;

  try {
    await leaveChatRoom(state.activeRoomId);
    closeLeaveConfirmDialog();
    leaveDoneDialog?.showModal(); // "채팅방에서 나갔습니다" 모달
  } catch (error) {
    console.error(error);
    closeLeaveConfirmDialog();
    alert(error.message || "채팅방 나가기에 실패했습니다.");
  }
}

/**
 * 완료 모달에서 "확인"을 누르면 목록을 갱신하고 다른 방 또는 챗봇으로 이동합니다.
 */
async function finishLeaveChat() {
  leaveDoneDialog?.close();

  await loadChatRooms();

  if (state.rooms.length > 0) {
    await openChatRoom(state.rooms[0].id);
  } else {
    openAiChatbot();
  }
}

/* ───────────────────────────────────────────
   14. URL 쿼리 처리
   ?productId=5  → 방 생성 후 열기 (중고거래 글의 "채팅하기")
   ?roomId=4     → 그 방 바로 열기
   쿼리가 없으면 목록 첫 방, 방도 없으면 챗봇
   ─────────────────────────────────────────── */
async function handleQueryParams() {
  const params = new URLSearchParams(location.search); // ? 뒤 쿼리 읽기
  const productId = params.get("productId");
  const roomId = params.get("roomId");

  if (productId) {
    const data = await createChatRoom(productId); // 이미 있으면 서버가 기존 방을 줌
    await loadChatRooms();
    await openChatRoom(data.room.id);
    return;
  }

  if (roomId) {
    await openChatRoom(Number(roomId));
    return;
  }

  if (state.rooms.length > 0) {
    await openChatRoom(state.rooms[0].id);
  } else {
    openAiChatbot();
  }
}

/* ───────────────────────────────────────────
   15. 페이지 초기화
   로그인 확인 → 헤더 → 버튼 이벤트 → 내 정보/목록 → URL 처리
   ─────────────────────────────────────────── */
async function initChatPage() {
  if (!ensureLoggedIn()) return; // 미로그인이면 여기서 끝

  syncHeaderAuthUI();

  // 입력·거래완료·리뷰·나가기 버튼과 확인창
  chatInputForm?.addEventListener("submit", handleSendMessage);
  dealCompleteButton?.addEventListener("click", openDealConfirmDialog);
  dealConfirmCancel?.addEventListener("click", closeDealConfirmDialog);
  dealConfirmOk?.addEventListener("click", confirmDealComplete);
  dealDoneOk?.addEventListener("click", finishDealComplete);
  reviewButton?.addEventListener("click", openReviewDialog);
  reviewCancelButton?.addEventListener("click", closeReviewDialog);
  reviewForm?.addEventListener("submit", handleSubmitReview);
  reviewDoneOk?.addEventListener("click", () => reviewDoneDialog?.close());
  leaveChatButton?.addEventListener("click", openLeaveConfirmDialog);
  leaveConfirmCancel?.addEventListener("click", closeLeaveConfirmDialog);
  leaveConfirmOk?.addEventListener("click", confirmLeaveChat);
  leaveDoneOk?.addEventListener("click", finishLeaveChat);

  unreadOnlyToggle?.addEventListener("change", renderChatRoomList); // 목록만 다시 그림

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

// 탭을 닫거나 새로고침할 때 폴링 타이머 정리
window.addEventListener("beforeunload", stopPolling);

// 이 파일이 로드되면 채팅 페이지를 시작합니다.
initChatPage();
