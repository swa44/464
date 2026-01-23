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
    const url = new URL(loginUrl);

    console.log("\n========================================");
    console.log("📤 전송할 HTTP 요청 전체:");
    console.log("========================================");
    console.log("Method: POST");
    console.log("Host:", url.hostname);
    console.log("Path:", url.pathname);
    console.log(
      "Headers:",
      JSON.stringify(
        {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        null,
        2,
      ),
    );
    console.log("Body:", payload);
    console.log("Body Length:", Buffer.byteLength(payload), "bytes");
    console.log("Body (각 필드):");
    Object.keys(payloadObj).forEach((key) => {
      console.log(
        `  ${key}: "${payloadObj[key]}" (${payloadObj[key].length} chars)`,
      );
    });
    console.log("========================================\n");

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          console.log("\n========================================");
          console.log("📥 받은 HTTP 응답 전체:");
          console.log("========================================");
          console.log("Status Code:", res.statusCode);
          console.log("Status Message:", res.statusMessage);
          console.log("Headers:", JSON.stringify(res.headers, null, 2));
          console.log("Body:", data);
          console.log("========================================\n");

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
    req.on("error", (err) => {
      console.error("❌ Request Error:", err);
      reject(err);
    });
    req.write(payload);
    req.end();
  });
}
