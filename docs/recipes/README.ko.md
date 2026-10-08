# 확장 레시피

[English](README.md) | 한국어

Monti를 확장하는 방법을 다루는 짧은 페이지 모음이다. 각 페이지에는 알아야 할 것과, 공개 API로 쓴 작은 스케치가 나온다. 코드 조각은 가져다 고쳐 쓰는 예시이며, 테스트되거나 제품에 포함된 코드가 아니다.

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
| [Cache Components에서 엄격한 404와 308](strict-status.md) | 필요할 때 작은 `proxy.ts`로 진짜 404와 308 | `cms.read.getEntry`, Next `proxy.ts` |
