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
let toleranceValue = 0; // 오차범위 (admin에서 설정)

// 페이지 로드 시
document.addEventListener("DOMContentLoaded", () => {
  // 오차범위 설정 로드
  loadToleranceSetting();

  // 초기 50개 제품 로드
  loadInitialProducts();

  // 통계 로드
  loadStatistics();

  // 실시간 동기화 시작
  subscribeToRealtime();
});

// 오차범위 설정 로드
async function loadToleranceSetting() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', 'tolerance')
      .single();

    if (!error && data) {
      toleranceValue = parseInt(data.value) || 0;
    }
  } catch (e) {
    console.error('오차범위 로드 실패:', e);
  }
}

// 통과/불일치 배지 HTML 반환
function getComparisonBadgeHtml(product) {
  if (product.quantity === null || product.quantity === undefined) return '';
  if (!isECountStockLoaded) return '';
  const ecountQty = ecountStockMap[product.code];
  if (ecountQty === undefined) return '';

  const diff = Math.abs(product.quantity - ecountQty);
  if (diff <= toleranceValue) {
    return '<span class="badge badge-pass comparison-badge">통과</span>';
  } else {
    return '<span class="badge badge-fail comparison-badge">불일치</span>';
  }
}

// 특정 항목의 배지 갱신
function refreshComparisonBadge(productId, quantity) {
  const input = document.getElementById(`qty-${productId}`);
  if (!input) return;
  const productItem = input.closest('.product-item');
  if (!productItem) return;

  const oldBadge = productItem.querySelector('.comparison-badge');
  if (oldBadge) oldBadge.remove();

  const code = input.dataset.productCode;
  const badgeHtml = getComparisonBadgeHtml({ quantity, code });
  if (badgeHtml) {
    const ecountStockEl = productItem.querySelector('.ecount-stock');
    if (ecountStockEl) ecountStockEl.insertAdjacentHTML('beforeend', badgeHtml);
  }
}

