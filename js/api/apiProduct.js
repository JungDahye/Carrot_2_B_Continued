import { API_TEAM_KEY, API_PRODUCT_URL } from "./apiConfig.js";

// 로그인 상태에서 보내야 하는 요청의 공통 헤더
function authHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    "X-API-Key": API_TEAM_KEY,
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// 응답을 확인하고 데이터를 돌려줌
// 401(토큰 만료)이면 로그인 정보를 지우고 로그인 페이지로 보냄
async function handleResponse(response, errorMessage) {
  // 204 No Content 처럼 본문이 없는 응답 대비
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("isLogin");
    localStorage.removeItem("userId");

    alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
    location.href = "../auth/login.html";

    throw new Error("로그인이 만료되었습니다.");
  }

  if (!response.ok) {
    throw new Error(data.message || errorMessage);
  }

  return data;
}

// 상품 목록 조회
// params: { page, limit, search }
// signal: 이전 요청을 취소하기 위한 AbortSignal (선택)
export async function getProducts(params = {}, signal) {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);
  if (params.search) query.append("search", params.search);

  const url = query.toString() ? `${API_PRODUCT_URL}?${query}` : API_PRODUCT_URL;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": API_TEAM_KEY,
    },
    signal: signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "매물을 불러오지 못했습니다.");
  }

  return data;
}

// 상품 상세 조회
export async function getProduct(id) {
  const response = await fetch(`${API_PRODUCT_URL}/${id}`, {
    method: "GET",
    headers: {
      "X-API-Key": API_TEAM_KEY,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "매물 정보를 불러오지 못했습니다.");
  }

  // 서버가 { product: {...} } 처럼 감싸서 주는 경우 대비
  return data.product ?? data.data ?? data;
}

// 상품 등록
// product: { title, price, description, location, images }
export async function createProduct(product) {
  const response = await fetch(API_PRODUCT_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(product),
  });

  const data = await handleResponse(response, "매물 등록에 실패했습니다.");

  return data.product ?? data.data ?? data;
}

// 상품 수정
// 서버가 PATCH 를 지원하지 않으면 method 를 "PUT" 으로 바꿔주세요.
// PUT 인 경우 보내지 않은 필드가 지워질 수 있으므로 전체 값을 넘겨야 합니다.
export async function updateProduct(id, product) {
  const response = await fetch(`${API_PRODUCT_URL}/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(product),
  });

  const data = await handleResponse(response, "매물 수정에 실패했습니다.");

  return data.product ?? data.data ?? data;
}

// 상품 삭제
export async function deleteProduct(id) {
  const response = await fetch(`${API_PRODUCT_URL}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(response, "매물 삭제에 실패했습니다.");
}
