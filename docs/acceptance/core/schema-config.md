# `resources/schema/` · `resources/config/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`ReadContext`, `WriteContext`, `MontiConfig`), 4절(컨텍스트와 설정), 6.1~6.2절(컬렉션 테이블과 8종 필드 매핑, 스키마 변경), 7절(`schema`, `config` 리소스), 8절(`state.ts`, `schema-file.ts`, `config-file.ts`)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `schema.get` | 현재 스키마(`ctx.schema`)의 독립 사본을 돌려준다 | 없음 |
| `schema.update` | 개발 서버(`dev: true`)에서 스키마·컬렉션 테이블·열·타입 변환·미디어 사용처를 동기화하고 파일에 반영한다(동시 저장 안전, 롤백·`dryRun`·파일 쓰기 실패 시 원복) | 운영 서버 `FORBIDDEN`, 미지원 필드·빈 키·예약어·금지 기호(`"`,`.`,`__`)·63바이트 초과·없는 `relation.to` `BAD_REQUEST` |
| `config.get` | 현재 사이트 설정(`ctx.config`)의 독립 사본을 돌려준다 | 없음 |
| `config.update` | 개발 서버에서 사이트 `name`을 변경하고 `monti.config.ts`의 사이트 이름 자리만 기록한다(동시 저장 안전, 롤백·`dryRun` 시 원복) | 운영 서버 `FORBIDDEN`, 빈 `name`·글자 그대로 적히지 않은 사이트 이름 `BAD_REQUEST` |

---

## 1. 스키마 조회 (`schema.get`)

### 핵심 요구사항

<details>
<summary><strong><code>SCH-GET-1</code></strong> 현재 스키마를 돌려준다</summary>

- **전제**: 초기 스키마로 엔진이 생성되어 있다
- **행동**: `schema.get`을 실행한다
- **결과**:
  - `SCH-GET-1.1` 현재 스키마를 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>SCH-GET-2</code></strong> 조회해서 받은 스키마 객체를 밖에서 고쳐도 엔진의 현재 스키마는 바뀌지 않는다</summary>

- **전제**: 컬렉션 하나가 있는 초기 스키마로 엔진이 생성되어 있고, 앞서 `schema.get`이 돌려준 객체의 `locales`와 `collections`를 밖에서 수정해 두었다
- **행동**: `schema.get`을 다시 실행한다
- **결과**:
  - `SCH-GET-2.1` 반환값이 원래 초기 스키마 그대로이다

</details>

## 2. 스키마 수정 (`schema.update`)

### 핵심 요구사항

<details>
<summary><strong><code>SCH-UPD-1</code></strong> 개발 서버에서 스키마를 바꾸면 현재 스키마와 스키마 파일에 새 스키마가 기록된다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 새 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-1.1` 반환값이 새 스키마이다
  - `SCH-UPD-1.2` `schema.get`을 실행하면 새 스키마를 돌려준다
  - `SCH-UPD-1.3` 스키마 파일에서 읽은 값이 새 스키마이다

</details>

<details>
<summary><strong><code>SCH-UPD-2</code></strong> 컬렉션을 추가하면 글 기본 테이블과 글자·숫자·참거짓·날짜·선택지 열을 가진 데이터 테이블이 만들어진다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마에 컬렉션이 없다
- **행동**: `body: true`와 `text`, `number`, `boolean`, `date`, 단건·다건 `select` 필드를 가진 `posts` 컬렉션과, `body`가 없는 `notes` 컬렉션 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-2.1` `posts` 테이블에 `id`, `source_locale`, `folder_id`, `trashed_at` 열이 있다
  - `SCH-UPD-2.2` `posts_data` 테이블에 `entry_id`, `locale`, `status`, `slug`, `published_at`, `translation_seen`, `body`와 각 필드 열이 있다
  - `SCH-UPD-2.3` `notes_data` 테이블에는 `body` 열이 없다

</details>

