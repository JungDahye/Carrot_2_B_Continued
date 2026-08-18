import { signup } from "../api/apiRegister.js";
import { region } from "../api/apiRegion.js";

const registerBtn = document.querySelector("#registerBtn");
const email = document.querySelector("#email");
const pwd = document.querySelector("#pwd");
const pwdCheck = document.querySelector("#pwdCheck");
const nickname = document.querySelector("#nickname");
const region1depth = document.querySelector("#region1depth");
const region2depth = document.querySelector("#region2depth");
const region3depth = document.querySelector("#region3depth");

// 지역 선택 설정
async function loadRegion1depth() {
  try {
    const data = await region("*00000000");

    data.regcodes.forEach((item) => {
      region1depth.innerHTML += `
        <option value="${item.code}">${item.name}</option>
      `;
    });
  } catch (error) {
    console.error(error);
  }
}
// 첫 번째 시/도를 선택하면 시/군/구 데이터 받아오기
region1depth.addEventListener("change", async () => {
  const query = region1depth.value.substring(0, 2) + "*00000";

  try {
    const data = await region(query);

    region2depth.innerHTML = `
      <option value="">시/군/구 선택</option>
    `;

    data.regcodes.slice(1).forEach((item) => {
      // 시/도 이름 제거
      const name = item.name.split(" ").slice(1).join(" ");

      region2depth.innerHTML += `
        <option value="${item.code}">${name}</option>
      `;
    });

    // 시/군/구가 변경되었으므로 3depth 초기화
    region3depth.innerHTML = `
      <option value="">읍/면/동 선택</option>
    `;
  } catch (error) {
    console.error(error);
  }
});

// 두 번째 시/군/구를 선택하면 읍/면/동 데이터 받아오기
region2depth.addEventListener("change", async () => {
  const code = region2depth.value;

  // 5번째 숫자가 0이면 앞 4자리,
  // 0이 아니면 앞 5자리를 사용
  const query = code[4] === "0" ? code.substring(0, 4) + "*" : code.substring(0, 5) + "*";

  try {
    const data = await region(query, true);

    region3depth.innerHTML = `
      <option value="">읍/면/동 선택</option>
    `;

    data.regcodes.forEach((item) => {
      // 가장 마지막 지역명만 사용
      const name = item.name.split(" ").pop();

      region3depth.innerHTML += `
        <option value="${item.code}">${name}</option>
      `;
    });
  } catch (error) {
    console.error(error);
  }
});
// 회원가입 버튼을 눌렀을 때 실행
registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  !email.value ? (email.closest(".input-bx").querySelector(".warning-text").textContent = "이메일을 입력해주세요.") : (email.closest(".input-bx").querySelector(".warning-text").textContent = "");

  !pwd.value ? (pwd.closest(".input-bx").querySelector(".warning-text").textContent = "비밀번호를 입력해주세요.") : (pwd.closest(".input-bx").querySelector(".warning-text").textContent = "");

  !pwdCheck.value ? (pwdCheck.closest(".input-bx").querySelector(".warning-text").textContent = "pwdCheck 입력해주세요.") : (pwdCheck.closest(".input-bx").querySelector(".warning-text").textContent = "");

  !nickname.value ? (nickname.closest(".input-bx").querySelector(".warning-text").textContent = "nickname 입력해주세요.") : (nickname.closest(".input-bx").querySelector(".warning-text").textContent = "");

  if (!region1depth.value) {
    region1depth.closest(".input-bx").querySelector(".warning-text").textContent = "region1depth 입력해주세요.";
  } else if (!region2depth.value) {
    region2depth.closest(".input-bx").querySelector(".warning-text").textContent = "region2depth 입력해주세요.";
  } else if (!region3depth.value) {
    region3depth.closest(".input-bx").querySelector(".warning-text").textContent = "region3depth 입력해주세요.";
  } else {
    region1depth.closest(".input-bx").querySelector(".warning-text").textContent = "";
  }

  if (email.value && pwd.value && nickname.value && region1depth.value && region2depth.value && region3depth.value) {
    const user = {
      email: email.value,
      password: pwd.value,
      nickname: nickname.value,
      profileImage: "",
      location: region1depth.value + " " + region2depth.value + " " + region3depth.value,
    };

    try {
      await signup(user);
      alert("가입이 완료되었습니다.");
      location.href = "./login.html";
    } catch (error) {
      console.error(error);
      alert("회원가입에 실패했습니다.");
    }
  }
});

// 처음 호출되었을 때 1depth 시/도 채우기
loadRegion1depth();
