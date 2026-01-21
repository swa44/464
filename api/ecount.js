import { createClient } from "@supabase/supabase-js";
import https from "https";

// Initialize Supabase Client (Verify Env Vars existence in Vercel)
// Note: These must be set in Vercel Project Settings
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key for server-side updates

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
    let sessionId = null;
    let supabase = null;

    // Initialize Supabase if keys are present
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn(
        "⚠️ Supabase credentials missing. Falling back to direct login.",
      );
    }

    // 2. Try to get Cached Session from Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("ecount_session")
          .select("session_id, updated_at")
          .eq("id", 1)
          .single();

        if (data && data.session_id) {
          const lastUpdated = new Date(data.updated_at).getTime();
          const now = new Date().getTime();
          // ECOUNT session lasts ~1 hour. Refresh if older than 50 mins.
          if (now - lastUpdated < 50 * 60 * 1000) {
            sessionId = data.session_id;
            console.log("✅ [Cache] Using Cached Session ID:", sessionId);
          } else {
            console.log("⚠️ [Cache] Session expired. Refreshing...");
          }
        }
      } catch (dbError) {
        console.error("⚠️ [Cache] Failed to read session:", dbError.message);
      }
    }

    // 3. Login if no cached session found
    if (!sessionId) {
      console.log("🔑 [Vercel] Logging in to ECOUNT (New Session)...");

      const sessionPayload = JSON.stringify({
        COM_CODE: CONFIG.COM_CODE,
        USER_ID: CONFIG.USER_ID,
        API_CERT_KEY: CONFIG.API_CERT_KEY,
        ZONE: CONFIG.ZONE,
        LAN_TYPE: CONFIG.LAN_TYPE,
      });

      sessionId = await new Promise((resolve, reject) => {
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
                reject(new Error("Login Parse Error: " + e.message));
              }
            });
          },
        );
        loginReq.on("error", reject);
        loginReq.write(sessionPayload);
        loginReq.end();
      });

      // Update Cache
      if (supabase && sessionId) {
        console.log("💾 [Cache] Updating Supabase...");
        try {
          // Upsert to store the new session immediately
          await supabase.from("ecount_session").upsert({
            id: 1,
            session_id: sessionId,
            updated_at: new Date().toISOString(),
          });
        } catch (upsertError) {
          console.error("❌ Failed to update cache:", upsertError.message);
        }
      }
    }

    // 4. Fetch Stock Data using Session ID
    const targetUrl = `https://oapi${CONFIG.ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;

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

    // 5. Return Data
    res.status(200).json(JSON.parse(stockData));
  } catch (error) {
    console.error("❌ [Vercel] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
