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

// 돌아갈 곳이 마땅치 않을 때 이동할 페이지
const BACK_FALLBACK = "trade.html";

// 돌아갈 주소를 담아두는 sessionStorage 키
// sessionStorage 는 탭 단위로 유지되고 탭을 닫으면 사라집니다.
const BACK_KEY = "postBackUrl";

// 돌아갈 곳으로 기록하면 안 되는 페이지 (등록 / 수정 후 넘어온 경우)
const SKIP_BACK_PAGES = ["/write.html"];

// 주소창에서 가져온 매물 번호
const productId = new URLSearchParams(location.search).get("id");

// 화면에 그린 매물 정보 (수정 / 삭제 / 채팅 버튼에서 재사용)
let product = null;

// ========== 내 글인지 확인 ==========
// 로그인 시 저장되는 값이 token 뿐이라 토큰 안에서 사용자 번호를 꺼내 씁니다.
// 토큰(JWT)은 헤더.페이로드.서명 세 부분이 점으로 이어진 형태이고,
// 가운데 페이로드에 사용자 정보가 담겨 있습니다.
function getMyUserId() {
  const token = localStorage.getItem("token");

  if (!token) return null;

  try {
    const parts = token.split(".");

    // 점으로 나눈 조각이 3개가 아니면 JWT 가 아님
    if (parts.length !== 3) return null;

    // base64url 을 일반 base64 로 바꾼 뒤 디코딩
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    // 한글 등 유니코드가 섞여 있어도 깨지지 않도록 변환
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );

    const payload = JSON.parse(json);

    // 서버마다 필드명이 다를 수 있어 흔한 이름을 순서대로 확인합니다.
    return payload.uid ?? payload.id ?? payload.userId ?? payload.sub ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// 판매자가 나인지 확인
// 확인할 수 없으면 false 를 돌려줍니다. (남의 글을 내 글로 오해하지 않기 위해)
function isMyPost(item) {
  const myId = getMyUserId();

  if (!myId || !item.seller) return false;

  return String(item.seller.id) === String(myId);
}

// ========== 돌아갈 곳 기록 ==========
// 목록이나 검색 결과에서 들어왔을 때만 저장합니다.
// 수정을 마치고 되돌아온 경우에는 덮어쓰지 않기 때문에
// 처음 출발했던 검색 결과로 정확히 돌아갈 수 있습니다.
function saveBackUrl() {
  const referrer = document.referrer;

  if (!referrer) return;

  try {
    const from = new URL(referrer);

    // 외부 사이트에서 들어온 경우는 무시
    if (from.origin !== location.origin) return;

    // 글쓰기 / 수정 페이지에서 온 경우는 기존 기록을 유지
    if (SKIP_BACK_PAGES.some((page) => from.pathname.endsWith(page))) return;

    sessionStorage.setItem(BACK_KEY, referrer);
  } catch (error) {
    // referrer 형식이 이상하면 무시합니다.
    console.error(error);
  }
}

// ========== 뒤로가기 ==========
// 저장해둔 주소로 이동합니다.
// 검색어와 페이지 번호가 주소에 담겨 있으므로 검색 결과도 그대로 복원됩니다.
function goBack() {
  const savedUrl = sessionStorage.getItem(BACK_KEY);

  sessionStorage.removeItem(BACK_KEY);

  location.href = savedUrl || BACK_FALLBACK;
}

backBtn.addEventListener("click", goBack);

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

  const isMine = isMyPost(item);

  // 내 글일 때만 수정 / 삭제 버튼 노출
  postManage.hidden = !isMine;

  // 내 글이 아닐 때만 채팅하기 버튼 노출
  // 로그인하지 않은 사람에게도 보이며, 누르면 로그인 페이지로 안내합니다.
  chatBtn.hidden = isMine;
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

    sessionStorage.removeItem(BACK_KEY);

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
  // 어디에서 들어왔는지 먼저 기록합니다.
  saveBackUrl();

  // 버튼은 데이터를 받기 전까지 숨겨둡니다.
  postManage.hidden = true;
  chatBtn.hidden = true;

  if (!productId) {
    showError("잘못된 접근입니다.");
    return;
  }

  postTitle.textContent = "불러오는 중...";

  try {
    product = await getProduct(productId);
    render(product);
  } catch (error) {
    console.error(error);
    showError(error.message || "매물 정보를 불러오지 못했습니다.");
  }
}

init();
