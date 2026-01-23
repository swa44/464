import https from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  console.log("✅ 함수 시작");

  const {
    COM_CODE = "603476",
    USER_ID = "에이피아이",
    API_CERT_KEY = "403dc3191c92b42aabc59227e3fd15b167",
    ZONE = "AB",
    LAN_TYPE = "ko-KR",
  } = req.body || {};

  console.log("COM_CODE:", COM_CODE);
  console.log("USER_ID:", USER_ID);
  console.log("API_CERT_KEY:", API_CERT_KEY);
  console.log("ZONE:", ZONE);

  const loginUrl = `https://oapi${ZONE}.ecount.com/OAPI/V2/OAPILogin`;
  const payload = JSON.stringify({
    COM_CODE,
    USER_ID,
    API_CERT_KEY,
    LAN_TYPE,
    ZONE,
  });

  console.log("URL:", loginUrl);
  console.log("Payload:", payload);

  return new Promise((resolve) => {
    const url = new URL(loginUrl);
    const httpsReq = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (httpsRes) => {
        let data = "";
        httpsRes.on("data", (chunk) => (data += chunk));
        httpsRes.on("end", () => {
          console.log("Response Status:", httpsRes.statusCode);
          console.log("Response Body:", data);

          try {
            const result = JSON.parse(data);
            res.status(200).json({
              success: result.Status === 200 || result.Status === "200",
              response: result,
            });
          } catch (e) {
            res.status(200).json({
              success: false,
              error: "Parse error",
              raw: data,
            });
          }
          resolve();
        });
      },
    );

    httpsReq.on("error", (err) => {
      console.error("Request error:", err);
      res.status(200).json({
        success: false,
        error: err.message,
      });
      resolve();
    });

    httpsReq.write(payload);
    httpsReq.end();
  });
}
