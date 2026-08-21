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
const backBtn = document.querySelector("#backBtn");

// 업로드 허용 용량 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 주소창에 id 가 있으면 수정 모드
const productId = new URLSearchParams(location.search).get("id");
const isEditMode = Boolean(productId);

// 미리보기용 임시 주소 (교체할 때 이전 것을 해제하기 위해 보관)
let previewUrl = "";

// 수정 모드에서 사진을 새로 고르지 않았을 때 유지할 기존 이미지
let existingImages = [];

// 처음 화면에 있던 입력값 (취소할 때 변경 여부를 판단하는 기준)
let initialValues = null;

// 돌아갈 페이지가 없을 때 이동할 기본 주소
const DEFAULT_BACK_URL = "trade.html";

// ========== 로그인 확인 ==========
// 실제로 헤더에 쓰이는 값은 token 이므로 token 을 기준으로 판단합니다.
if (!localStorage.getItem("token")) {
  alert("로그인이 필요한 서비스입니다.");
  location.href = "../auth/login.html";

  // location.href 를 대입해도 아래 코드가 계속 실행되므로 여기서 멈춥니다.
  throw new Error("로그인이 필요합니다.");
}

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

// 글쓴이가 나인지 확인
// 확인할 수 없으면 false 를 돌려줍니다.
function isMyPost(item) {
  const myId = getMyUserId();

  if (!myId || !item.seller) return false;

  return String(item.seller.id) === String(myId);
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

// ========== 뒤로 가기 ==========
// 현재 입력값을 한 덩어리로 모읍니다.
function getValues() {
  return {
    title: postTitle.value.trim(),
    price: postPrice.value.trim(),
    description: postContent.value.trim(),
    location: tradePlace.value.trim(),
  };
}

// 처음 상태와 달라진 곳이 있는지 확인
function isChanged() {
  // 사진을 새로 고른 경우
  if (photoInput.files.length > 0) return true;

  const current = getValues();

  return Object.keys(current).some((key) => current[key] !== initialValues[key]);
}

// 이전 페이지로 이동
function goBack() {
  // 주소를 직접 입력해 들어온 경우에는 돌아갈 기록이 없습니다.
  if (history.length > 1) {
    history.back();
    return;
  }

  location.href = DEFAULT_BACK_URL;
}

// 뒤로 가기 버튼 - 바뀐 내용이 있으면 확인 후 이동
backBtn.addEventListener("click", () => {
  if (isChanged() && !confirm("변경사항이 저장되지 않을 수 있습니다.")) {
    // 취소를 누르면 작성 화면에 그대로 남습니다.
    return;
  }

  goBack();
});

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

    // 미리 채워둔 값은 사용자가 입력한 것이 아니므로 기준값으로 저장합니다.
    initialValues = getValues();

    return;
  }

  // 수정 모드에서는 기존 값을 불러와 폼을 채웁니다.
  submitBtn.disabled = true;
  submitBtn.textContent = "불러오는 중...";

  try {
    const product = await getProduct(productId);

    // 내 글이 아니면 수정할 수 없습니다.
    if (!isMyPost(product)) {
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
    // 불러온 값을 기준으로 삼아야 아무것도 고치지 않고 취소할 때
    // 경고창이 뜨지 않습니다.
    initialValues = getValues();

    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? "수정 완료" : "완료";
  }
}

// 페이지를 떠날 때 미리보기 주소 정리
window.addEventListener("beforeunload", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

init();
