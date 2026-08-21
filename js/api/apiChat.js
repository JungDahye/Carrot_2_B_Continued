/**
 * apiChat.js
 * ─────────────────────────────────────────────────────────
 * 채팅 페이지가 서버와 대화할 때 쓰는 요청 함수만 모아 둔 파일입니다.
 * 화면을 그리는 일은 chat.js가 하고, 이 파일은 fetch만 담당합니다.
 *
 * 모든 요청에 팀 API KEY(X-API-Key)가 필요합니다.
 * 채팅/상품 상태/리뷰 API는 로그인 JWT(Authorization: Bearer)도 필요합니다.
 *
 * [chat.js가 쓰는 함수]
 * fetchMyProfile, fetchChatRooms, fetchChatRoom, fetchMessages,
 * sendMessage, createChatRoom, updateProductStatus,
 * submitChatReview, leaveChatRoom
 *
 * [지금은 화면에서 안 쓰지만 같은 API라 남겨 둔 함수]
 * fetchUserReviews, fetchChatReview
 */

// apiConfig.js에 적힌 서버 주소와 팀 키를 가져옵니다.
import {
  API_TEAM_KEY, // 요청 헤더 X-API-Key에 넣을 팀 키
  API_AUTH_URL, // .../api/auth
  API_CHAT_URL, // .../api/chats
  API_PRODUCT_URL, // .../api/products
  API_BASE_URL, // https://carrot.techfree.kr
} from "./apiConfig.js";

/**
 * fetch에 공통으로 넣을 헤더 객체를 만듭니다.
 * @param {boolean} withJson - true면 JSON body를 보낸다는 뜻이라 Content-Type을 추가
 * @returns {Object} headers
 */
