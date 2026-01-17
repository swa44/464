// CSV 다운로드 페이지 로직

// DOM 요소
const onlyWithQuantityCheckbox = document.getElementById("onlyWithQuantity");
const totalCountEl = document.getElementById("totalCount");
const countedCountEl = document.getElementById("countedCount");
const progressPercentEl = document.getElementById("progressPercent");
const downloadBtn = document.getElementById("downloadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const notification = document.getElementById("notification");
const loadingPreview = document.getElementById("loadingPreview");
const previewTable = document.getElementById("previewTable");
const previewBody = document.getElementById("previewBody");

// 페이지 로드 시 통계 및 미리보기 로드
document.addEventListener("DOMContentLoaded", () => {
  loadStatistics();
  loadPreview();
});

// 다운로드 버튼 클릭
downloadBtn.addEventListener("click", downloadCSV);

// 새로고침 버튼 클릭
refreshBtn.addEventListener("click", () => {
  loadStatistics();
  loadPreview();
});

// 통계 로드
async function loadStatistics() {
  try {
    // 전체 제품 수
    const { count: totalCount, error: totalError } = await supabaseClient
      .from("products")
      .select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // 수량이 1 이상인 제품 수
    const { count: countedCount, error: countedError } = await supabaseClient
      .from("products")
      .select("*", { count: "exact", head: true })
      .gt("quantity", 0);

    if (countedError) throw countedError;

    // 통계 표시
    totalCountEl.textContent = totalCount || 0;
    countedCountEl.textContent = countedCount || 0;

    const progress =
      totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;
    progressPercentEl.textContent = progress + "%";
  } catch (error) {
    console.error("통계 로드 오류:", error);
    showNotification(
      "통계 로드 중 오류가 발생했습니다: " + error.message,
      "error"
    );
  }
}

// 미리보기 로드
async function loadPreview() {
  try {
    loadingPreview.classList.remove("hidden");
    previewTable.classList.add("hidden");

    // 최근 업데이트된 10개 제품
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // 미리보기 테이블 렌더링
    previewBody.innerHTML = data
      .map(
        (product) => `
            <tr>
                <td style="font-family: 'Courier New', monospace;">${
                  product.code
                }</td>
                <td>${product.name}</td>
                <td style="font-weight: 600; text-align: center;">${
                  product.quantity || 0
                }</td>
                <td style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${formatDateTime(product.updated_at)}
                </td>
            </tr>
        `
      )
      .join("");

    loadingPreview.classList.add("hidden");
    previewTable.classList.remove("hidden");
  } catch (error) {
    console.error("미리보기 로드 오류:", error);
    loadingPreview.classList.add("hidden");
    showNotification(
      "미리보기 로드 중 오류가 발생했습니다: " + error.message,
      "error"
    );
  }
}

// 날짜/시간 포맷팅
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 파일명용 날짜 포맷팅
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}`;
}

// 알림 표시
function showNotification(message, type = "info") {
  notification.className = `alert alert-${type} mt-2`;
  notification.innerHTML = `
        <span>${
          type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"
        }</span>
        <span>${message}</span>
    `;
  notification.classList.remove("hidden");

  // 5초 후 자동 숨김
  setTimeout(() => {
    notification.classList.add("hidden");
  }, 5000);
}
// CSV 다운로드 (배치 처리)
async function downloadCSV() {
  try {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = "<span>⏳</span><span>다운로드 중...</span>";

    // 필터 옵션 확인
    const onlyWithQuantity = onlyWithQuantityCheckbox.checked;

    // 전체 데이터를 담을 배열
    let allData = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;

    // 1000개씩 반복해서 가져오기
    while (hasMore) {
      let query = supabaseClient
        .from("products")
        .select("code, name, quantity")
        .order("code", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (onlyWithQuantity) {
        query = query.gt("quantity", 0);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data.length > 0) {
        allData = allData.concat(data);
        offset += batchSize;

        // 진행 상황 표시
        downloadBtn.innerHTML = `<span>⏳</span><span>${allData.length}개 로드 중...</span>`;
      }

      // 1000개 미만이면 마지막 페이지
      if (data.length < batchSize) {
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      showNotification("다운로드할 데이터가 없습니다.", "error");
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = "<span>⬇️</span><span>CSV 다운로드</span>";
      return;
    }

    // CSV 변환
    const csv = Papa.unparse(allData, {
      header: true,
      columns: ["code", "name", "quantity"],
    });

    // 파일 다운로드
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    }); // UTF-8 BOM 추가
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const fileName = `재고조사_${formatDateForFilename(now)}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(
      `✅ ${allData.length}개의 제품 데이터가 다운로드되었습니다!`,
      "success"
    );
  } catch (error) {
    console.error("다운로드 오류:", error);
    showNotification(
      "다운로드 중 오류가 발생했습니다: " + error.message,
      "error"
    );
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = "<span>⬇️</span><span>CSV 다운로드</span>";
  }
}
