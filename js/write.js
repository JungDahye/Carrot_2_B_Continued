import { createProduct } from "./api/apiProduct.js";
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

// 미리보기용 임시 주소 (교체할 때 이전 것을 해제하기 위해 보관)
let previewUrl = "";

// ========== 로그인 확인 ==========
// 매물 등록은 로그인한 사용자만 가능합니다.
if (localStorage.getItem("isLogin") !== "true") {
  alert("로그인이 필요한 서비스입니다.");
  location.href = "../auth/login.html";
}

// ========== 거래 희망 장소 기본값 ==========
// 로그인할 때 저장해둔 동네를 미리 채워줍니다.
const savedLocation = localStorage.getItem("location");

if (savedLocation) {
  tradePlace.value = savedLocation;
}

// ========== 사진 미리보기 ==========
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

  photoPreview.src = previewUrl;
  photoPreview.style.display = "block";
  photoIcon.style.display = "none";
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

// ========== 등록 ==========
writeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 연타로 같은 매물이 여러 번 등록되는 것을 막습니다.
  if (submitBtn.disabled) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중...";

  try {
    const product = getFormData();
    const file = photoInput.files[0];

    // 1단계: 사진이 있으면 먼저 업로드해서 주소를 받습니다.
    if (file) {
      const imageUrl = await uploadImage(file);
      product.images = [imageUrl];
    }

    // 2단계: 받은 주소를 포함해 매물을 등록합니다.
    const created = await createProduct(product);

    alert("매물이 등록되었습니다.");

    // 등록된 상세 페이지로 이동 (id가 없으면 목록으로)
    location.href = created?.id ? `trade_post.html?id=${created.id}` : "trade.html";
  } catch (error) {
    console.error(error);
    alert(error.message || "매물 등록에 실패했습니다.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "완료";
  }
});

// 페이지를 떠날 때 미리보기 주소 정리
window.addEventListener("beforeunload", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