// 실시간 통계 로드
async function loadStatistics() {
  try {
    // 1. 전체 제품 수 (exact count)
    const { count: total, error: e1 } = await supabaseClient
      .from("products")
      .select("*", { count: "exact", head: true });

    if (e1) throw e1;

    // 2. 입력 완료 수 (quantity > 0)
    const { count: counted, error: e2 } = await supabaseClient
      .from("products")
      .select("*", { count: "exact", head: true })
      .gte("quantity", 0);

    if (e2) throw e2;

    // 3. UI 업데이트
    const totalEl = document.getElementById("statTotalCount");
    const countedEl = document.getElementById("statCountedCount");
    const progressEl = document.getElementById("statProgressPercent");

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (countedEl) countedEl.textContent = counted.toLocaleString();

    if (progressEl) {
      const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
      progressEl.textContent = percent;
    }
  } catch (error) {
    console.error("통계 로드 실패:", error);
  }
}

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
          : "0";
      const ecountClass =
        ecountStockMap[product.code] !== undefined
          ? "text-primary"
          : "text-muted";

      // 수량이 입력된 항목인지 확인
      const hasQuantity = product.quantity !== null && product.quantity >= 0;
      const itemClass = hasQuantity
        ? "product-item has-quantity"
        : "product-item";

      return `
        <div class="${itemClass}" data-id="${product.id}">
            <div class="product-info">
                <h3>${highlightMatch(product.name, query)}</h3>
                <div class="code">${product.code}</div>
                <div class="ecount-stock" style="margin-top: 4px; font-size: 0.9rem; color: var(--text-secondary);">
                    전산재고: <span class="${ecountClass}" style="font-weight: 600;">${ecountQty}</span>개
                    ${getComparisonBadgeHtml(product)}
                </div>
            </div>
            <div class="quantity-input quantity-wrapper">
                <label for="qty-${product.id}">실사수량:</label>
                <input 
                    type="text" 
                    inputmode="numeric"
                    pattern="[0-9]*"
                    id="qty-${product.id}" 
                    value="${product.quantity === null ? "" : product.quantity}" 
                    placeholder="-"
                    data-product-id="${product.id}"
                    data-product-code="${product.code}"
                >
                <button type="button" class="btn-calc-open" data-target-id="qty-${product.id}" tabindex="-1" title="계산기 열기">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <line x1="8" y1="6" x2="16" y2="6"></line>
                    <line x1="16" y1="14" x2="16" y2="18"></line>
                    <path d="M16 10h.01"></path>
                    <path d="M12 10h.01"></path>
                    <path d="M8 10h.01"></path>
                    <path d="M12 14h.01"></path>
                    <path d="M8 14h.01"></path>
                    <path d="M12 18h.01"></path>
                    <path d="M8 18h.01"></path>
                  </svg>
                </button>
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

let isECountFetching = false; // 진행 중인 요청 방지
let ecountLastFailTime = 0; // 에러 발생 시 30초 쿨다운

// 이카운트 재고 가져오기 (Vercel Serverless Function 이용)
async function fetchECountStock() {
  if (isECountStockLoaded || isECountFetching) return;

  // 에러 발생 후 30초 동안은 재시도하지 않음 (서버 과부하 방지)
  const now = Date.now();
  if (now - ecountLastFailTime < 30000) {
    console.log("이카운트 재조회 쿨다운 중...");
    return;
  }

  isECountFetching = true;

  try {
    console.log("이카운트 재고 조회 시작 (via Vercel Function)...");

    const response = await fetch("/api/ecount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        WH_CD: "7777",
        PROD_CD: "",
      }),
    });

    const result = await response.json();

    if (result.Status !== "200" || !result.Data || !result.Data.Result) {
      console.error("이카운트 API 오류:", result);
      ecountLastFailTime = Date.now(); // 실패 시간 기록
      return;
    }

    // 재고 맵핑 (PROD_CD -> BAL_QTY)
    result.Data.Result.forEach((item) => {
      ecountStockMap[item.PROD_CD] = parseFloat(item.BAL_QTY);
    });

    isECountStockLoaded = true;
    console.log(
      `이카운트 재고 로드 완료: ${Object.keys(ecountStockMap).length}건`,
    );

    // 현재 화면 갱신
    displayProducts(allProducts, searchInput.value.trim());
  } catch (error) {
    console.error("이카운트 재고 조회 실패:", error);
    ecountLastFailTime = Date.now(); // 실패 시간 기록
  } finally {
    isECountFetching = false;
  }
}

// 실시간 동기화 (Supabase Realtime)
function subscribeToRealtime() {
  supabaseClient
    .channel("products_realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "products" },
      (payload) => {
        const updatedProduct = payload.new;
        console.log("실시간 업데이트 수신:", updatedProduct);

        // 1. 캐시 데이터 업데이트 (allProducts)
        const productIndex = allProducts.findIndex(
          (p) => p.id === updatedProduct.id,
        );
        if (productIndex !== -1) {
          allProducts[productIndex] = updatedProduct;
        }

        // 2. 현재 화면에 보이고 있다면 UI 즉시 업데이트
        const input = document.getElementById(`qty-${updatedProduct.id}`);
        if (input) {
          // 현재 내가 입력 중인 필드가 아닐 때만 업데이트 (내 입력 방해 금지)
          if (document.activeElement !== input) {
            input.value = updatedProduct.quantity;
            highlightRemoteUpdate(input);

            // 배경색 업데이트 (has-quantity 클래스 추가/제거)
            const productItem = input.closest(".product-item");
            if (productItem) {
              if (
                updatedProduct.quantity !== null &&
                updatedProduct.quantity >= 0
              ) {
                productItem.classList.add("has-quantity");
              } else {
                productItem.classList.remove("has-quantity");
              }
            }

            // 배지 갱신
            refreshComparisonBadge(updatedProduct.id, updatedProduct.quantity);

            loadStatistics(); // 통계 업데이트
          }
        }
      },
    )
    .subscribe();
}

// 다른 사용자가 업데이트했을 때 강조 효과
function highlightRemoteUpdate(element) {
  element.style.backgroundColor = "#fff9c4"; // 연노랑
  element.style.transition = "background-color 0.5s";

  setTimeout(() => {
    element.style.backgroundColor = "";
  }, 2000);
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
    // 포커스 시: 전체 선택
    input.addEventListener("focus", (e) => {
      e.target.select(); // 전체 선택
    });

    // 입력 시: 숫자만 허용
    input.addEventListener("input", (e) => {
      // 숫자가 아닌 문자 제거
      e.target.value = e.target.value.replace(/[^0-9]/g, "");

      const productId = e.target.dataset.productId;
      const newQuantity =
        e.target.value === "" ? null : parseInt(e.target.value) || 0;

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
        const newQuantity =
          e.target.value === "" ? null : parseInt(e.target.value) || 0;

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

      // 부모 product-item에 has-quantity 클래스 추가/제거
      const productItem = input.closest(".product-item");
      if (productItem) {
        if (quantity !== null && quantity >= 0) {
          productItem.classList.add("has-quantity");
        } else {
          productItem.classList.remove("has-quantity");
        }
      }
    }

    // allProducts 캐시 동기화
    const idx = allProducts.findIndex((p) => p.id === parseInt(productId));
    if (idx !== -1) allProducts[idx].quantity = quantity;

    // 배지 갱신
    refreshComparisonBadge(productId, quantity);

    console.log("수량 업데이트 성공:", productId, quantity);
    loadStatistics(); // 통계 업데이트
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

// --- 🧮 계산기 로직 ---

let currentCalcTargetId = null;
let calcFormula = ""; // 상단 수식 (예: "10 + 5")
let calcCurrentInput = "0"; // 현재 입력 중인 숫자 (예: "5")
let isResultDisplayed = false; // 결과가 표시된 상태인지

function initCalculator() {
  const modal = document.getElementById("calculatorModal");
  const closeBtn = document.getElementById("closeCalcBtn");
  const applyBtn = document.getElementById("applyCalcBtn");
  const keysContainer = document.querySelector(".calc-keys");

  if (!modal) return;

  // 1. 계산기 열기 버튼 (이벤트 위임)
  const listContainer = document.getElementById("productList");
  if (listContainer) {
    listContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-calc-open");
      if (btn) {
        e.preventDefault();
        const targetId = btn.dataset.targetId;
        openCalculator(targetId);
      }
    });
  }

  // 2. 모달 닫기
  if (closeBtn) closeBtn.addEventListener("click", closeCalculator);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeCalculator();
  });

  // 3. 키패드 입력 (Fast Click - 터치 즉시 반응)
  if (keysContainer) {
    const handleKeyInput = (e) => {
      const btn = e.target.closest(".calc-btn");
      if (!btn || btn.classList.contains("btn-submit")) return;

      // 터치 딜레이 제거
      if (e.type === "touchstart") {
        e.preventDefault();
      }

      // 시각적 피드백 즉시 적용
      btn.classList.add("active-press");
      setTimeout(() => btn.classList.remove("active-press"), 100);

      const action = btn.dataset.action;
      const value = btn.dataset.value;

      handleCalcInput(action, value);
    };

    // 터치용 (passive: false -> preventDefault 가능)
    keysContainer.addEventListener("touchstart", handleKeyInput, {
      passive: false,
    });
    // 마우스용
    keysContainer.addEventListener("mousedown", handleKeyInput);
  }

  // 4. 적용 버튼
  if (applyBtn) {
    applyBtn.addEventListener("click", applyCalculatorValue);
  }
  // 5. PC 키보드 지원 (숫자패드 등)
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("calculatorModal");
    if (!modal || !modal.classList.contains("open")) return;
    const key = e.key;
    if (/[0-9]/.test(key)) {
      e.preventDefault();
      const btn = document.querySelector(`.calc-btn[data-value="${key}"]`);
      if (btn) {
        btn.classList.add("active-press");
        setTimeout(() => btn.classList.remove("active-press"), 100);
      }
      handleCalcInput(null, key);
      return;
    }
    const operators = {
      "+": "add",
      "-": "subtract",
      "*": "multiply",
      "/": "divide",
    };
    if (operators[key]) {
      e.preventDefault();
      handleCalcInput(operators[key], null);
      return;
    }
    switch (key) {
      case "Enter":
        e.preventDefault();
        applyCalculatorValue();
        break;
      case "=":
        e.preventDefault();
        handleCalcInput("calculate", null);
        break;
      case "Backspace":
        e.preventDefault();
        handleCalcInput("backspace", null);
        break;
      case "Escape":
        e.preventDefault();
        closeCalculator();
        break;
      case "Delete":
        handleCalcInput("clear", null);
        break;
      case ".":
        handleCalcInput(null, ".");
        break;
    }
  });
}

function openCalculator(targetId) {
  currentCalcTargetId = targetId;
  const input = document.getElementById(targetId);
  if (input) input.blur(); // 배경 입력창 포커스 해제
  const initialValue = input ? input.value : "";

  calcFormula = "";
  calcCurrentInput = initialValue !== "" ? initialValue : "0";
  isResultDisplayed = true;

  updateCalcDisplay();

  const modal = document.getElementById("calculatorModal");

  // hidden 클래스 제거 (기존 코드에 hidden이 있다면)
  // CSS에 따라 다르지만, 여기선 style.display와 opacity transition 사용
  // modal.classList.remove('hidden'); // inventory.html에 hidden 클래스는 없고 style이 없을 수도 있음
  // calculator.css에서는 opacity로 제어. 초기 display: none 필요할 수도.

  // 강제로 display 설정 (CSS와 맞춤)
  // .calculator-modal { display: flex; ... opacity: 0; pointer-events: none; }
  // calculator.css 대로면 display: flex가 기본이고 open 클래스로 보임.
  // CSS만으로는 display: none 처리가 안 되어 있을 수 있으니 JS로 제어

  modal.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeCalculator() {
  const modal = document.getElementById("calculatorModal");
  modal.classList.remove("open");
  document.body.classList.remove("modal-open");
}

function handleCalcInput(action, value) {
  if (!action) {
    // 숫자 입력
    if (isResultDisplayed) {
      calcCurrentInput = value === "00" ? "0" : value;
      calcFormula = "";
      isResultDisplayed = false;
    } else {
      if (calcCurrentInput === "0" && value !== ".") {
        calcCurrentInput = value === "00" ? "0" : value;
      } else {
        if (value === "." && calcCurrentInput.includes(".")) return;
        if (calcCurrentInput.length > 12) return; // 길이 제한
        calcCurrentInput += value;
      }
    }
    updateCalcDisplay();
    return;
  }

  switch (action) {
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      handleOperator(action);
      break;
    case "calculate":
      calculateResult();
      break;
    case "clear":
      calcCurrentInput = "0";
      updateCalcDisplay();
      break;
    case "backspace":
      if (calcCurrentInput.length > 1) {
        calcCurrentInput = calcCurrentInput.slice(0, -1);
      } else {
        calcCurrentInput = "0";
      }
      updateCalcDisplay();
      break;
    case "all-clear":
      calcCurrentInput = "0";
      calcFormula = "";
      isResultDisplayed = false;
      updateCalcDisplay();
      break;
  }
}

function handleOperator(op) {
  const symbols = {
    add: "+",
    subtract: "-",
    multiply: "*",
    divide: "/",
  };
  const symbol = symbols[op];

  if (isResultDisplayed) {
    calcFormula = calcCurrentInput + " " + symbol + " ";
    isResultDisplayed = false;
    calcCurrentInput = "0";
  } else {
    calcFormula += calcCurrentInput + " " + symbol + " ";
    calcCurrentInput = "0";
  }
  updateCalcDisplay();
}

function calculateResult() {
  let expression = calcFormula + calcCurrentInput;

  try {
    if (/[^0-9+\-*/. ]/.test(expression)) {
      throw new Error("Invalid");
    }

    // eslint-disable-next-line no-new-func
    const result = new Function("return " + expression)();

    // 소수점 처리
    const rounded = Math.round(result * 100) / 100;

    calcCurrentInput = String(rounded);
    calcFormula = "";
    isResultDisplayed = true;

    updateCalcDisplay();
  } catch (e) {
    calcCurrentInput = "Error";
    isResultDisplayed = true;
    updateCalcDisplay();
  }
}

function updateCalcDisplay() {
  const formulaEl = document.getElementById("calcFormula");
  const resultEl = document.getElementById("calcResult");

  if (formulaEl) {
    let displayFormula = calcFormula.replace(/\*/g, "×").replace(/\//g, "÷");
    formulaEl.textContent = displayFormula;
  }

  if (resultEl) {
    resultEl.textContent = calcCurrentInput;
  }
}

function applyCalculatorValue() {
  if (!currentCalcTargetId) return;

  if (!isResultDisplayed && calcFormula !== "") {
    calculateResult();
  }

  const input = document.getElementById(currentCalcTargetId);
  if (input) {
    if (calcCurrentInput === "Error") return;

    input.value = calcCurrentInput;

    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);

    const keyEvent = new KeyboardEvent("keypress", { key: "Enter" });
    input.dispatchEvent(keyEvent);
  }

  closeCalculator();
}

// 초기화 실행
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalculator);
} else {
  initCalculator();
}
