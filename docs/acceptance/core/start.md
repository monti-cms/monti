# `index.ts` 시작·마이그레이션 함수 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 2절(core가 하는 일), 5절(플러그인과 마이그레이션), 6.2절(스키마 변경과 마이그레이션), 8절(`index.ts`)의 인수 조건이다.

| 함수 / 객체 | 하는 일 | 주요 거절 |
|---|---|---|
| `startMonti` | DB를 변경하지 않고 스키마 검사·코어/플러그인 리소스 조립만 수행해 `monti`를 반환한다(`secret`은 `keys` 내부 격리, `admin`·`session`·`keys` 쓰기는 `onEvent` 미통지, 서버 전용 `monti.withStoredKey`는 명세에 없음) | 잘못된 스키마 `BAD_REQUEST`, 중복 플러그인 경로·엔진 기본 메서드 이름 `CONFLICT` |
| `migrateMonti` | 스키마 검사 → 코어(`"@monti-cms/core"`)·플러그인 내장 마이그레이션 순차 실행 → 개발 서버(`dev: true`)만 현재 DB 스키마의 컬렉션 테이블 동기화(동시 실행 안전) | 잘못된 스키마·예약 출처 플러그인 이름 `BAD_REQUEST`, 플러그인 이름 중복 `CONFLICT` |
| `monti.spec()` · `specOf` | DB 연결 유무와 무관하게 코어 전체 및 플러그인 Operation의 이름·종류·입력 JSON Schema 명세를 돌려준다 | 중복 플러그인 경로·엔진 기본 메서드 이름 `CONFLICT` |
| `migrate` · `coreMigrations` | 지정한 출처(`source`)의 마이그레이션 단계를 순서대로 실행해 `migrations` 테이블에 기록하고, 코어 내장 마이그레이션 목록(`coreMigrations`)을 공개한다 | 실패한 단계 롤백, 배열 내 중복 단계 이름 거절 |
| `snapshotOf` · `planSchemaDiff` | 스키마의 DB 테이블·열 스냅샷을 만들고, 이전 스냅샷과 새 스키마의 차이를 개발 서버 동기화와 동일한 PostgreSQL DDL 문장 목록으로 생성한다 | 잘못된 스키마·허용되지 않은 식별자의 이전 스냅샷 `BAD_REQUEST` |

---

## 1. DB 준비 (`migrateMonti`)와 엔진 조립 (`startMonti`)

### 핵심 요구사항

<details>
<summary><strong><code>START-1</code></strong> 코어와 플러그인의 내장 마이그레이션을 코어 먼저 실행한다</summary>

- **전제**: 비어 있는 DB와, 코어 테이블을 참조하는 테이블을 만드는 마이그레이션 단계를 가진 플러그인이 있다
- **행동**: 그 플러그인을 `config.plugins`에 넣고 `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-1.1` `migrations`에 `"@monti-cms/core"` 출처의 단계와 플러그인 이름 출처의 단계가 기록된다
  - `START-1.2` 플러그인 테이블이 만들어져 있다

</details>

