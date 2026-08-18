import { API_TEAM_KEY, API_AUTH_URL } from "./apiConfig.js";

export async function signup(user) {
  const response = await fetch(`${API_AUTH_URL}/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_TEAM_KEY,
    },
    body: JSON.stringify(user),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "회원가입에 실패했습니다.");
  }

  return data;
}
