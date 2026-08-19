import { getProduct, createProduct, updateProduct } from "./api/apiProduct.js";
import { uploadImage } from "./api/apiImage.js";

const writeForm = document.querySelector("#writeForm");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const photoIcon = document.querySelector(".photo-icon");
const postTitle = document.querySelector("#postTitle");
const postPrice = document.querySelector("#postPrice");
const postContent = document.querySelector("#postContent");
const tradePlace = document.querySelector("#tradePlace");
const submitBtn = document.querySelector("#submitBtn");

// 업로드 허용 용량 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 주소창에 id 가 있으면 수정 모드
const productId = new URLSearchParams(location.search).get("id");
const isEditMode = Boolean(productId);

// 미리보기용 임시 주소 (교체할 때 이전 것을 해제하기 위해 보관)
let previewUrl = "";

// 수정 모드에서 사진을 새로 고르지 않았을 때 유지할 기존 이미지
let existingImages = [];

// ========== 로그인 확인 ==========
// 실제로 헤더에 쓰이는 값은 token 이므로 token 을 기준으로 판단합니다.
if (!localStorage.getItem("token")) {
  alert("로그인이 필요한 서비스입니다.");
  location.href = "../auth/login.html";

  // location.href 를 대입해도 아래 코드가 계속 실행되므로 여기서 멈춥니다.
  throw new Error("로그인이 필요합니다.");
}

// ========== 사진 미리보기 ==========
function showPreview(src) {
  photoPreview.src = src;
  photoPreview.style.display = "block";
  photoIcon.style.display = "none";
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];

  if (!file) return;

  // 이미지 파일인지 확인
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 첨부할 수 있습니다.");
    photoInput.value = "";
    return;
  }

  // 용량 확인
  if (file.size > MAX_FILE_SIZE) {
    alert("이미지는 5MB 이하만 첨부할 수 있습니다.");
    photoInput.value = "";
    return;
  }

  // 이전 미리보기 주소가 있으면 메모리에서 해제
  if (previewUrl) URL.revokeObjectURL(previewUrl);

  previewUrl = URL.createObjectURL(file);
  showPreview(previewUrl);
});

// ========== 가격 입력 (숫자만, 천 단위 콤마) ==========
postPrice.addEventListener("input", () => {
  const onlyNumber = postPrice.value.replace(/[^0-9]/g, "");

  postPrice.value = onlyNumber ? Number(onlyNumber).toLocaleString() : "";
});

// ========== 입력값 검증 ==========
// 문제가 없으면 서버로 보낼 객체를, 문제가 있으면 예외를 던집니다.
function getFormData() {
  const title = postTitle.value.trim();
  const price = Number(postPrice.value.replace(/[^0-9]/g, ""));
  const description = postContent.value.trim();
  const location = tradePlace.value.trim();

  if (!title) {
    postTitle.focus();
    throw new Error("글 제목을 입력해주세요.");
  }

  if (!postPrice.value.trim()) {
    postPrice.focus();
    throw new Error("가격을 입력해주세요.");
  }

  if (!Number.isFinite(price) || price < 0) {
    postPrice.focus();
    throw new Error("가격은 0원 이상의 숫자로 입력해주세요.");
  }

  if (!description) {
    postContent.focus();
    throw new Error("물품 설명을 입력해주세요.");
  }

  if (!location) {
    tradePlace.focus();
    throw new Error("거래 희망 장소를 입력해주세요.");
  }

  return { title, price, description, location };
}

// ========== 등록 / 수정 ==========
writeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 연타로 같은 매물이 여러 번 등록되는 것을 막습니다.
  if (submitBtn.disabled) return;

  submitBtn.disabled = true;
  submitBtn.textContent = isEditMode ? "수정 중..." : "등록 중...";

  try {
    const product = getFormData();
    const file = photoInput.files[0];

    if (file) {
      // 1단계: 사진을 먼저 업로드해서 주소를 받습니다.
      const imageUrl = await uploadImage(file);

      product.images = [imageUrl];
    } else if (existingImages.length) {
      // 수정 모드에서 사진을 바꾸지 않았으면 기존 이미지를 그대로 둡니다.
      product.images = existingImages;
    }

    // 2단계: 받은 주소를 포함해 등록하거나 수정합니다.
    const saved = isEditMode ? await updateProduct(productId, product) : await createProduct(product);

    alert(isEditMode ? "매물이 수정되었습니다." : "매물이 등록되었습니다.");

    const id = saved?.id ?? productId;

    // replace 를 쓰면 상세 페이지에서 뒤로가기를 눌렀을 때
    // 이 작성 화면으로 되돌아오지 않습니다.
    location.replace(id ? `trade_post.html?id=${id}` : "trade.html");
  } catch (error) {
    console.error(error);
    alert(error.message || "저장에 실패했습니다.");

    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? "수정 완료" : "완료";
  }
});

// ========== 첫 실행 ==========
async function init() {
  if (!isEditMode) {
    // 등록 모드에서는 로그인할 때 저장해둔 동네를 미리 채워줍니다.
    const savedLocation = localStorage.getItem("location");

    if (savedLocation) {
      tradePlace.value = savedLocation;
    }

    return;
  }

  // 수정 모드에서는 기존 값을 불러와 폼을 채웁니다.
  submitBtn.disabled = true;
  submitBtn.textContent = "불러오는 중...";

  try {
    const product = await getProduct(productId);

    // 내 글이 아니면 수정할 수 없습니다.
    const userId = localStorage.getItem("userId");

    if (userId && product.seller && String(product.seller.id) !== String(userId)) {
      alert("내가 등록한 매물만 수정할 수 있습니다.");
      location.replace(`trade_post.html?id=${productId}`);
      return;
    }

    postTitle.value = product.title ?? "";
    postPrice.value = Number(product.price ?? 0).toLocaleString();
    postContent.value = product.description ?? "";
    tradePlace.value = product.location ?? "";

    existingImages = product.images ?? [];

    const thumbnail = product.thumbnail || existingImages[0];

    if (thumbnail) {
      showPreview(thumbnail);
    }

    document.title = "매물 수정 | 당근마켓 클론 코딩";
  } catch (error) {
    console.error(error);
    alert(error.message || "매물 정보를 불러오지 못했습니다.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? "수정 완료" : "완료";
  }
}

// 페이지를 떠날 때 미리보기 주소 정리
window.addEventListener("beforeunload", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

init();
