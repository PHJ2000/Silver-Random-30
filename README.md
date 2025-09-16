# 실랜디(Silver Random 30)

실랜디는 solved.ac의 Silver 등급 문제를 균등하게 추천하고, 30분 타이머와 Discord 알림·주간 랭킹을 제공하는 풀스택 애플리케이션입니다. 프론트엔드는 Vite + React + TypeScript로 작성됐으며, 백엔드는 Express + SQLite를 사용합니다.

## 폴더 구조

```
app/         # React + Tailwind 기반 웹앱 (Zustand 상태관리, dayjs 타임존 지원)
server/      # Express API 서버 (better-sqlite3, node-cron)
shared/      # 프론트/백엔드가 공용으로 사용하는 타입 정의
```

## 주요 기능

- solved.ac Silver V~I 범위 문제를 균등 랜덤 추천, 푼/시도 문제 제외 필터 지원
- “백준에서 풀기” 클릭 시 타이머 자동 시작 및 기록 생성, 남은 시간 기반 점수 계산
- 태그/티어 스포일러 숨김, 15분 경과 시 자동 힌트, 사용 횟수 서버에 기록
- Discord 웹훅으로 시작/5분 경고/타임업/결과 요약 알림 발송 (사용자별 웹훅 옵션 포함)
- 주간 랭킹(월~일, Asia/Seoul 기준) 및 월요일 00:01 크론 자동 게시
- 설정 내보내기/가져오기 + File System Access API로 로컬 JSON 파일과 동기화
- 타이머 미니 팝업 창, 단축키(Space/R/E), 새로고침 경고 및 알림/사운드 지원

## 개발 환경 준비

### 1) 프론트엔드

```bash
cd app
npm install
```

### 2) 백엔드

```bash
cd server
npm install
```

## 개발 서버 실행

프론트엔드와 백엔드를 각각 실행합니다.

```bash
# React 개발 서버 (http://localhost:5173)
cd app
npm run dev
```

```bash
# Express API 서버 (http://localhost:8080)
cd server
npm run dev
```

Vite 설정에는 `/api` 경로 프록시가 포함돼 있으므로, 프론트엔드 개발 서버에서 바로 API를 호출할 수 있습니다.

## 환경 변수

`server/.env` 혹은 루트 `.env` 파일에 다음 항목을 설정합니다.

```
DISCORD_WEBHOOK_URL=...   # 기본 Discord 채널 웹훅
API_KEY=...               # (선택) 쓰기 API 보호용 키
PORT=8080
TZ=Asia/Seoul
```

프론트엔드 설정에서 사용자별 웹훅과 API 키를 입력하면 요청 헤더(`X-API-Key`)와 웹훅 오버라이드가 함께 전송됩니다.

## 빌드 및 검증

```bash
# 프론트엔드 린트 & 빌드
cd app
npm run lint
npm run build

# 백엔드 타입 검사 및 빌드
cd ../server
npm run build
```

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.
