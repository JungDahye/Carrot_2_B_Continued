import { getProducts } from "./api/apiProduct.js";

const itemGrid = document.querySelector("#itemGrid");

// 한 번에 불러올 매물 개수
const ITEM_LIMIT = 28;

// 썸네일이 없거나 깨졌을 때 사용할 기본 이미지
const NO_IMAGE = "../../images/trade/no-image.png";

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
      <a href="trade_post.html?id=${item.id}" class="item-link">
        <img src="${thumbnail}" alt="${title}" class="item-thumb" onerror="this.src='${NO_IMAGE}'">
        <div class="item-info">
          <p class="item-name">${title}</p>
          <p class="item-price">${price}원</p>
          <p class="item-region">${location}</p>
          <p class="item-meta">조회 ${item.viewCount} · 채팅 ${item.chatCount}</p>
        </div>
      </a>
    </li>
  `;
}

// 매물 목록 불러와서 그리기
async function loadItems() {
  try {
    const data = await getProducts({ page: 1, limit: ITEM_LIMIT });

    if (!data.items.length) {
      itemGrid.innerHTML = `<li class="item-empty">등록된 매물이 없습니다.</li>`;
      return;
    }

    itemGrid.innerHTML = data.items.map(createCard).join("");
  } catch (error) {
    console.error(error);
    itemGrid.innerHTML = `<li class="item-empty">매물을 불러오지 못했습니다.</li>`;
  }
}

loadItems();
