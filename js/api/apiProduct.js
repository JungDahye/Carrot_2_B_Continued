import { API_TEAM_KEY, API_PRODUCT_URL } from "./apiConfig.js";

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

  return data;
}
