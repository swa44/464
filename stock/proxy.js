const http = require("http");
const https = require("https");
const url = require("url");

const PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let targetUrl = "";

  if (parsedUrl.pathname === "/api/login") {
    targetUrl = "https://login.ecount.com/OpenApi/Login";
  } else if (parsedUrl.pathname === "/api/ecount") {
    const zone = parsedUrl.query.ZONE;
    const sessionId = parsedUrl.query.SESSION_ID;

    if (!zone || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing ZONE or SESSION_ID" }));
      return;
    }

    targetUrl = `https://sboapi${zone}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${sessionId}`;
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  // Forward the request
  const bodyChunks = [];
  req.on("data", (chunk) => bodyChunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(bodyChunks).toString();

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const proxyReq = https.request(targetUrl, options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
        });
        res.end(data);
      });
    });

    proxyReq.on("error", (e) => {
      console.error(e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}/`);
  console.log(`- Login Endpoint: http://localhost:${PORT}/api/login`);
  console.log(`- Stock Endpoint: http://localhost:${PORT}/api/ecount`);
});