<details>
<summary><strong><code>SCH-UPD-3</code></strong> 하나를 고르는 미디어·관계 필드는 데이터 테이블의 외래 키 열로 만들어진다</summary>

- **전제**: `config.dev`가 `true`이고 `authors` 컬렉션이 있는 스키마가 적용되어 있다
- **행동**: 단건 `media` 필드(`cover`)와 `authors`를 가리키는 단건 `relation` 필드(`author`)를 가진 `posts` 컬렉션 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-3.1` `posts_data` 테이블에 `media(id)`를 참조하는 `cover` 열이 있다
  - `SCH-UPD-3.2` `posts_data` 테이블에 `authors(id)`를 참조하는 `author` 열이 있다

</details>

<details>
<summary><strong><code>SCH-UPD-4</code></strong> 여러 개를 고르는 미디어·관계 필드는 순서를 저장하는 연결 테이블로 만들어지고 데이터 테이블에는 열을 만들지 않는다</summary>

- **전제**: `config.dev`가 `true`이고 `authors`·`tags` 컬렉션이 있는 스키마가 적용되어 있다
- **행동**: `authors`를 가리키는 단건 `relation` 필드(`author`)와 `many: true`인 `media` 필드(`gallery`), `tags`를 가리키는 `many: true`인 `relation` 필드(`tags`)를 가진 `posts` 컬렉션 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-4.1` `posts_rels` 테이블에 `entry_id`, `locale`, `status`, `path`, `position`, `media_id`, `tags_id` 열만 있고 `authors_id` 열은 없다
  - `SCH-UPD-4.2` `posts_data` 테이블에 `gallery`와 `tags` 열은 없다

</details>

<details>
<summary><strong><code>SCH-UPD-5</code></strong> 조건부 필드는 선택한 분기 열과 각 분기의 하위 입력칸 열·연결 테이블로 펼쳐져 만들어진다</summary>

- **전제**: `config.dev`가 `true`이고 `tags` 컬렉션이 있는 스키마가 적용되어 있다
- **행동**: `yes` 분기에 숫자 하위 필드(`price`)와 `tags`를 가리키는 다건 `relation` 하위 필드(`badges`)를 가진 `conditional` 필드(`discount`)가 있는 `products` 컬렉션 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-5.1` `products_data` 테이블에 선택한 분기를 담는 `discount` 열이 있다
  - `SCH-UPD-5.2` `products_data` 테이블에 하위 필드 값을 담는 `discount__yes__price` 열이 있다
  - `SCH-UPD-5.3` `products_rels` 테이블에 `tags_id` 열이 있다

</details>

<details>
<summary><strong><code>SCH-UPD-6</code></strong> 컬렉션에 필드를 새로 넣으면 열이 추가되고 기존 필드를 빼면 열이 삭제되며 바꾸지 않은 필드의 값은 유지된다</summary>

- **전제**: `config.dev`가 `true`이고 `keep_field`와 `old_field` 열에 값이 저장된 글이 있는 `posts` 컬렉션이 적용되어 있다
- **행동**: `posts`에서 `keep_field`는 유지하고 `old_field`를 빼고 `new_field`를 추가한 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-6.1` `posts_data` 테이블에 `new_field` 열이 있다
  - `SCH-UPD-6.2` `posts_data` 테이블에 `old_field` 열이 없다
  - `SCH-UPD-6.3` `posts_data` 테이블에서 기존 글의 `keep_field` 값이 원래 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-7</code></strong> 필드의 종류나 관계 대상을 바꾸면 데이터 테이블의 열도 새 종류로 바뀌고 변환 가능한 값은 유지되며 호환되지 않는 값은 비워진다</summary>

