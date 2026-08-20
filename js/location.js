/**
 * location.js
 * ─────────────────────────────────────────────────────────
 * pages/location/location.html 전용 화면 스크립트입니다.
 * 팀 API는 쓰지 않고, Nominatim(주소↔좌표)과 브라우저 GPS만 사용합니다.
 *
 * [흐름]
 * 1) 페이지 로드 → Leaflet 지도 + 내 GPS
 * 2) "내 동네 설정" → 주소를 좌표로 바꿔 핀·1.5km 원을 그림
 * 3) GPS가 원 안이면 "동네인증 완료하기" 활성화
 * 4) 완료 버튼 → 모달을 display:flex 로 보여 줌
 */

// ========================================
// 0. 상수 & DOM 요소 참조
// ========================================

// 동네 인증이 통과되는 최대 거리(미터). 검색한 주소에서 이 거리 안에 GPS가 있어야 인증 가능
const RADIUS_METERS = 1500; // 1.5km

// HTML의 주소 검색 폼 (#addressForm). submit 이벤트를 여기서 받음
const addressForm = document.getElementById('addressForm');
// 주소 입력칸 (#addressInput). 사용자가 친 "서울 강서구 화곡동" 같은 문자열을 읽음
const addressInput = document.getElementById('addressInput');
// 화면 안내 문구 (#locationMessage). "현재 위치는 ~ 입니다" 를 여기에 표시
const locationMessage = document.getElementById('locationMessage');
// "동네인증 완료하기" 버튼. 반경 밖이면 disabled, 안이면 클릭 가능
const verificationButton = document.getElementById('verificationButton');
// 인증 완료 팝업 전체 배경 (#completeModal)
const completeModal = document.getElementById('completeModal');
// 팝업 안의 "확인" 버튼. 누르면 모달을 닫음
const modalConfirmButton = document.getElementById('modalConfirmButton');

// Leaflet 지도 객체. initMap()에서 한 번 만들고 이후 계속 재사용
let map;
// 검색한 동네 위치에 찍는 핀. 새로 검색하면 이전 핀을 지우고 다시 만듦
let targetMarker = null;
// 검색 위치 주변에 그리는 인증 반경 원 (파란색 원)
let targetCircle = null;
// 내 GPS 위치를 나타내는 작은 점 마커
let userMarker = null;
// 검색한 주소의 위도/경도. 예: { lat: 37.54, lon: 126.84 }
let targetLatLng = null;
// 브라우저 GPS로 받은 내 현재 위도/경도
let userLatLng = null;

// ========================================
// 1. 지도 초기화 (페이지 로드 시 내 GPS 위치 기반)
// ========================================
function initMap() {
    // #map 요소에 Leaflet 지도를 붙임
    // setView([위도, 경도], 줌레벨) : GPS를 받기 전 임시로 서울시청을 중심으로 보여 줌
    map = L.map('map').setView([37.5665, 126.9780], 11);

    // 지도 타일(실제 지도 그림)을 OpenStreetMap에서 받아 옴
    // {s}, {z}, {x}, {y} 는 Leaflet이 줌/좌표에 맞게 자동으로 채움
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, // 사용자가 최대로 확대할 수 있는 줌
        attribution: '&copy; OpenStreetMap contributors' // 하단에 표시되는 저작권 문구
    }).addTo(map); // 만든 타일 레이어를 지도 위에 올림

    // 지도가 준비되면 바로 브라우저 GPS를 요청해서 내 위치로 이동
    getCurrentLocationAndCheck();
}

// ========================================
// 2. 주소 -> 좌표 변환 (Nominatim 지오코딩)
//    "화곡동" 글자를 위도/경도로 바꿈
// ========================================
async function geocodeAddress(address) {
    // Nominatim 검색 API 주소 만들기
    // format=json : JSON으로 받기
    // limit=1 : 결과 1개만
    // q= : 검색할 주소. 한글/공백은 encodeURIComponent로 안전하게 변환
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

    // 위에서 만든 URL로 GET 요청
    const response = await fetch(url);

    // HTTP 상태 코드가 200번대가 아니면 실패로 처리
    if (!response.ok) {
        throw new Error('Nominatim 서버 요청에 실패했습니다.');
    }

    // 응답 본문을 자바스크립트 배열/객체로 파싱
    const data = await response.json();

    // 검색 결과가 빈 배열이면 해당 주소를 못 찾은 것
    if (data.length === 0) {
        throw new Error('해당 주소를 찾을 수 없습니다.');
    }

    // 첫 번째 결과의 lat, lon은 문자열이므로 숫자로 변환해서 반환
    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
    };
}

