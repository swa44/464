import { createClient } from "@supabase/supabase-js";
import https from "https";

// Initialize Supabase Client (Verify Env Vars existence in Vercel)
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
  };

  /**
   * Helper: Get Session from Cache (Supabase)
   */
  async function getCachedSession(supabase) {
    if (!supabase) return null;
    try {
      const { data } = await supabase
        .from("ecount_session")
        .select("*")
        .eq("id", 1)
        .single();

      if (data?.session_id && data.session_id !== "INIT") {
        const age = new Date().getTime() - new Date(data.updated_at).getTime();
        // ECOUNT session lasts ~1 hour. Use if < 50 mins.
        if (age < 50 * 60 * 1000) {
          return data.session_id;
        }
      }
    } catch (e) {
      console.error("⚠️ Cache read error:", e.message);
    }
    return null;
  }

  /**
   * Helper: Login to ECOUNT and return Session ID
   */
  async function loginToECount() {
    console.log("🔑 [Vercel] Logging in to ECOUNT...");
    const sessionPayload = JSON.stringify({
      COM_CODE: CONFIG.COM_CODE,
      USER_ID: CONFIG.USER_ID,
      API_CERT_KEY: CONFIG.API_CERT_KEY,
      ZONE: CONFIG.ZONE,
      LAN_TYPE: CONFIG.LAN_TYPE,
    });

    return new Promise((resolve, reject) => {
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
              if (data.trim().startsWith("<")) {
                console.error(
                  "❌ ECOUNT returned HTML:",
                  data.substring(0, 200),
                );
                reject(
                  new Error("ECOUNT API returned HTML (Rate Limit/Error)."),
                );
                return;
              }
              const result = JSON.parse(data);
              if (
                String(result.Status) === "200" &&
                result.Data?.Datas?.SESSION_ID
              ) {
                resolve(result.Data.Datas.SESSION_ID);
              } else {
                reject(new Error("Login failed: " + JSON.stringify(result)));
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
  }

  /**
   * Helper: Fetch Stock Data
   */
  async function fetchStock(sessionId) {
    const targetUrl = `https://oapi${CONFIG.ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;
    const { PROD_CD } = req.body || {};
    const stockPayload = JSON.stringify({
      PROD_CD: PROD_CD || "",
      WH_CD: CONFIG.WH_CD,
      BASE_DATE: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    });

    return new Promise((resolve, reject) => {
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
          stockRes.on("end", () => {
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
      stockReq.write(stockPayload);
      stockReq.end();
    });
  }

  try {
    let sessionId = null;
    let supabase = null;
    if (supabaseUrl && supabaseKey)
      supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Initial Cache Check
    sessionId = await getCachedSession(supabase);

    // 2. Login Logic with Double-Check (Prevents Login Storm)
    if (!sessionId) {
      console.log(
        "⌛ [Vercel] No session. Waiting to prevent concurrent login storm...",
      );
      // Random jitter (0-800ms) to spread concurrent requests
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 800)));

      // Double-check cache: Maybe another request already logged in while we waited
      sessionId = await getCachedSession(supabase);

      if (!sessionId) {
        sessionId = await loginToECount();
        if (supabase) {
          console.log("💾 [Cache] Success. Saving new session to Supabase.");
          await supabase
            .from("ecount_session")
            .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
        }
      } else {
        console.log(
          "✅ [Cache] Re-checked and found session from another request.",
        );
      }
    } else {
      console.log("✅ [Cache] Found valid session.");
    }

    // 3. Fetch Stock
    let stockResult = await fetchStock(sessionId);

    // 4. RETRY LOGIC: If Session Invalid/Error -> Force Login -> Retry
    if (String(stockResult.Status) !== "200") {
      console.warn(
        "⚠️ [Vercel] Stock fetch failed. Retrying with fresh login...",
      );

      // Wait a bit before retry to avoid spamming the lock
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 500)));

      // Check if someone else already refreshed it
      sessionId = await getCachedSession(supabase);

      if (!sessionId) {
        sessionId = await loginToECount();
        if (supabase) {
          await supabase
            .from("ecount_session")
            .upsert({ id: 1, session_id: sessionId, updated_at: new Date() });
        }
      }

      stockResult = await fetchStock(sessionId);
    }

    res.status(200).json(stockResult);
  } catch (error) {
    console.error("❌ [Vercel] Fatal Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
