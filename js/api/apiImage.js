import { API_TEAM_KEY, API_BASE_URL, API_IMAGE_URL } from "./apiConfig.js";

// 업로드 응답에서 이미지 주소를 꺼냅니다.
// 서버마다 필드명이 달라서 흔한 후보들을 순서대로 확인합니다.
// (명세를 확인한 뒤 실제 필드 하나만 남기고 정리하는 것을 권장합니다.)
function pickImageUrl(data) {
  const url = data?.url ?? data?.imageUrl ?? data?.image?.url ?? data?.data?.url ?? data?.path ?? data?.location;

  if (typeof url !== "string" || !url) {
    console.error("업로드 응답 형태를 확인하세요:", data);
    throw new Error("업로드 응답에서 이미지 주소를 찾지 못했습니다.");
  }

  // 절대주소면 그대로, 상대경로면 API 주소를 앞에 붙입니다.
  if (url.startsWith("http")) return url;

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// 이미지 업로드
// file: <input type="file"> 로 선택한 File 객체
// 반환: 업로드된 이미지의 URL 문자열
export async function uploadImage(file) {
  const formData = new FormData();

  // 필드명이 "image" 가 아니라면 명세에 맞게 바꿔주세요. (file, upload 등)
  formData.append("image", file);

  const token = localStorage.getItem("token");

  const response = await fetch(API_IMAGE_URL, {
    method: "POST",
    headers: {
      // Content-Type 을 직접 넣으면 안 됩니다.
      // FormData 는 boundary 값이 필요한데, 브라우저가 자동으로 붙여줍니다.
      "X-API-Key": API_TEAM_KEY,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "이미지 업로드에 실패했습니다.");
  }

  return pickImageUrl(data);
}
