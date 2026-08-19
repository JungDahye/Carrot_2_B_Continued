// 헤더 검색창에서 검색하면 검색 결과 페이지로 이동
// search.html 이외의 페이지에서 import해서 사용

const searchInput = document.querySelector(".search-bx input");

// pages/폴더명/파일.html 기준 경로
const SEARCH_PAGE_URL = "../search/search.html";

function moveToSearchPage() {
  const keyword = searchInput.value.trim();

  if (!keyword) {
    alert("검색어를 입력해주세요.");
    return;
  }

  location.href = `${SEARCH_PAGE_URL}?keyword=${encodeURIComponent(keyword)}`;
}

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    moveToSearchPage();
  }
});
