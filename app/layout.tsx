import "./globals.css";

export const metadata = {
  title: "YouTube Live Chat Viewer",
  description: "YouTube 라이브 채팅 보기 및 닉네임별 검색",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