// ========================================
// 2-1. 좌표 -> 주소 변환 (Nominatim 역지오코딩)
//      위도/경도를 "충청남도 서산시 대곡리" 같은 글자로 바꿈
// ========================================
async function reverseGeocode(lat, lon) {
    // reverse API: lat, lon을 쿼리로 넘기면 그 지점의 주소 객체를 줌
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    const response = await fetch(url, {
        headers: {
            'Accept-Language': 'ko' // 가능하면 한국어 주소명으로 달라고 요청
        }
    });

    // 서버 오류면 중단
    if (!response.ok) {
        throw new Error('역지오코딩 요청에 실패했습니다.');
    }

    // JSON 파싱. data.address 안에 province, city, suburb 등이 들어 있음
    const data = await response.json();
    // address가 없으면 빈 객체로 대체해서 아래 접근 시 에러 방지
    const addr = data.address || {};

    // 시/도: province가 없으면 state를 사용 (국가마다 필드명이 다름)
    const province = addr.province || addr.state || '';
    // 시/군/구: city → county → district 순으로 있는 값을 사용
    const city = addr.city || addr.county || addr.district || '';
    // 읍/면/동/리: suburb → town → village → neighbourhood 순
    const town = addr.suburb || addr.town || addr.village || addr.neighbourhood || '';

    // [도, 시, 동] 배열에서 빈 문자열은 빼고 공백으로 이어 붙임
    const formattedAddress = [province, city, town]
        .filter(Boolean)
        .join(' ');

    // 행정구역 조합이 있으면 그걸 쓰고, 없으면 Nominatim이 준 긴 주소(display_name)를 씀
    return formattedAddress || data.display_name;
}

// ========================================
// 3. 검색한 주소를 지도에 표시 (마커 + 반경 원)
// ========================================
function plotTarget(coords) {
    // Leaflet은 [위도, 경도] 배열을 씀
    const latlng = [coords.lat, coords.lon];

    // 지도를 검색 위치로 옮기고 줌 15로 확대
    map.setView(latlng, 15);

    // 이전에 찍어 둔 검색 마커가 있으면 지도에서 제거 (중복 핀 방지)
    if (targetMarker) map.removeLayer(targetMarker);
    // 이전 반경 원도 제거
    if (targetCircle) map.removeLayer(targetCircle);

    // 검색 위치용 커스텀 핀 이미지 설정
    const targetIcon = L.icon({
        iconUrl: '../../images/chat/icon-locationmarker.png', // 핀 이미지 경로
        iconSize: [60, 60],     // 아이콘 가로·세로 크기(px)
        iconAnchor: [30, 60],   // 이미지가 좌표에 붙는 기준점 (아래 중앙 = 핀 끝이 그 지점)
        popupAnchor: [0, -60]   // 팝업이 아이콘 위쪽으로 뜨도록 오프셋
    });

    // 마커를 만들고 지도에 올린 뒤, 클릭하면 "검색한 위치" 팝업이 뜨게 함
    targetMarker = L.marker(latlng, { icon: targetIcon }).addTo(map).bindPopup('검색한 위치');

    // 검색 위치를 중심으로 RADIUS_METERS 짜리 원을 그림
    targetCircle = L.circle(latlng, {
        radius: RADIUS_METERS, // 원 반지름 (미터)
        color: '#0066FF',      // 원 테두리 색
        fillColor: '#0066FF',  // 원 안 채움 색
        fillOpacity: 0.15      // 안쪽 투명도 (0이면 투명, 1이면 불투명)
    }).addTo(map);
}

// ========================================
// 4. GPS로 현재 위치 가져오기 (초기 로딩 및 갱신용)
// ========================================
function getCurrentLocationAndCheck() {
    // 브라우저가 Geolocation API를 지원하지 않으면 (구형/일부 환경) 안내만 하고 종료
    if (!navigator.geolocation) {
        locationMessage.textContent = '이 브라우저는 위치 정보를 지원하지 않습니다.';
        return;
    }

    // GPS 응답을 기다리는 동안 사용자에게 로딩 문구 표시
    locationMessage.textContent = '현재 위치를 확인하는 중입니다...';

    // 브라우저에게 현재 좌표를 요청. 성공 콜백 / 실패 콜백 두 개를 넘김
    navigator.geolocation.getCurrentPosition(
        // --- 성공: position 안에 coords.latitude, coords.longitude가 있음 ---
        async (position) => {
            // 전역 상태 userLatLng에 내 좌표를 저장 (인증 거리 계산에 재사용)
            userLatLng = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };

            // 지도 중심을 내 GPS 좌표로 이동, 줌 15
            map.setView([userLatLng.lat, userLatLng.lon], 15);
            // 내 위치 점 마커를 지도에 그림
            plotUser(userLatLng);

            // 좌표만 있으면 사람이 못 읽으니 주소 글자로 바꿈
            try {
                const userAddress = await reverseGeocode(userLatLng.lat, userLatLng.lon);
                locationMessage.textContent = `현재 위치는 ${userAddress} 입니다.`;
            } catch (error) {
                // 주소 변환만 실패한 경우 GPS는 성공한 상태. 콘솔에 원인 기록
                console.error('주소 변환 실패:', error);
                locationMessage.textContent = '현재 위치 주소를 가져오지 못했습니다.';
            }

            // 이미 검색한 동네(targetLatLng)가 있으면 반경 안/밖을 이어서 판별
            checkVerification();
        },
        // --- 실패: 권한 거부, 타임아웃, 위치 사용 불가 등 ---
        (error) => {
            locationMessage.textContent = '위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.';
            console.error(error); // 브라우저가 준 에러 객체를 콘솔에 출력
        }
    );
}

