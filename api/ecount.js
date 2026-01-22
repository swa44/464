import { createClient } from "@supabase/supabase-js";
import https from "https";

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const CONFIG = {
    COM_CODE: "603476".trim(),
    USER_ID: "KANGSOOHWA".trim(), // 영문 ID로 변경
    API_CERT_KEY: "57ccf1f47331e4c10b01da90ca2face5c6".trim(), // 신규 키 적용
    ZONE: "AB".trim(), // 대문자로 복구 (ec_req_sid=AB... 확인됨)
    LAN_TYPE: "ko-KR",
    WH_CD: "7777".trim(),
    STOCK_CACHE_SEC: 30,
  };

  const LOGIN_URL = `https://oapi${CONFIG.ZONE}.ecount.com/OAPI/V2/OAPILogin`;

  /**
   * Helper: Get Cached Session & Stock from Supabase
   */
  async function getFullCache(supabase) {
    if (!supabase) return null;
    try {
      const { data } = await supabase
        .from("ecount_session")
        .select("*")
        .eq("id", 1)
        .single();
      return data;
    } catch (e) {
      console.error("⚠️ Cache read error:", e.message);
      return null;
    }
  }

  /**
   * Helper: Get Zone from ECOUNT (Diagnostic)
   */
  async function getZoneFromECount() {
    console.log(
      `🔍 [ECOUNT] Detecting Zone for COM_CODE: ${CONFIG.COM_CODE}...`,
    );
    return new Promise((resolve, reject) => {
      const zoneReq = https.request(
        "https://oapi.ecount.com/OAPI/V2/Zone", // 최신 Zone API 엔드포인트
        { method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              const status = String(result.Status);
              if (status === "200") {
                // ECOUNT V2 Zone API can return result.Data as a string "AB" or an object { ZONE: "AB" }
                const zoneValue =
                  typeof result.Data === "string"
                    ? result.Data
                    : result.Data?.ZONE;
                resolve(
                  zoneValue || `NO_ZONE_FIELD:${JSON.stringify(result.Data)}`,
                );
              } else {
                resolve(
                  `API_ERROR_STATUS_${status}: ${JSON.stringify(result.Errors || result.Error || result)}`,
                );
              }
            } catch (e) {
              resolve(`PARSE_ERROR: ${data.substring(0, 100)}`);
            }
          });
        },
      );
      zoneReq.on("error", () => resolve("CONNECTION_ERROR"));
      zoneReq.write(JSON.stringify({ COM_CODE: CONFIG.COM_CODE }));
      zoneReq.end();
    });
  }

  /**
   * Helper: Login to ECOUNT
   */
  async function loginToECount() {
    console.log("🔑 [Vercel] Logging in to ECOUNT...");
    const payload = JSON.stringify({
      COM_CODE: CONFIG.COM_CODE,
      USER_ID: CONFIG.USER_ID,
      API_CERT_KEY: CONFIG.API_CERT_KEY,
      ZONE: CONFIG.ZONE,
      LAN_TYPE: CONFIG.LAN_TYPE,
    });

    return new Promise((resolve, reject) => {
      const loginReq = https.request(
        LOGIN_URL,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", async () => {
            try {
              if (data.trim().startsWith("<")) {
                console.error(
                  "❌ [ECOUNT] HTML Response instead of JSON. Check URL or Server Status.",
                );
                return reject(new Error("ECOUNT Login HTML Response"));
              }
              const result = JSON.parse(data);
              if (
                String(result.Status) === "200" &&
                result.Data?.Datas?.SESSION_ID
              ) {
                resolve(result.Data.Datas.SESSION_ID);
              } else {
                console.error(
                  "❌ [ECOUNT] Login Failed Detailed Response:",
                  JSON.stringify(result, null, 2),
                );
                // Show info about Config without revealing secrets
                console.log("ℹ️ [ECOUNT] Current Config Check:", {
                  COM_CODE: CONFIG.COM_CODE,
                  USER_ID: CONFIG.USER_ID,
                  API_CERT_KEY: CONFIG.API_CERT_KEY
                    ? `PRESENT (Length: ${CONFIG.API_CERT_KEY.length})`
                    : "MISSING",
                  ZONE: CONFIG.ZONE,
                  LAN_TYPE: CONFIG.LAN_TYPE,
                });
                const keyHint = CONFIG.API_CERT_KEY
                  ? `${CONFIG.API_CERT_KEY.substring(0, 4)}...${CONFIG.API_CERT_KEY.slice(-4)}`
                  : "None";
                const detectedZone = await getZoneFromECount();
                const zoneMatch =
                  detectedZone === CONFIG.ZONE
                    ? "MATCH"
                    : `MISMATCH (Detected: ${detectedZone})`;

                // Construct a more descriptive error object
                const errorData = {
                  message:
                    result.Data?.message ||
                    result.Error?.Message ||
                    "Unknown ECount Error",
                  raw_status: result.Status,
                  diagnostic: {
                    id: CONFIG.USER_ID,
                    com: CONFIG.COM_CODE,
                    zone: `${CONFIG.ZONE} [${zoneMatch}]`,
                    key_hint: keyHint,
                    key_len: CONFIG.API_CERT_KEY?.length,
                  },
                  raw_response: result,
                };

                reject(
                  new Error(`LOGIN_FAIL_DETAIL: ${JSON.stringify(errorData)}`),
                );
              }
            } catch (e) {
              console.error(
                "❌ [ECOUNT] Parse Error:",
                e.message,
                "Raw Content:",
                data.substring(0, 100),
              );
              reject(e);
            }
          });
        },
      );
      loginReq.on("error", reject);
      loginReq.write(payload);
      loginReq.end();
    });
  }

  /**
   * Helper: Fetch Stock from ECOUNT
   */
  async function fetchStockFromECount(sessionId) {
    const targetUrl = `https://oapi${CONFIG.ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;
    const { PROD_CD } = req.body || {};
    const payload = JSON.stringify({
      PROD_CD: PROD_CD || "",
      WH_CD: CONFIG.WH_CD,
      BASE_DATE: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        targetUrl,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              if (data.trim().startsWith("<"))
                resolve({ Status: "500", Error: { Message: "HTML Response" } });
              else resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  try {
    let supabase =
      supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey)
        : null;
    let cache = await getFullCache(supabase);

    // --- 1. STOCK DATA CACHE CHECK ---
    if (cache?.stock_data && cache?.stock_updated_at) {
      const stockAge =
        (new Date().getTime() - new Date(cache.stock_updated_at).getTime()) /
        1000;
      if (stockAge < CONFIG.STOCK_CACHE_SEC) {
        console.log(
          `✅ [Cache] Using Cached Stock (${Math.round(stockAge)}s old)`,
        );
        return res.status(200).json(cache.stock_data);
      }
    }

    // --- 2. STORM PROTECTION (JITTER) ---
    // Wait a random jitter to spread concurrent requests
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 800)));

    // Re-check cache after jitter
    cache = await getFullCache(supabase);
    if (cache?.stock_data && cache?.stock_updated_at) {
      const stockAge =
        (new Date().getTime() - new Date(cache.stock_updated_at).getTime()) /
        1000;
      if (stockAge < CONFIG.STOCK_CACHE_SEC) {
        console.log(
          `✅ [Cache] Found valid stock after jitter (${Math.round(stockAge)}s old)`,
        );
        return res.status(200).json(cache.stock_data);
      }
    }

    // --- 3. SESSION ID CHECK ---
    let sessionId = cache?.session_id !== "INIT" ? cache?.session_id : null;
    const sessionAge = cache?.updated_at
      ? (new Date().getTime() - new Date(cache.updated_at).getTime()) / 1000
      : 9999;

    if (!sessionId || sessionAge > 50 * 60) {
      sessionId = await loginToECount();
      if (supabase)
        await supabase
          .from("ecount_session")
          .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
    }

    // --- 4. FETCH STOCK FROM ECOUNT ---
    console.log("🚀 [Vercel] Fetching fresh stock from ECOUNT...");
    let stockResult = await fetchStockFromECount(sessionId);

    // --- 5. RETRY IF SESSION INVALID ---
    if (String(stockResult.Status) !== "200") {
      console.warn(
        "⚠️ [Vercel] Session invalid. Refreshing session and retrying fetch...",
      );
      sessionId = await loginToECount();
      if (supabase)
        await supabase
          .from("ecount_session")
          .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
      stockResult = await fetchStockFromECount(sessionId);
    }

    // --- 6. UPDATE CACHE AND RETURN ---
    if (String(stockResult.Status) === "200" && supabase) {
      console.log("💾 [Cache] Updating Stock Cache in Supabase.");
      await supabase
        .from("ecount_session")
        .update({
          stock_data: stockResult,
          stock_updated_at: new Date(),
        })
        .eq("id", 1);
    }

    return res.status(200).json(stockResult);
  } catch (error) {
    console.error("❌ [Vercel] Fatal Error:", error.message);
    // Ensure the message and any additional data is sent back
    res.status(500).json({
      error: error.message,
      details: error.stack?.split("\n")[0], // Optional: include first line of stack for more context
    });
  }
}
