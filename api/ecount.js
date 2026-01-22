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
    LOGIN_URL: "https://oapiAB.ecount.com/OAPI/V2/OAPILogin",
    COM_CODE: "603476",
    USER_ID: "강수화",
    API_CERT_KEY: "0a21ffd1440d5436cb58f4a3be5560c196",
    ZONE: "AB",
    LAN_TYPE: "ko-KR",
    WH_CD: "7777",
    STOCK_CACHE_SEC: 30, // 30 second stock cache
  };

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
        CONFIG.LOGIN_URL,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
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
                reject(
                  new Error(
                    "Login Failed: " +
                      (result.Data?.message || JSON.stringify(result)),
                  ),
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
    res.status(500).json({ error: error.message });
  }
}
