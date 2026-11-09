# 09 미디어 개발 계획

상태: 끝남, PR #457 (2026-11-09). 소유자가 시작을 승인했다. 결정 5, 7, 8, 9는 소유자가 정했고, 나머지는 따로 말이 없어 기본값으로 둔다. 처음부터 끝까지 한 세션이 그대로 돌 수 있게 적었다. 소유자가 기본값을 바꾸면 그 줄과 그 줄이 가리키는 단계만 고친다.

- 설계: [09-media.md](../design/features/09-media.md), [흐름 6](../design/admin/flows/06-media.md), [화면 지도](../design/admin/screens/media.md)
- 브랜치와 PR: `feat/media-09`, `feat(core): media library, uploads and images in the editor (doc 09)`
- PR 대상: `overhaul`. 다시 만들기는 이 브랜치에 쌓인다(#456도 여기로 병합됐다). `main`은 옛 코드다.
- 함께 끝내는 남은 일: T33, T59, T25, T67, T99
- 하는 쪽: 한 세션이 단계 순서대로 만든다(관리자 화면은 가장 강한 모델, admin-ui 스킬 규칙). GPT-6.1 Terra는 사용성 시험, GPT-6.1 Sol과 별도의 Opus 에이전트는 코드 리뷰만 맡고 코드를 고치지 않는다(3부).

## 시작할 때 알아야 할 것

읽어서 확인한 사실이다. 계획은 이 위에 서 있다.

| 무엇 | 지금 상태 | 계획에 미치는 것 |
|---|---|---|
| 기능 호출 | `Transport`는 JSON 한 가지이고 `fetch`에는 올린 비율이 없다(`admin/src/operations/transport.ts`) | 파일 바이트는 따로 간다(결정 1) |
| 쓰기 실행 | `runWrite`가 트랜잭션 하나로 돈다. `humanOnly`는 되돌리기 스냅숏이 없다(`engine/execute.ts`) | 트랜잭션 안에서 파일을 올리지 않는다. `media.upload`, `media.replace`는 되돌리기가 없다 |
| 글 쓰는 곳 | `entries.save`, 번역, 관계, 폴더, 스키마 적용 등 30곳 가까이가 `entries`를 직접 고친다 | 쓰는 곳을 기능마다 고치면 하나는 빠진다. 엔진 한 곳에서 다시 적는다(단계 3) |
| 되돌리기 | `undo()`가 `RecordKind.restore`로 스냅숏을 되돌린다 | 되돌린 뒤에도 쓰는 곳을 다시 적는다 |
| 스키마 적용 | `schema/apply.ts`가 `entries.values`를 바로 고치고 기록 대상은 `schema`다 | 적용 뒤 그 컬렉션의 쓰는 곳을 다시 적는다 |
| 이미지 블록 | `attrs`에 `decorative`가 없고 `width`는 `null`을 못 받는다(`body/blocks.ts:140`). 문서 09의 예와 다르다 | 문서에 맞춰 고친다 |
| 폴더 | `folders.tree`는 미디어 파일을 세지 않고, `useFolders`는 컬렉션만 받고, `folders.remove`에는 미디어 규칙이 없다 | 07-1대로 같은 기능과 부품을 넓힌다 |
| 부품 | `Tile`, `FolderTile`, `DropArea`, `FilePreview`, `MediaPicker`, `MediaInput`, `UploadingImage`, `FileBlock`, `CropStage`, `Image`, `RowThumb`, `SplitButton`은 이미 있다 | 새 부품은 최소로 만든다 |
| 끝까지 도는 앱 | `flows/`와 예제 앱은 지워졌고 사이트에 붙이는 길은 T13(출시 전)이다. 지금 가장 위 층은 PGlite 위의 L4다 | 시험용 서버를 새로 만든다(1.3) |
| 문서 어긋남 | 09의 끝 조건에 번호가 없다. `screens/media.md:100`의 "기본 캡션"은 빠진 항목인데 표시가 없다. 흐름 6의 테스트 경로는 옛 코드의 것이다 | 단계 0에서 고친다 |

### 실제 입력 도구를 직접 시험한 결과 (2026-11-09)

| 도구 | 결과 |
|---|---|
| T3 `preview_act` (Terra에서 실행) | 마우스 사건은 `isTrusted`지만 포인터가 목적지로 뛴다(궤적 없음). `type`은 `keydown`을 내지 않았고, `hover`는 15초 시간 초과가 한 번 났다. OS 파일 끌어 놓기가 없다 |
| Playwright + CDP (헤드리스 Chromium) | 궤적 26회 이동, 글자와 화살표 `keydown`, 오른쪽 클릭, 요소 끌기, 한글 조합, CDP `Input.dispatchDragEvent`로 OS 파일 놓기(`drop`에 파일 1개), 클립보드 그림을 ⌘V로 붙여 넣기(`paste`에 `image/png`)가 모두 `isTrusted`로 들어왔다. 예외로 합성 끝 사건 `compositionend`만 `isTrusted`가 아니었다 |

그래서 Terra는 `preview_act`가 아니라 Playwright 드라이버(1.4)로 몬다. 창을 띄운(headed) 실행, Terra가 화면 그림을 읽는지, 실제 편집기에서의 동작은 아직 시험하지 않았다. 단계 13의 첫 관문에서 확인한다.

## 먼저 정한 것

| # | 결정 | 기본값 | 이유 |
|---|---|---|---|
| 1 | 올리는 길 | 두 단계다. `PUT …/media/bytes`(기능 아님, 세션 필요, 형식 · 크기 검사)가 `{ key, mime, size }`를 주고, 그 `key`로 JSON 기능 `media.upload`를 부른다. `media.replace`도 같다 | 막대에 비율이 필요하고, 쓰기 트랜잭션이 파일 올리는 동안 잡혀 있으면 안 된다. S3 직접 올리기(T102)로 그대로 넓어진다 |
| 2 | 저장소 접점 | `Plugin.storage`. 모양은 `put · stat · read · remove · url`. 둘 이상이면 시작 오류. 없으면 `site.storage`가 `null`이고 저장소 없음 화면이다. 09는 로컬 폴더 어댑터까지, S3는 T102 | 원칙 6이 "저장소 플러그인"이다 |
| 3 | 웹용 크기 | 브라우저가 만든다(`createImageBitmap` + 캔버스, 긴 변 2400). 치수도 브라우저가 읽는다. GIF는 웹용을 만들지 않는다 | "줄여서 다시"에 같은 코드가 필요하고, 네이티브 의존(`sharp`)이 없어 Storybook에서도 같게 돈다 |
| 4 | 받는 종류 | JPEG, PNG, WebP, GIF, AVIF, PDF, ZIP, txt, md, csv. HEIC(흐름 6·04), SVG, HTML은 거절. 서버가 앞 바이트로 다시 판별한다. 파일은 `nosniff`, `Content-Security-Policy: sandbox`로 내보내고 이미지가 아니면 내려받기로 준다 | 같은 주소에서 스크립트가 도는 파일을 막는다 |
| 5 | "휴지통으로"를 언제 | 09에 넣는다. 흐름 6·11, 12, 27, 28이 09의 끝 조건이다. 휴지통 화면(11) 전까지 되돌리기 토스트를 놓친 파일은 찾을 곳이 없지만 지워지지는 않는다 | T72의 소유자 결정(글의 "휴지통으로"는 11에)과 긴장이 있어 소유자가 확인한다 |
| 6 | `media.trash`와 `trash.move` | 09는 `media.trash`, 11에서 T101로 합친다 | 07의 `folders.remove`와 같은 길이다 |
| 7 | 템플릿의 이미지 | 쓰는 곳으로 센다(`media_uses`에 `template_id`). 문서 09의 ER을 고친다 | 안 세면 템플릿이 쓰는 파일이 휴지통에 들어가 09-4가 깨진다 |
| 8 | 자르기 · 돌리기 | 원본을 건드리지 않고 `attrs.crop`(비율), `attrs.rotate`로 둔다. T81에서 "자르기 · 돌리기 보기"를 빼 09의 `render.ts`로 당긴다 | 저장한 자르기가 사이트에 안 보이면 거짓 화면이다 |
| 9 | 미디어 필드의 번역 | 그대로 쓸 수도, 바꿀 수도 있다. 새 언어 방식을 만들지 않고 기존 `fromSource`를 미디어 필드의 기본값으로 한다. 번역의 값이 비어 있으면 원문의 파일과 `alt`를 따른다. 번역에서 파일을 고르거나 `alt`를 쓰면 그 번역의 값이 되고(그때부터 원문을 따르지 않는다), ×로 지우면 다시 따른다. 새 번역은 값을 복사하지 않고 비어서 시작한다. 본문 이미지는 04대로 같은 파일을 쓴다 | `translatedFields`, 발행 할 일, 사이트 읽기가 이미 이 규칙이라 읽는 코드를 새로 만들지 않는다. 사이트가 `same`이나 `perLocale`을 적으면 그 방식을 따른다 |

## 1부. 테스트

[testing.md](../testing.md)의 "동작 하나에 층 하나"를 따른다. 각 단계에서 테스트를 먼저 쓰고 실패를 본 뒤에 만든다. 기능 이름이 문자열이라 기능이 없어도 테스트는 컴파일되고 실패한다.

### 1.1 층

| 층 | 무엇을 잡나 | 파일 | 명령 |
|---|---|---|---|
| L1 유닛 | 판단 함수 | `*.test.ts` | `pnpm test` |
| L2 통합 | 기능, 표, 불변식, 바이트 경로 (진짜 Postgres) | `*.int.test.ts` | `pnpm test` |
| L3 부품 | `@monti-cms/ui`에서 바꾼 부품 | `*.browser.test.tsx` | `pnpm test:browser` |
| L4 화면 | 화면이 부품을 잇는 방식, 흐름 단계, 장면 (PGlite) | `*.screen.test.tsx` | `pnpm test:browser` |
| L5 e2e | HTTP, 쿠키, 디스크, 실제 그림 해독까지 합쳐야 깨지는 곳 | `testing/e2e/*.e2e.ts` | `pnpm test:e2e` (새로 만듦) |
| 사용성 | 테스트가 물을 줄 모르는 것: 막힘, 헷갈림, 어색함 | `docs/usability/feat-media-09.md` | 1.4 |

끝 조건 번호(단계 0에서 문서에 단다): **09-1** 흐름 6, **09-2** 라이브러리에 대체 텍스트 없음, **09-3** 같은 올리기와 같은 창, **09-4** 쓰이는 파일은 휴지통에 안 들어감, **09-5** 파일을 바꿔도 쓰는 곳 그대로.

### 1.2 유닛 · 통합 · 화면

**L1 유닛**

| 파일 | 확인하는 것 |
|---|---|
| `core/src/media/accept.test.ts` | 앞 바이트로 판별. `.png`로 이름만 바꾼 실행 파일, HEIC, SVG, HTML 거절. 10 MB 경계(10,485,760 통과, 1 더하면 거절) |
| `core/src/media/uses.test.ts` | `usesOf(entry)`: 필드, 본문, 표 · 목록 · 인용 안의 블록, 고치는 본과 발행본 중복 제거, 스키마에 없는 필드 무시 |
| `core/src/media/alt.test.ts` | 빈 대체 텍스트: 공백만 있음, 장식 이미지 제외, 파일 블록 제외, `accept: "any"` 필드의 파일 제외 |
| `core/src/render.test.ts` | 자르기 · 돌리기, 장식 이미지의 빈 `alt`, 웹용 주소 |
| `admin/src/media/upload-queue.test.ts` | 대기 → 올리는 중 → 끝, 실패, 너무 큼, 빼기, 줄여서 다시, 동시 3개 |
| `admin/src/media/fit.test.ts` | 4032×2688 → 2400×1600(흐름 6·16), 이미 작으면 그대로, 한도 아래로 줄이는 긴 변 계산 |
| `admin/src/screens/media/media-query.test.ts`, `admin/src/route.test.ts` | `#/media?folder=…&file=…&kind=…` 읽고 쓰기 |
| `admin/src/editor/extensions.test.ts`에 추가 | 올리는 중인 블록은 저장 문서에 들어가지 않음, 이미지 `attrs` 왕복 |

**L2 통합** (`core/src/media/media.int.test.ts`, 메모리 저장소와 진짜 Postgres)

| 끝 조건 | 시험 |
|---|---|
| 09-1 | 올리기, 찾기 · 종류 · 사용 여부 · 정렬 · 개수, `media.get`의 쓰는 곳, 이름 바꾸기, 폴더로 옮기기와 `folders.tree` 개수(T99), 미디어 폴더 지우기(일부 남김), 되돌리기 |
| 09-1 | 사람만: 에이전트의 `media.upload` · `media.replace` 거절. 없는 `key`, 다른 항목의 `key` 거절. 저장소 없음은 `media.query`의 `storage: false` |
| 09-2 | `media.query` · `media.get` 출력에 `alt` · `caption`이 없음. 같은 파일을 쓰는 두 글의 대체 텍스트가 각자 다름 |
| 09-4 | **표 하나로:** `entries.create` · `save` · `duplicate` · `publish` · `archive`, `body.edit`, 제안 적용, `translations.create`, `items.saveGroup`, `templates.*`, `activity.undo`, 스키마의 필드 이름 바꾸기 · 빼기 · 컬렉션 빼기. 각각 뒤에 `media_uses`가 현재 글에서 다시 계산한 값과 같아야 한다 |
| 09-4 | 쓰는 파일은 남고 안 쓰는 파일만 옮김. 휴지통의 글이 쓰는 파일도 남음. 폴더째 지워도 남음. **경쟁:** 저장과 휴지통이 동시에 돌아도 쓰이는 파일이 휴지통에 없음. **되살리기:** 되돌리기로 휴지통의 파일을 다시 쓰면 그 파일이 나온다 |
| 09-5 | 바꾼 뒤 `id` · 쓰는 곳 · 문서의 `alt` · 캡션이 그대로, 새 `key`, 종류가 다르면 거절 |
| 04-5 | 번역의 미디어 필드: 비어 있으면 원문의 파일과 `alt`를 읽고 원문을 바꾸면 따라온다. 번역에서 고르면 그 번역만 바뀐다. 지우면 다시 따른다. 새 번역은 비어서 시작한다. 쓰는 곳은 값을 가진 글에만 있다 |
| T25 | `entries.missingAlt`, `entries.checkPublish`의 할 일 수, 발행 거절. 번역은 `translatedFields`로 읽은 값으로 판단한다 |
| T59 | 목록의 미디어 열과 칸, "비어 있음" 거르기 |
| 사이트 | `createReader`가 글에 쓴 파일의 웹용 주소와 치수를 준다 |
| 바이트 경로 (`entry/api` 쪽) | 세션 없으면 401, 큰 파일 413, 위장 파일 415, `key`에 `../` 거절, 내려받기 헤더 |
| 로컬 어댑터 (`local-storage.int.test.ts`) | 왕복, 지우기, 폴더 밖으로 못 나감 |

**L3 부품.** 바꾼 부품에만 쓴다. `MediaPicker`와 `Tile`에 `keys-to-end`, `esc-closes`, `many`.

**L4 화면.** 이름은 `09-n [flow 6·NN] …`이나 `[장면] …`으로 시작한다.

| 파일 | 다루는 것 |
|---|---|
| `screens/media/media.screen.test.tsx` | 흐름 6의 01–04, 07–21, 27, 28, 31–36. 장면 `dragging`, `dropped`, `esc-cancels`, `keys-move`(폴더로 끌기), `korean`(찾기), `many`(타일 200개), `overflow-after-add`(긴 이름) |
| `editor/media.screen.test.tsx` | 흐름 6의 05, 06, 29, 30, 37, 38. `/` 메뉴에 장면 `line-start`, `mid-sentence`, `in-block`, `korean`, `keys-to-end`, `every-row-marked`, `esc-closes`. 도구 행에 `reach`, `leave`. `ResizeCorner`에 `dragging`, `dropped`, `keys-move` |
| `screens/entry/media-field.screen.test.tsx` | 대표 이미지(T67), 할 일에서 빈 대체 텍스트로 가기, "다음 이미지"(흐름 1·10–12), 번역에서 원문 따르기 · 바꾸기 · 다시 따르기 |
| `screens/list/list.screen.test.tsx`에 추가 | 대표 이미지 열(T59) |

`testing/scenes.ts`의 `KINDS`에 새 끌기와 떠 있는 도구를 더한다. 이 파일을 바꾸면 PR에서 소유자가 승인한다.

### 1.3 e2e (L5)

**새로 만드는 기반.** `playwright`는 이미 있고 `@playwright/test@1.64.1`을 더한다.

| 파일 | 하는 일 |
|---|---|
| `testing/e2e/vite.config.ts` | Vite 플러그인이 `createAdminApi`와 파일 경로를 띄운다. `testing/vitest.ts`의 `fonts()`를 내보내 함께 쓴다 |
| `testing/e2e/site.ts` | 스키마 `monti_e2e`를 비우고 만든 뒤 `story-schema` 데이터를 기능으로 넣는다. 진짜 `pg`, `localFolderStorage(임시 폴더)`. `E2E_STORAGE=off`는 저장소 없는 사이트 |
| `testing/e2e/main.tsx`, `index.html` | `<MontiAdmin transport={httpTransport("/admin/api")} />` |
| `/site/:collection/:slug` | `createReader` + `renderDocument`로 사이트 글 하나를 그린다 |
| `testing/e2e/playwright.config.ts` | `webServer` 둘(보통 · 저장소 없음), 재시도 없음 |

`knip.json`, `package.json`의 `test:e2e`, CI의 새 작업 `e2e`(Postgres + Chromium)를 더한다. T13 때 이 기반을 예제 앱으로 옮길 수 있다.

**흐름.** 합쳐야 깨지는 이음매만 본다. 경우는 아래 층이 본다.

| # | 흐름 | 지키는 이음매 |
|---|---|---|
| E1 (09-3) | 사진을 라이브러리에 OS에서 끌어 놓는다 → 새로고침해도 타일이 있고 그림이 해독된다(`naturalWidth > 0`) | HTTP 바이트 경로, 쿠키, 디스크, 파일 내보내기 |
| E2 (09-3) | 편집기 문장 중간에서 ⌘V → 막대 → 저장 → 새로고침 → 라이브러리의 쓰는 곳 "본문" | 붙여 넣기, 올리기, 저장, 쓰는 곳 |
| E3 (09-1) | 대체 텍스트가 없어 발행이 막힘 → 채움 → 발행 → `/site/…`에 웹용 그림과 `alt` | 할 일, 발행, 읽기, 그리기 |
| E4 (09-4) | 쓰는 파일과 안 쓰는 파일을 함께 휴지통으로 → 일부 남김과 "보기" → 쓰는 곳을 빼고 저장 → 옮겨짐 → 되돌리기 | 쓰는 곳이 화면까지 |
| E5 (09-5) | 파일 바꾸기 → 사이트 그림이 바뀌고 `alt`는 그대로 | 새 `key`가 사이트까지 |
| E6 | `.exe`, HEIC는 그 자리에 남음. 14 MB 이미지는 "줄여서 다시"로 올라감. 위장 파일을 직접 `PUT`하면 415 | 브라우저와 서버의 판별 |
| E7 | 저장소 없는 사이트: 두 줄과 "연결 방법", "올리기"와 `/` 메뉴 행 없음 | 플러그인 없는 설정 |
| E8 | 올리는 중 세션이 끝남 → 실패 줄과 맨 위 띠 → 다시 로그인 → 다시 올림 | 세션 끝남과 바이트 경로 |

### 1.4 GPT-6.1 Terra 사용성 시험

이 절은 09에서 한 일의 기록이다. 2026-11-09 소유자 결정으로 다음 문서부터는 필수 절차가 아니다(`docs/testing.md`, 사용성 확인).

**도구.** `testing/usability/driver.ts`를 새로 만든다. 창을 띄운 Chromium 하나를 잡고 있는 작은 서버이고, 명령은 `node testing/usability/do.ts <명령>`이다. 포인터 위치와 입력 기록이 호출 사이에 남는다. 영상(`recordVideo`)도 남긴다.

| 명령 | 입력 |
|---|---|
| `move x y --steps n`, `down`, `up`, `click`, `rclick`, `dblclick`, `wheel` | 궤적이 있는 실제 마우스 |
| `key <키>`, `type <글자>`, `korean <글자>` | 실제 `keydown`, 한글 조합(`typeKorean`과 같은 방법) |
| `dropfile <경로…> x y` | CDP `Input.dispatchDragEvent`, OS에서 끌어 놓기 |
| `clip <그림 경로>` 뒤 `key Meta+V` | 실제 클립보드 붙여 넣기 |
| `choose <경로>` | 파일 고르는 창에 답하기 |
| `shot`, `aria`, `rect <역할과 이름>`, `console` | 화면 그림, 접근성 트리, 측정, 콘솔 오류 |
| `offline on\|off`, `resize w h` | 끊김, 작은 창 |

규칙: 진행은 이 입력만 쓴다. 화면을 바꾸는 JavaScript, 저장소나 데이터베이스 직접 호출은 금지다. `aria`와 `rect`는 읽기만 한다. 드라이버 입력 기록을 보고서에 붙인다. 시험 파일은 `testing/usability/files/`에 스크립트로 만든다(3000×2000 사진, 14 MB 이미지, HEIC 머리, `.exe`, PDF, 긴 한글 이름).

**실행.** 단계 12까지 끝나고 시험용 서버와 드라이버가 뜬 다음, 코드를 고치지 않는 조건으로 부른다.

```
delegate_task:
  title: "Usability test of doc 09 media"
  role: test
  target: { providerInstanceId: codex, model: gpt-6.1-terra, options: { reasoningEffort: high } }
  task: docs/plans/09-media.md 1.4의 시나리오를 드라이버로 해 보고 docs/usability/feat-media-09.md에 적는다.
        소스를 고치지 않는다. 흐름 6과 기준 화면은 판정 근거로만 읽고, 시나리오를 시작하기 전에는 테스트 파일을 읽지 않는다.
```

**시나리오.** 눌러야 할 곳이 아니라 이루려는 일을 준다. 어디를 눌러야 할지 스스로 찾지 못하는 것이 결함이다.

| # | 하려는 일 | 입력 | 특히 볼 것 |
|---|---|---|---|
| U1 | 블로그 사진 셋을 라이브러리에 올리고, 하나는 `covers` 폴더에 바로 넣는다 | OS 끌어 놓기 | 놓는 자리 표시, 막대, 어느 폴더에 들어갔는지 |
| U2 | 올리다 실패한 HEIC, `.exe`, 14 MB 사진을 처리한다 | OS 끌어 놓기 | 까닭이 그 자리에 보이는지, 다음 할 일이 보이는지 |
| U3 | 폴더를 만들고 이름을 바꾸고 파일 여럿을 끌어 옮긴다. 같은 일을 키보드만으로도 한다 | 마우스, 키보드 | 끄는 동안 무엇이 움직이나, Esc, 사이드바 트리에 놓기 |
| U4 | 한글 이름 "표지"로 파일을 찾고, 모든 폴더로 넓히고, PDF만 남기고, 목록 보기로 본다 | 한글 조합 | 조합 중 깜빡임, 칩 풀기 |
| U5 | 글의 문장 사이에 그림을 붙여 넣고, 목록 안에도 넣고, 크기 · 정렬 · 캡션 · 자르기를 다루고, ⌘Z로 되돌린다 | ⌘V, 끌기, 키보드 | 올리는 중에 저장하면, 도구 행까지 포인터가 닿나 |
| U6 | 대체 텍스트가 없어 막힌 글을 "다음 이미지"로 채워 발행하고 사이트에서 본다 | 키보드 위주 | 어디가 비었는지 찾는 시간 |
| U7 | 안 쓰는 파일을 정리한다. 쓰는 파일이 섞여 있다. 남은 까닭을 보고 쓰는 곳을 고쳐 다시 지운다. 되돌린다 | 일괄 막대, Del, 폴더 메뉴 | 왜 남았는지 알 수 있나, "보기"가 어디로 가나 |
| U8 | 대표 이미지 파일을 새 파일로 바꾼다 | 패널 ⋯, 파일 고르는 창 | 무엇이 그대로인지 확인 창으로 알 수 있나 |
| U9 | 라이브러리와 고르는 창을 키보드만으로 끝까지 쓴다 | Tab, 화살표, Enter, Esc | 포커스 고리가 잘리는지(`shot`), 포커스가 돌아오는지 |
| U10 | 끊긴 상황과 많은 양: 올리는 중 오프라인, 올리는 중 나가기, 1024×768, 파일 200개, 긴 이름 | `offline`, `resize` | 쓰던 것을 잃지 않나, 넘침 |
| U11 | 한국어 글의 대표 이미지를 정해 발행한 뒤(번역은 원문의 발행본을 따른다, 04번 문서 원칙 5), 영어 번역에서 대표 이미지를 처음에는 그대로 쓰며 대체 텍스트만 영어로 쓰고, 영어판 그림으로 바꿨다가, 다시 원문을 따르게 한다 | 마우스, 파일 고르는 창 | 지금 값이 원문 것인지 번역 것인지 알 수 있나 |

**보고 형식.** 결함마다 하나씩: 등급, 시나리오, 입력 기록(다시 해 볼 수 있게), 화면 그림 경로, 기대한 것과 그 근거(흐름 단계, 원칙 번호), 본 것.

| 등급 | 뜻 | 처리 |
|---|---|---|
| A 막힘 | 일을 끝내지 못했거나 데이터를 잃음 | 고친다 |
| B 헷갈림 | 끝냈지만 잘못 눌렀거나, 왜 그런지 알 수 없었음 | 고친다 |
| C 다듬기 | 끝냈고 알 수 있었지만 어색함 | 소유자가 정한다. 미루면 tracker에 적는다 |

**끝나는 조건.** A와 B가 0이다. 고칠 때마다 그 결함을 잡는 L3~L5 테스트를 먼저 더하고, 장면으로 일반화할 수 있으면 `scenes.ts`의 `caught`에 적는다. 다시 볼 때는 새 `delegate_task`로 해당 시나리오만 돌린다. 시험한 모델의 말을 그대로 믿지 않고, 소유자에게 보이기 전에 메인 세션이 A와 B를 드라이버 기록으로 재현해 본다.

## 2부. 개발 순서

각 단계는 그 자체로 초록이고 커밋 하나 이상이다. 범위 이름은 `core`, `admin`, `ui`, `repo` 중에서 고른다.

### 단계 0. 문서와 브랜치

- `git switch -c feat/media-09`. 지금 워크트리의 `docs/tracker.md` 수정(08의 PR 번호, 표 이음, 09 "만드는 중", T101, T102)과 이 계획을 함께 커밋한다.
- `09-media.md`: 끝 조건에 **09-1~5**, "저장소 접점"과 "올리는 길" 절, ER의 `template_id`, `Media`의 `web`, 결정 기록에 결정 1~9.
- `screens/media.md:100`의 "기본 캡션"에 빠짐 표시, 흐름 6의 테스트 경로를 새 이름으로.
- 결정 9를 문서에 옮긴다: 01의 언어 방식 표에서 대표 이미지를 `same`의 예에서 `fromSource`의 예로, 04의 방식 표와 결정 기록(기본값에 미디어 필드), 09 "글 속 이미지"의 번역 줄, `screens/editor.md` 속성 패널에 번역의 대표 이미지 줄. tracker에 T103("올린 뒤 항목이 안 된 파일과 바꾼 옛 파일 지우기", 할 때 11)과 T104("이미지 설정 카드, 캡션 줄, 미디어 필드의 ✦ 채우기", 할 때 10, 나온 곳 09)를 더한다. T102에 호스트의 요청 크기 한도를 직접 올리기로 푼다는 말을 더하고, T81에서 자르기 · 돌리기를 뺀다. `docs/testing.md`의 층 표를 L1~L5로 고치고 T91에서 그 부분을 뺀다.
- `monti_test` 데이터베이스가 없으면 `createdb monti_test`로 만들고, 테스트를 돌릴 때 `CMS_TEST_DATABASE_URL`을 준다.
- 통과: `pnpm check:operations`, `pnpm check:korean`.

### 단계 1. e2e 기반

- 먼저 쓸 테스트: E0 "로그인 → 글 쓰기 → 저장 → 새로고침"(미디어 없음).
- 1.3의 파일, CI 작업. 이 단계에서는 저장소 없이 돈다.
- 통과: `pnpm test:e2e`, `pnpm knip`.

### 단계 2. core의 저장소와 기능

- 먼저 쓸 테스트: `accept`, `alt`, `local-storage`, 1.2의 09-1, 09-2, 09-5.
- 만들 것:
  - `db/migrations.ts`에 `0011_media`(`media`, `media_uses`, `original_key` · `web_key` 유일), `db/schema.ts`
  - `media/storage.ts`(접점), `media/local-storage.ts`, `media/accept.ts`(브라우저에서도 쓰는 순수 함수)
  - `media/record.ts`(`defineRecordKind`, `folders/operations.ts`의 `folderRecord`와 같은 모양)
  - `media/operations.ts`: 기능 목록에서 `entries.missingAlt`(단계 4)를 뺀 7개. `media.query`에 `ids` 거르기와 `storage`. `upload` · `replace`는 `humanOnly`
  - `monti.ts`의 `Plugin.storage`, `site.ts`의 `storage`, `core/src/messages.ts`
  - `body/blocks.ts`: `decorative`, `width` nullable, `crop`, `rotate`. `entries/operations.ts:50` 옆에 미디어 값 모양과 `accept` 검사
- 통과: core 테스트, `pnpm check:operations`, `pnpm check:messages`. 올리기를 뺀 기능을 CLI로 돌려 본다(build.md 규칙 7).

### 단계 3. 쓰는 곳 불변식

이 PR에서 가장 틀리기 쉬운 곳이다. 09-4 전체가 여기에 기댄다.

- 먼저 쓸 테스트: `uses`, 1.2의 09-4 표와 경쟁, 되살리기.
- 만들 것:
  - `media/uses.ts`: `usesOf`, `rewriteUses(db, schema, refs)`(그 글의 줄을 지우고 다시 적는다, 고치는 본과 발행본 모두, 없는 파일 id는 줄을 만들지 않음)
  - `engine/execute.ts`: `operation.run` 뒤에 건드리거나 만든 `entry`, `template`에 `rewriteUses`
  - `engine/undo.ts`: 복원한 것에 `rewriteUses`
  - `schema/apply.ts`: 적용 뒤 그 컬렉션 전체
  - 경쟁: `rewriteUses`가 파일마다 `monti:record:media:<id>` 잠금을 잡는다. `media.trash`의 `touches`가 같은 잠금을 잡아 둘이 줄을 선다
  - 되살리기: 다시 쓰이는 휴지통 파일은 `trashed_at`을 비운다
- 통과: 09-4 표 전부. 일부러 `execute.ts`의 호출을 빼 보고 표가 실패하는지 본다.

### 단계 4. 바이트 경로, 폴더, 할 일, 사이트

- 먼저 쓸 테스트: 바이트 경로, T25, T59(core 쪽), T99(core 쪽), 사이트, `render`.
- 만들 것:
  - `entry/api.ts`: `PUT …/media/bytes`, `GET …/media/files/<key>`
  - `folders/operations.ts`: `folders.tree`의 파일 수, `folders.remove`의 미디어 갈래(쓰는 파일과 그 폴더는 남음, 출력에 `moved` · `kept`)
  - `entries/tasks.ts`의 대체 텍스트 할 일, `entries.missingAlt`
  - `entries/list.ts`의 `KIND_OF`에 미디어, `entries/reader.ts`의 파일 정보, `render.ts`의 자르기 · 돌리기
  - 번역: `schema/define.ts`의 `localeModeOf` 기본값에서 미디어 필드를 `fromSource`로. `translations/operations.ts`의 새 번역 복사에서 미디어 필드를 뺀다(복사하면 원문을 따르지 못한다). `field-sheet.tsx:116`이 `{ kind: "text" }`가 아니라 필드의 실제 종류로 기본값을 견주게 한다. `translatedFields`는 고치지 않는다
- 통과: core 테스트 전부.
- **리뷰 1 (Sol):** 3부의 요청을 core 쪽 변경에 돌린다. 화면이 이 위에 쌓이기 전에 설계의 파편화를 잡는 자리다. 결과를 처리한 뒤 다음 단계로 간다.

### 단계 5. 부품 확인

- 읽을 것: `tokens.md`, `components/list.md`, `overlay.md`, `editor-tools.md`, `field.md`, `sidebar.md`, `screens/media.md`, `screens/editor.md`의 이미지와 속성 패널 줄.
- 지도의 줄마다 있는 부품과 빠진 prop을 표로 적는다(`Tile`의 끌기, 사이드바 줄의 `dropTarget`, `toast.dropHint`). 빠진 것만 `@monti-cms/ui`에 스토리, 문서와 함께 더한다.
- 통과: `pnpm check:design`, ui 브라우저 테스트.

### 단계 6. 올리기와 라이브러리 둘러보기

- 먼저 쓸 테스트: `upload-queue`, `fit`, `media-query`, `media.screen.test.tsx`의 01–04, 07–10, 13–15, 31–35.
- 만들 것:
  - `operations/transport.ts`: `Uploader`, `httpUploader`(XHR, 비율). `fetch`와 XHR은 이 폴더에만 둔다. `AdminProvider`와 `MontiAdmin`에 `uploader`
  - `.storybook/pglite-site.ts`: 메모리 저장소(`blob:` 주소), `storage: null` 옵션, `uploader`
  - `media/upload-queue.ts`, `media/fit.ts`, `media/use-upload.ts`(문서의 `useUpload(target)`)
  - `route.ts`의 `media` 경로와 `app.tsx`, `admin-frame.tsx:187`의 폴더 트리
  - `screens/list/folders.tsx`: `useFolders(scope, on)`으로 넓히고 `FolderMenuItems`, `MoveToFolderMenu`, `useRemoveFolder`를 그대로 쓴다(07-1)
  - `screens/media/media-screen.tsx`, `media-query.ts`, `media.stories.tsx`(사람이 볼 상태만)
- 통과: 해당 L4. Storybook에서 기준 화면 `Screens/Reference/Lists › Media`와 나란히 본다.

### 단계 7. 파일 다루기

- 먼저 쓸 테스트: 11, 12, 16–21, 27, 28, 36과 `dragging`, `dropped`, `esc-cancels`, `keys-move`, `many`, `korean`, `overflow-after-add`.
- 만들 것: `media-panel.tsx`(`use-item-panel.ts`의 저장 모양, 이름과 폴더가 바뀐 것만 부른다, 쓰는 곳), 파일 바꾸기 확인, 일괄 막대, 오른쪽 클릭 메뉴, Del, 타일을 폴더와 사이드바로 끌기(T99), 토스트의 되돌리기와 "보기"(글 쓰는 곳으로).
- 통과: 해당 L4. E1, E4, E5, E6, E7, E8의 라이브러리 쪽.

### 단계 8. 고르는 창과 편집기 (T33)

- 먼저 쓸 테스트: `editor/media.screen.test.tsx`, `extensions.test.ts`의 추가분.
- 만들 것:
  - `media/media-picker-dialog.tsx`: `MediaPicker`와 `media.query`. 필드와 편집기가 같은 것을 쓴다(09-3)
  - `editor/schema.ts`: `image`, `file`의 노드 뷰(`UploadingImage`, `Image`, `FileBlock`). "이름 상자"를 없앤다
  - `editor/plugins.ts`: 붙여 넣기와 끌어 넣기. 임시 `uploadId`로 자리를 잡고, 끝나면 `media`를 채운다
  - `editor/convert.ts`: `uploadId`가 있는 블록은 저장 문서에서 뺀다. 올리는 중이면 나가기 확인을 한다
  - `catalog.ts`의 `NOT_FROM_MENU`를 지우고 `slash-menu.tsx`의 이미지 · 파일 행이 창을 연다. 저장소가 없으면 그 행이 없다
  - `ImageTools`: 정렬, 설정 카드, 캡션, `ResizeCorner`, `Sheet` + `CropStage`, "다음 이미지". "✦ 채우기"는 10번 문서 때 넣는다(T104). 그때까지 흐리게 두지 않고 없앤다
  - 템플릿 편집기도 같은 `useBodyEditor`로 함께 된다
- 통과: 해당 L4. E2.

### 단계 9. 필드, 목록, 할 일

- 먼저 쓸 테스트: `media-field.screen.test.tsx`, 목록 열.
- 만들 것: `entry-properties.tsx`의 `SHOWN`에 미디어, `MediaInput`과 대체 텍스트 칸(T67), 번역에서 원문을 따르는 모습(`editor.md`의 "다른 값을 따르는 값"처럼 원문 `alt`가 플레이스홀더), 목록 칸의 `RowThumb`와 열 메뉴(T59), 할 일 줄에서 그 자리로 가기(T25).
- 통과: 해당 L4. E3.

### 단계 10. e2e 마무리

- E1~E8을 모두 진짜 경로로 돌린다. 어느 이음매를 지키는지 `docs/testing/flows.md`에 흐름마다 적는다. 이음매를 한 번씩 끊어 보고 그 흐름이 실패하는지 본다.

### 단계 11. Sol 전체 리뷰

- **리뷰 2 (Sol):** 3부의 요청을 `origin/overhaul...HEAD` 전체에 돌리고 결과를 처리한다.

### 단계 12. 디자인 관문

- `pnpm check:design`, `design-review` 에이전트, 바뀐 상태마다 기준 화면과 1440×900으로 나란히 보기.
- admin-ui 스킬의 측정: 줄 높이와 간격(36 · 32 · 28 · 24), 끄는 도중 화면, 포커스 고리, 패널과 기준 화면.

### 단계 13. 사용성 시험

1. 드라이버를 만들고 첫 관문을 지난다. Terra로 `move`, `type`, `dropfile`, `key Meta+V`, `shot`을 한 번씩 하게 하고, 그림을 읽는지와 창을 띄운 실행에서도 `isTrusted`인지 확인한다. 그림을 읽지 못하면 시험용 서버 주소로 그림을 내보내 T3의 `preview_snapshot`으로 읽게 한다. 그것도 안 되면 `aria`와 `rect` 위주로 줄이고, 눈으로 봐야 하는 항목은 메인 세션이 본다고 소유자에게 알린다.
2. 1.4의 U1~U11을 돌린다.
3. A와 B를 재현하고, 테스트를 먼저 더해 고치고, 해당 시나리오를 새 `delegate_task`로 다시 본다. A와 B가 0일 때까지 한다.
4. 보고서를 PR에 링크한다. T89의 자동 점검 에이전트는 이번에 만들지 않고 "출시 전"으로 둔다.

### 단계 14. Opus 최종 리뷰

- PR 직전 코드가 모두 들어간 뒤 **리뷰 3 (Opus)** 을 돌린다. 앞의 리뷰 결과는 주지 않는다. 고친 것이 있으면 관련 테스트를 다시 돌린다.

### 단계 15. 마무리

- 전체 확인:

```
pnpm lint && pnpm check:korean && pnpm check:design && pnpm gen:tokens --check \
  && pnpm gen:screen-catalog --check && pnpm check:screens && pnpm check:messages \
  && pnpm check:operations && pnpm typecheck && pnpm knip && pnpm build \
  && CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test \
  && pnpm test:browser && CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test:e2e
```

- tracker: T33, T59, T25, T67, T99를 "끝낸 일"로, 09를 "통합 대기"(흐름 6·06의 ✦ 채우기인 T104가 남으므로)로, PR 번호를 적는다. README가 바뀌면 `README.ko.md`도 함께.
- PR 본문: 끝 조건 09-1~5와 다섯 T의 표, 결정 1~9, 사용성 보고서, 리뷰에서 고친 것과 받지 않은 지적의 이유. 화면이 든 PR이므로 소유자가 Storybook을 본 뒤 병합한다(build.md 규칙 8).

## 3부. 코드 리뷰

세 번 한다. `design-review` 에이전트(디자인)와 Terra(사용성)는 따로 돈다.

| 차례 | 언제 | 누가 | 범위 |
|---|---|---|---|
| 리뷰 1 | 단계 4 끝 | GPT-6.1 Sol | core 쪽 변경 |
| 리뷰 2 | 단계 11 | GPT-6.1 Sol | `origin/overhaul...HEAD` 전체 |
| 리뷰 3 | 단계 14, PR 직전 | 별도의 Opus 에이전트 | `origin/overhaul...HEAD` 전체 |

```
리뷰 1, 2: delegate_task
  title: "Code review of doc 09 media"
  role: review
  target: { providerInstanceId: codex, model: gpt-6.1-sol, options: { reasoningEffort: high } }
리뷰 3: Agent
  model: opus
  run_in_background: false
```

**요청에 넣는 것.** 범위, 아래 세 기준, 읽을 문서(`AGENTS.md`, `09-media.md`, `07-folders.md`, `build.md`, `docs/testing.md`), 아래 기계 검사 결과. 코드를 고치지 않는다고 적는다. 메인 세션의 결론이나 앞 리뷰의 지적은 넣지 않는다.

**기준 1. 올바름.** 끝 조건을 어기는 입력과 상태. 잃는 데이터, 권한, 경쟁, 실패 뒤 남는 상태.

**기준 2. 파편화.** 기존 구조에서 로직이나 설계가 갈라진 곳을 찾는다.

- 같은 규칙이 두 곳에 있나: 받는 종류는 `media/accept.ts`, 쓰는 곳 계산은 `usesOf`, 번역 값 읽기는 `translatedFields` 하나뿐이어야 한다.
- 기존 길을 돌아갔나: `defineOperation`, `defineRecordKind`, `runWrite`, 말 사전, `walk`와 `asDoc`, `localeModeOf`, `useOperation`과 `useRead`, `useDraft`, `useFolders`, `@monti-cms/ui` 부품.
- 미디어 전용으로 새로 만든 것이 기존 것을 넓혀 될 일이었나: 폴더는 글과 같은 기능과 부품이어야 한다(07-1). 파일 바이트 경로 말고 화면에서 서버로 가는 새 길이 있으면 안 된다.
- `if (media)` 같은 특별 처리가 여러 파일에 흩어졌나. 한 곳으로 모을 수 있는가.
- 이름, 파일 위치, 오류 처리, 테스트 층이 이웃 코드와 다른가. 문서와 코드가 다른가.

**기준 3. 타입 안정성.** 새로 생긴 것을 줄마다 본다.

- `any`, `as`(특히 `as never`, `as unknown as`), `!`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore`: 없앨 수 있나, 남긴다면 이유가 있나.
- 경계에서 검사 없이 믿는 값: HTTP 본문, `JSON.parse`, jsonb(`values`, `doc`), 스냅숏, `DataTransfer`, 업로드 응답.
- `useOperation<Output>`은 응답을 `as Output`으로 받는다. 화면이 적은 출력 타입이 core의 기능 출력에서 온 것인가, 따로 손으로 적어 어긋날 수 있는가.
- 손으로 적은 타입과 Zod 입력이 어긋날 수 있나. `place`, `Scope`, 올리기 상태 같은 합 타입을 빠짐없이 다루나.

**기계 검사.** 요청과 함께 준다.

```
git diff origin/overhaul...HEAD -- 'packages/**' 'testing/**' \
  | grep -nE '^\+.*(\bas (any|never|unknown)\b|: any\b|<any>|[a-zA-Z)\]]!(\.|\)|,|;)|@ts-|biome-ignore)'
pnpm typecheck && pnpm knip
```

**보고 형식.** 지적마다 파일과 줄, 기준 번호, 심각도(높음 · 중간 · 낮음), 틀리는 구체적인 상황, 고칠 방향. 찾지 못했으면 찾지 못했다고 쓴다.

**처리.** 메인 세션이 지적을 코드에서 하나씩 확인한다. 맞으면 테스트를 먼저 더하고 고친다. 틀리거나 받지 않으면 이유를 PR 본문에 남긴다. 미루면 tracker에 적는다. 작은 지적은 메인 세션이 바로 고치고, 다시 확인을 맡겨야 하면 새 위임으로 지적과 반론을 함께 준다. 리뷰 3에서 높음이 0이고 중간은 고쳤거나 이유가 있으면 끝이다.

## 위험

| 위험 | 막는 것 |
|---|---|
| 쓰는 곳이 어긋나 쓰이는 파일이 지워짐 | 엔진 한 곳에서 다시 적기, 09-4 표, 경쟁 테스트, 일부러 빼 보기 |
| 올리는 중인 블록이 저장되거나 사라짐 | `convert.ts` 유닛 테스트, 올리는 중 저장 L4, U5 |
| 위험한 파일을 같은 주소로 내보냄 | 결정 4, 바이트 경로 L2, E6 |
| 올린 뒤 항목이 안 된 파일이 저장소에 쌓임 | 무해하므로 T103(11)으로 넘긴다 |
| Vercel 같은 호스트의 요청 크기 한도(10 MB보다 작을 수 있음) | 운영 저장소는 T102에서 직접 올리기로 푼다. T102에 이 줄을 더한다 |
| PR이 크다 | 단계마다 커밋하고 초록을 유지한다. 그래도 넘치면 단계 2~4(core)만 먼저 병합할 수 있다. 그때 09는 "만드는 중"으로 둔다 |
