// 재고조사 페이지 로직

// DOM 요소
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const loadingSpinner = document.getElementById("loadingSpinner");
const productList = document.getElementById("productList");
const emptyState = document.getElementById("emptyState");
const notification = document.getElementById("notification");

// 디바운스 타이머
let searchDebounceTimer = null;
const updateDebounceTimers = {};

// 페이지네이션 상태
let currentPage = 1;
const itemsPerPage = 50;
let totalItems = 0;
let allProducts = []; // 전체 제품 캐시
let ecountStockMap = {}; // 이카운트 재고 캐시 (PROD_CD -> QTY)
let isECountStockLoaded = false; // 이카운트 재고 로드 여부

// 페이지 로드 시
document.addEventListener("DOMContentLoaded", () => {
  // 초기 50개 제품 로드
  loadInitialProducts();
});

// 검색 입력 이벤트 (디바운싱)
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();

  // 디바운싱: 300ms 후 검색 실행
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    if (query.length > 0) {
      searchProducts(query);
    } else {
      loadInitialProducts();
    }
  }, 300);
});

// 제품 검색
async function searchProducts(query) {
  try {
    // 로딩 시작
    showLoading();

    // Supabase에서 검색 (제품명 또는 제품번호 부분 일치)
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    // 결과 표시
    hideLoading();

    // 전체 제품 저장 및 페이지 초기화
    allProducts = data;
    totalItems = data.length;
    currentPage = 1;

    displayProducts(data, query);
  } catch (error) {
    console.error("검색 오류:", error);
    hideLoading();
    showNotification("검색 중 오류가 발생했습니다: " + error.message, "error");
  }
}

