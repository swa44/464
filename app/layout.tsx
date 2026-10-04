import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "딱 10개 | 운동 카운터",
  description: "운동 횟수를 10개씩 빠르게 기록하는 모바일 운동 카운터",
  applicationName: "딱 10개",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "딱 10개",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#131714",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      {process.env.NODE_ENV === "development" && (
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator && !sessionStorage.getItem('dev-sw-cleaned')) {
                  Promise.all([
                    navigator.serviceWorker.getRegistrations().then(function (items) {
                      return Promise.all(items.map(function (item) { return item.unregister(); }));
                    }),
                    caches.keys().then(function (keys) {
                      return Promise.all(keys.map(function (key) { return caches.delete(key); }));
                    })
                  ]).then(function () {
                    sessionStorage.setItem('dev-sw-cleaned', '1');
                    location.reload();
                  });
                }
              `,
            }}
          />
        </head>
      )}
      <body>{children}</body>
    </html>
  );
}
