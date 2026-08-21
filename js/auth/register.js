import { signup } from "../api/apiAuth.js";
import { connectRegionSelects, getLocationText } from "./region.js";

const registerBtn = document.querySelector("#registerBtn");
const email = document.querySelector("#email");
const pwd = document.querySelector("#pwd");
const pwdCheck = document.querySelector("#pwdCheck");
const nickname = document.querySelector("#nickname");
const region1depth = document.querySelector("#region1depth");
const region2depth = document.querySelector("#region2depth");
const region3depth = document.querySelector("#region3depth");

// 지역 select region.js
const selects = {
  sido: region1depth,
  sigungu: region2depth,
  dong: region3depth,
};

function showWarning(input, message) {
  const warningText = input.closest(".input-bx").querySelector(".warning-text");
  warningText.textContent = message;
}

function clearWarning(input) {
  showWarning(input, "");
}

function validate() {
  // 이전 경고 문구 모두 지우기
  clearWarning(email);
  clearWarning(pwd);
  clearWarning(pwdCheck);
  clearWarning(nickname);
  clearWarning(region1depth);

  // 이메일
  if (!email.value) {
    showWarning(email, "이메일을 입력해주세요.");
    email.focus();
    return false;
  }

  if (!email.value.includes("@")) {
    showWarning(email, "올바른 이메일 형식이 아닙니다.");
    email.focus();
    return false;
  }

  // 비밀번호
  if (!pwd.value) {
    showWarning(pwd, "비밀번호를 입력해주세요.");
    pwd.focus();
    return false;
  }

  // 비밀번호 확인
  if (!pwdCheck.value) {
    showWarning(pwdCheck, "비밀번호를 한 번 더 입력해주세요.");
    pwdCheck.focus();
    return false;
  }

  if (pwd.value !== pwdCheck.value) {
    showWarning(pwdCheck, "비밀번호가 일치하지 않습니다.");
    pwdCheck.focus();
    return false;
  }

  // 닉네임
  if (!nickname.value) {
    showWarning(nickname, "닉네임을 입력해주세요.");
    nickname.focus();
    return false;
  }

  // 지역
  if (!region1depth.value) {
    showWarning(region1depth, "시/도를 선택해주세요.");
    region1depth.focus();
    return false;
  }

  if (!region2depth.value) {
    showWarning(region2depth, "시/군/구를 선택해주세요.");
    region2depth.focus();
    return false;
  }

  if (!region3depth.value) {
    showWarning(region3depth, "읍/면/동을 선택해주세요.");
    region3depth.focus();
    return false;
  }

  return true;
}

// 회원가입 버튼을 눌렀을 때 실행
registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!validate()) return;

  const user = {
    email: email.value,
    password: pwd.value,
    nickname: nickname.value,
    profileImage: "",
    location: getLocationText(selects),
    regionCode: region3depth.value,
  };

  try {
    await signup(user);
    alert("가입이 완료되었습니다.");
    location.href = "./login.html";
  } catch (error) {
    console.error(error);
    alert(error.message || "회원가입에 실패했습니다.");
  }
});

email.addEventListener("input", () => clearWarning(email));
pwd.addEventListener("input", () => clearWarning(pwd));
pwdCheck.addEventListener("input", () => clearWarning(pwdCheck));
nickname.addEventListener("input", () => clearWarning(nickname));
region1depth.addEventListener("change", () => clearWarning(region1depth));
region2depth.addEventListener("change", () => clearWarning(region2depth));
region3depth.addEventListener("change", () => clearWarning(region3depth));

// 처음 호출되었을 때 시/도 목록을 채우고, 시/도 → 시/군/구 → 읍/면/동 연동을 시작한다
connectRegionSelects(selects, (message) => showWarning(region1depth, message));
