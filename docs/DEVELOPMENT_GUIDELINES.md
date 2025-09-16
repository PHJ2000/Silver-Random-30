# 실랜디(Silver Random 30) – 개발 지침

## 0) 목표

- solved.ac 기준 **Silver V ~ Silver I** 범위의 백준 문제를 랜덤으로 1개 뽑아 보여주고, **30분 카운트다운 타이머**를 시작한다.
- (선택) 사용자의 백준 핸들을 입력받아 **이미 푼 문제/시도한 문제는 제외**한다.
- 문제 링크는 **acmicpc.net/problem/{problemId}**로 연동한다. ([Baekjoon Online Judge](https://www.acmicpc.net/problem/6324?utm_source=chatgpt.com "6324번 - - URLs 다국어"))
- 난이도/필터는 **solved.ac 고급 검색 쿼리 문법**을 따르고, Silver 범위는 `*s` 또는 `*s..s` 로 지정한다. 푼 문제/시도 문제 제외는 `-@{handle}`, `-t@{handle}` 조합을 쓴다. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))

---

## 1) 기술 스택(권장)

- **프론트만으로 시작**: Vite + React(또는 Svelte) + TypeScript
- **CORS 이슈 대비**: 필요시 Node/Express **프록시**(간단한 1개 엔드포인트) 추가
- 스타일: Tailwind(선택)
- 배포: Netlify/Vercel(프론트), Render/Fly.io(프록시)

---

## 2) 핵심 기능 명세

### A. 문제 랜덤 추출

1. **검색 쿼리 구성**
   - 기본: `*s` (Silver V ~ I) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
   - 옵션:
     - 푼 문제 제외: `-@{handle}` (solved_by 필터의 부정) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
     - 시도 문제 제외: `-t@{handle}` (tried_by 필터의 부정) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
     - 한국어 문제만: `%ko` (lang 필터) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
     - 특정 태그 가중: `#dp | #greedy` 등 태그 필터(선택) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
