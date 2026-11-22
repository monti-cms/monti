# `@monti-cms/admin` 리팩토링 이관 기록

상태: 이관 범위 합의, 상세 설계·구현 대기 (2026-11-18). 기존 메인 체크아웃의 초안을 바탕으로 [core.md](core.md)의 최신 경계에 맞춰 정리했다.

## 1. core에서 받는 일

- 목록의 열 너비·숨김·순서·페이지 크기·보기 방식, 최근 본 항목, 접힘 상태, 안내 닫기, 관리자 표시 언어 등 개인 UI 상태는 브라우저 `localStorage`에서 관리한다. `list.savePrefs`, `admin.setPreference`와 이를 위한 서버 저장을 복원하지 않는다.
- 관리자 표시 언어는 admin·Next 연결 쪽의 브라우저 설정으로 관리한다. core의 `MontiConfig.language`와 사이트 공통 표시 언어 설정은 제거한다(2026-11-18, 소유자와 정함). 미설정 시 선택할 기본 언어와 `localStorage` 키는 이 패키지의 테스트 계획 전에 정한다. 콘텐츠 언어 목록인 `schema.locales`와 연결하거나 중복 저장하지 않는다.
- 공통 사이트 설정·컬렉션·필드 라벨과 배치는 core가 읽는 `monti.config.ts`·`monti.schema.ts`의 값이다. 개인 보기 상태와 섞어 저장하지 않는다.
- `kind: "screen"`으로 정의하던 `screen.openEntry`, `list.show`, `list.select`는 화면과 AI가 주고받는 UI 도구로 옮긴다. DB Operation으로 만들지 않는다.
- 설정 탭, 툴바, 입력 부품, 미리보기, 상태바와 팝오버는 `AdminPlugin` 등 화면 확장으로 제공한다. core의 서버 `Plugin`에 UI 슬롯을 만들지 않는다.
- 맞춤법·문장 길이·금지어 등 글쓰기 보조 진단은 에디터와 화면 확장에서 담당한다. 필수값·참조·본문 구조처럼 저장·발행의 데이터 무결성 검증은 core Operation에 남는다. 화면 진단으로 서버 검증을 대신하지 않는다.
- `MontiError.code`와 `details`를 화면 언어에 맞는 메시지로 표시한다. HTTP 상태 응답은 [http.md](http.md)의 책임이다.

## 2. AI 제안과 실행 취소

- 열린 대상의 제안은 `useDraft`가 제안 입력을 읽어 화면의 임시 수정으로 보여준다. 사용자가 저장하면 정식 Operation을 호출한다.
- 열려 있지 않은 대상과 생성·이동·삭제·발행 제안은 제안 카드와 검토 화면에 표시한다.
- 다중 대상 제안은 core나 AI DB에서 `each`로 쪼개지 않는다. 화면이 고른 ID만 추려 한 번 적용한다.
- AI 대화·제안 저장과 승인 실행은 [ai.md](ai.md)의 책임이다. 화면 전용 도구의 연결은 두 패키지의 설계에서 정한다.
- 에디터 실행 취소, 발행본 기준 초안 되돌리기, `trash.restore`를 이용한 복원은 서로의 목적에 맞게 제공한다. core의 30일 활동 스냅샷 타임머신을 화면 구현을 이유로 되살리지 않는다.

## 3. 외부 기능 연결

- 구조·설정 편집 UI는 core가 제공하는 실제 `dev` 판정을 따른다. 기본값은 `NODE_ENV === "development"`이고 명시적 설정으로 덮어쓸 수 있다. 코드 파일 반영은 core의 커밋 이후 규칙을 따른다.
- 브라우저 요청은 `@monti-cms/http`([http.md](http.md))의 REST 입구를 사용한다. 화면에서 DB나 별도 저장 규칙을 만들지 않는다. Next.js 전용 연결(`AdminPage`, `adminRoute` 래퍼, `draftMode` 미리보기, `onEvent` 기반 `revalidatePath`·`after` 캐시 갱신)은 `@monti-cms/admin/next` 서브패스로 제공한다([next.md](next.md)에서 이관).
- 어시스턴트 답변의 Markdown 읽기는 [mdx.md](mdx.md)의 외부 변환기를 사용한다. `@monti-cms/core/markdown`을 다시 만들지 않는다.
- 본문 표시와 코드 블록의 표현은 [rendering.md](rendering.md)·[blocks.md](blocks.md)를 사용한다. 실제 패키지·export 위치는 해당 작업에서 정한다.

## 4. 이 패키지의 테스트 계획 전에 정할 것

- `localStorage` 키와 수명, 화면 도구와 AI의 연결 계약.
- `AdminPlugin`의 실제 화면 확장 계약과 진단 표시 방식.
- REST 클라이언트·이벤트 알림의 연결, 외부 변환기·렌더러의 소비 경로.

화면의 상세 동작은 이관 기록만으로 구현하지 않고 관리자 설계 문서와 소유자 검토를 거쳐 정한다.
