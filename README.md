# 로또 6/45 번호 생성기

별도의 개인정보 입력 없이 1~10게임을 직접 선택해 번호를 생성하는 정적 GitHub Pages 사이트입니다.

## 구성

- 일반 자동번호: 브라우저에서 즉시 생성
- 고유조합 번호: Cloudflare Worker에서 생성 후 최종 JSON만 반환
- 전체 복사, 초기화, 로딩 및 오류 상태
- 모바일 390px / 데스크톱 1440px 대응
- 정적 후기·공지 및 필수 이용 안내

## 1. 연결된 Cloudflare Worker

```text
https://lotto-custom-api.killu800.workers.dev/generate-custom
```

AI 안내 API 키는 Cloudflare Worker Secret에 저장되어 있으며 브라우저 코드에 포함되지
않습니다.

## 2. Cloudflare Worker 재배포

`worker` 폴더는 운영자의 비공개 엔진이 포함되어 있으므로 **공개 GitHub Pages 저장소에
커밋하지 마세요.** 별도의 비공개 저장소나 로컬 폴더에서 Worker를 배포해야 합니다.
루트 `.gitignore`는 실수로 `worker` 폴더가 공개 커밋되는 것을 막습니다.

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

AI 안내문이 필요 없다면 별도의 안내 API 키를 등록하지 않아도 됩니다. 호출 실패 또는
키 미설정 시 기본 안내문을 사용하며, 번호 생성에는 영향을 주지 않습니다.

`worker/wrangler.toml`의 `ALLOWED_ORIGIN`을 실제 GitHub Pages 주소로 바꾸세요.

## 3. 프론트엔드 API 연결

`index.html` 상단에 배포된 Worker 주소가 연결되어 있습니다.

```html
<script>
  window.LOTTO_API_URL =
    "https://lotto-custom-api.killu800.workers.dev/generate-custom";
</script>
```

## 4. GitHub Pages 배포

공개 저장소에는 아래 파일만 커밋합니다.

```text
index.html
src/style.css
src/main.js
README.md
.gitignore
```

GitHub 저장소의 **Settings → Pages**에서 배포 브랜치와 루트 폴더를 선택하면 됩니다.

## API

### 요청

```http
POST /generate-custom
Content-Type: application/json
```

```json
{
  "gameCount": 10
}
```

### 성공 응답

```json
{
  "ok": true,
  "games": [
    [3, 11, 18, 24, 35, 42],
    [5, 9, 16, 27, 34, 41]
  ],
  "message": "고유조합 번호가 생성되었습니다."
}
```

`gameCount`는 1 이상 10 이하의 정수만 허용하며, 잘못된 요청은 HTTP 400을 반환합니다.

## 주의

본 사이트는 복권을 판매하거나 구매를 대행하지 않습니다. 제공되는 번호는 정보 및 오락
목적이며 당첨을 보장하지 않습니다. 복권 구매는 공식 판매처를 이용해 주세요.
