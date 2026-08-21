// 지역(시/도 → 시/군/구 → 읍/면/동) 데이터를 가져오는 파일
// 가져온 데이터를 select 에 뿌리는 일은 js/auth/region.js 가 담당한다.

const API_REGION_URL = "https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes";

// 한 번 받아온 목록은 기억해 둔다 (같은 목록을 다시 호출하지 않게)
const cache = new Map();

export async function region(query, isIgnoreZero = false) {
  const key = query + isIgnoreZero;

  if (cache.has(key)) return cache.get(key);

  const response = await fetch(`${API_REGION_URL}?regcode_pattern=${encodeURIComponent(query)}&is_ignore_zero=${isIgnoreZero}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "데이터 호출에 실패했습니다.");
  }

  cache.set(key, data);

  return data;
}

// 시/도 목록
export async function getSidoList() {
  const data = await region("*00000000");

  const list = data.regcodes.map((item) => ({ code: item.code, name: item.name }));

  // 세종특별자치시는 API 결과에 없어서 직접 넣어준다
  list.push({ code: "3611000000", name: "세종특별자치시" });

  // 코드 순서(서울 → 부산 → …)로 정렬
  list.sort((a, b) => a.code.localeCompare(b.code));

  return list;
}

// 시/군/구 목록 (예: 서울특별시 1100000000 → "11*00000" 으로 조회)
export async function getSigunguList(sidoCode) {
  const data = await region(sidoCode.slice(0, 2) + "*00000");

  return removeParentRegions(data.regcodes).map((item) => ({
    code: item.code,
    // 앞에 붙은 시/도 이름은 지운다 ("경기도 용인시 처인구" → "용인시 처인구")
    name: item.name.split(" ").slice(1).join(" ") || item.name,
  }));
}

// 읍/면/동 목록
export async function getDongList(sigunguCode) {
  // 구가 없는 시/군/구는 앞 4자리, 있는 곳(용인시 처인구 등)은 앞 5자리로 조회한다
  // 예: 강남구 1168000000 → "1168*" / 처인구 4146100000 → "41461*"
  const query = sigunguCode[4] === "0" ? sigunguCode.slice(0, 4) + "*" : sigunguCode.slice(0, 5) + "*";

  const data = await region(query, true);

  return data.regcodes
    .filter((item) => item.code !== sigunguCode) // 시/군/구 자기 자신은 빼기
    .map((item) => ({
      code: item.code,
      name: item.name.split(" ").pop(), // 맨 뒤가 읍/면/동 이름
    }));
}

// 시/군/구 목록에는 "경기도 용인시"(→ 처인구/기흥구/수지구를 가진 상위 지역)나
// "서울특별시" 자기 자신처럼 고르면 안 되는 항목이 섞여 있어서 걸러낸다.
function removeParentRegions(list) {
  // 다른 지역 이름의 앞부분으로 쓰이고 있는 이름들을 모은다
  const parentNames = [];

  list.forEach((item) => {
    const lastSpace = item.name.lastIndexOf(" ");
    if (lastSpace !== -1) parentNames.push(item.name.slice(0, lastSpace));
  });

  return list.filter((item) => !parentNames.includes(item.name));
}
