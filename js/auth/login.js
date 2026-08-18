import { login } from "../api/apiLogin.js";

const loginBtn = document.querySelector("#loginBtn");

loginBtn.addEventListener("click", async (e) => {
  const email = document.querySelector("#email");
  const pwd = document.querySelector("#pwd");

  !email.value ? (email.closest(".input-bx").querySelector(".warning-text").textContent = "이메일을 입력해주세요.") : (email.closest(".input-bx").querySelector(".warning-text").textContent = "");

  !pwd.value ? (pwd.closest(".input-bx").querySelector(".warning-text").textContent = "비밀번호를 입력해주세요.") : (pwd.closest(".input-bx").querySelector(".warning-text").textContent = "");

  if (email.value && pwd.value) {
    const user = {
      email: email.value,
      password: pwd.value,
    };

    try {
      await login(user);
      alert("로그인이 완료되었습니다.");
      location.href = "../home/";
    } catch (error) {
      console.error(error);
      alert("로그인에 실패했습니다.");
    }
  }
});