- **전제**: `config.dev`가 `true`이고 `authors`·`members` 컬렉션과, 숫자 `code`, 참거짓 `flag`, 참거짓 `active`, 날짜 `event_at`, 단건 `select` `category`, 다건 `select` `labels`, 글자 `score`·`note`(`score`는 숫자 모양 문자열, `note`는 일반 문자열), `authors`를 가리키는 단건 `relation` `owner`에 값이 저장된 글이 있는 `posts` 컬렉션이 적용되어 있다
- **행동**: `code`·`active`·`event_at`을 글자(`text`)로, `flag`를 숫자(`number`)로, `category`를 다건 `select`로, `labels`를 단건 `select`로, `score`와 `note`를 숫자(`number`)로, `owner`의 `to`를 `members`로 바꾼 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-7.1` `posts_data` 테이블에서 `code`, `active`, `event_at` 열의 데이터 타입이 `text`이고 기존 값이 문자열로 유지된다
  - `SCH-UPD-7.2` `posts_data` 테이블에서 `flag` 열의 데이터 타입이 `double precision`이고 기존 값이 `null`로 비워진다
  - `SCH-UPD-7.3` `posts_data` 테이블에서 `category` 열의 데이터 타입이 `text[]`이고 기존 단건 선택 값이 1개짜리 배열로 유지되며, `labels` 열의 데이터 타입은 `text`이고 기존 배열의 첫 번째 원소가 남는다
  - `SCH-UPD-7.4` `posts_data` 테이블에서 `score` 열은 숫자로 변환된 값이 저장되고 `note`와 `owner` 열은 `null`로 비워진다

</details>

<details>
<summary><strong><code>SCH-UPD-8</code></strong> 스키마에서 컬렉션을 지우면 그 컬렉션의 테이블들이 모두 삭제된다</summary>

- **전제**: `config.dev`가 `true`이고 `posts` 컬렉션이 적용되어 `posts`, `posts_data`, `posts_rels` 테이블이 있으며, 미디어 필드에 미디어를 넣은 `posts` 글이 있다
- **행동**: `posts` 컬렉션을 제거한 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-8.1` DB에 `posts`, `posts_data`, `posts_rels` 테이블이 없다
  - `SCH-UPD-8.2` 그 미디어의 `media.get` 결과 `uses`에 지운 컬렉션의 글이 없다

</details>

<details>
<summary><strong><code>SCH-UPD-17</code></strong> 값이 들어 있는 다건 관계 필드의 대상을 바꿔도 기존 글을 정상적으로 읽고 수정·발행할 수 있다</summary>

- **전제**: `config.dev`가 `true`이고 `authors`·`members` 컬렉션과 `authors`를 가리키는 다건 `relation` 필드(`contributors`)에 값이 저장된 글이 있는 `posts` 컬렉션이 적용되어 있다
- **행동**: `contributors`의 `to`를 `members`로 바꾼 스키마로 `schema.update`를 실행한 뒤 기존 글을 조회·수정·발행한다
- **결과**:
  - `SCH-UPD-17.1` 기존 글 조회 결과에서 `contributors` 필드가 비어 있다
  - `SCH-UPD-17.2` 기존 글의 다른 필드를 수정하고 발행할 수 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>SCH-UPD-9</code></strong> 개발 서버가 아니면 스키마를 수정할 수 없다</summary>

- **전제**: `config.dev`가 `false`이고 초기 스키마 파일이 있다
- **행동**: 새 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-9.1` `FORBIDDEN` 오류를 던진다
  - `SCH-UPD-9.2` `schema.get`을 실행하면 원래 스키마 그대로이다
  - `SCH-UPD-9.3` 스키마 파일에서 읽은 값이 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-10</code></strong> 트랜잭션이 실패해 롤백되면 DB 테이블과 스키마 파일은 원래대로 유지된다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: `transaction` 안에서 새 컬렉션이 추가된 스키마로 `schema.update`를 실행한 뒤 오류를 던져 롤백시킨다
- **결과**:
  - `SCH-UPD-10.1` 롤백된 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
  - `SCH-UPD-10.2` 스키마 파일에서 읽은 값이 원래 스키마 그대로이다
  - `SCH-UPD-10.3` DB에 새 컬렉션의 테이블이 없다

</details>

<details>
<summary><strong><code>SCH-UPD-11</code></strong> 드라이런으로 실행하면 DB 테이블과 스키마 파일은 원래대로 유지된다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: `dryRun` 안에서 새 컬렉션이 추가된 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-11.1` `dryRun`이 끝난 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
  - `SCH-UPD-11.2` 스키마 파일에서 읽은 값이 원래 스키마 그대로이다
  - `SCH-UPD-11.3` DB에 새 컬렉션의 테이블이 없다

