# 플러그인·CLI 리팩토링 이관 기록

상태: 이관 범위 합의, 상세 설계·구현 대기 (2026-11-18). 기존 메인 체크아웃의 초안에서 HTTP 책임을 [next.md](next.md)로 옮기고 [core.md](core.md)의 다섯 가지 서버 확장 계약에 맞춘다.

## 1. 이벤트 소비자

- core는 쓰기 커밋 직후 `{ operation, input, output }`을 발행하며 구독 작업이 끝날 때까지 기다리지 않는다. 조회·실패·`dryRun`에서는 쓰기 이벤트를 내지 않는다.
- 사이트 캐시 갱신은 Next 연결이, 웹훅·활동 기록·스냅샷은 해당 외부 플러그인이 구독해 처리한다.
- 기존 `monti_delivery`·`engine/deliveries.ts`의 웹훅 큐와 24시간 재시도, `monti_activity`·`monti_activity_snapshot`·`activity/`·`engine/undo.ts`의 기록·스냅샷은 core에서 제거한다. 외부에서 어느 기능을 유지할지와 기간·스키마는 플러그인 작업에서 정한다. 옛 숫자를 새 보장으로 확정하지 않는다.
- 구독자는 필요한 이벤트를 고르고 비밀번호·API 키 등 외부로 보낼 수 없는 값을 필터링한다. 작업 수명·실패·재시도·중복 처리는 구독자의 책임이다. core 리스너의 실패 격리는 전송 보장이나 재시도 큐를 뜻하지 않는다.
- core에 호출자·세션 컨텍스트가 없으므로 이벤트만으로 수행자의 신원을 기록할 수 있다고 가정하지 않는다.
- core의 수동 `ctx.emit`, `afterCommit`, `touches`, 레코드 스냅샷 계층을 복원하지 않는다. 플러그인의 자체 DB가 필요할 때 사용할 공개 계약은 core의 T313 결정에 맞춘다. `migrations`는 현재의 절차 등록 초안이다.

## 2. 별도 `@monti-cms/cli`

- CLI는 `packages/cli/`에서 제공한다. core에 `cli/`, `adapters/cli/`, CLI 실행기를 두지 않는다.
- 명령 파싱, 도움말, 터미널 출력, 종료 코드, `stdin`과 비밀값 입력 가리기를 담당한다. `secretInputs` 같은 CLI 속성을 core Operation에 다시 넣지 않는다.
- `monti <resource> <action>`을 core의 명세와 공개 RPC에 연결한다. `transaction`·`dryRun`도 같은 core 실행을 사용한다.
- 비밀값이 필요한 명령의 입력 방식은 CLI가 담당하되 암호화·저장·검증 규칙은 core의 `keys.*`·인증 Operation을 사용한다.
- 프로젝트 초기화·진단·개발 도구와 실행 진입점을 이 패키지의 설계에서 정리한다. 설치 도구가 필요한 패키지·설정을 준비해 사용자가 내부 패키지를 각각 조합하지 않게 하는 방향으로 설계한다. 새 설치 명령이나 공개 옵션은 아직 확정하지 않는다.

## 3. 없애는 옛 슬롯

- 서버 플러그인의 책임은 식별자, Operation, 키 서비스 규격, 플러그인 DB, 이벤트 구독이다. DB 슬롯의 공개 이름·입력 형태는 T313에서 정하며 나머지 옛 슬롯을 되살리지 않는다.
- `beforeSave`, `receivers`, `attach` 등 옛 연결 훅은 일괄 복원하지 않는다. UI 확장은 [admin.md](admin.md), AI 전용 실행은 [ai.md](ai.md), 저장소·블록 연결은 설정의 계약으로 나눈다.
- MDX가 외부라는 이유로 `importers`, `publishChecks`, `documentViews`를 다시 만들지 않는다. [mdx.md](mdx.md)에 해당 기능의 연결을 기록한다.

## 4. 각 패키지의 테스트 계획 전에 정할 것

- 외부 이벤트 소비자의 패키지 위치·필요 기능·전송 정책과 저장 스키마.
- CLI 명령 파서·비밀값 입력·실행 및 설치 경로, core 명세와 명령의 대응.
- 플러그인 경로 충돌의 core 조립 규칙은 core의 T303을 따른다. 이 문서에서 별도 규칙을 만들지 않는다.
- 내보내기·가져오기(`data.export`·`data.import`)를 맡을 곳(플러그인이나 CLI), 파일 모양, 미디어 파일 처리, 지워진 필드에 남은 값을 치우는 방법. core의 공개 읽기·쓰기·`__preset_id`·`transaction`·`dryRun`만 쓴다([core.md](core.md) 2절). 가져오기는 본문 검사에서 문제가 나온 글만 건너뛴다(2026-11-18 결정).
