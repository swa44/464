const https = require("https");

export default async function handler(req, res) {
  // 1. Enable CORS (for frontend access)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // ECOUNT Configuration
  const CONFIG = {
    LOGIN_URL: "https://oapiAB.ecount.com/OAPI/V2/OAPILogin",
    COM_CODE: "603476",
    USER_ID: "강수화",
    API_CERT_KEY: "0a21ffd1440d5436cb58f4a3be5560c196",
    ZONE: "AB",
    LAN_TYPE: "ko-KR",
    WH_CD: "7777",
  };

  try {
    console.log("🔑 [Vercel] Logging in to ECOUNT...");

    // 2. Auto-Login to get Session ID
    const sessionPayload = JSON.stringify({
      COM_CODE: CONFIG.COM_CODE,
      USER_ID: CONFIG.USER_ID,
      API_CERT_KEY: CONFIG.API_CERT_KEY,
      ZONE: CONFIG.ZONE,
      LAN_TYPE: CONFIG.LAN_TYPE,
    });

    const sessionId = await new Promise((resolve, reject) => {
      const loginReq = https.request(
        CONFIG.LOGIN_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(sessionPayload),
          },
        },
        (loginRes) => {
          let data = "";
          loginRes.on("data", (c) => (data += c));
          loginRes.on("end", () => {
            try {
              // Check if response is HTML (starts with <)
              if (data.trim().startsWith("<")) {
                console.error(
                  "❌ ECOUNT returned HTML (Likely Error/Block):",
                  data.substring(0, 200),
                );
                reject(
                  new Error(
                    "ECOUNT API returned HTML instead of JSON. (Server Error or Rate Limit)",
                  ),
                );
                return;
              }

              const result = JSON.parse(data);
              // Status can be "200" (string) or 200 (number)
              if (
                String(result.Status) === "200" &&
                result.Data &&
                result.Data.Datas &&
                result.Data.Datas.SESSION_ID
              ) {
                resolve(result.Data.Datas.SESSION_ID);
              } else {
                console.error(
                  "❌ Login Validation Failed. Response:",
                  JSON.stringify(result),
                );
                reject(
                  new Error(
                    "Login verification failed: " + JSON.stringify(result),
                  ),
                );
              }
            } catch (e) {
              reject(
                new Error(
                  "Login Parse Error: " +
                    e.message +
                    " | Raw: " +
                    data.substring(0, 100),
                ),
              );
            }
          });
        },
      );
      loginReq.on("error", reject);
      loginReq.write(sessionPayload);
      loginReq.end();
    });

    console.log("✅ [Vercel] Session ID Acquired:", sessionId);

    // 3. Fetch Stock Data using Session ID
    const targetUrl = `https://oapi${CONFIG.ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;

    // Use params from request or default
    const { PROD_CD } = req.body || {};

    const stockPayload = JSON.stringify({
      PROD_CD: PROD_CD || "",
      WH_CD: CONFIG.WH_CD,
      BASE_DATE: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    });

    const stockData = await new Promise((resolve, reject) => {
      const stockReq = https.request(
        targetUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(stockPayload),
          },
        },
        (stockRes) => {
          let data = "";
          stockRes.on("data", (c) => (data += c));
          stockRes.on("end", () => resolve(data));
        },
      );
      stockReq.on("error", reject);
      stockReq.write(stockPayload);
      stockReq.end();
    });

    // 4. Return Data
    res.status(200).json(JSON.parse(stockData));
  } catch (error) {
    console.error("❌ [Vercel] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
