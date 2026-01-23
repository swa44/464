import https from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // POST body에서 값을 받음
  const {
    COM_CODE = "603476",
    USER_ID = "에이피아이",
    API_CERT_KEY = "403dc3191c92b42aabc59227e3fd15b167",
    ZONE = "AB",
    LAN_TYPE = "ko-KR",
  } = req.body || {};

  console.log("\n========================================");
  console.log("받은 파라미터:");
  console.log("========================================");
  console.log("COM_CODE:", COM_CODE);
  console.log("USER_ID:", USER_ID);
  console.log("API_CERT_KEY:", API_CERT_KEY);
  console.log("ZONE:", ZONE);
  console.log("LAN_TYPE:", LAN_TYPE);

  try {
    const loginResult = await testLogin(
      COM_CODE,
      USER_ID,
      API_CERT_KEY,
      LAN_TYPE,
      ZONE,
    );

    console.log("✅ 로그인 성공!");
    return res.status(200).json({
      success: true,
      session_id: loginResult.data.Data.Datas.SESSION_ID,
      full_response: loginResult.data,
    });
  } catch (error) {
    console.log("❌ 로그인 실패");
    return res.status(200).json({
      success: false,
      error: error.message,
      response: error.response,
    });
  }
}

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

    console.log("\n📤 Login URL:", loginUrl);
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
          console.log("\n📥 Response Status:", res.statusCode);
          console.log("📥 Response Body:", data);
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
