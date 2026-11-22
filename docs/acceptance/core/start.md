# `index.ts` 시작 함수 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 2절(core가 하는 일), 5절(플러그인과 마이그레이션), 6.2절(스키마 변경과 마이그레이션), 8절(`index.ts`)의 인수 조건이다.

| 함수 / 객체 | 하는 일 | 주요 거절 |
|---|---|---|
| `startMonti` | 스키마 검사 → 코어·플러그인 마이그레이션 순차 실행 → 개발 서버(`dev: true`)만 컬렉션 테이블 동기화 → `monti` 반환(`secret`은 `keys` 내부 격리, `admin`·`session`·`keys` 쓰기는 `onEvent` 미통지) | 잘못된 스키마는 마이그레이션 전 `BAD_REQUEST` |
| `monti.spec()` | 코어 전체 및 플러그인 Operation의 이름·종류·입력 JSON Schema 명세를 돌려준다 | 없음 |

---

## 1. 시작 (`startMonti`)

### 핵심 요구사항

<details>
<summary><strong><code>START-1</code></strong> 시작하면 코어와 플러그인의 마이그레이션을 코어 먼저 실행한다</summary>

- **전제**: 비어 있는 DB와, 코어 테이블을 참조하는 테이블을 만드는 마이그레이션 단계를 가진 플러그인이 있다
- **행동**: 그 플러그인을 `config.plugins`에 넣고 `startMonti({ db, schema, config, schemaFile, configFile })`를 실행한다
- **결과**:
  - `START-1.1` `migrations`에 `"core"` 범위의 단계와 플러그인 이름 범위의 단계가 기록된다
  - `START-1.2` 플러그인 테이블이 만들어져 있다

</details>

<details>
<summary><strong><code>START-2</code></strong> `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다</summary>

- **전제**: 쓰기 Operation 하나를 가진 플러그인이 `config.plugins`에 있다
- **행동**: `startMonti`로 만든 `monti` 객체로 `folders.create`와 플러그인의 쓰기 Operation을 실행한다
- **결과**:
  - `START-2.1` `folders.create`가 폴더를 만든다
  - `START-2.2` 플러그인의 쓰기 Operation이 실행되어 결과가 반환된다

</details>

<details>
<summary><strong><code>START-4</code></strong> 플러그인의 키 서비스가 `keys.check`에 연결된다</summary>

- **전제**: 확인 함수를 가진 키 서비스를 등록한 플러그인이 `config.plugins`에 있다
- **행동**: `startMonti`로 시작해 그 서비스 이름과 비밀값으로 `keys.check`를 실행한다
- **결과**:
  - `START-4.1` 플러그인의 확인 함수가 그 비밀값으로 호출된다

</details>

<details>
<summary><strong><code>START-5</code></strong> `monti` 객체의 명세에 코어의 모든 Operation이 들어 있다</summary>

- **전제**: 플러그인 없이 `startMonti`로 만든 `monti` 객체가 있다
- **행동**: 그 `monti` 객체로 `monti.spec()`을 실행한다
- **결과**:
  - `START-5.1` 명세의 이름이 `core.md` 7절 표의 `리소스.동작` 전체와 같다

</details>

<details>
<summary><strong><code>START-6</code></strong> 개발 서버로 시작하면 스키마에 정의된 컬렉션 테이블을 DB에 준비한다</summary>

- **전제**: 비어 있는 DB와 `posts` 컬렉션이 정의된 스키마, `config.dev: true` 설정이 있다
- **행동**: `startMonti`를 실행한다
- **결과**:
  - `START-6.1` DB에 `posts`와 `posts_data` 테이블이 만들어져 있다

</details>

<details>
<summary><strong><code>START-7</code></strong> 운영 서버로 시작하면 등록된 마이그레이션만 실행하고 컬렉션 테이블은 자동으로 만들지 않는다</summary>

- **전제**: 비어 있는 DB와 `posts` 컬렉션이 정의된 스키마, `config.dev: false` 설정이 있다
- **행동**: `startMonti`를 실행한다
- **결과**:
  - `START-7.1` DB에 `migrations` 테이블은 있고 `posts`와 `posts_data` 테이블은 없다

</details>

<details>
<summary><strong><code>START-8</code></strong> 관리자·세션·키 리소스의 쓰기는 이벤트 구독자에게 통지하지 않는다</summary>

- **전제**: `startMonti`로 시작해 `onEvent` 구독자가 등록되어 있고 암호화 비밀값(`secret`)이 설정되어 있다
- **행동**: `admin.create`, `session.create`, `keys.create`를 실행한다
- **결과**:
  - `START-8.1` `onEvent` 구독자가 한 번도 호출되지 않는다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>START-3</code></strong> 스키마에 지원하지 않는 필드 종류가 들어 있으면 마이그레이션 전에 시작을 거절한다</summary>

- **전제**: 비어 있는 DB와, 정의된 8종 밖의 `type`을 가진 필드가 있는 스키마가 있다
- **행동**: `startMonti`를 실행한다
- **결과**:
  - `START-3.1` `BAD_REQUEST` 오류를 던진다
  - `START-3.2` `migrations` 테이블이 없다

</details>
