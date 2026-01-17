// CSV 업로드 로직

let selectedFile = null;
let parsedData = [];

// DOM 요소
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const uploadProgress = document.getElementById("uploadProgress");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const uploadResult = document.getElementById("uploadResult");

// 드래그 앤 드롭 이벤트
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

// 파일 선택 이벤트
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// 업로드 버튼 클릭
uploadBtn.addEventListener("click", uploadToDatabase);

// 파일 선택 처리
function handleFileSelect(file) {
  if (!file.name.endsWith(".csv")) {
    showError("CSV 파일만 업로드 가능합니다.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileInfo.classList.remove("hidden");
  uploadBtn.disabled = false;

  // CSV 파싱
  parseCSV(file);
}

// CSV 파싱
function parseCSV(file) {
  Papa.parse(file, {
    header: true,
    encoding: "UTF-8",
    skipEmptyLines: true,
    complete: function (results) {
      parsedData = results.data;
      console.log("파싱된 데이터:", parsedData.length, "개");

      if (parsedData.length === 0) {
        showError("CSV 파일이 비어있습니다.");
        uploadBtn.disabled = true;
        return;
      }

      // 데이터 검증
      const firstRow = parsedData[0];
      const keys = Object.keys(firstRow);

      if (keys.length < 3) {
        showError(
          "CSV 파일에 최소 3개의 열(제품번호, 제품명, 수량)이 필요합니다."
        );
        uploadBtn.disabled = true;
        return;
      }

      showInfo(`✅ ${parsedData.length}개의 제품이 준비되었습니다.`);
    },
    error: function (error) {
      showError("CSV 파일 파싱 중 오류가 발생했습니다: " + error.message);
      uploadBtn.disabled = true;
    },
  });
}

// 데이터베이스에 업로드
async function uploadToDatabase() {
  if (parsedData.length === 0) {
    showError("업로드할 데이터가 없습니다.");
    return;
  }

  // 업로드 시작
  uploadBtn.disabled = true;
  uploadProgress.classList.remove("hidden");
  uploadResult.classList.add("hidden");

  try {
    // CSV의 첫 번째 행에서 열 이름 가져오기
    const firstRow = parsedData[0];
    const keys = Object.keys(firstRow);

    // 열 이름 매핑 (사용자의 CSV 헤더가 다를 수 있으므로)
    const codeKey = keys[0]; // A열 (제품번호)
    const nameKey = keys[1]; // B열 (제품명)
    const quantityKey = keys[2]; // C열 (수량)

    // 데이터 변환
    const productsToInsert = parsedData
      .map((row) => ({
        code: String(row[codeKey] || "").trim(),
        name: String(row[nameKey] || "").trim(),
        quantity: parseInt(row[quantityKey]) || 0,
      }))
      .filter((p) => p.code && p.name); // 빈 데이터 제외

    console.log("업로드할 제품:", productsToInsert.length, "개");

    // 배치 크기 (한 번에 100개씩 업로드)
    const batchSize = 100;
    const totalBatches = Math.ceil(productsToInsert.length / batchSize);
    let uploadedCount = 0;

    // 1. 기존 데이터 전체 삭제
    progressText.textContent = "기존 데이터 삭제 중...";

    // 안전을 위해 id가 0보다 큰 모든 행 삭제 (전체 삭제 트릭)
    const { error: deleteError } = await supabaseClient
      .from("products")
      .delete()
      .gte("id", 0);

    if (deleteError) {
      throw new Error("기존 데이터 삭제 실패: " + deleteError.message);
    }

    console.log("기존 데이터 삭제 완료");

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, productsToInsert.length);
      const batch = productsToInsert.slice(start, end);

      // Supabase에 insert (전체 교체)
      const { data, error } = await supabaseClient
        .from("products")
        .insert(batch);

      if (error) {
        throw error;
      }

      uploadedCount = end;
      const progress = Math.round(
        (uploadedCount / productsToInsert.length) * 100
      );
      progressBar.style.width = progress + "%";
      progressText.textContent = `업로드 중... (${uploadedCount} / ${productsToInsert.length})`;

      // 진행 상황 확인을 위한 짧은 대기
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 업로드 완료
    progressBar.style.width = "100%";
    progressText.textContent = "업로드 완료!";

    setTimeout(() => {
      uploadProgress.classList.add("hidden");
      showSuccess(
        `✅ ${uploadedCount}개의 제품이 성공적으로 업로드되었습니다!`
      );
      uploadBtn.disabled = false;
    }, 1000);
  } catch (error) {
    console.error("업로드 오류:", error);
    uploadProgress.classList.add("hidden");
    showError("업로드 중 오류가 발생했습니다: " + error.message);
    uploadBtn.disabled = false;
  }
}

// 에러 메시지 표시
function showError(message) {
  uploadResult.className = "alert alert-error mt-2";
  uploadResult.innerHTML = `<span>❌</span><span>${message}</span>`;
  uploadResult.classList.remove("hidden");
}

// 성공 메시지 표시
function showSuccess(message) {
  uploadResult.className = "alert alert-success mt-2";
  uploadResult.innerHTML = `<span>✅</span><span>${message}</span>`;
  uploadResult.classList.remove("hidden");
}

// 정보 메시지 표시
function showInfo(message) {
  uploadResult.className = "alert alert-info mt-2";
  uploadResult.innerHTML = `<span>ℹ️</span><span>${message}</span>`;
  uploadResult.classList.remove("hidden");
}
