// ========================================
// 0. 상수 & DOM 요소 참조
// ========================================
const RADIUS_METERS = 1000; // 인증 반경 (1km)

const addressForm = document.getElementById('addressForm');
const addressInput = document.getElementById('addressInput');
const locationMessage = document.getElementById('locationMessage');
const verificationButton = document.getElementById('verificationButton');
const completeModal = document.getElementById('completeModal');
const modalConfirmButton = document.getElementById('modalConfirmButton');

// 지도 위에서 갱신될 상태값들 (검색/GPS 할 때마다 덮어씀)
let map;
let targetMarker = null;   // 검색한 주소 위치 마커
let targetCircle = null;   // 1km 반경 원
let userMarker = null;     // 내 GPS 위치 마커
let targetLatLng = null;   // { lat, lon } - 검색한 주소 좌표
let userLatLng = null;     // { lat, lon } - 내 GPS 좌표

// ========================================
// 1. 지도 초기화 (페이지 로드 시 1회)
// ========================================
function initMap() {
    // L.map, setView : Leaflet 내장 - 지도 생성 및 초기 중심좌표/줌 설정
    map = L.map('map').setView([37.5665, 126.9780], 11); // 기본값: 서울시청

    // L.tileLayer, addTo : Leaflet 내장 - OSM 배경 이미지를 지도에 부착
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// ========================================
// 2. 주소 -> 좌표 변환 (Nominatim 지오코딩)
// ========================================
// 커스텀 함수: Nominatim API를 호출해서 좌표를 돌려주는 부분은
// Leaflet이나 브라우저가 해주지 않으므로 직접 작성해야 함
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

    // fetch : 브라우저 내장 함수 - HTTP 요청을 보냄 (비동기, Promise 반환)
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Nominatim 서버 요청에 실패했습니다.');
    }

    // response.json() : 내장 메서드 - 응답 본문을 JS 객체로 파싱
    const data = await response.json();

    if (data.length === 0) {
        throw new Error('해당 주소를 찾을 수 없습니다.');
    }

    // parseFloat : 내장 함수 - 문자열로 온 좌표를 숫자로 변환
    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
    };
}

// ========================================
// 3. 검색한 주소를 지도에 표시 (마커 + 반경 원)
// ========================================
// 커스텀 함수: "검색 결과를 어떻게 그릴지"는 이 프로젝트의 요구사항이므로 직접 작성
function plotTarget(coords) {
    const latlng = [coords.lat, coords.lon];

    map.setView(latlng, 15); // 검색한 위치로 지도 이동 + 확대

    // 이전 검색 결과가 남아있으면 지우고 새로 그림 (재검색 대비)
    if (targetMarker) map.removeLayer(targetMarker);
    if (targetCircle) map.removeLayer(targetCircle);

    // L.icon : Leaflet 내장 - 이미지 파일을 마커 아이콘으로 등록
    const targetIcon = L.icon({
        iconUrl: '../../images/chat/LocationMarker.png',   // 준비한 이미지 파일 경로로 수정하세요
        iconSize: [60, 60],          // 이미지가 화면에 그려질 크기 (px)
        iconAnchor: [20, 40],        // 핀의 뾰족한 끝이 좌표를 가리키도록 기준점 지정 (가로중앙, 세로끝)
        popupAnchor: [0, -40]        // 팝업이 아이콘 위쪽에 뜨도록 보정
    });

    targetMarker = L.marker(latlng, { icon: targetIcon }).addTo(map).bindPopup('검색한 위치');

    targetCircle = L.circle(latlng, {
        radius: RADIUS_METERS,
        color: '#0066FF',
        fillColor: '#0066FF',
        fillOpacity: 0.15
    }).addTo(map);
}

// ========================================
// 4. GPS로 현재 위치 가져오기
// ========================================
// 커스텀 함수: GPS 결과를 받은 뒤 "무엇을 할지"는 이 프로젝트의 로직이므로 직접 작성
function getCurrentLocationAndCheck() {
    if (!navigator.geolocation) {
        locationMessage.textContent = '이 브라우저는 위치 정보를 지원하지 않습니다.';
        return;
    }

    locationMessage.textContent = '현재 위치를 확인하는 중입니다...';

    // navigator.geolocation.getCurrentPosition : 브라우저 내장 - GPS 좌표를 비동기로 가져옴
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // position.coords.latitude / longitude : 내장 속성 - GPS 결과값
            userLatLng = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            plotUser(userLatLng);
            checkVerification();
        },
        (error) => {
            locationMessage.textContent = '위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.';
            console.error(error);
        }
    );
}

// ========================================
// 5. 내 GPS 위치를 지도에 마커로 표시
// ========================================
function plotUser(coords) {
    const latlng = [coords.lat, coords.lon];

    if (userMarker) map.removeLayer(userMarker);

    // L.divIcon : Leaflet 내장 - 이미지 대신 CSS로 만든 마커 (위 <style>의 .my-location-dot 사용)
    const dotIcon = L.divIcon({
        className: '',
        html: '<div class="my-location-dot"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    userMarker = L.marker(latlng, { icon: dotIcon }).addTo(map).bindPopup('내 현재 위치');
}

// ========================================
// 6. 두 좌표 사이 거리 계산 (Haversine 공식)
// ========================================
// 커스텀 함수: JS나 Leaflet이 기본 제공하지 않으므로 직접 구현
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 지구 반지름 (미터)
    const toRad = (deg) => deg * (Math.PI / 180); // Math.PI : 내장 속성

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    // Math.sin, Math.cos, Math.sqrt, Math.atan2 : 모두 내장 Math 메서드
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 결과: 미터 단위 거리
}

// ========================================
// 7. 반경 안에 있는지 판별 -> 버튼 활성화
// ========================================
function checkVerification() {
    if (!targetLatLng || !userLatLng) return;

    const distance = getDistanceMeters(
        targetLatLng.lat, targetLatLng.lon,
        userLatLng.lat, userLatLng.lon
    );

    if (distance <= RADIUS_METERS) {
        locationMessage.textContent =
            `현재 위치가 설정한 동네 범위 안에 있습니다. (약 ${Math.round(distance)}m)`;
        verificationButton.disabled = false; // disabled : 내장 속성 - false면 클릭 가능
    } else {
        locationMessage.textContent =
            `현재 위치가 설정한 동네 범위 밖에 있습니다. (약 ${Math.round(distance)}m)`;
        verificationButton.disabled = true;
    }
}

// ========================================
// 8. 이벤트 연결
// ========================================
// addEventListener : 브라우저 내장 메서드 - 특정 이벤트 발생 시 함수 실행
addressForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 내장 메서드 - 폼 제출 시 페이지 새로고침되는 기본 동작 막음

    const address = addressInput.value.trim();
    if (!address) return;

    try {
        targetLatLng = await geocodeAddress(address);
        plotTarget(targetLatLng);
        getCurrentLocationAndCheck();
    } catch (error) {
        alert('주소를 찾을 수 없습니다. 다시 입력해주세요.');
        console.error(error);
    }
});

verificationButton.addEventListener('click', () => {
    // style.display : 내장 속성 - CSS의 display 값을 JS로 직접 제어
    completeModal.style.display = 'flex'; // 모달 보이기
});

modalConfirmButton.addEventListener('click', () => {
    completeModal.style.display = 'none'; // 모달 숨기기
});

// 페이지가 열리면 지도부터 초기화
initMap();