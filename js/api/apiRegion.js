const API_REGION_URL = "https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes";

export async function region(query, isIgnoreZero = false) {
  const response = await fetch(`${API_REGION_URL}?regcode_pattern=${encodeURIComponent(query)}&is_ignore_zero=${isIgnoreZero}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "데이터 호출에 실패했습니다.");
  }

  return data;
}
