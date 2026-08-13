# 연관주 보드 — 배포 가이드

종목 카드를 자유롭게 배치하고, AI 버튼으로 경쟁사·협력사·공급망 연관주를 자동 확장하는 MVP 보드입니다.
3강에서 배운 GitHub → Vercel 흐름 그대로 배포할 수 있도록 구성했습니다.

## 폴더 구조

```
├── index.html          # 프론트엔드 (보드 UI 전체)
├── api/
│   ├── stock-info.js    # 종목 1개 정보 조회 (서버리스 함수)
│   └── related.js       # 연관주 3그룹×3개 조회 (서버리스 함수)
├── package.json
├── .env.example         # 환경 변수 예시 (실제 키는 여기 넣지 않음)
└── .gitignore
```

기존 artifact 버전과 다른 점: 브라우저가 Anthropic API를 **직접** 호출하지 않고,
`/api/stock-info`, `/api/related` 라는 **우리 서버(Vercel 서버리스 함수)** 를 거쳐서 호출합니다.
API 키는 서버에만 저장되고 브라우저(클라이언트)에는 절대 노출되지 않습니다.

---

## 1. API 키 발급 (무료)

이 프로젝트는 **Google Gemini API**를 사용합니다. Flash 모델은 신용카드 등록 없이 상시 무료 티어로 사용할 수 있고, 웹 검색(Google Search grounding) 기능도 무료 범위에 포함됩니다.
(과제 규모의 트래픽에는 충분하지만, 하루/분당 요청 수 제한이 있습니다 — README 하단 참고)

1. https://aistudio.google.com/apikey 접속 → Google 계정으로 로그인
2. "Create API key" 클릭 → 키 값 복사해두기
3. 별도 결제 정보 입력 불필요

> 팀원 중 한 명의 Google 계정으로 키를 발급해 공유해도 됩니다.

## 2. GitHub 업로드

1. GitHub에서 새 저장소(repository) 생성 (예: `stock-board-mvp`)
2. 이 폴더 전체를 로컬에 압축 해제 후, 저장소에 업로드
   ```bash
   git init
   git add .
   git commit -m "init: 연관주 보드 MVP"
   git branch -M main
   git remote add origin https://github.com/KWON0431/stock-board-mvp.git
   git push -u origin main
   ```
   (터미널 명령이 낯설면 VS Code + Claude Code에게 "이 폴더를 GitHub 저장소에 올려줘"라고 요청해도 됩니다.)

## 3. Vercel 배포

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. "Add New... → Project" → 방금 만든 저장소 선택 → Import
3. **Environment Variables**(환경 변수) 섹션에서 추가:
   - Key: `GEMINI_API_KEY`
   - Value: 1단계에서 발급받은 키
4. Deploy 클릭 → 1~2분 후 자동으로 `https://프로젝트명.vercel.app` 도메인 생성

이후 GitHub에 코드를 push할 때마다 Vercel이 자동으로 재배포합니다 (3강에서 배운 내용과 동일).

## 4. 배포 후 확인

- 발급받은 URL에 접속해 종목을 검색해보고, AI 버튼으로 연관주 확장이 잘 되는지 확인하세요.
- 안 되면 Vercel 프로젝트 → Settings → Environment Variables에 키가 정확히 들어갔는지, 오타는 없는지 확인하세요.
- Vercel 대시보드의 "Deployments → Functions" 로그에서 `/api/stock-info`, `/api/related` 호출 에러를 확인할 수 있습니다.

## 5. KPI 측정 활성화하기 (강력 추천)

이 프로젝트는 방문수·검색수·AI확장 클릭수·피드백을 실제로 집계하는 KPI 대시보드(우측 상단 "📊 KPI" 버튼)와
피드백 위젯("💬 피드백" 버튼)이 이미 붙어 있습니다. 다만 데이터를 저장할 **Vercel KV**를 연결해야 실제로 집계됩니다.
(연결하지 않아도 사이트 핵심 기능은 정상 작동하며, KPI 숫자만 0으로 표시됩니다.)

1. Vercel 대시보드 → 방금 만든 프로젝트 → 상단 **Storage** 탭
2. **Create Database → KV (Upstash)** 선택 → 이름 입력 후 생성 (무료 티어로 충분)
3. 생성된 KV를 현재 프로젝트에 **Connect**
4. 자동으로 필요한 환경 변수(`KV_REST_API_URL`, `KV_REST_API_TOKEN` 등)가 프로젝트에 주입됩니다
5. **Deployments** 탭에서 재배포(Redeploy) 한 번 실행

이후 사이트에서 검색/AI확장/피드백을 남기면 "📊 KPI" 패널에 실시간으로 숫자가 쌓입니다.
발표 영상의 "반복 결과" 파트에서 이 대시보드 화면을 그대로 보여주면 됩니다.

## 6. (선택) 구글 검색 노출

3강에서 다룬 대로 Google Search Console에 배포된 URL을 등록하면 검색 노출도 설정할 수 있습니다.

## 7. 기획 문서

`docs/PROJECT_PLAN.md`에 문제 정의·고객 페르소나·As-Is/To-Be 시나리오·KPI 정의·1차 반복 계획이 정리되어 있습니다.
발표 영상 스크립트는 별도로 전달된 `VIDEO_SCRIPT.md`를 참고하세요.

---

## 로컬에서 테스트하고 싶다면

```bash
npm install -g vercel
vercel dev
```
루트에 `.env` 파일을 만들고 `GEMINI_API_KEY=발급받은키`를 넣으면 로컬(`localhost:3000`)에서도 동일하게 동작합니다.
(`.env`는 `.gitignore`에 포함되어 있어 실수로 깃허브에 올라가지 않습니다.)

## 무료 티어 한도 참고

Gemini 2.5 Flash 무료 티어는 대략 **분당 10회, 하루 1,000~1,500회** 요청까지 무료입니다 (구글 정책에 따라 변동 가능).
과제 발표·소규모 사용자 테스트 용도로는 충분하지만, 짧은 시간에 너무 많이 요청하면 일시적으로 429 오류가 날 수 있습니다.
이 경우 사이트 상태 메시지에 오류가 표시되며, 잠시 후 다시 시도하면 됩니다.
