import { modify, profile } from "../api/apiAuth.js";
import { connectRegionSelects, selectSavedRegion, getLocationText } from "./region.js";

const emailInput = document.querySelector("#email");
const nicknameInput = document.querySelector("#nickname");
const modifyBtn = document.querySelector("#modifyBtn");

// 지역 select region.js
const selects = {
  sido: document.querySelector("#region1depth"),
  sigungu: document.querySelector("#region2depth"),
  dong: document.querySelector("#region3depth"),
};

const nicknameWarning = nicknameInput.closest(".input-bx").querySelector(".warning-text");
const regionWarning = selects.sido.closest(".input-bx").querySelector(".warning-text");

const showRegionWarning = (message) => {
  regionWarning.textContent = message;
};

function getTempColor(temp) {
  const t = Math.max(0, Math.min(80, temp));
  const lightness = 75 - (t / 80) * 48; // 36.5 → 약 53% (#ff6f0e)
  return `hsl(24, 100%, ${lightness}%)`;
}

// 매너온도 UI 반영
function applyMannerTemp(temp, mood) {
  const tempEl = document.querySelector("#manner-temp");
  const emojiEl = document.querySelector("#manner-emoji");
  const labelEl = document.querySelector("#manner-label");
  const progressEl = document.querySelector("#manner-progress");

  tempEl.textContent = temp.toFixed(1);
  tempEl.style.color = mood.color;

  emojiEl.textContent = mood.emoji;
  labelEl.textContent = mood.label;

  progressEl.style.width = `${(temp / 99) * 100}%`;
  progressEl.style.background = mood.color;
}

// 내 정보 조회
async function loadMyInfo() {
  // 로그인하지 않았으면 로그인 페이지로 보낸다
  if (!localStorage.getItem("token")) {
    alert("로그인이 필요합니다.");
    location.href = "./login.html";
    return;
  }

  try {
    const data = await profile();
    const user = data.user || data;

    emailInput.value = user.email || "";
    nicknameInput.value = user.nickname || "";

    applyMannerTemp(Number(user.mannerTemp ?? 36.5), user.mannerLevel ?? { label: "보통이에요", emoji: "🙂", color: "#30b0c7" });

    // 시/도 목록을 채우고 저장된 지역을 선택한다
    await connectRegionSelects(selects, showRegionWarning);

    await selectSavedRegion(
      selects,
      {
        // 서버 응답에 지역이 없으면, 로그인할 때 저장해 둔 값을 대신 쓴다
        location: user.location || localStorage.getItem("location"),
        regionCode: user.regionCode || localStorage.getItem("regionCode"),
      },
      showRegionWarning,
    );
  } catch (error) {
    console.error(error);
    alert(error.message || "회원정보를 불러오지 못했습니다.");
  }
}

// 수정 후 저장
async function saveMyInfo() {
  nicknameWarning.textContent = "";
  regionWarning.textContent = "";

  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    nicknameWarning.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  if (!selects.sido.value) {
    regionWarning.textContent = "시/도를 선택해주세요.";
    selects.sido.focus();
    return;
  }

  if (!selects.sigungu.value) {
    regionWarning.textContent = "시/군/구를 선택해주세요.";
    selects.sigungu.focus();
    return;
  }

  if (!selects.dong.value) {
    regionWarning.textContent = "읍/면/동을 선택해주세요.";
    selects.dong.focus();
    return;
  }

  const userLocation = getLocationText(selects);

  modifyBtn.disabled = true;

  try {
    await modify({
      nickname: nickname,
      location: userLocation,
      regionCode: selects.dong.value,
    });

    localStorage.setItem("location", userLocation);
    localStorage.setItem("regionCode", selects.dong.value);

    alert("회원정보가 수정되었습니다.");
  } catch (error) {
    console.error(error);
    alert(error.message || "회원정보 수정에 실패했습니다.");
  }

  modifyBtn.disabled = false;
}

// 회원정보 수정 눌렀을 경우
modifyBtn.addEventListener("click", saveMyInfo);

nicknameInput.addEventListener("input", () => {
  nicknameWarning.textContent = "";
});

selects.sido.addEventListener("change", () => showRegionWarning(""));
selects.sigungu.addEventListener("change", () => showRegionWarning(""));
selects.dong.addEventListener("change", () => showRegionWarning(""));

// 페이지 로딩 후 내정보 로드
loadMyInfo();
