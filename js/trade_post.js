import { getProduct, deleteProduct } from "./api/apiProduct.js";

const backBtn = document.querySelector("#backBtn");
const postImage = document.querySelector("#postImage");
const sellerId = document.querySelector("#sellerId");
const sellerRegion = document.querySelector("#sellerRegion");
const chatBtn = document.querySelector("#chatBtn");
const postTitle = document.querySelector("#postTitle");
const postPrice = document.querySelector("#postPrice");
const viewCount = document.querySelector("#viewCount");
const chatCount = document.querySelector("#chatCount");
const postContent = document.querySelector("#postContent");
const tradePlace = document.querySelector("#tradePlace");
const postManage = document.querySelector("#postManage");
const deleteBtn = document.querySelector("#deleteBtn");
const editBtn = document.querySelector("#editBtn");

// 이미지가 없거나 깨졌을 때 사용할 기본 이미지
const NO_IMAGE = "../../images/trade/no-image.png";

// 뒤로 갈 곳이 마땅치 않을 때 이동할 페이지
const BACK_FALLBACK = "trade.html";

// 뒤로가기로 되돌아가면 안 되는 페이지 (등록 / 수정 후 넘어온 경우)
const SKIP_BACK_PAGES = ["/write.html"];

// 주소창에서 가져온 매물 번호
const productId = new URLSearchParams(location.search).get("id");

// 화면에 그린 매물 정보 (수정 버튼에서 재사용)
let product = null;

// ========== 뒤로가기 ==========
// 목록에서 왔으면 목록으로, 검색에서 왔으면 검색 결과로 돌아갑니다.
// 브라우저 기록을 그대로 쓰기 때문에 검색어나 페이지 번호도 유지됩니다.
function goBack() {
  const referrer = document.referrer;

  if (referrer) {
    try {
      const from = new URL(referrer);
      const isSameSite = from.origin === location.origin;
      const isSkipPage = SKIP_BACK_PAGES.some((page) => from.pathname.endsWith(page));

      // 같은 사이트에서 왔고, 글쓰기 / 수정 페이지가 아니면 브라우저 기록으로 이동
      if (isSameSite && !isSkipPage) {
        history.back();
        return;
      }
    } catch (error) {
      // referrer 형식이 이상하면 무시하고 아래 기본 경로로 이동
      console.error(error);
    }
  }

  // 주소를 직접 입력했거나 새 탭으로 연 경우
  location.href = BACK_FALLBACK;
}

backBtn.addEventListener("click", goBack);

// ========== 내 게시글인지 확인 ==========
function isMyPost(item) {
  return Boolean(localStorage.getItem("token"));
}

// ========== 화면에 그리기 ==========
function render(item) {
  const thumbnail = item.thumbnail || item.images?.[0] || NO_IMAGE;

  // 상품 이미지
  postImage.src = thumbnail;
  postImage.alt = item.title ?? "상품 이미지";
  postImage.onerror = () => {
    postImage.onerror = null;
    postImage.src = NO_IMAGE;
  };

  // 판매자 정보
  sellerId.textContent = item.seller?.nickname ?? "알 수 없음";
  sellerRegion.textContent = item.seller?.location ?? item.location ?? "";

  // 게시글 정보
  postTitle.textContent = item.title ?? "";
  postPrice.textContent = `${Number(item.price ?? 0).toLocaleString()} 원`;
  viewCount.textContent = `조회 ${item.viewCount ?? 0}`;
  chatCount.textContent = `채팅 ${item.chatCount ?? 0}`;
  postContent.textContent = item.description ?? "";
  tradePlace.textContent = item.location ?? "";

  // 문서 제목도 매물명으로 바꿔줍니다.
  document.title = `${item.title} | 당근마켓 클론 코딩`;

  // 내 글일 때만 수정 / 삭제 버튼 노출
  postManage.hidden = !isMyPost(item);

  // 내 글이면 나에게 채팅을 걸 수 없으므로 숨김
  chatBtn.hidden = isMyPost(item);
}

// ========== 불러오기 실패 ==========
function showError(message) {
  postTitle.textContent = message;
  postContent.textContent = "";
  postPrice.textContent = "";
  viewCount.textContent = "";
  chatCount.textContent = "";
  tradePlace.textContent = "";
  sellerId.textContent = "";
  sellerRegion.textContent = "";
  postImage.src = NO_IMAGE;

  postManage.hidden = true;
  chatBtn.hidden = true;
}

// ========== 수정하기 ==========
// 글쓰기 페이지를 수정 모드로 엽니다. (write.js 가 id 를 읽어 폼을 채웁니다)
editBtn.addEventListener("click", () => {
  if (!product) return;

  location.href = `write.html?id=${product.id}`;
});

// ========== 삭제하기 ==========
deleteBtn.addEventListener("click", async () => {
  if (!product) return;

  if (!confirm("이 매물을 삭제할까요? 삭제한 글은 되돌릴 수 없습니다.")) return;

  deleteBtn.disabled = true;
  deleteBtn.textContent = "삭제 중...";

  try {
    await deleteProduct(product.id);

    alert("매물이 삭제되었습니다.");

    // 삭제된 글로 다시 돌아오지 않도록 기록을 남기지 않고 이동
    location.replace(BACK_FALLBACK);
  } catch (error) {
    console.error(error);
    alert(error.message || "매물 삭제에 실패했습니다.");

    deleteBtn.disabled = false;
    deleteBtn.textContent = "삭제하기";
  }
});

// ========== 채팅하기 ==========
chatBtn.addEventListener("click", () => {
  if (!localStorage.getItem("token")) {
    alert("로그인이 필요한 서비스입니다.");
    location.href = "../auth/login.html";
    return;
  }

  if (!product) return;

  location.href = `../chat/chat.html?productId=${product.id}`;
});

// ========== 첫 실행 ==========
async function init() {
  // 버튼은 데이터를 받기 전까지 숨겨둡니다.
  postManage.hidden = true;
  postTitle.textContent = "불러오는 중...";   // ← 추가

  if (!productId) {
    showError("잘못된 접근입니다.");
    return;
  }

  try {
    product = await getProduct(productId);
    render(product);
  } catch (error) {
    console.error(error);
    showError(error.message || "매물 정보를 불러오지 못했습니다.");
  }
}

init();
