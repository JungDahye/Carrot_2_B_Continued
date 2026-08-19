import { login } from "../api/apiAuth.js";

const loginBtn = document.querySelector("#loginBtn");
const email = document.querySelector("#email");
const pwd = document.querySelector("#pwd");

// 로그인 실패시 안내문구
function showWarning(input, message) {
  const warningText = input.closest(".input-bx").querySelector(".warning-text");
  warningText.textContent = message;
}

// warning text 리셋
function clearWarning(input) {
  showWarning(input, "");
}

// 로그인 input 내용 검증
function validate() {
  // 이전 경고 문구 모두 지우기
  clearWarning(email);
  clearWarning(pwd);

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

  return true;
}

// 로그인 버튼 클릭 시
loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!validate()) return;

  const user = {
    email: email.value,
    password: pwd.value,
  };

  loginBtn.disabled = true;

  try {
    await login(user);
    location.href = "../home/";
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showWarning(pwd, "이메일 또는 비밀번호가 일치하지 않습니다.");
      pwd.value = "";
      pwd.focus();
    } else {
      showWarning(pwd, "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  } finally {
    loginBtn.disabled = false;
  }
});

// warning text 리셋
email.addEventListener("input", () => clearWarning(email));
pwd.addEventListener("input", () => clearWarning(pwd));