</details>

<details>
<summary><strong><code>SCH-UPD-12</code></strong> 지원하지 않는 필드 종류가 들어 있으면 스키마를 수정할 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 정의된 8종이 아닌 `type`을 가진 필드가 포함된 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-12.1` `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-12.2` `schema.get`을 실행하면 원래 스키마 그대로이다
  - `SCH-UPD-12.3` 스키마 파일에서 읽은 값이 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-13</code></strong> 코어 기본 테이블 이름이나 `_data`·`_rels`로 끝나는 이름은 컬렉션 이름으로 쓸 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 예약어(`media` 또는 `posts_data`)를 컬렉션 키로 가진 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-13.1` `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-13.2` `schema.get`을 실행하면 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-14</code></strong> 데이터 테이블의 고정 열 이름은 컬렉션의 필드 이름으로 쓸 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 고정 열 이름(`status` 또는 `slug`)을 필드 키로 가진 컬렉션 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-14.1` `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-14.2` `schema.get`을 실행하면 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-15</code></strong> 키나 만들어질 테이블·열 이름이 63바이트를 넘거나 금지된 기호가 들어 있으면 스키마를 저장할 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 63바이트를 넘는 키·조건부 하위 열 이름, 또는 `"`, `.`, `__`가 들어간 키를 가진 컬렉션 스키마와 정확히 63바이트인 이름의 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-15.1` 63바이트를 넘거나 금지된 기호가 들어간 스키마는 `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-15.2` 정확히 63바이트인 이름의 스키마는 정상 저장된다
  - `SCH-UPD-15.3` 거절된 뒤 `schema.get`을 실행하면 직전에 저장된 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-16</code></strong> 관계 필드가 스키마에 없는 컬렉션을 가리키면 스키마를 저장할 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 올바른 `relation` 필드와 함께 스키마의 `collections`에 없는 이름(예: `"folders"` 또는 존재하지 않는 키)을 `to`로 가진 `relation` 필드가 포함된 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-16.1` `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-16.2` `schema.get`을 실행하면 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-18</code></strong> 개발 서버에서 서로 다른 스키마를 동시에 저장해도 DB와 스키마 파일, 조회 결과가 하나의 스키마로 일치한다</summary>

- **전제**: `config.dev`가 `true`이고 `posts` 컬렉션이 있는 초기 스키마 파일이 있으며, 제목 필드를 더한 스키마와 요약 필드를 더한 스키마가 준비되어 있다
- **행동**: 같은 엔진에서 제목 필드를 더한 스키마와 요약 필드를 더한 스키마로 `schema.update`를 동시에 실행한다
- **결과**:
  - `SCH-UPD-18.1` 두 호출 모두 오류 없이 끝난다
  - `SCH-UPD-18.2` `schema.get`의 결과가 제목 필드를 더한 스키마 또는 요약 필드를 더한 스키마 중 하나와 같다
  - `SCH-UPD-18.3` 스키마 파일에서 읽은 값이 `schema.get`과 같다
  - `SCH-UPD-18.4` `posts_data` 테이블의 사용자 열 목록이 `schema.get`의 `posts` 필드와 같다

</details>

<details>
<summary><strong><code>SCH-UPD-19</code></strong> 이름이 빈 컬렉션이나 필드는 스키마에 넣을 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 스키마 파일이 있다
- **행동**: 컬렉션 키나 필드 키 하나가 빈 문자열 `""`인 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-19.1` `BAD_REQUEST` 오류를 던진다
  - `SCH-UPD-19.2` `schema.get`이 원래 스키마 그대로이다
  - `SCH-UPD-19.3` 스키마 파일에서 읽은 값이 원래 스키마 그대로이다

