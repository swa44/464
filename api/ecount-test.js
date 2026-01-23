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
    ZONE: "AB",
    LAN_TYPE: "ko-KR",
  };

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // ============================================
  // 테스트 1: Zone API 호출
  // ============================================
  console.log("\n========================================");
  console.log("테스트 1: Zone API 호출");
  console.log("========================================");

  try {
    const zoneResult = await testZoneAPI(CONFIG.COM_CODE);
    results.tests.push({
      name: "Zone API",
      success: zoneResult.success,
      data: zoneResult.data,
    });
    console.log("✅ Zone API 성공:", JSON.stringify(zoneResult.data, null, 2));
  } catch (error) {
    results.tests.push({
      name: "Zone API",
      success: false,
      error: error.message,
    });
    console.log("❌ Zone API 실패:", error.message);
  }

  // ============================================
  // 테스트 2: 로그인 (ZONE 포함)
  // ============================================
  console.log("\n========================================");
  console.log("테스트 2: 로그인 (ZONE 포함)");
  console.log("========================================");

  try {
    const loginWithZone = await testLogin(
      CONFIG.COM_CODE,
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE,
      true, // ZONE 포함
    );
    results.tests.push({
      name: "로그인 (ZONE 포함)",
      success: loginWithZone.success,
      data: loginWithZone.data,
    });
    console.log(
      "✅ 로그인 성공 (ZONE 포함):",
      JSON.stringify(loginWithZone.data, null, 2),
    );
  } catch (error) {
    results.tests.push({
      name: "로그인 (ZONE 포함)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (ZONE 포함):", error.message);
  }

  // ============================================
  // 테스트 3: 로그인 (ZONE 제외)
  // ============================================
  console.log("\n========================================");
  console.log("테스트 3: 로그인 (ZONE 제외)");
  console.log("========================================");

  try {
    const loginWithoutZone = await testLogin(
      CONFIG.COM_CODE,
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE,
      false, // ZONE 제외
    );
    results.tests.push({
      name: "로그인 (ZONE 제외)",
      success: loginWithoutZone.success,
      data: loginWithoutZone.data,
    });
    console.log(
      "✅ 로그인 성공 (ZONE 제외):",
      JSON.stringify(loginWithoutZone.data, null, 2),
    );
  } catch (error) {
    results.tests.push({
      name: "로그인 (ZONE 제외)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (ZONE 제외):", error.message);
  }

  // ============================================
  // 테스트 4: 로그인 (URL에만 ZONE, payload에서 제외)
  // ============================================
  console.log("\n========================================");
  console.log("테스트 4: 로그인 (URL에만 ZONE)");
  console.log("========================================");

  try {
    const loginUrlOnly = await testLoginUrlZoneOnly(
      CONFIG.COM_CODE,
      CONFIG.USER_ID,
      CONFIG.API_CERT_KEY,
      CONFIG.LAN_TYPE,
      CONFIG.ZONE,
    );
    results.tests.push({
      name: "로그인 (URL에만 ZONE)",
      success: loginUrlOnly.success,
      data: loginUrlOnly.data,
    });
    console.log(
      "✅ 로그인 성공 (URL에만 ZONE):",
      JSON.stringify(loginUrlOnly.data, null, 2),
    );
  } catch (error) {
    results.tests.push({
      name: "로그인 (URL에만 ZONE)",
      success: false,
      error: error.message,
      response: error.response,
    });
    console.log("❌ 로그인 실패 (URL에만 ZONE):", error.message);
  }

  console.log("\n========================================");
  console.log("테스트 완료");
  console.log("========================================\n");

  return res.status(200).json(results);
}

// Zone API 테스트 함수
function testZoneAPI(comCode) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ COM_CODE: comCode });
    const url = new URL("https://oapi.ecount.com/OAPI/V2/Zone");

    console.log("📤 Zone API URL:", url.href);
    console.log("📤 Zone API Payload:", payload);

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
          console.log("📥 Zone API Response:", data);
          try {
            const result = JSON.parse(data);
            if (result.Status === 200 || result.Status === "200") {
              resolve({ success: true, data: result });
            } else {
              reject({
                success: false,
                error: "Invalid response",
                data: result,
              });
            }
          } catch (e) {
            reject({ success: false, error: e.message });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// 로그인 테스트 함수 (ZONE 포함/제외)
function testLogin(comCode, userId, apiKey, lanType, zone, includeZone) {
  return new Promise((resolve, reject) => {
    const loginUrl = includeZone
      ? `https://oapi${zone}.ecount.com/OAPI/V2/OAPILogin`
      : `https://oapi.ecount.com/OAPI/V2/OAPILogin`;

    const payloadObj = {
      COM_CODE: comCode,
      USER_ID: userId,
      API_CERT_KEY: apiKey,
      LAN_TYPE: lanType,
    };

    if (includeZone) {
      payloadObj.ZONE = zone;
    }

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

// 로그인 테스트 (URL에만 ZONE, payload에는 제외)
function testLoginUrlZoneOnly(comCode, userId, apiKey, lanType, zone) {
  return new Promise((resolve, reject) => {
    const loginUrl = `https://oapi${zone}.ecount.com/OAPI/V2/OAPILogin`;

    const payloadObj = {
      COM_CODE: comCode,
      USER_ID: userId,
      API_CERT_KEY: apiKey,
      LAN_TYPE: lanType,
      // ZONE은 제외
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
