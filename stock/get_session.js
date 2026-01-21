const https = require("https");

const CONFIG = {
  // Zone이 AB라면 sboapiAB, oapiAB 등이 될 수 있음. 문서상 테스트 URL은 sboapi{ZONE}, 실 사용은 oapi{ZONE}
  // 여기서는 문서상 Request URL인 oapi{ZONE}.ecount.com을 사용합니다.
  LOGIN_URL: "https://oapiAB.ecount.com/OAPI/V2/OAPILogin",
  COM_CODE: "603476",
  USER_ID: "강수화",
  API_CERT_KEY: "0a21ffd1440d5436cb58f4a3be5560c196",
  ZONE: "AB",
  LAN_TYPE: "ko-KR",
};

const payload = JSON.stringify({
  COM_CODE: CONFIG.COM_CODE,
  USER_ID: CONFIG.USER_ID,
  API_CERT_KEY: CONFIG.API_CERT_KEY, // 문서는 API_KEY가 아니라 API_CERT_KEY
  ZONE: CONFIG.ZONE,
  LAN_TYPE: CONFIG.LAN_TYPE,
});

const options = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
};

console.log("🔑 이카운트 세션 ID 발급 요청 중...");

const req = https.request(CONFIG.LOGIN_URL, options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const result = JSON.parse(data);
      // 문서 예시: { Data: { Datas: { SESSION_ID: "..." } } }
      if (
        result.Status === "200" &&
        result.Data &&
        result.Data.Datas &&
        result.Data.Datas.SESSION_ID
      ) {
        console.log(
          "\n✅ 발급 성공! 아래 세션 ID를 복사해서 config.js에 붙여넣으세요:\n",
        );
        console.log(result.Data.Datas.SESSION_ID);
        console.log("\n");
      } else {
        console.error(
          "\n❌ 발급 실패 (API 응답):",
          JSON.stringify(result, null, 2),
        );
      }
    } catch (e) {
      console.error(
        "\n❌ JSON 파싱 실패. ECOUNT에서 HTML 응답을 보냈을 수 있습니다.",
      );
      console.error("응답 내용 미리보기 (처음 500자):");
      console.error("--------------------------------------------------");
      console.error(data.substring(0, 500));
      console.error("--------------------------------------------------");
    }
  });
});

req.on("error", (e) => {
  console.error("\n❌ 요청 오류:", e.message);
});

req.write(payload);
req.end();