</details>

<details>
<summary><strong><code>SCH-UPD-20</code></strong> 여러 미디어를 고르는 필드를 지우면 그 필드의 연결만 정리된다</summary>

- **전제**: `config.dev`가 `true`이고 `storage`가 설정되어 있으며, `media`를 가리키는 다건 필드 `gallery`와 `cover`를 가진 `posts` 컬렉션에 같은 미디어가 두 필드 모두에 연결된 글이 저장되어 있다
- **행동**: `posts`에서 `gallery`만 제거하고 `cover`는 남긴 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-20.1` `posts_rels` 테이블에 경로 `gallery`의 행은 없고 `cover`의 행은 남아 있다
  - `SCH-UPD-20.2` `media.get`의 `uses`에서 `gallery` 경로는 사라지고 `cover` 경로는 남아 있다

</details>

<details>
<summary><strong><code>SCH-UPD-21</code></strong> 스키마 파일에 쓸 수 없으면 DB 테이블과 현재 스키마를 바꾸지 않고 실패한다</summary>

- **전제**: `config.dev`가 `true`이고 정상 초기 스키마 파일로 엔진이 생성된 뒤, 해당 스키마 파일 경로가 쓸 수 없는 상태(예: 쓰기 권한 제거 또는 디렉터리로 교체)가 되었다
- **행동**: 새 컬렉션 `posts`를 추가한 스키마로 `schema.update`를 실행한다
- **결과**:
  - `SCH-UPD-21.1` 오류가 던져진다
  - `SCH-UPD-21.2` `schema.get`이 원래 스키마 그대로이다
  - `SCH-UPD-21.3` DB에 `posts` 테이블이 없다

</details>

## 3. 설정 조회 (`config.get`)

### 핵심 요구사항

<details>
<summary><strong><code>CFG-GET-1</code></strong> 현재 사이트 설정을 돌려준다</summary>

- **전제**: 초기 설정으로 엔진이 생성되어 있다
- **행동**: `config.get`을 실행한다
- **결과**:
  - `CFG-GET-1.1` 현재 사이트 설정을 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CFG-GET-2</code></strong> 조회해서 받은 설정을 고쳐도 운영 서버가 개발 모드로 바뀌지 않는다</summary>

- **전제**: `config.dev`가 `false`인 설정으로 엔진이 생성되어 있고, 앞서 `config.get`이 돌려준 객체의 `dev`를 `true`로 바꿔 두었다
- **행동**: 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-GET-2.1` `FORBIDDEN` 오류를 던진다
  - `CFG-GET-2.2` 다시 `config.get`을 실행하면 `dev`가 `false` 그대로이다

</details>

## 4. 설정 수정 (`config.update`)

### 핵심 요구사항

<details>
<summary><strong><code>CFG-UPD-1</code></strong> 개발 서버에서 사이트 이름을 바꾸고 설정 파일에 기록한다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-1.1` 반환값의 `name`이 새 `name`이다
  - `CFG-UPD-1.2` `config.get`을 실행하면 `name`만 새 `name`으로 바뀐 설정을 돌려준다
  - `CFG-UPD-1.3` 설정 파일의 `name`이 새 `name`으로 바뀐다
  - `CFG-UPD-1.4` 설정 파일에서 `name`을 제외한 나머지 내용은 그대로이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CFG-UPD-2</code></strong> 개발 서버가 아니면 사이트 설정을 수정할 수 없다</summary>

- **전제**: `config.dev`가 `false`이고 초기 설정 파일이 있다
- **행동**: 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-2.1` `FORBIDDEN` 오류를 던진다
  - `CFG-UPD-2.2` `config.get`을 실행하면 원래 설정 그대로이다
  - `CFG-UPD-2.3` 설정 파일의 내용은 원래 그대로이다

