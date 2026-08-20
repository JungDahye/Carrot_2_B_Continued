// 지역 select 3개(시/도 → 시/군/구 → 읍/면/동)를 다루는 공통 파일
// 회원가입(register.js)과 내정보 조회/수정(profile.js) 이 같이 사용한다.
//
// 쓰는 방법
//   const selects = { sido: ..., sigungu: ..., dong: ... };   // select 요소 3개
//   await connectRegionSelects(selects, showWarning);          // 시/도 목록 채우고 3단 연동 시작
//   await selectSavedRegion(selects, { location, regionCode }); // 저장된 지역 다시 선택 (조회 화면)
//   const text = getLocationText(selects);                     // "서울특별시 강남구 역삼동"

import { getSidoList, getSigunguList, getDongList } from "../api/apiRegion.js";

const PLACEHOLDER = {
  sido: "시/도 선택",
  sigungu: "시/군/구 선택",
  dong: "읍/면/동 선택",
};

const LOAD_FAIL_MESSAGE = "지역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

// ===== 밖에서 쓰는 함수 =====
// 시/도 목록을 채우고, 위 단계를 고르면 아래 단계가 따라오도록 연결한다.
// onError: 실패했을 때 화면에 보여줄 문구를 받는 함수 (없어도 된다)
export async function connectRegionSelects(selects, onError) {
  const { sido, sigungu, dong } = selects;

  // 시/도를 고르면 → 시/군/구 목록 불러오기
  sido.addEventListener("change", async () => {
    clearSelect(sigungu, PLACEHOLDER.sigungu);
    clearSelect(dong, PLACEHOLDER.dong);

    if (!sido.value) {
      unlockRegion(selects);
      return;
    }

    await loadInto(selects, sigungu, () => getSigunguList(sido.value), PLACEHOLDER.sigungu, onError);
  });

  // 시/군/구를 고르면 → 읍/면/동 목록 불러오기
  sigungu.addEventListener("change", async () => {
    clearSelect(dong, PLACEHOLDER.dong);

    if (!sigungu.value) {
      unlockRegion(selects);
      return;
    }

    await loadInto(selects, dong, () => getDongList(sigungu.value), PLACEHOLDER.dong, onError);
  });

  // 첫 목록인 시/도 채우기
  await loadInto(selects, sido, getSidoList, PLACEHOLDER.sido, onError);
}

// 저장된 지역을 select 3개에 다시 표시한다. (connectRegionSelects 를 먼저 호출해야 한다)
// saved = { location: "서울특별시 강남구 역삼동", regionCode: "1168010100" }
// regionCode 앞 2자리가 시/도, 앞 5자리가 시/군/구, 10자리 전체가 읍/면/동이다.
// 코드로 못 찾으면 location 의 이름으로 찾는다.
export async function selectSavedRegion(selects, saved, onError) {
  const { sido, sigungu, dong } = selects;

  const regionCode = String(saved.regionCode || "");
  const savedName = splitLocation(saved.location);

  // 1단계 시/도
  if (!selectByCode(sido, regionCode.slice(0, 2))) selectByName(sido, savedName.sido);
  if (!sido.value) return false; // 저장된 지역을 못 찾으면 직접 고르도록 둔다

  // 2단계 시/군/구
  await loadInto(selects, sigungu, () => getSigunguList(sido.value), PLACEHOLDER.sigungu, onError);
  if (!selectByCode(sigungu, regionCode.slice(0, 5))) selectByName(sigungu, savedName.sigungu);
  if (!sigungu.value) return false;

  // 3단계 읍/면/동
  await loadInto(selects, dong, () => getDongList(sigungu.value), PLACEHOLDER.dong, onError);
  if (!selectByCode(dong, regionCode)) selectByName(dong, savedName.dong);

  return Boolean(dong.value);
}

// 선택한 지역을 서버에 저장할 형태로 만든다 → "서울특별시 강남구 역삼동"
export function getLocationText(selects) {
  return getSelectedName(selects.sido) + " " + getSelectedName(selects.sigungu) + " " + getSelectedName(selects.dong);
}

// 지금 선택된 이름 꺼내기
export function getSelectedName(selectEl) {
  if (selectEl.selectedIndex === -1) return "";
  return selectEl.options[selectEl.selectedIndex].textContent;
}

// "서울특별시 강남구 역삼동" → { sido: "서울특별시", sigungu: "강남구", dong: "역삼동" }
// 시/군/구 이름에 공백이 있을 수 있어서(경기도 "용인시 처인구" 역북동)
// 맨 앞은 시/도, 맨 뒤는 읍/면/동, 가운데는 모두 시/군/구로 본다.
export function splitLocation(locationText) {
  const words = String(locationText || "")
    .trim()
    .split(" ")
    .filter((word) => word !== "");

  return {
    sido: words[0] || "",
    sigungu: words.slice(1, -1).join(" "),
    dong: words.length >= 2 ? words[words.length - 1] : "",
  };
}

// ===== 안에서만 쓰는 함수 =====
// 목록을 받아와 select 를 채운다. 받아오는 동안에는 select 를 잠근다.
async function loadInto(selects, target, getList, placeholder, onError) {
  lockRegion(selects);

  try {
    fillSelect(target, await getList(), placeholder);
  } catch (error) {
    console.error(error);
    if (onError) onError(LOAD_FAIL_MESSAGE);
  }

  unlockRegion(selects);
}

// select 안을 목록으로 채운다 (보이는 글자는 이름, 값은 코드)
function fillSelect(selectEl, list, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;

  list.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.name;
    selectEl.append(option);
  });
}

// select 를 처음 상태(안내 문구만 있는 상태)로 되돌린다
function clearSelect(selectEl, placeholder) {
  fillSelect(selectEl, [], placeholder);
}

// 코드로 option 찾아서 선택. 앞부분만 같아도 찾는다.
// 예: "11" → 서울특별시(1100000000), "11680" → 강남구(1168000000)
function selectByCode(selectEl, codePrefix) {
  if (!codePrefix) return false;

  for (const option of selectEl.options) {
    if (option.value !== "" && option.value.startsWith(codePrefix)) {
      selectEl.value = option.value;
      return true;
    }
  }

  return false;
}

// 이름으로 option 찾아서 선택 (코드로 못 찾았을 때 사용)
function selectByName(selectEl, name) {
  if (!name) return false;

  for (const option of selectEl.options) {
    if (option.textContent === name) {
      selectEl.value = option.value;
      return true;
    }
  }

  return false;
}

// 목록을 불러오는 동안에는 select 를 모두 잠근다 (요청이 겹치는 것을 막는다)
function lockRegion({ sido, sigungu, dong }) {
  sido.disabled = true;
  sigungu.disabled = true;
  dong.disabled = true;
}

// 목록이 들어있는 select 만 다시 쓸 수 있게 한다
// (option 이 안내 문구 1개뿐이면 아직 고를 게 없다는 뜻이라 잠긴 채로 둔다)
function unlockRegion({ sido, sigungu, dong }) {
  sido.disabled = sido.options.length <= 1;
  sigungu.disabled = sigungu.options.length <= 1;
  dong.disabled = dong.options.length <= 1;
}
