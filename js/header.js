// header search-bx active 클래스
const searchBtn = document.querySelector(".search-btn");
const searchBx = document.querySelector(".search-bx");

searchBtn.addEventListener("click", () => {
  searchBx.classList.toggle("active");
});

// header mobile menu active 클래스
const menuOpenBtn = document.querySelector(".mobile-menu-btn");
const menuCloseBtn = document.querySelector(".menu-close-btn");
const headerNav = document.querySelector("header nav");

menuOpenBtn.addEventListener("click", () => {
  headerNav.classList.add("active");
});

menuCloseBtn.addEventListener("click", () => {
  headerNav.classList.remove("active");
});