</details>

<details>
<summary><strong><code>CFG-UPD-3</code></strong> 트랜잭션이 실패해 롤백되면 설정과 설정 파일은 바뀌지 않는다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: `transaction` 안에서 새 `name`으로 `config.update`를 실행한 뒤 오류를 던져 롤백시킨다
- **결과**:
  - `CFG-UPD-3.1` 롤백된 뒤 `config.get`을 실행하면 원래 설정 그대로이다
  - `CFG-UPD-3.2` 설정 파일의 내용은 원래 그대로이다

</details>

<details>
<summary><strong><code>CFG-UPD-4</code></strong> 드라이런으로 실행하면 설정과 설정 파일은 바뀌지 않는다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: `dryRun` 안에서 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-4.1` `dryRun`이 끝난 뒤 `config.get`을 실행하면 원래 설정 그대로이다
  - `CFG-UPD-4.2` 설정 파일의 내용은 원래 그대로이다

</details>

<details>
<summary><strong><code>CFG-UPD-5</code></strong> 큰따옴표가 들어간 사이트 이름으로 바꾼 뒤 다시 이름을 바꿔도 설정 파일이 깨지지 않는다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: 큰따옴표(`"`)가 포함된 `name`으로 `config.update`를 실행한 뒤 다시 일반 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-5.1` 설정 파일의 `name`이 마지막에 전달한 `name`으로 깔끔하게 기록되고 이전 이름의 조각이 남지 않는다

</details>

<details>
<summary><strong><code>CFG-UPD-6</code></strong> 사이트 이름을 빈 문자열로 바꿀 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: 빈 문자열 `name: ""`로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-6.1` `BAD_REQUEST` 오류를 던진다
  - `CFG-UPD-6.2` `config.get`을 실행하면 원래 설정 그대로이다

</details>

<details>
<summary><strong><code>CFG-UPD-7</code></strong> 사이트 이름을 바꿔도 플러그인 이름은 그대로다</summary>

- **전제**: `config.dev`가 `true`이고, 플러그인 객체의 `name`이 사이트 `name`보다 앞에 적힌 설정 파일이 있다
- **행동**: 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-7.1` 설정 파일의 플러그인 `name`은 원래 그대로이다
  - `CFG-UPD-7.2` 설정 파일의 사이트 `name`이 새 이름으로 바뀐다

</details>

<details>
<summary><strong><code>CFG-UPD-8</code></strong> 개발 서버에서 사이트 이름을 동시에 두 번 바꿔도 설정 파일이 깨지지 않고 조회 결과와 일치한다</summary>

- **전제**: `config.dev`가 `true`이고 초기 설정 파일이 있다
- **행동**: 같은 엔진에서 `"가 사이트"`와 `"나 사이트"`로 `config.update`를 동시에 실행한다
- **결과**:
  - `CFG-UPD-8.1` 두 호출 모두 오류 없이 끝난다
  - `CFG-UPD-8.2` `config.get`의 `name`은 `"가 사이트"` 또는 `"나 사이트"` 중 하나이다
  - `CFG-UPD-8.3` 설정 파일의 사이트 `name`이 `config.get`의 `name`과 같고 파일 나머지 내용은 깨지지 않는다

</details>

<details>
<summary><strong><code>CFG-UPD-9</code></strong> 설정 파일에 사이트 이름이 글자 그대로 적혀 있지 않으면 이름을 바꿀 수 없다</summary>

- **전제**: `config.dev`가 `true`이고 사이트 `name`이 문자열 리터럴이 아닌 변수 참조로 적힌 설정 파일이 있다
- **행동**: 새 `name`으로 `config.update`를 실행한다
- **결과**:
  - `CFG-UPD-9.1` `BAD_REQUEST` 오류를 던진다
  - `CFG-UPD-9.2` `config.get`이 원래 설정 그대로이다
  - `CFG-UPD-9.3` 설정 파일의 내용이 원래 그대로이다

</details>
