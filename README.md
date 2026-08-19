# YouTube Live Chat Viewer — Vercel 배포판

완전히 독립된 Next.js 프로젝트입니다.

## 기능
- YouTube 라이브 URL 입력
- 라이브 채팅 자동 수집
- 최소 3초 polling
- YouTube `pollingIntervalMillis`가 3초보다 길면 지정값 우선
- 전체 채팅 실시간 표시
- 닉네임 / 아이디 검색
- 특정 사용자 채팅만 우측 패널에 모아보기
- 새 채팅: 초록색 배경 → 약 4.5초 후 원래 배경으로 페이드
- 일반 사용자 닉네임: 흰색
- 멤버십 닉네임: 초록색
- 스패너/매니저 닉네임: 파란색
- 반쪽 화면 사용을 고려한 약 980px UI

## Vercel 배포에 맞춘 구조

Vercel Functions의 로컬 파일시스템에 채팅을 저장하지 않습니다.
채팅은 방송 중 현재 브라우저 메모리에만 유지됩니다.

따라서:
- Vercel 서버 재시작 영향 없음
- 별도 DB 불필요
- 방송 탭을 새로고침하면 기존 채팅은 사라짐
- 방송 중 같은 탭에서는 계속 누적/검색 가능

## 로컬 실행

```bash
npm install
```

`.env.local` 생성:

```env
YOUTUBE_API_KEY=본인의_YouTube_Data_API_v3_API_KEY
```

실행:

```bash
npm run dev
```

## GitHub에 올리기

프로젝트 폴더에서:

```bash
git init
git add .
git commit -m "Initial YouTube live chat viewer"
git branch -M main
git remote add origin https://github.com/YOUR_ID/YOUR_REPO.git
git push -u origin main
```

## Vercel 배포

### 방법 1 — Vercel Dashboard
1. Vercel에서 `Add New > Project`
2. GitHub 저장소 선택
3. Framework Preset: `Next.js`
4. Environment Variables에 아래 추가

```text
YOUTUBE_API_KEY = 본인의 YouTube Data API v3 키
```

5. Deploy

### 방법 2 — Vercel CLI

```bash
npm i -g vercel
vercel
```

최초 설정 후 production 배포:

```bash
vercel --prod
```

Vercel 프로젝트 환경변수 등록:

```bash
vercel env add YOUTUBE_API_KEY production
```

Preview에서도 쓸 경우:

```bash
vercel env add YOUTUBE_API_KEY preview
```

환경변수 등록 후 다시:

```bash
vercel --prod
```

## 중요
YouTube Data API v3가 해당 Google Cloud 프로젝트에서 활성화되어 있어야 합니다.
