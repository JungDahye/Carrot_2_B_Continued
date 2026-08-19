import { signup } from "../api/apiAuth.js";
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
function removeParents(list) {
  const parents = new Set();

  for (const { name } of list) {
    const i = name.lastIndexOf(" ");
    if (i > -1) parents.add(name.slice(0, i));
  }

  return list.filter((item) => !parents.has(item.name));
}

async function loadRegion1depth() {
  try {
    const data = await region("*00000000");

    const list = [...data.regcodes, { code: "3611000000", name: "세종특별자치시" }].sort((a, b) => a.code.localeCompare(b.code));

    region1depth.innerHTML += list.map((item) => `<option value="${item.code}">${item.name}</option>`).join("");
  } catch (error) {
    console.error(error);
  }
}
// 첫 번째 시/도를 선택하면 시/군/구 데이터 받아오기
region1depth.addEventListener("change", async () => {
  region2depth.innerHTML = `<option value="">시/군/구 선택</option>`;
  region3depth.innerHTML = `<option value="">읍/면/동 선택</option>`;

  if (!region1depth.value) return;

  const query = region1depth.value.substring(0, 2) + "*00000";

  try {
    const data = await region(query);

    region2depth.innerHTML += removeParents(data.regcodes)
      .map((item) => {
        // 시/도 이름 제거 ("경기도 용인시 처인구" → "용인시 처인구")
        const name = item.name.split(" ").slice(1).join(" ") || item.name;
        return `<option value="${item.code}">${name}</option>`;
      })
      .join("");
  } catch (error) {
    console.error(error);
  }
});

// 두 번째 시/군/구를 선택하면 읍/면/동 데이터 받아오기
region2depth.addEventListener("change", async () => {
  region3depth.innerHTML = `<option value="">읍/면/동 선택</option>`;

  const code = region2depth.value;
  if (!code) return;

  // 5번째 숫자가 0이면 앞 4자리,
  // 0이 아니면 앞 5자리를 사용
  const query = code[4] === "0" ? code.substring(0, 4) + "*" : code.substring(0, 5) + "*";

  try {
    const data = await region(query, true);

    region3depth.innerHTML += data.regcodes
      .filter((item) => item.code !== code)
      .map((item) => {
        const name = item.name.split(" ").pop();
        return `<option value="${item.code}">${name}</option>`;
      })
      .join("");
  } catch (error) {
    console.error(error);
  }
});

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

  const sido = region1depth.selectedOptions[0].textContent;
  const sigungu = region2depth.selectedOptions[0].textContent;
  const dong = region3depth.selectedOptions[0].textContent;

  const user = {
    email: email.value,
    password: pwd.value,
    nickname: nickname.value,
    profileImage: "",
    location: sido + " " + sigungu + " " + dong,
    regionCode: region3depth.value,
  };

  try {
    await signup(user);
    alert("가입이 완료되었습니다.");
    location.href = "./login.html";
  } catch (error) {
    console.error(error);
    alert("회원가입에 실패했습니다.");
  }
});

email.addEventListener("input", () => clearWarning(email));
pwd.addEventListener("input", () => clearWarning(pwd));
pwdCheck.addEventListener("input", () => clearWarning(pwdCheck));
nickname.addEventListener("input", () => clearWarning(nickname));
region1depth.addEventListener("change", () => clearWarning(region1depth));
region2depth.addEventListener("change", () => clearWarning(region2depth));
region3depth.addEventListener("change", () => clearWarning(region3depth));

// 처음 호출되었을 때 1depth 시/도 채우기
loadRegion1depth();
