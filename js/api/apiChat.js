/**
 * apiChat.js
 * ─────────────────────────────────────────────────────────
 * 채팅 페이지에서 사용하는 API 요청 함수 모음입니다.
 *
 * 모든 요청에는 팀 API KEY(X-API-Key)가 필요하고,
 * 🔒 표시가 있는 채팅 API는 로그인 토큰(Authorization: Bearer)도 함께 보냅니다.
 */

import {
  API_TEAM_KEY,
  API_AUTH_URL,
  API_CHAT_URL,
  API_PRODUCT_URL,
  API_BASE_URL,
} from "./apiConfig.js";

/**
 * localStorage에 저장된 JWT 토큰을 읽어
 * fetch 요청에 공통으로 넣을 헤더 객체를 만듭니다.
 *
 * @param {boolean} withJson - JSON body를 보낼 때 true (Content-Type 추가)
 * @returns {Object} fetch headers
 */
function buildHeaders(withJson = true) {
  const token = localStorage.getItem("token");

  const headers = {
    "X-API-Key": API_TEAM_KEY,
  };

  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * API 응답을 JSON으로 파싱하고, 실패(status >= 400)면 에러를 던집니다.
 *
 * @param {Response} response - fetch 결과
 * @returns {Promise<any>} 파싱된 JSON 데이터
 */
async function parseResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "요청에 실패했습니다.");
  }

  return data;
}

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보를 조회합니다.
 * 채팅 목록 상단 "내 아이디" 영역에 nickname을 표시할 때 사용합니다.
 */
export async function fetchMyProfile() {
  const response = await fetch(`${API_AUTH_URL}/me`, {
    method: "GET",
    headers: buildHeaders(false),
  });

  return parseResponse(response);
}

/**
 * GET /api/chats
 * 내가 참여 중인 채팅방 목록을 가져옵니다.
 * 각 room에는 partner, product, lastMessage, unreadCount 등이 포함됩니다.
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
 * 선택한 채팅방의 상세 정보(상품, 상대방, 역할 등)를 가져옵니다.
 *
 * @param {number|string} roomId - 채팅방 ID
 */
export async function fetchChatRoom(roomId) {
  const response = await fetch(`${API_CHAT_URL}/${roomId}`, {
    method: "GET",
    headers: buildHeaders(false),
  });

  return parseResponse(response);
}

/**
 * GET /api/chats/{id}/messages
 * 채팅방 메시지 목록을 가져옵니다.
 *
 * @param {number|string} roomId - 채팅방 ID
 * @param {number|null} after - 이 ID보다 큰 메시지만 조회 (폴링용)
 * @param {number} limit - 한 번에 가져올 개수 (기본 50)
 */
export async function fetchMessages(roomId, after = null, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });

  if (after) {
    params.set("after", String(after));
  }

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
 * 채팅방에 새 메시지를 전송합니다.
 *
 * @param {number|string} roomId - 채팅방 ID
 * @param {string} content - 보낼 메시지 내용
 */
export async function sendMessage(roomId, content) {
  const response = await fetch(`${API_CHAT_URL}/${roomId}/messages`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ content }),
  });

  return parseResponse(response);
}

/**
 * POST /api/chats
 * 상품 상세 페이지 등에서 "채팅하기"를 눌렀을 때 채팅방을 생성합니다.
 * 같은 상품에 이미 방이 있으면 기존 room을 그대로 반환합니다.
 *
 * @param {number|string} productId - 상품 ID
 */
export async function createChatRoom(productId) {
  const response = await fetch(API_CHAT_URL, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ productId: Number(productId) }),
  });

  return parseResponse(response);
}

/**
 * PATCH /api/products/{id}/status
 * 판매자가 "거래완료" 버튼을 눌렀을 때 상품 상태를 변경합니다.
 *
 * @param {number|string} productId - 상품 ID
 * @param {"on_sale"|"reserved"|"sold"} status - 변경할 거래 상태
 */
export async function updateProductStatus(productId, status) {
  const response = await fetch(`${API_PRODUCT_URL}/${productId}/status`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify({ status }),
  });

  return parseResponse(response);
}

/**
 * GET /api/users/{id}/reviews
 * 해당 회원이 받은 매너 평가 목록을 가져옵니다.
 *
 * @param {number|string} userId - 회원 ID
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
 * 이 채팅방에서 내가 남긴 평가와 받은 평가를 조회합니다.
 * 아직 없으면 myReview / receivedReview 가 null 입니다.
 *
 * @param {number|string} roomId - 채팅방 ID
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
 * 거래완료된 채팅방에서 상대방에게 매너 평가를 남깁니다.
 * 대상은 서버가 채팅 상대방으로 자동 지정합니다.
 *
 * @param {number|string} roomId - 채팅방 ID
 * @param {"great"|"good"|"soso"|"bad"} rating
 * @param {string} [comment]
 */
export async function submitChatReview(roomId, rating, comment = "") {
  const body = { rating };

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
