import { createClient } from "@supabase/supabase-js";
import https from "https";

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
    COM_CODE: "603476",
    USER_ID: "에이피아이",
    API_CERT_KEY: "403dc3191c92b42aabc59227e3fd15b167",
    ZONE: "AB",
    LAN_TYPE: "ko-KR",
    WH_CD: "7777",
    STOCK_CACHE_SEC: 30,
  };

  /**
   * Helper: Get Zone from ECOUNT
   */
  async function getZoneFromECount() {
    const payload = JSON.stringify({
      COM_CODE: CONFIG.COM_CODE,
    });

    return new Promise((resolve, reject) => {
      const url = new URL("https://oapi.ecount.com/OAPI/V2/Zone");
      const zoneReq = https.request(
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
            try {
              console.log("Zone API Response:", data);
              const result = JSON.parse(data);
              if (result.Status === "200" && result.Data?.ZONE) {
                console.log("✅ Zone 확인 성공:", result.Data.ZONE);
                resolve(result.Data.ZONE);
              } else {
                console.error("❌ Zone 확인 실패:", result);
                reject(new Error("Zone lookup failed"));
              }
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      zoneReq.on("error", reject);
      zoneReq.write(payload);
      zoneReq.end();
    });
  }

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
   * Helper: Login to ECOUNT
   */
  async function loginToECount(zone) {
    console.log("🔑 [Vercel] Logging in to ECOUNT...");
    console.log("Using ZONE:", zone);

    const LOGIN_URL = `https://oapi${zone}.ecount.com/OAPI/V2/OAPILogin`;

    const payload = JSON.stringify({
      COM_CODE: CONFIG.COM_CODE,
      USER_ID: CONFIG.USER_ID,
      API_CERT_KEY: CONFIG.API_CERT_KEY,
      LAN_TYPE: CONFIG.LAN_TYPE,
      ZONE: zone,
    });

    console.log("📤 Login URL:", LOGIN_URL);
    console.log("📤 Login Payload:", payload);

    return new Promise((resolve, reject) => {
      const url = new URL(LOGIN_URL);
      const loginReq = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", async () => {
            try {
              console.log("📥 Login Response:", data);

              if (data.trim().startsWith("<")) {
                console.error("❌ HTML Response instead of JSON");
                return reject(new Error("ECOUNT Login HTML Response"));
              }

              const result = JSON.parse(data);

              if (
                String(result.Status) === "200" &&
                result.Data?.Datas?.SESSION_ID
              ) {
                console.log(
                  "✅ Login Success! Session ID:",
                  result.Data.Datas.SESSION_ID,
                );
                resolve(result.Data.Datas.SESSION_ID);
              } else {
                console.error(
                  "❌ Login Failed:",
                  JSON.stringify(result, null, 2),
                );

                const errorData = {
                  message:
                    result.Data?.message ||
                    result.Error?.Message ||
                    "Unknown Error",
                  raw_status: result.Status,
                  raw_response: result,
                };

                reject(new Error(`LOGIN_FAIL: ${JSON.stringify(errorData)}`));
              }
            } catch (e) {
              console.error("❌ Parse Error:", e.message);
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
  async function fetchStockFromECount(sessionId, zone) {
    const targetUrl = `https://oapi${zone}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;
    const { PROD_CD } = req.body || {};
    const payload = JSON.stringify({
      PROD_CD: PROD_CD || "",
      WH_CD: CONFIG.WH_CD,
      BASE_DATE: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    });

    return new Promise((resolve, reject) => {
      const url = new URL(targetUrl);
      const stockReq = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              if (data.trim().startsWith("<")) {
                resolve({ Status: "500", Error: { Message: "HTML Response" } });
              } else {
                resolve(JSON.parse(data));
              }
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      stockReq.on("error", reject);
      stockReq.write(payload);
      stockReq.end();
    });
  }

  try {
    // ✅ 1단계: Zone 확인
    console.log("🔍 Step 1: Zone 확인 중...");
    let actualZone;
    try {
      actualZone = await getZoneFromECount();
      console.log(`✅ Zone 확인됨: ${actualZone}`);
    } catch (zoneError) {
      console.warn("⚠️ Zone API 실패, 기본값 사용:", CONFIG.ZONE);
      actualZone = CONFIG.ZONE;
    }

    let supabase =
      supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey)
        : null;
    let cache = await getFullCache(supabase);

    // --- 2. STOCK DATA CACHE CHECK ---
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

    // --- 3. STORM PROTECTION (JITTER) ---
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 800)));

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

    // --- 4. SESSION ID CHECK ---
    let sessionId = cache?.session_id !== "INIT" ? cache?.session_id : null;
    const sessionAge = cache?.updated_at
      ? (new Date().getTime() - new Date(cache.updated_at).getTime()) / 1000
      : 9999;

    if (!sessionId || sessionAge > 50 * 60) {
      sessionId = await loginToECount(actualZone);
      if (supabase) {
        await supabase
          .from("ecount_session")
          .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
      }
    }

    // --- 5. FETCH STOCK FROM ECOUNT ---
    console.log("🚀 [Vercel] Fetching fresh stock from ECOUNT...");
    let stockResult = await fetchStockFromECount(sessionId, actualZone);

    // --- 6. RETRY IF SESSION INVALID ---
    if (String(stockResult.Status) !== "200") {
      console.warn("⚠️ Session invalid. Refreshing session and retrying...");
      sessionId = await loginToECount(actualZone);
      if (supabase) {
        await supabase
          .from("ecount_session")
          .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
      }
      stockResult = await fetchStockFromECount(sessionId, actualZone);
    }

    // --- 7. UPDATE CACHE AND RETURN ---
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
    console.error("Full Error:", error);

    res.status(500).json({
      error: error.message,
      details: error.stack?.split("\n")[0],
      timestamp: new Date().toISOString(),
    });
  }
}