2. **API 호출**
   - **solved.ac 문제 검색 API(v3)**의 “search/problem” 엔드포인트를 사용해 `query`, `page`, `size` 파라미터로 페이지네이션 조회(브라우저 CORS가 막히면 프록시 경유).
   - 쿼리 문법/필드 이름은 solved.ac 고급 검색 문서 기준으로 생성한다. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
   - (참고) solved.ac는 백준 문제 난이도/태그를 제공하는 커뮤니티 프로젝트다. ([solved.ac](https://solved.ac/en?utm_source=chatgpt.com "solved.ac"))
3. **균등 랜덤 샘플링 알고리즘**
   - 첫 요청 `size=1`로 총 결과 수 `count` 확보 → `k = randInt(1..count)`
   - `page = Math.ceil(k / size)` (권장 `size=100`)
   - 해당 `page` 재요청 후, `index = (k-1) % size` 항목 선택
   - 예외 처리: 페이지가 모자라거나 필터로 빈 결과면 **필터 완화**(예: `-t@` 제거) 후 재시도
4. **문제 표시**
   - 제목(ko/en), 티어(Silver 등급), 태그(있다면), 푼 사람 수 등 표시
   - **문제 풀기 버튼**: `https://www.acmicpc.net/problem/{problemId}`로 새 탭 열기 ([Baekjoon Online Judge](https://www.acmicpc.net/problem/6324?utm_source=chatgpt.com "6324번 - - URLs 다국어"))

### B. 30분 타이머

- 기본 30:00에서 **시작/일시정지/리셋/연장(+5분)** 제공
- 0이 되면: 화면 강조, 소리/브라우저 알림(알림 권한 요청)
- (선택) **라이트/다크 테마** UI

### C. 사용자 설정 & 상태 유지

- 사용자 **백준 핸들**, 언어, 태그 포함/제외, “시도 문제 제외” 여부를 **localStorage**에 저장
- 최근 출제한 문제 ID 리스트를 저장해 **중복 회피**

### D. 장애/에러 처리

- 네트워크 오류, API 429/5xx: 사용자 메시지 + **지수적 백오프** 재시도(최대 3회)
- 결과 없음: 필터 자동 완화(예: 태그 제거 → 시도 제외 해제 → 언어 제한 해제 순)
- 브라우저 CORS: 프록시 모드로 자동 전환(설정 토글 제공)

---

## 3) 프론트/프록시 계약(있다면)

- **프런트 → 프록시**: `GET /api/problems/random?query=...&handle=...&excludeTried=true&lang=ko`
- **프록시 → solved.ac**: search/problem API를 그대로 호출해 위의 **균등 랜덤** 로직 수행 후, 최종 1문제만 반환
- 응답 예시(JSON):

```json
{
  "problemId": 1931,
  "titleKo": "회의실 배정",
  "tier": "Silver I",
  "tags": ["greedy", "sorting"],
  "solvedCount": 123456,
  "bojUrl": "https://www.acmicpc.net/problem/1931"
}
```

---

## 4) UX 흐름

1. 첫 진입: 핸들/옵션 폼 → “문제 뽑기”
2. 카드에 문제 정보 렌더 → “백준에서 풀기” + “30:00 시작”
3. 타이머 동작(일시정지/연장/리셋 가능) → 종료 시 알림
4. “다시 뽑기”로 다음 문제 샘플링 (중복 회피)

---

## 5) 테스트 & 검증 시나리오

- **기본**: 핸들 비워두고 `*s`만으로 랜덤 10회 → 같은 문제 연속 중복 **거의 없음**(중복 회피 로직 확인). ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- **푼 문제 제외**: 임의 핸들 넣고 `-@{handle}`로 5회 뽑기 → 모두 “푼 문제” 아님 확인(문서 쿼리 문법). ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- **시도 제외**: `-t@{handle}` 적용 시 시도한 문제 미출력 확인. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- **언어 필터**: `%ko` 적용 시 한글 문제만 노출. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- **빈 결과**: 극단 필터로 0건이면 자동 완화 후 결과 제공
- **타이머**: 시작/일시정지/연장/리셋, 00:00 이벤트 동작
- **네트워크 장애**: 429/5xx 시 백오프 재시도 후 사용자 피드백

---

## 6) 보안/성능

- **API 키 불필요**(공개 엔드포인트 기준). 브라우저에서 막히면 **서버 프록시** 경유
- 프록시 캐시(쿼리 → ID 목록 60초 캐시)로 트래픽 절감
- 사용자 설정은 **localStorage**에만 저장(개인정보 최소화)

---

## 7) Codex(코드 생성 모델)용 프롬프트 샘플

> **지시문**  
> “solved.ac 고급 검색 문법을 사용해 Silver 범위(`*s`)의 백준 문제를 랜덤으로 1개 뽑아오는 웹앱을 Vite + React + TS로 구현하라. (필수) 30분 카운트다운 타이머(시작/일시정지/연장/리셋), (선택) 핸들 입력 시 `-@{handle}`와 `-t@{handle}`로 푼/시도 문제 제외. 언어 제한 `%ko` 토글. 결과는 문제 제목/티어/태그/푼 사람 수와 함께 `https://www.acmicpc.net/problem/{id}` 버튼 제공.  
> solved.ac 검색 쿼리 문법은 문서의 연산자(`*`, `@`, `t@`, `%`, `#`) 그대로 사용한다. **균등 랜덤**은: ① size=1로 총 count 얻기, ② 1..count에서 난수 k, ③ size=100 기준 page 계산해 해당 page 재요청 후 index 선택.  
> 브라우저 CORS 실패 시 Node/Express 프록시로 우회하는 코드도 포함해라(동일 로직 서버에서 수행). 에러/빈결과/재시도 처리, 최근 문제 중복 회피(localStorage), 간단한 Tailwind UI 포함.”

(참고 문서: solved.ac 고급 검색 문법 페이지. Silver 범위 `*s`, 푼 문제 `@`, 시도 문제 `t@`, 언어 `%` 필터 등 표기 확인.) ([solved.ac](https://solved.ac/search "solved.ac - 검색"))

---

## 8) 수용 기준(Definition of Done)

- “문제 뽑기” 클릭 시 **항상** Silver 범위의 문제 1개가 표시된다. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- 30분 타이머가 정상 동작(일시정지/연장/종료 알림)
- 핸들 입력 시 **푼/시도 문제 제외**가 실제로 반영된다. ([solved.ac](https://solved.ac/search "solved.ac - 검색"))
- “백준에서 풀기”가 올바른 문제 페이지로 이동한다(도메인/경로 검증). ([Baekjoon Online Judge](https://www.acmicpc.net/problem/6324?utm_source=chatgpt.com "6324번 - - URLs 다국어"))
- 네트워크/빈 결과/429 등 오류 상황에서 사용자에게 명확한 피드백을 주고 재시도한다.
- 새로고침 후에도 사용자 옵션과 **최근 문제 중복 회피**가 유지된다.
