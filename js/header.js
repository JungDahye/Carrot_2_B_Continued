// header search-bx active 클래스
const searchBtn = document.querySelector(".search-btn");
const searchBx = document.querySelector(".search-bx");

searchBtn?.addEventListener("click", () => {
  searchBx.classList.toggle("active");
});

// header mobile menu active 클래스
const menuOpenBtn = document.querySelector(".mobile-menu-btn");
const menuCloseBtn = document.querySelector(".menu-close-btn");
const headerNav = document.querySelector("header nav");

menuOpenBtn?.addEventListener("click", () => {
  headerNav.classList.add("active");
});

menuCloseBtn?.addEventListener("click", () => {
  headerNav.classList.remove("active");
});

// 로그인 상태 관리
const header = document.querySelector("header");
const logoutBtn = document.querySelector("#logoutBtn");

function updateAuthUI() {
  const isLogin = !!localStorage.getItem("token");

  header.dataset.login = isLogin; // 로그인 상태
}

// 로그아웃 버튼 클릭 시
logoutBtn.addEventListener("click", (e) => {
  e.preventDefault();

  localStorage.removeItem("token");
  localStorage.removeItem("location");
  localStorage.removeItem("regionCode");

  alert("로그아웃되었습니다.");
  location.href = "../home/index.html";
});

updateAuthUI();
