export const config = {
  // /stock/admin 경로 하위의 모든 페이지에 적용
  matcher: "/stock/admin/:path*",
};

export default function middleware(request) {
  const authorization = request.headers.get("authorization");

  if (authorization) {
    // Basic Auth 헤더 파싱 (username:password)
    // base64 디코딩
    const basicAuth = authorization.split(" ")[1];
    const [user, password] = atob(basicAuth).split(":");

    // 여기에 원하는 아이디와 비밀번호를 설정하세요
    // 예: 아이디 admin, 비밀번호 123123
    if (user === "admin" && password === "123123") {
      // 인증 성공! 요청을 계속 진행시킵니다.
      return;
    }
  }

  // 인증 헤더가 없거나 틀렸을 경우 401 응답을 보내 브라우저 로그인 창을 띄웁니다.
  return new Response("Access Denied", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Admin Area"',
    },
  });
}
