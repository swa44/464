import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "샤먼 여행 노트",
  description: "샤먼 여행지·맛집 정리와 고덕지도용 중국어 주소 복사",
  applicationName: "샤먼 여행 노트",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "샤먼",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1ea",
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
