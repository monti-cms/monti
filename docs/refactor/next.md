# `@monti-cms/next` 리팩토링 이관 기록

상태: 이관 범위 합의, 상세 설계·구현 대기 (2026-11-18). [core.md](core.md)의 얇은 core 결정에 따라 HTTP·사이트·관리자 화면의 서버 연결을 받는다. 구현이 끝났다는 뜻이 아니다.

## 1. 담당하는 일

- REST 경로·메서드·쿼리·본문을 읽어 공개 Operation을 호출하고 `Response`로 바꾼다. 별도 REST 전용 패키지는 만들지 않는다.
- `createAdminApi` 등 기존 HTTP 입구의 책임을 이어받는다. `Request`·`Response`, 세션 쿠키, `Set-Cookie`, HTTP 상태 변환을 core에 두지 않는다.
- 로그인·최초 관리자 생성 예외를 제외한 관리자 API 요청은 쿠키의 토큰을 꺼내 `monti.session.get({ token })`으로 검증한다. 세션 유효성·계정 변경 규칙 자체는 core가 담당한다.
- 로그인·로그아웃의 쿠키 설정·해제와 `MontiError`의 HTTP 응답 매핑을 처리한다. core의 오류 코드는 `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`이며 HTTP 입구가 각각 400·401·403·404·409로 바꾼다.
- 관리자 페이지와 API를 Next 프로젝트에 연결한다. 관리자 화면 자체는 [admin.md](admin.md), 본문 표현은 [rendering.md](rendering.md)가 담당한다.
- 관리자 표시 언어는 admin과 연결되는 브라우저 설정·`localStorage`에서 관리한다. core의 `MontiConfig`나 `config.*`에 관리자 표시 언어를 저장하지 않는다. 콘텐츠의 `schema.locales`는 이 설정과 별개다.
- 사이트는 `entries.get`·`entries.list` 등 공개 Operation을 직접 사용한다. core에 별도 `Reader`를 만들지 않는다. 발행본·작업본 선택과 데이터 접근 규칙은 core의 리소스가 담당하고, 미리보기 요청·쿠키를 그 입력에 연결하는 일은 이 패키지가 담당한다.
- 캐시 갱신은 `onEvent`를 구독한다. core에 전용 `revalidate`, `afterCommit`, `waitUntil` 옵션을 복원하지 않는다. 구독 작업의 실행·실패 처리는 이쪽의 책임이다.

## 2. core에서 옮긴 REST 매핑안

다음은 기존 문서의 매핑안을 보존한 것이다. 단일 리소스·단건·다건 구분과 경로 충돌의 상세 규칙은 이 패키지의 테스트 계획 전에 확정한다(T304). core Operation에는 HTTP 전용 속성을 추가하지 않는다.

| Operation | HTTP 매핑안 |
|---|---|
| `<resource>.list` | `GET /api/<resource>`; 필터·정렬은 쿼리 |
| `<resource>.get` | `GET /api/<resource>/:id`; 단일 리소스는 `GET /api/<resource>` |
| `<resource>.create` | `POST /api/<resource>` |
| `<resource>.update` | 단건은 `PATCH /api/<resource>/:id`, 다건·단일 리소스는 `PATCH /api/<resource>` |
| `<resource>.delete` | 단건은 `DELETE /api/<resource>/:id`, 다건·조건부·단일 리소스는 `DELETE /api/<resource>` |
| `<resource>.<action>` | `POST /api/<resource>/<action>` |
| 쓰기의 `?dryRun=true` | 동일 Operation을 core의 `dryRun`으로 실행 |

인증 예외는 로그인 `POST /api/session`과 최초 관리자 생성 `POST /api/admin`이다. 최초 생성 가능 여부는 core의 `admin.create`가 검증한다.

## 3. 테스트 계획 전에 정할 것

- 단일 리소스·단건·다건 입력을 매핑하는 규칙과 고유 액션 경로의 충돌 처리.
- 쿠키에서 얻은 토큰·검증 결과를 `admin.update`·`session.delete` 등 각 Operation 입력에 연결하는 방식.
- 미리보기 허용 여부를 검증하고 core 조회 입력으로 전달하는 방식.
- Next 요청 수명 안에서 이벤트 소비 작업을 실행하고 실패를 처리하는 방식. core는 구독자의 완료를 기다리지 않는다.

이 문서에서 HTTP 연결을 구현할 때 core에 별도 실행 규칙이나 사이트 전용 DB 조회를 복제하지 않는다.