<details>
<summary><strong><code>START-2</code></strong> `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다</summary>

- **전제**: 마이그레이션이 적용된 DB와 쓰기 Operation 하나를 가진 플러그인이 `config.plugins`에 있다
- **행동**: `startMonti`로 만든 `monti` 객체로 `folders.create`와 플러그인의 쓰기 Operation을 실행한다
- **결과**:
  - `START-2.1` `folders.create`가 폴더를 만든다
  - `START-2.2` 플러그인의 쓰기 Operation이 실행되어 결과가 반환된다

</details>

<details>
<summary><strong><code>START-4</code></strong> 플러그인의 키 서비스가 `keys.check`에 연결된다</summary>

- **전제**: 확인 함수를 가진 키 서비스를 등록한 플러그인이 `config.plugins`에 있다
- **행동**: `startMonti`로 만든 엔진으로 그 서비스 이름과 비밀값으로 `keys.check`를 실행한다
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
<summary><strong><code>START-6</code></strong> 개발 서버에서 DB를 준비하면 스키마에 정의된 컬렉션 테이블도 함께 만든다</summary>

- **전제**: 비어 있는 DB와 `posts` 컬렉션이 정의된 스키마, `config.dev: true` 설정이 있다
- **행동**: `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-6.1` DB에 `posts`와 `posts_data` 테이블이 만들어져 있다

</details>

<details>
<summary><strong><code>START-7</code></strong> 운영 서버에서 DB를 준비하면 등록된 마이그레이션만 실행하고 컬렉션 테이블은 자동으로 만들지 않는다</summary>

- **전제**: 비어 있는 DB와 `posts` 컬렉션이 정의된 스키마, `config.dev: false` 설정이 있다
- **행동**: `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-7.1` DB에 `migrations` 테이블은 있고 `posts`와 `posts_data` 테이블은 없다

</details>

<details>
<summary><strong><code>START-14</code></strong> 엔진 조립만 호출하면 개발 설정이어도 DB 테이블을 만들거나 바꾸지 않는다</summary>

- **전제**: 비어 있는 DB와 `posts` 컬렉션이 정의된 스키마, `config.dev: true` 설정이 있다
- **행동**: `startMonti({ db, schema, config, schemaFile, configFile })`를 실행한다
- **결과**:
  - `START-14.1` DB에 `migrations` 테이블이 없다
  - `START-14.2` DB에 `posts` 테이블이 없다

</details>

<details>
<summary><strong><code>START-8</code></strong> 관리자·세션·키 리소스의 쓰기는 이벤트 구독자에게 통지하지 않는다</summary>

- **전제**: 마이그레이션이 적용된 DB에서 `startMonti`로 시작해 `onEvent` 구독자가 등록되어 있고 암호화 비밀값(`secret`)이 설정되어 있다
- **행동**: `admin.create`, `session.create`, `keys.create`를 실행한다
- **결과**:
  - `START-8.1` `onEvent` 구독자가 한 번도 호출되지 않는다

</details>

<details>
<summary><strong><code>START-9</code></strong> DB 연결 없이도 코어와 플러그인의 Operation 명세를 얻을 수 있다</summary>

- **전제**: 쓰기 Operation 하나를 가진 플러그인이 있다
- **행동**: `specOf([plugin])`을 호출한다
- **결과**:
  - `START-9.1` 반환값에 `core.md` 7절의 코어 Operation 전체와 플러그인 Operation이 모두 포함된다
  - `START-9.2` 같은 플러그인으로 `startMonti`해 호출한 `monti.spec()`과 반환값이 같다

</details>

<details>
<summary><strong><code>START-10</code></strong> 공개 마이그레이션 실행기로 프로젝트 출처의 마이그레이션 단계를 실행할 수 있다</summary>

- **전제**: 코어 마이그레이션이 적용된 DB와, 테이블을 만드는 마이그레이션 단계 하나가 있다
- **행동**: 공개 출구에서 불러온 `migrate(db, "project", [step])`을 실행한다
- **결과**:
  - `START-10.1` 단계가 만든 테이블이 DB에 존재한다
  - `START-10.2` `migrations` 테이블에 `("project", step.name)`이 기록된다

</details>

<details>
<summary><strong><code>START-13</code></strong> 공개된 코어 내장 마이그레이션 목록을 단일 롤백 트랜잭션으로 시험 실행하면 DB에 변경을 남기지 않는다</summary>

- **전제**: 비어 있는 DB가 있다
- **행동**: 단일 트랜잭션을 열어 `coreMigrations`의 각 `up(tx)`을 순서대로 실행하고 롤백한다
- **결과**:
  - `START-13.1` 트랜잭션 안에서 코어 고정 테이블(`folders`)이 생성되어 조회할 수 있다
  - `START-13.2` 롤백 후 DB에 `folders`와 `migrations` 테이블이 모두 없다

</details>

<details>
<summary><strong><code>START-11</code></strong> 빈 스냅샷과 새 스키마의 차이를 SQL로 생성해 적용하면 개발 서버 동기화와 같은 테이블과 열이 만들어진다</summary>

- **전제**: 코어 마이그레이션만 적용된 DB와 `body: true`, 단건·다건 `media`·`relation`, `conditional` 필드를 가진 컬렉션 스키마가 있다
- **행동**: 빈 스냅샷(`snapshotOf({ locales: ["ko"], collections: {} })`)과 해당 스키마로 `planSchemaDiff`를 호출해 얻은 SQL을 DB에 실행한다
- **결과**:
  - `START-11.1` `<collection>`, `<collection>_data`, `<collection>_rels` 테이블과 모든 필드 열·외래 키가 생성된다
  - `START-11.2` `snapshotOf(schema)`와 같은 스키마로 다시 `planSchemaDiff`를 호출하면 빈 배열 `[]`을 돌려준다

</details>

<details>
<summary><strong><code>START-12</code></strong> 스키마 변경 SQL은 열 추가·타입 변환·외래 키 대상 교체·열 삭제·컬렉션 삭제를 실제 DB에서 정상 실행한다</summary>

- **전제**: `authors`·`members`·`legacy` 컬렉션과 `posts` 컬렉션(`number` `code`, 단건 `select` `category`, `authors`를 가리키는 단건 `relation` `author`와 `writer`, `old_col`)에 데이터가 저장된 DB와 그 직전 스냅샷이 있다
- **행동**: `legacy` 컬렉션을 제거하고, `posts`에서 `code`를 `text`로, `category`를 다건 `select`로, `author`를 `text`로, `writer`의 `to`를 `members`로 바꾸고 `old_col`을 삭제·`new_col`을 추가한 스키마로 `planSchemaDiff` SQL을 생성해 DB에 실행한다
- **결과**:
  - `START-12.1` `legacy` 컬렉션 테이블들이 삭제되고 `posts_data`에 `new_col`이 추가·`old_col`이 삭제된다
  - `START-12.2` `code`는 문자열로, `category`는 1개짜리 배열(`text[]`)로 기존 값이 유지된다
  - `START-12.3` `author`는 외래 키 없이 `text` 열로, `writer`는 `members(id)` 외래 키 열로 바뀌며 기존 값은 `null`로 비워진다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>START-3</code></strong> 스키마에 지원하지 않는 필드 종류가 들어 있으면 마이그레이션 전에 거절한다</summary>

- **전제**: 비어 있는 DB와, 정의된 8종 밖의 `type`을 가진 필드가 있는 스키마가 있다
- **행동**: `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-3.1` `BAD_REQUEST` 오류를 던진다
  - `START-3.2` `migrations` 테이블이 없다

</details>

<details>
<summary><strong><code>START-15</code></strong> 개발 서버를 동시에 두 번 띄워도 컬렉션 테이블 준비가 둘 다 성공한다</summary>

- **전제**: 비어 있는 DB, `posts` 컬렉션이 정의된 스키마, `config.dev: true` 설정이 있다
- **행동**: 같은 DB로 `migrateMonti({ db, schema, config })`를 동시에 두 번 실행한다
- **결과**:
  - `START-15.1` 두 호출 모두 오류 없이 끝난다
  - `START-15.2` DB에 `posts`와 `posts_data` 테이블이 만들어져 있다

</details>

<details>
<summary><strong><code>START-16</code></strong> 이름이 같은 플러그인이 둘 이상 있으면 마이그레이션을 시작할 수 없다</summary>

- **전제**: 비어 있는 DB와, 같은 `name`을 가진 플러그인 둘이 들어 있는 설정이 있다
- **행동**: `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-16.1` `CONFLICT` 오류를 던진다
  - `START-16.2` DB에 `migrations` 테이블이 만들어지지 않는다

</details>

<details>
<summary><strong><code>START-17</code></strong> 예약된 출처 이름의 플러그인으로는 마이그레이션을 시작할 수 없다</summary>

- **전제**: 비어 있는 DB와, 이름이 `"@monti-cms/core"`인 플러그인이 들어 있는 설정, 이름이 `"project"`인 플러그인이 들어 있는 설정이 각각 있다
- **행동**: 각 설정으로 `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-17.1` 두 호출 모두 `BAD_REQUEST` 오류를 던진다
  - `START-17.2` DB에 `migrations` 테이블이 만들어지지 않는다

</details>

<details>
<summary><strong><code>START-18</code></strong> 허용되지 않은 식별자가 들어 있는 이전 스냅샷으로는 스키마 변경 SQL을 만들 수 없다</summary>

- **전제**: 컬렉션 키나 열 이름에 `"`, `.`, 빈 문자열이 들어 있거나 63바이트를 넘는 이전 스냅샷이 있다(조건부 열의 `__`는 허용)
- **행동**: 그 이전 스냅샷과 정상 새 스키마로 `planSchemaDiff`를 호출한다
- **결과**:
  - `START-18.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>START-19</code></strong> 기본 DB 스키마가 `public`이 아니어도 개발 서버 동기화가 같은 스키마에서 동작한다</summary>

- **전제**: `app` 스키마가 존재하고 연결의 `search_path`가 `app`으로 설정되어 있으며, `posts` 컬렉션이 `app`에 이미 적용된 DB와 `posts`에 새 필드를 추가한 스키마, `config.dev: true` 설정이 있다
- **행동**: `migrateMonti({ db, schema, config })`를 실행한다
- **결과**:
  - `START-19.1` `app.posts_data` 테이블에 새 필드 열이 추가된다
  - `START-19.2` `public` 스키마에는 `posts` 테이블이 만들어지지 않는다

</details>

<details>
<summary><strong><code>START-20</code></strong> DB 없이 명세를 만들 때도 엔진 기본 메서드 이름을 플러그인 리소스 이름으로 쓸 수 없다</summary>

- **전제**: 리소스 이름이 `spec`인 Operation을 가진 플러그인이 있다
- **행동**: `specOf([plugin])`을 호출한다
- **결과**:
  - `START-20.1` `CONFLICT` 오류를 던진다

</details>

<details>
<summary><strong><code>START-21</code></strong> `startMonti`로 만든 `monti`의 `withStoredKey`로 저장된 키의 원문을 받아 쓴다</summary>

- **전제**: 암호화 비밀값(`secret`)을 주고 `startMonti`로 만든 `monti`로 `keys.create`를 실행해 저장한 키가 하나 있다
- **행동**: 그 키의 `id`와 `service`로 `monti.withStoredKey`를 호출한다
- **결과**:
  - `START-21.1` 콜백이 저장할 때 넣은 비밀값 원문을 받는다

</details>

<details>
<summary><strong><code>START-22</code></strong> 플러그인 리소스 이름으로 `withStoredKey`를 쓸 수 없다</summary>

- **전제**: 리소스 이름이 `withStoredKey`인 Operation을 가진 플러그인이 `config.plugins`에 있다
- **행동**: `startMonti`를 호출한다
- **결과**:
  - `START-22.1` `CONFLICT` 오류를 던진다

</details>
