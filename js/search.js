import { getProducts } from "./api/apiProduct.js";

const searchGrid = document.querySelector("#searchGrid");
const searchInput = document.querySelector(".search-bx input");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const currentPage = document.querySelector("#currentPage");
const totalPage = document.querySelector("#totalPage");
const pagination = document.querySelector(".pagination");

// 한 페이지에 보여줄 매물 개수
const ITEM_LIMIT = 8;

// 썸네일이 없거나 깨졌을 때 사용할 기본 이미지
const NO_IMAGE = "../../images/search/no-image.png";

// 페이지 버튼 아이콘 (1: 이전 버튼, 2: 다음 버튼)
const PREV_ICON_ON = "../../images/search/icon-search-pageOn1.png";
const PREV_ICON_OFF = "../../images/search/icon-search-pageOff1.png";
const NEXT_ICON_ON = "../../images/search/icon-search-pageOn2.png";
const NEXT_ICON_OFF = "../../images/search/icon-search-pageOff2.png";

// 현재 상태
let page = 1;
let keyword = "";
let totalPages = 1;

// 요청 중복 방지
let isLoading = false;

// 이전 요청 취소용
let controller = null;

// HTML 특수문자 변환 (제목에 태그가 들어오는 경우 방지)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";

  return div.innerHTML;
}

// 매물 카드 한 개 만들기
function createCard(item) {
  const thumbnail = item.thumbnail || NO_IMAGE;
  const title = escapeHtml(item.title);
  const price = Number(item.price).toLocaleString();
  const location = escapeHtml(item.location);

  return `
    <li class="item-card">
      <a href="../trade/trade_post.html?id=${item.id}" class="item-link">
        <img src="${thumbnail}" alt="${title}" class="item-thumb" onerror="this.onerror=null; this.src='${NO_IMAGE}'">
        <div class="item-info">
          <h3 class="item-name">${title}</h3>
          <p class="item-price">${price}원</p>
          <p class="item-region">${location}</p>
          <p class="item-count">
            <span class="view-count">조회 ${item.viewCount}</span>
            <span class="chat-count">채팅 ${item.chatCount}</span>
          </p>
        </div>
      </a>
    </li>
  `;
}

// 페이지 버튼 상태 바꾸기
// 버튼마다 사용하는 아이콘이 다르므로 켜짐 / 꺼짐 이미지를 함께 받음
function setPageBtn(btn, isActive, onIcon, offIcon) {
  const icon = btn.querySelector(".page-icon");

  btn.disabled = !isActive;
  icon.src = isActive ? onIcon : offIcon;
}

// 페이지 번호와 이전 / 다음 버튼 갱신
function updatePagination(data) {
  totalPages = data.totalPages || 1;

  currentPage.textContent = data.page;
  totalPage.textContent = totalPages;

  // 첫 페이지면 이전 버튼 비활성화
  setPageBtn(prevBtn, data.page > 1, PREV_ICON_ON, PREV_ICON_OFF);

  // 끝 페이지면 다음 버튼 비활성화
  // 페이지가 1개뿐이면 두 버튼 모두 비활성화됨
  setPageBtn(nextBtn, data.page < totalPages, NEXT_ICON_ON, NEXT_ICON_OFF);
}

// 요청 중에는 페이지 버튼을 잠가 연타를 막음
function setLoadingBtn(isLoadingState) {
  if (isLoadingState) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

// 검색 결과가 없을 때 표시
function showEmpty() {
  const message = keyword
    ? `'${escapeHtml(keyword)}'에 대한 검색 결과가 없습니다.`
    : "등록된 매물이 없습니다.";

  searchGrid.innerHTML = `
    <li class="item-empty">
      <p class="empty-title">검색 결과 없음</p>
      <p class="empty-text">${message}</p>
    </li>
  `;

  pagination.hidden = true;
}

// 검색 결과 불러와서 그리기
async function loadItems() {
  // 이미 요청 중이면 무시
  if (isLoading) return;

  // 이전 요청이 남아있으면 취소
  controller?.abort();
  controller = new AbortController();

  isLoading = true;
  setLoadingBtn(true);

  try {
    const data = await getProducts(
      {
        page: page,
        limit: ITEM_LIMIT,
        search: keyword,
      },
      controller.signal
    );

    if (!data.items.length) {
      showEmpty();
      return;
    }


    pagination.hidden = false;
    searchGrid.innerHTML = data.items.map(createCard).join("");

    updatePagination(data);
    window.scrollTo(0, 0);
  } catch (error) {
    // 새 검색 때문에 취소된 요청은 에러로 보지 않음
    if (error.name === "AbortError") return;

    console.error(error);

    searchGrid.innerHTML = `
      <li class="item-empty">
        <p class="empty-title">불러오기 실패</p>
        <p class="empty-text">잠시 후 다시 시도해주세요.</p>
      </li>
    `;

    pagination.hidden = true;
  } finally {
    isLoading = false;
    setLoadingBtn(false);
  }
}

// 주소창의 검색어를 현재 검색어와 맞춤
function updateUrl() {
  const url = keyword ? `?keyword=${encodeURIComponent(keyword)}` : location.pathname;

  history.replaceState(null, "", url);
}

// 검색 실행 (페이지 이동 없이 목록만 교체)
function search() {
  const newKeyword = searchInput.value.trim();

  // 같은 검색어를 다시 눌렀을 때는 요청하지 않음
  if (newKeyword === keyword && page === 1) return;

  keyword = newKeyword;
  page = 1;

  updateUrl();
  loadItems();
}

// 이전 페이지
prevBtn.addEventListener("click", () => {
  if (isLoading || page <= 1) return;

  page -= 1;
  loadItems();
});

// 다음 페이지
nextBtn.addEventListener("click", () => {
  if (isLoading || page >= totalPages) return;

  page += 1;
  loadItems();
});

// 헤더 검색창에서 엔터
searchInput?.addEventListener("keydown", (e) => {
  // 한글 조합 중에 눌린 엔터는 무시 (중복 호출 방지)
  if (e.key !== "Enter" || e.isComposing) return;

  search();
});

// 페이지가 열리면 주소창의 검색어로 첫 조회
function init() {
  const params = new URLSearchParams(location.search);

  keyword = params.get("keyword") || "";

  if (searchInput) {
    searchInput.value = keyword;
  }

  loadItems();
}

init();