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
let updateDebounceTimers = {};

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
    displayProducts(data, query);
  } catch (error) {
    console.error("검색 오류:", error);
    hideLoading();
    showNotification("검색 중 오류가 발생했습니다: " + error.message, "error");
  }
}

// 제품 목록 표시
function displayProducts(products, query) {
  if (products.length === 0) {
    productList.innerHTML = "";
    emptyState.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>"${query}"에 해당하는 제품이 없습니다.</p>
        `;
    emptyState.classList.remove("hidden");
    searchStatus.textContent = "";
    return;
  }

  emptyState.classList.add("hidden");
  searchStatus.textContent = `${products.length}개의 제품을 찾았습니다`;

  // 제품 목록 렌더링
  productList.innerHTML = products
    .map(
      (product) => `
        <div class="product-item" data-id="${product.id}">
            <div class="product-info">
                <h3>${highlightMatch(product.name, query)}</h3>
                <div class="code">${product.code}</div>
            </div>
            <div class="quantity-input">
                <label for="qty-${product.id}">수량:</label>
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
    `
    )
    .join("");

  // 수량 입력 이벤트 리스너 추가
  attachQuantityListeners();
}

// 검색어 하이라이트
function highlightMatch(text, query) {
  if (!query) return text;

  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(
    regex,
    '<mark style="background: yellow; padding: 2px 4px; border-radius: 3px;">$1</mark>'
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
      "error"
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

// 초기 제품 로드 (처음 50개)
async function loadInitialProducts() {
  try {
    showLoading();

    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      showNotification(
        "제품 로드 중 오류가 발생했습니다: " + error.message,
        "error"
      );
      hideLoading();
      return;
    }

    hideLoading();

    if (data.length === 0) {
      showEmptyState();
      return;
    }

    searchStatus.textContent = `전체 ${data.length}개 제품`;
    displayProducts(data);
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