function buildHeaders(withJson = true) {
  // 로그인 때 저장해 둔 JWT. 없으면 비로그인 상태
  const token = localStorage.getItem("token");

  // 팀 키는 GET/POST 구분 없이 항상 넣습니다. 없으면 서버가 요청을 거절합니다.
  const headers = {
    "X-API-Key": API_TEAM_KEY,
  };

  // POST, PATCH처럼 body가 JSON일 때만 Content-Type을 붙입니다.
  // GET에 붙이면 서버가 본문을 기대해서 문제가 날 수 있어 false로 호출합니다.
  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  // 토큰이 있으면 "Bearer 토큰문자열" 형식으로 인증 헤더를 추가합니다.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ───────────────────────────────────────────
   공통: 응답 JSON 파싱 + 실패 검사
   ─────────────────────────────────────────── */

/**
 * 서버가 준 Response를 JSON으로 읽고, 실패면 Error를 throw 합니다.
 * fetch는 404/401이어도 예외를 안 던지므로 여기서 직접 검사합니다.
 *
 * @param {Response} response
 * @returns {Promise<any>} 성공 시 파싱된 JSON
 */
async function parseResponse(response) {
  // 본문을 자바스크립트 객체로 변환
  const data = await response.json();

  // response.ok 는 상태 코드 200~299일 때만 true
  if (!response.ok) {
    // 서버가 준 message가 있으면 그걸, 없으면 기본 문구를 에러로 던짐
    throw new Error(data.message || "요청에 실패했습니다.");
  }

  return data;
}

/* ───────────────────────────────────────────
   내 정보 / 채팅방 / 메시지
   ─────────────────────────────────────────── */

/**
 * GET /api/auth/me
 * 지금 로그인한 내 정보(user)를 가져옵니다.
 * 채팅 목록 위 "내 아이디"에 nickname을 넣을 때 씁니다.
 */
export async function fetchMyProfile() {
  // API_AUTH_URL + "/me" → https://carrot.techfree.kr/api/auth/me
  const response = await fetch(`${API_AUTH_URL}/me`, {
    method: "GET",
    headers: buildHeaders(false), // GET이라 JSON Content-Type은 생략
  });

  return parseResponse(response);
}

/**
 * GET /api/chats
 * 내가 들어 있는 채팅방 목록입니다.
 * 응답 items[] 안에 partner, product, lastMessage, unreadCount가 있습니다.
 */
export async function fetchChatRooms() {
  const response = await fetch(API_CHAT_URL, {
    method: "GET",
    headers: buildHeaders(false),
  });

  return parseResponse(response);
}

/**
 * GET /api/chats/{id}
 * 방 하나 상세: 상대방, 상품, 내가 판매자인지(myRole), 리뷰 가능 여부 등
 *
 * @param {number|string} roomId
 */
export async function fetchChatRoom(roomId) {
  // 주소 뒤에 방 번호를 붙여 /api/chats/4 처럼 만듭니다.
  const response = await fetch(`${API_CHAT_URL}/${roomId}`, {
    method: "GET",
    headers: buildHeaders(false),
  });

  return parseResponse(response);
}

/**
 * GET /api/chats/{id}/messages
 * 메시지 목록. after를 넣으면 그 ID보다 큰 새 메시지만 가져옵니다(폴링).
 *
 * @param {number|string} roomId
 * @param {number|null} after - 이 값보다 큰 id만 조회. 없으면 최근 목록
 * @param {number} limit - 한 번에 가져올 개수
 */
export async function fetchMessages(roomId, after = null, limit = 50) {
  // ?limit=50 쿼리를 만들기 위한 객체. 값은 전부 문자열이어야 합니다.
  const params = new URLSearchParams({ limit: String(limit) });

  // after가 0, null, undefined면 쿼리를 안 붙입니다. (처음 방 열 때)
  if (after) {
    params.set("after", String(after));
  }

  // 예: /api/chats/4/messages?limit=50 또는 ...?limit=50&after=12
  const response = await fetch(
    `${API_CHAT_URL}/${roomId}/messages?${params.toString()}`,
    {
      method: "GET",
      headers: buildHeaders(false),
    }
  );

  return parseResponse(response);
}

/**
 * POST /api/chats/{id}/messages
 * 채팅방에 글 한 줄을 보냅니다.
 *
 * @param {number|string} roomId
 * @param {string} content
 */
export async function sendMessage(roomId, content) {
  const response = await fetch(`${API_CHAT_URL}/${roomId}/messages`, {
    method: "POST",
    headers: buildHeaders(true), // JSON body이므로 Content-Type 포함
    // { content: "안녕하세요" } 를 문자열로 바꿔 서버에 전달
    body: JSON.stringify({ content }),
  });

  return parseResponse(response);
}

/* ───────────────────────────────────────────
   채팅방 나가기 / 방 만들기 / 거래완료
   ─────────────────────────────────────────── */

/**
 * DELETE /api/chats/{id}
 * 채팅방에서 나갑니다. 성공하면 목록에서 해당 방이 사라집니다.
 *
 * @param {number|string} roomId
 */
export async function leaveChatRoom(roomId) {
  // /api/chats/4 처럼 방 번호를 주소에 붙입니다.
  const response = await fetch(`${API_CHAT_URL}/${roomId}`, {
    method: "DELETE", // 방 나가기. body는 없습니다.
    headers: buildHeaders(false), // GET과 같이 JSON Content-Type은 생략
  });

  return parseResponse(response); // { message, id } 또는 실패 시 throw
}

/**
 * POST /api/chats
 * 상품에서 "채팅하기"를 누르면 방을 만듭니다.
 * 이미 같은 상품으로 방이 있으면 서버가 기존 방을 그대로 돌려줍니다.
 *
 * @param {number|string} productId - URL 쿼리에서 오면 문자열일 수 있음
 */
export async function createChatRoom(productId) {
  const response = await fetch(API_CHAT_URL, {
    method: "POST",
    headers: buildHeaders(true),
    // 서버는 숫자를 원하므로 Number()로 변환. "5" → 5
    body: JSON.stringify({ productId: Number(productId) }),
  });

  return parseResponse(response);
}

/**
 * PATCH /api/products/{id}/status
 * 판매자가 거래완료를 누르면 상품 status를 바꿉니다.
 *
 * @param {number|string} productId
 * @param {"on_sale"|"reserved"|"sold"} status
 */
export async function updateProductStatus(productId, status) {
  const response = await fetch(`${API_PRODUCT_URL}/${productId}/status`, {
    method: "PATCH", // 일부만 수정
    headers: buildHeaders(true),
    body: JSON.stringify({ status }),
  });

  return parseResponse(response);
}

/* ───────────────────────────────────────────
   매너 평가
   ─────────────────────────────────────────── */

/**
 * GET /api/users/{id}/reviews
 * 그 사람이 받은 매너 평가 목록 (페이지네이션).
 * chat.html에서는 아직 호출하지 않습니다.
 *
 * @param {number|string} userId
 * @param {number} page
 * @param {number} limit
 */
export async function fetchUserReviews(userId, page = 1, limit = 20) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/reviews?${params.toString()}`,
    {
      method: "GET",
      headers: buildHeaders(false),
    }
  );

  return parseResponse(response);
}

/**
 * GET /api/chats/{id}/review
 * 이 방에서 내가 남긴 평가(myReview)와 받은 평가(receivedReview)
 * 아직 없으면 null 입니다. chat.js는 방 상세의 myReview를 쓰므로 여기 함수는 예비입니다.
 *
 * @param {number|string} roomId
 */
export async function fetchChatReview(roomId) {
  const response = await fetch(`${API_CHAT_URL}/${roomId}/review`, {
    method: "GET",
    headers: buildHeaders(false),
  });

  return parseResponse(response);
}

/**
 * POST /api/chats/{id}/review
 * 거래완료된 방에서 상대에게 매너 평가를 남깁니다.
 * 대상 user id는 보내지 않습니다. 서버가 채팅 상대방으로 정합니다.
 *
 * @param {number|string} roomId
 * @param {"great"|"good"|"soso"|"bad"} rating
 * @param {string} [comment]
 */
export async function submitChatReview(roomId, rating, comment = "") {
  const body = { rating };

  // 후기가 비어 있으면 comment 필드를 아예 안 넣습니다.
  if (comment) {
    body.comment = comment;
  }

  const response = await fetch(`${API_CHAT_URL}/${roomId}/review`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });

  return parseResponse(response);
}
