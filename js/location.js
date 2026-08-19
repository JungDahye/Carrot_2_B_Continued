// ========================================
// 0. 상수 & DOM 요소 참조
// ========================================
const RADIUS_METERS = 1500; // 인증 반경 (1.5km)

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
// 1. 지도 초기화 (페이지 로드 시 내 GPS 위치 기반)
// ========================================
function initMap() {
    // 일단 기본 지도 생성 (기본값: 서울시청)
    map = L.map('map').setView([37.5665, 126.9780], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 페이지가 열리면 즉시 내 현재 위치를 가져와서 중심 이동 & 주소 업데이트
    getCurrentLocationAndCheck();
}

// ========================================
// 2. 주소 -> 좌표 변환 (Nominatim 지오코딩)
// ========================================
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Nominatim 서버 요청에 실패했습니다.');
    }

    const data = await response.json();

    if (data.length === 0) {
        throw new Error('해당 주소를 찾을 수 없습니다.');
    }

    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
    };
}

// ========================================
// 2-1. 좌표 -> 주소 변환 (Nominatim 역지오코딩)
// ========================================
async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    const response = await fetch(url, {
        headers: {
            'Accept-Language': 'ko' // 한국어 응답 요청
        }
    });

    if (!response.ok) {
        throw new Error('역지오코딩 요청에 실패했습니다.');
    }

    const data = await response.json();
    const addr = data.address || {};

    // 1. 주요 행정구역 데이터 추출
    const province = addr.province || addr.state || '';                       // 충청남도
    const city = addr.city || addr.county || addr.district || '';              // 서산시
    const town = addr.suburb || addr.town || addr.village || addr.neighbourhood || ''; // 대곡리 (또는 동/읍/면)

    // 2. 한국식 순서(도/시 -> 시/군/구 -> 읍/면/동/리)로 조합
    const formattedAddress = [province, city, town]
        .filter(Boolean) // 빈 값 제거
        .join(' ');      // 공백으로 연결

    // 추출된 행정구역이 있으면 한국식 주소 반환, 실패 시 기본 display_name 사용
    return formattedAddress || data.display_name;
}

// ========================================
// 3. 검색한 주소를 지도에 표시 (마커 + 반경 원)
// ========================================
function plotTarget(coords) {
    const latlng = [coords.lat, coords.lon];

    map.setView(latlng, 15);

    if (targetMarker) map.removeLayer(targetMarker);
    if (targetCircle) map.removeLayer(targetCircle);

    const targetIcon = L.icon({
        iconUrl: '../../images/chat/LocationMarker.png',
        iconSize: [60, 60],
        iconAnchor: [30, 60],
        popupAnchor: [0, -60]
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
// 4. GPS로 현재 위치 가져오기 (초기 로딩 및 갱신용)
// ========================================
function getCurrentLocationAndCheck() {
    if (!navigator.geolocation) {
        locationMessage.textContent = '이 브라우저는 위치 정보를 지원하지 않습니다.';
        return;
    }

    locationMessage.textContent = '현재 위치를 확인하는 중입니다...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLatLng = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };

            // 지도의 중심을 내 위치로 이동 & 마커 표시
            map.setView([userLatLng.lat, userLatLng.lon], 15);
            plotUser(userLatLng);

            // 🔹 GPS 좌표를 주소로 변환하여 locationMessage 텍스트 교체
            try {
                const userAddress = await reverseGeocode(userLatLng.lat, userLatLng.lon);
                locationMessage.textContent = `현재 위치는 ${userAddress} 입니다.`;
            } catch (error) {
                console.error('주소 변환 실패:', error);
                locationMessage.textContent = '현재 위치 주소를 가져오지 못했습니다.';
            }

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
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// ========================================
// 7. 반경 안에 있는지 판별 -> 메시지 변경 및 버튼 활성화
// ========================================
async function checkVerification() {
    if (!targetLatLng || !userLatLng) return;

    // 1. 내 GPS 좌표를 한국식 주소로 변환
    let userAddress = '';
    try {
        userAddress = await reverseGeocode(userLatLng.lat, userLatLng.lon);
    } catch (error) {
        console.error('주소 변환 실패:', error);
        userAddress = '현재 위치';
    }

    // 2. 두 좌표 사이 거리 계산 (미터)
    const distance = getDistanceMeters(
        targetLatLng.lat, targetLatLng.lon,
        userLatLng.lat, userLatLng.lon
    );

    // 3. 반경 내 유무에 따른 메시지 구성
    if (distance <= RADIUS_METERS) {
        // 반경 안에 있을 때: 두 줄 문구 출력
        locationMessage.innerHTML = 
            `현재 위치는 ${userAddress} 입니다.<br>현재 위치가 내 동네 설정과 같습니다.`;
        verificationButton.disabled = false;
    } else {
        // 반경 밖에 있을 때
        locationMessage.innerHTML = 
            `현재 위치는 ${userAddress} 입니다.<br>현재 위치가 설정한 동네 범위 밖에 있습니다. (약 ${Math.round(distance)}m 거리)`;
        verificationButton.disabled = true;
    }
}

// ========================================
// 8. 이벤트 연결
// ========================================
addressForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const address = addressInput.value.trim();
    if (!address) return;

    try {
        targetLatLng = await geocodeAddress(address);
        plotTarget(targetLatLng);
        checkVerification(); // 검색 위치가 바뀌었을 때 인증 범위 다시 체크
    } catch (error) {
        alert('주소를 찾을 수 없습니다. 다시 입력해주세요.');
        console.error(error);
    }
});

verificationButton.addEventListener('click', () => {
    completeModal.style.display = 'flex';
});

modalConfirmButton.addEventListener('click', () => {
    completeModal.style.display = 'none';
});

// 페이지가 열리면 지도 초기화 및 위치 정보 로드 실행
initMap();