// ========================================
// 5. 내 GPS 위치를 지도에 마커로 표시
// ========================================
function plotUser(coords) {
    const latlng = [coords.lat, coords.lon];

    // 이전 내 위치 점이 있으면 지움 (GPS가 갱신될 때 점이 여러 개 남는 것 방지)
    if (userMarker) map.removeLayer(userMarker);

    // 이미지 파일이 아니라 HTML/CSS로 만든 작은 점 아이콘
    const dotIcon = L.divIcon({
        className: '',                              // Leaflet 기본 아이콘 CSS 클래스는 쓰지 않음
        html: '<div class="my-location-dot"></div>', // location.css의 .my-location-dot 스타일이 적용됨
        iconSize: [14, 14],                         // 점의 크기
        iconAnchor: [7, 7]                          // 중심이 좌표에 오도록 (가로·세로 절반)
    });

    // 점을 지도에 올리고, 클릭 시 "내 현재 위치" 팝업
    userMarker = L.marker(latlng, { icon: dotIcon }).addTo(map).bindPopup('내 현재 위치');
}

// ========================================
// 6. 두 좌표 사이 거리 계산 (Haversine 공식)
//    지구를 구로 보고 두 지점의 최단 거리(미터)를 구함
// ========================================
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 지구 평균 반지름 (미터)
    // 도(degree)를 라디안으로 바꾸는 작은 함수. 삼각함수는 라디안을 씀
    const toRad = (deg) => deg * (Math.PI / 180);

    // 위도 차이, 경도 차이를 라디안으로
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    // Haversine 공식의 a : 두 지점 사이 각거리의 절반에 해당하는 값
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    // 중심각 c (라디안)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // 거리 = 반지름 × 중심각
    return R * c;
}

// ========================================
// 7. 반경 안에 있는지 판별 -> 메시지 변경 및 버튼 활성화
// ========================================
async function checkVerification() {
    // 검색 주소 또는 내 GPS 중 하나라도 없으면 비교할 수 없으니 바로 종료
    if (!targetLatLng || !userLatLng) return;

    let userAddress = '';
    try {
        // 안내 문구에 쓸 현재 위치 주소
        userAddress = await reverseGeocode(userLatLng.lat, userLatLng.lon);
    } catch (error) {
        console.error('주소 변환 실패:', error);
        userAddress = '현재 위치'; // 변환 실패 시 문구에 넣을 기본 단어
    }

    // 검색한 동네와 내 GPS 사이 직선 거리(미터)
    const distance = getDistanceMeters(
        targetLatLng.lat, targetLatLng.lon,
        userLatLng.lat, userLatLng.lon
    );

    // 인증 반경 안이면 완료 버튼을 켜고, 밖이면 끔
    if (distance <= RADIUS_METERS) {
        // innerHTML을 쓰는 이유: <br>로 두 줄을 나누기 위해
        locationMessage.innerHTML =
            `현재 위치는 ${userAddress} 입니다.<br>현재 위치가 내 동네 설정과 같습니다.`;
        verificationButton.disabled = false; // 버튼 클릭 가능
    } else {
        // Math.round(distance) : 소수 미터를 반올림해서 "약 2300m"처럼 표시
        locationMessage.innerHTML =
            `현재 위치는 ${userAddress} 입니다.<br>현재 위치가 설정한 동네 범위 밖에 있습니다. (약 ${Math.round(distance)}m 거리)`;
        verificationButton.disabled = true; // 버튼 비활성화
    }
}

// ========================================
// 8. 이벤트 연결
// ========================================

// 주소 폼에서 엔터 또는 "내 동네 설정"을 눌렀을 때
addressForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 폼 기본 동작(페이지 새로고침)을 막음

    const address = addressInput.value.trim(); // 앞뒤 공백 제거
    if (!address) return; // 빈 값이면 아무 것도 안 함

    try {
        // 글자 주소 → 좌표
        targetLatLng = await geocodeAddress(address);
        // 지도에 핀 + 파란 원
        plotTarget(targetLatLng);
        // 내 GPS가 이미 있으면 반경 안인지 바로 다시 계산
        checkVerification();
    } catch (error) {
        alert('주소를 찾을 수 없습니다. 다시 입력해주세요.');
        console.error(error);
    }
});

// 인증 버튼을 누르면 완료 모달을 화면 중앙에 보여 줌
// (location.css의 .active 대신 display를 직접 바꿉니다)
verificationButton.addEventListener('click', () => {
    completeModal.style.display = 'flex';
});

// 모달 "확인"을 누르면 다시 숨김
modalConfirmButton.addEventListener('click', () => {
    completeModal.style.display = 'none';
});

// 스크립트가 로드되면 지도부터 그림. 이 줄이 전체 흐름의 시작점
initMap();
