import { getProducts } from "../js/api/apiProduct.js";

const productList = document.querySelector("#productList");

async function renderMainProducts() {
  try {
    const data = await getProducts({ page: 1, limit: 8 });
    // console.log(data);

    const products = data.items;

    const NO_IMAGE = "../../images/trade/no-image.png";

    productList.innerHTML = products
      .map(
        (product) => `
        <li class="item-card">
          <a href="../trade/trade_post.html?id=${product.id}" class="item-link">
            <img src="${product.thumbnail}" alt="${product.title}" class="item-thumb" onerror="this.onerror=null; this.src='${NO_IMAGE}'" />
            <div class="item-info">
                <p class="item-name">${product.title}</p>
                <p class="item-price">${Number(product.price).toLocaleString()}원</p>
                <p class="item-region">${product.location}</p>
                <p class="item-meta">조회 ${product.viewCount} · 채팅 ${product.chatCount}</p>
            </div>
          </a>
        </li>
      `,
      )
      .join("");
  } catch (error) {
    console.error(error);
    productList.innerHTML = `<li class="error">${error.message}</li>`;
  }
}

renderMainProducts();
