# Silver Random 30

실랜디(Silver Random 30)는 solved.ac의 Silver 난이도 범위에서 무작위로 백준 문제를 추천하고, 30분 카운트다운 타이머를 함께 제공하는 웹 애플리케이션입니다. 프로젝트 전반의 개발 지침은 [`docs/DEVELOPMENT_GUIDELINES.md`](docs/DEVELOPMENT_GUIDELINES.md)에 정리되어 있습니다.

## 구성

- `frontend/` – Vite + React + TypeScript 기반의 사용자 인터페이스
  - Tailwind CSS로 스타일링
  - solved.ac API를 직접 호출하거나 Express 프록시를 경유하여 문제를 균등하게 샘플링
  - 사용자 설정(핸들, 태그, 언어, 프록시 사용 여부 등)과 최근 추천 문제 ID를 `localStorage`에 저장
  - 30분 타이머(시작/일시정지/리셋/연장, 알림/사운드 지원)
- `proxy/` – solved.ac API 호출을 중계하는 Node.js Express 서버
  - 동일한 균등 랜덤 알고리즘과 필터 완화 전략 적용
  - solved.ac 응답을 60초 동안 캐싱해 트래픽을 절감

## 개발 환경 준비

프로젝트 루트에서 다음 명령을 실행합니다.

```bash
# 프론트엔드 의존성 설치
cd frontend
npm install

# (옵션) 프록시 서버 의존성 설치
cd ../proxy
npm install
```

## 사용 방법

### 프론트엔드 개발 서버

```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173`에 접속하면 됩니다. solved.ac API가 CORS로 차단될 경우 설정에서 프록시 모드를 활성화하거나 아래의 프록시 서버를 함께 실행하세요.

### Express 프록시 서버

```bash
cd proxy
npm run dev
```

서버는 기본적으로 `http://localhost:3000`에서 실행되며, Vite 개발 서버는 `/api` 경로를 자동으로 해당 프록시로 전달하도록 설정돼 있습니다.

## 빌드 및 검사

프론트엔드 프로젝트에서 다음 명령을 실행해 정적 검사를 수행하고 빌드 결과를 확인할 수 있습니다.

```bash
cd frontend
npm run lint
npm run build
```

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.
