import { API_TEAM_KEY, API_AUTH_URL } from "./apiConfig.js";

export async function login(user) {
  const response = await fetch(`${API_AUTH_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_TEAM_KEY,
    },
    body: JSON.stringify(user),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "로그인에 실패했습니다.");
    error.status = response.status;
    throw error;
  }

  // console.log("data.user" + data.user);
  // console.log("data.token" + data.token);
  // console.log(response);
  localStorage.setItem("token", data.token);

  if (data.user?.location) {
    localStorage.setItem("location", data.user.location);
  }

  if (data.user?.regionCode) {
    localStorage.setItem("regionCode", data.user.regionCode);
  }

  return data;
}
