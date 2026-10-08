# 확장 레시피

[English](README.md) | 한국어

Monti를 확장하는 방법을 보여 주는, 동작하는 작은 예제 모음이다. 레시피는 모두 공개 문서만 보고, 코드베이스를 처음 접한 개발자가 쓰듯이 작성한 뒤 [`examples/recipes`](../../examples/recipes)에 테스트된 코드로 남겼다. 레시피 페이지에는 알아야 할 것이 나오고, 코드(항상 테스트된 파일의 코드다. 둘이 다르면 `pnpm recipes:check`가 실패한다)가 나오며, 쓰는 동안 불편했던 점이 적혀 있다.

바탕에 있는 원칙은 이렇다. 사용자가 만지는 부분은 열어 두고, 코어가 지켜야 할 부분은 인터페이스 뒤에 닫아 둔다. 쓰기 파이프라인, 저장소, 마이그레이션은 훅, 이벤트, 플러그인으로만 닿을 수 있다. 그래서 아래 레시피는 모두 플러그인이거나 훅이고, 코어를 바꾸는 것은 하나도 없다.

| 레시피 | 얻는 것 | 쓰는 지점 |
| --- | --- | --- |
| [글을 발행하면 Slack 메시지 보내기](slack-on-publish.md) | 발행마다 메시지 하나, Slack이 멈추면 재시도 | `afterCommit`(`cms`를 받는다), `event.once`, 이벤트 아웃박스, 플러그인의 지연 `server` 훅 |
| [나만의 블록 더하기](custom-block.md) | `notice` 블록: 정의, 검사, 편집기 뷰, 공개 컴포넌트 | `defineBlock`(`validate`), `blockViews`, `documentComponents` |
| [관리자 필드 화면 직접 만들기](reading-time-field.md) | 본문을 입력하는 대로 계산하는 "3분 읽기" | 보기 필드, `fieldViews`, `@monti-cms/admin` 공급자 |
| [저장 전에 슬러그 규칙 지키기](slug-rule.md) | 소문자 ASCII 슬러그, 거부하거나 고치고 분명한 오류를 낸다 | 쓰기 훅 `validate`와 `transform`, 플러그인의 인라인 `hooks` |
| [나만의 형식 만들기](custom-format.md) | Markdown 읽기와 쓰기, 한쪽으로만 내보내는 텍스트 | `defineFormat`, 플러그인의 `formats` |
| [공개 사이트에서 글을 타입 있게 읽기](read-posts.md) | 목록, 글 하나, 태그, 리디렉션. 타입은 설정에서 온다 | `cms.read`, `Cms<typeof config>` |
| [플러그인에 관리자 페이지 더하기](admin-page.md) | 자체 API 경로가 있는 "Post stats" 화면 | `nav`, `server.routes`, `defineAdminPlugin({ pages })` |
| [플러그인에서 `monti doctor` 검사 더하기](doctor-check.md) | 어디를 어떻게 고치는지 알려 주는 검사, 플러그인 이름으로 표시 | `server.checks` |
| [Cache Components에서 엄격한 404와 308](strict-status.md) | 필요할 때 작은 `proxy.ts`로 진짜 404와 308 | `cms.read.getEntry`, Next `proxy.ts` |

## 레시피마다 드는 양

문서만 보고 처음 동작하게 만든 버전을 기준으로 센 값이다. **개념**은 레시피가 필요로 하는, 전에는 몰랐던 이름 붙은 아이디어나 API다(각 페이지의 "알아야 할 것" 목록). **소스 읽기**는 문서만으로 모자라 소스(또는 다른 패키지의 소스)를 읽어야 했던 곳이다. 두 번째 숫자는 이번 변경에서 고치고 README 절을 더한 뒤 남은 수다.

| 레시피 | 개념 | 파일 | 코드 줄 | 테스트 줄 | 소스 읽기 | 고친 뒤 |
| --- | --- | --- | --- | --- | --- | --- |
| 발행 시 Slack 메시지 | 5 | 1 | 34 | 67 | 3 | 0 |
| 나만의 블록 | 5 | 6 | 92 | 122 | 4 | 1 |
| 관리자 필드 화면 | 4 | 5 | 30 | 57 | 4 | 0 |
| 슬러그 규칙 | 5 | 1 | 20 | 57 | 4 | 0 |
| 나만의 형식 | 5 | 2 | 167 | 66 | 4 | 0 |
| 타입 있는 글 읽기 | 5 | 2 | 46 | 88 | 5 | 0 |
| 플러그인의 관리자 페이지 | 4 | 4 | 63 | 98 | 4 | 0 |
| `monti doctor` 검사 | 5 | 3 | 37 | 90 | 1 | 0 |

코드 줄은 레시피 자체 파일에서 빈 줄이나 주석이 아닌 줄이다(테스트는 따로 센다). 파일은 레시피의 소스 파일이다(블록이나 화면에는 정의, 플러그인, 관리자 쪽, 뷰가 필요하고 훅은 하나면 된다). 남은 소스 읽기 하나는 블록의 편집기 뷰 테스트다. 그 브라우저 설정(jsdom 범위 shim과 편집기 확장)은 그 레시피에만 나온다.

## 실행하기

```sh
pnpm --filter @monti-cms/example-recipes test:run   # needs CMS_TEST_DATABASE_URL, like the other tests
pnpm --filter @monti-cms/example-recipes typecheck  # also compiles the type tests
pnpm recipes:check                                  # the pages show the code of the files
```
