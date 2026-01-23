import https from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const CONFIG = {
    COM_CODE: "603476",
    USER_ID: "KANGSOOHWA",
    API_CERT_KEY: "57ccf1f47331e4c10b01da90ca2face5c6",
    ZONE_UPPER: "AB", // 대문자
    ZONE_LOWER: "ab", // 소문자
    LAN_TYPE: "ko-KR",
  };

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // ============================================
  // 테스트 1: 로그인 (ZONE 대문자 "AB")
  // ============================================
  console.log("\n========================================");
  console.log("테스트 1: 로그인 (ZONE 대문자 AB)");
  console.log("========================================");

  try {
    const loginUpper = await testLogin(
      CONFIG.COM_CODE,
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE_UPPER,
    );
    results.tests.push({
      name: "로그인 (ZONE: AB 대문자)",
      success: true,
      data: loginUpper.data,
    });
    console.log("✅ 로그인 성공 (대문자)");
  } catch (error) {
    results.tests.push({
      name: "로그인 (ZONE: AB 대문자)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (대문자):", error.message);
  }

  // ============================================
  // 테스트 2: 로그인 (ZONE 소문자 "ab")
  // ============================================
  console.log("\n========================================");
  console.log("테스트 2: 로그인 (ZONE 소문자 ab)");
  console.log("========================================");

  try {
    const loginLower = await testLogin(
      CONFIG.COM_CODE,
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE_LOWER,
    );
    results.tests.push({
      name: "로그인 (ZONE: ab 소문자)",
      success: true,
      data: loginLower.data,
    });
    console.log("✅ 로그인 성공 (소문자)");
  } catch (error) {
    results.tests.push({
      name: "로그인 (ZONE: ab 소문자)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (소문자):", error.message);
  }

  // ============================================
  // 테스트 3: USER_ID 소문자 시도
  // ============================================
  console.log("\n========================================");
  console.log("테스트 3: USER_ID 소문자로 시도");
  console.log("========================================");

  try {
    const loginLowerUserId = await testLogin(
      CONFIG.COM_CODE,
      CONFIG.USER_ID.toLowerCase(), // "kangsoohwa"
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE_LOWER,
    );
    results.tests.push({
      name: "로그인 (USER_ID 소문자)",
      success: true,
      data: loginLowerUserId.data,
    });
    console.log("✅ 로그인 성공 (USER_ID 소문자)");
  } catch (error) {
    results.tests.push({
      name: "로그인 (USER_ID 소문자)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (USER_ID 소문자):", error.message);
  }

  // ============================================
  // 테스트 4: COM_CODE 앞에 0 추가 시도
  // ============================================
  console.log("\n========================================");
  console.log("테스트 4: COM_CODE 앞에 0 추가");
  console.log("========================================");

  try {
    const loginWithZero = await testLogin(
      "0603476", // 앞에 0 추가
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE_LOWER,
    );
    results.tests.push({
      name: "로그인 (COM_CODE: 0603476)",
      success: true,
      data: loginWithZero.data,
    });
    console.log("✅ 로그인 성공 (COM_CODE 0 추가)");
  } catch (error) {
    results.tests.push({
      name: "로그인 (COM_CODE: 0603476)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (COM_CODE 0 추가):", error.message);
  }

  console.log("\n========================================");
  console.log("테스트 완료");
  console.log("========================================\n");

  return res.status(200).json(results);
}

// 로그인 테스트 함수
function testLogin(comCode, userId, apiKey, lanType, zone) {
  return new Promise((resolve, reject) => {
    const loginUrl = `https://oapi${zone}.ecount.com/OAPI/V2/OAPILogin`;

    const payloadObj = {
      COM_CODE: comCode,
      USER_ID: userId,
      API_CERT_KEY: apiKey,
      LAN_TYPE: lanType,
      ZONE: zone,
    };

    const payload = JSON.stringify(payloadObj);

    console.log("📤 Login URL:", loginUrl);
    console.log("📤 Login Payload:", payload);

    const url = new URL(loginUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          console.log("📥 Login Response Status:", res.statusCode);
          console.log("📥 Login Response Body:", data);
          try {
            const result = JSON.parse(data);
            if (
              (result.Status === 200 || result.Status === "200") &&
              result.Data?.Datas?.SESSION_ID
            ) {
              resolve({ success: true, data: result });
            } else {
              const error = new Error("Login failed");
              error.response = result;
              reject(error);
            }
          } catch (e) {
            reject(new Error(e.message));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