// 제품 목록 표시
function displayProducts(products, query = "") {
  // 페이지네이션 계산
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageProducts = products.slice(startIndex, endIndex);
  const totalPages = Math.ceil(products.length / itemsPerPage);

  if (pageProducts.length === 0) {
    productList.innerHTML = "";
    emptyState.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>"${query}"에 해당하는 제품이 없습니다.</p>
        `;
    emptyState.classList.remove("hidden");
    searchStatus.textContent = "";
    updatePaginationUI(0, 0);
    return;
  }

  emptyState.classList.add("hidden");

  // 상태 표시 업데이트
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(endIndex, products.length);
  searchStatus.textContent = `전체 ${products.length}개 제품 중 ${displayStart}-${displayEnd} 표시`;

  // 제품 목록 렌더링
  productList.innerHTML = pageProducts
    .map((product) => {
      // 전산재고 가져오기 (없으면 - 표시)
      const ecountQty =
        ecountStockMap[product.code] !== undefined
          ? ecountStockMap[product.code]
          : "-";
      const ecountClass =
        ecountStockMap[product.code] !== undefined
          ? "text-primary"
          : "text-muted";

      return `
        <div class="product-item" data-id="${product.id}">
            <div class="product-info">
                <h3>${highlightMatch(product.name, query)}</h3>
                <div class="code">${product.code}</div>
                <div class="ecount-stock" style="margin-top: 4px; font-size: 0.9rem; color: var(--text-secondary);">
                    전산재고: <span class="${ecountClass}" style="font-weight: 600;">${ecountQty}</span>개
                </div>
            </div>
            <div class="quantity-input">
                <label for="qty-${product.id}">실사수량:</label>
                <input 
                    type="text" 
                    inputmode="numeric"
                    pattern="[0-9]*"
                    id="qty-${product.id}" 
                    value="${product.quantity || 0}" 
                    data-product-id="${product.id}"
                    data-product-code="${product.code}"
                >
            </div>
        </div>
    `;
    })
    .join("");

  // 페이지네이션 UI 업데이트
  updatePaginationUI(totalPages, products.length);

  // 수량 입력 이벤트 리스너 추가
  attachQuantityListeners();

  // 이카운트 재고가 아직 로드되지 않았다면 로드 시도
  if (!isECountStockLoaded) {
    fetchECountStock();
  }
}

// 이카운트 재고 가져오기 (전체 로드)
async function fetchECountStock() {
  if (isECountStockLoaded) return;

  try {
    console.log("이카운트 재고 조회 시작...");
    const { ZONE, SESSION_ID, WH_CD, API_URL_TEMPLATE } = ECOUNT_CONFIG;

    // 오늘 날짜 (YYYYMMDD)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const url = API_URL_TEMPLATE.replace("{ZONE}", ZONE).replace(
      "{SESSION_ID}",
      SESSION_ID,
    );

    const payload = {
      PROD_CD: "", // 전체 품목 조회
      WH_CD: WH_CD,
      BASE_DATE: today,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.Status !== "200" || !result.Data || !result.Data.Result) {
      console.error("이카운트 API 오류:", result);
      return;
    }

    // 재고 맵핑 (PROD_CD -> BAL_QTY)
    result.Data.Result.forEach((item) => {
      // BAL_QTY는 실수형 문자열일 수 있음 (예: "3.0000000000")
      ecountStockMap[item.PROD_CD] = parseFloat(item.BAL_QTY);
    });

    isECountStockLoaded = true;
    console.log(
      `이카운트 재고 로드 완료: ${Object.keys(ecountStockMap).length}건`,
    );

    // 현재 화면 갱신 (전산재고 표시를 위해)
    displayProducts(allProducts, searchInput.value.trim());
  } catch (error) {
    console.error("이카운트 재고 조회 실패:", error);
  }
}

// 검색어 하이라이트
function highlightMatch(text, query) {
  if (!query) return text;

  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(
    regex,
    '<mark style="background: yellow; padding: 2px 4px; border-radius: 3px;">$1</mark>',
  );
}

// 수량 입력 이벤트 리스너
function attachQuantityListeners() {
  const quantityInputs = document.querySelectorAll("input[data-product-id]");

  quantityInputs.forEach((input) => {
    // 포커스 시: 0이면 빈칸으로
    input.addEventListener("focus", (e) => {
      if (e.target.value === "0") {
        e.target.value = "";
      }
      e.target.select(); // 전체 선택
    });

    // 블러 시: 빈칸이면 0으로 복원
    input.addEventListener("blur", (e) => {
      if (e.target.value === "" || e.target.value === null) {
        e.target.value = "0";
      }
    });

    // 입력 시: 숫자만 허용
    input.addEventListener("input", (e) => {
      // 숫자가 아닌 문자 제거
      e.target.value = e.target.value.replace(/[^0-9]/g, "");

      const productId = e.target.dataset.productId;
      const newQuantity = parseInt(e.target.value) || 0;

      // 디바운싱: 500ms 후 자동 저장
      clearTimeout(updateDebounceTimers[productId]);
      updateDebounceTimers[productId] = setTimeout(() => {
        updateQuantity(productId, newQuantity);
      }, 500);
    });

    // Enter 키 즉시 저장
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const productId = e.target.dataset.productId;
        const newQuantity = parseInt(e.target.value) || 0;

        clearTimeout(updateDebounceTimers[productId]);
        updateQuantity(productId, newQuantity);
        e.target.blur(); // 포커스 해제
      }
    });
  });
}

// 수량 업데이트
async function updateQuantity(productId, quantity) {
  try {
    const { data, error } = await supabaseClient
      .from("products")
      .update({ quantity: quantity })
      .eq("id", productId)
      .select();

    if (error) {
      throw error;
    }

    // 성공 피드백 (간단하게)
    const input = document.getElementById(`qty-${productId}`);
    if (input) {
      input.style.borderColor = "var(--success)";
      setTimeout(() => {
        input.style.borderColor = "";
      }, 1000);
    }

    console.log("수량 업데이트 성공:", productId, quantity);
  } catch (error) {
    console.error("수량 업데이트 오류:", error);
    showNotification(
      "수량 저장 중 오류가 발생했습니다: " + error.message,
      "error",
    );

    // 에러 피드백
    const input = document.getElementById(`qty-${productId}`);
    if (input) {
      input.style.borderColor = "var(--danger)";
    }
  }
}

// 로딩 표시
function showLoading() {
  loadingSpinner.classList.remove("hidden");
  productList.innerHTML = "";
  emptyState.classList.add("hidden");
}

// 로딩 숨기기
function hideLoading() {
  loadingSpinner.classList.add("hidden");
}

// 초기 제품 로드
async function loadInitialProducts() {
  try {
    showLoading();

    let allData = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;

    // 배치로 전체 데이터 가져오기
    while (hasMore) {
      const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("code", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;

      if (data.length > 0) {
        allData = allData.concat(data);
        offset += batchSize;

        // 로딩 상태 업데이트 (선택사항)
        if (offset > 1000) {
          // 사용자에게 진행 상황을 알리고 싶다면 여기에...
        }
      }

      if (data.length < batchSize) {
        hasMore = false;
      }
    }

    hideLoading();

    if (allData.length === 0) {
      showEmptyState();
      return;
    }

    // 전체 제품 저장 및 페이지 초기화
    allProducts = allData;
    totalItems = allData.length;
    currentPage = 1;

    displayProducts(allData);
  } catch (err) {
    hideLoading();
    showNotification("제품 로드 실패: " + err.message, "error");
  }
}

// 빈 상태 표시
function showEmptyState() {
  productList.innerHTML = "";
  emptyState.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 16px;">📦</div>
        <h3>제품이 없습니다</h3>
        <p>CSV를 업로드하여 제품을 추가하세요.</p>
    `;
  emptyState.classList.remove("hidden");
  searchStatus.textContent = "";
}

// 알림 표시
function showNotification(message, type = "info") {
  notification.className = `alert alert-${type} mt-2`;
  notification.innerHTML = `
        <span>${type === "error" ? "❌" : "ℹ️"}</span>
        <span>${message}</span>
    `;
  notification.classList.remove("hidden");

  // 3초 후 자동 숨김
  setTimeout(() => {
    notification.classList.add("hidden");
  }, 3000);
}

// 페이지네이션 UI 업데이트
function updatePaginationUI(totalPages, totalItems) {
  const paginationTop = document.getElementById("paginationTop");

  if (totalPages <= 1) {
    paginationTop.classList.add("hidden");
    return;
  }

  paginationTop.classList.remove("hidden");

  // 페이지 번호 범위 계산 (최대 5개 표시)
  const maxVisiblePages = 5;

  // 현재 페이지가 속한 그룹 계산 (1-5, 6-10, 11-15, ...)
  const currentGroup = Math.ceil(currentPage / maxVisiblePages);
  let startPage = (currentGroup - 1) * maxVisiblePages + 1;
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // 페이지네이션 HTML 생성 (2줄 구조)
  let paginationHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center;">
      <!-- 첫 번째 줄: 페이지 번호들 -->
      <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: nowrap;">
  `;

  // 페이지 번호 버튼들
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    paginationHTML += `
      <button 
        class="btn ${isActive ? "btn-primary" : "btn-outline"}" 
        onclick="goToPage(${i})" 
        style="padding: 6px 12px; min-width: 60px; min-height: 40px;font-size: 14px; font-weight: ${isActive ? "700" : "400"}; ${isActive ? "background: var(--primary); color: white;" : ""}"
      >
        ${i}
      </button>
    `;
  }

  paginationHTML += `
      </div>
      <!-- 두 번째 줄: 이전/다음 버튼 -->
      <div style="display: flex; gap: 8px; justify-content: center;">
  `;

  // 이전 그룹으로 이동 (이전 그룹의 첫 페이지)
  const prevGroupFirstPage = startPage - maxVisiblePages;
  if (prevGroupFirstPage >= 1) {
    paginationHTML += `
      <button class="btn btn-outline" onclick="goToPage(${prevGroupFirstPage})" style="padding: 6px 12px; font-size: 14px;">
        ◀◀ 이전
      </button>
    `;
  }

  // 다음 그룹으로 이동 (다음 그룹의 첫 페이지)
  const nextGroupFirstPage = endPage + 1;
  if (nextGroupFirstPage <= totalPages) {
    paginationHTML += `
      <button class="btn btn-outline" onclick="goToPage(${nextGroupFirstPage})" style="padding: 6px 12px; font-size: 14px;">
        다음 ▶▶
      </button>
    `;
  }

  paginationHTML += `
      </div>
    </div>
  `;

  paginationTop.innerHTML = paginationHTML;
}

// 페이지 이동 함수
function goToPage(page) {
  if (page < 1 || page > Math.ceil(allProducts.length / itemsPerPage)) {
    return;
  }
  currentPage = page;
  displayProducts(allProducts, searchInput.value.trim());
  window.scrollTo({ top: 0, behavior: "smooth" });
}
