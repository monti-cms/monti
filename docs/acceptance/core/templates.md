# `resources/templates/` · `resources/media/uses.ts` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6절(`templates`, `media_uses`), 7절(`templates` 리소스)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `templates.create` | 컬렉션용 재사용 본문 템플릿 생성(`__preset_id` 선택), 본문 검증 및 `media_uses`(`field_path: "content"`) 기록 | 없는 컬렉션·빈 `name`·본문 오류·휴지통 미디어 `BAD_REQUEST`, 같은 컬렉션 이름 중복(동시 생성 포함) `CONFLICT` |
| `templates.list` · `get` | 전체 또는 특정 컬렉션 템플릿 목록과 단건 조회 | 없는 `id` `NOT_FOUND` |
| `templates.update` | `name`·`content` 수정 및 `media_uses` 갱신(기존 본문에 있던 휴지통 미디어 유지 허용, 동시 수정 시 본문·사용처 일관성 및 독립 필드 보존) | 빈 `name`·본문 오류·새 휴지통·삭제된 미디어 `BAD_REQUEST`, 없는 `id` `NOT_FOUND`, 이름 중복 `CONFLICT` |
| `templates.delete` | 템플릿과 해당 `media_uses`만 즉시 삭제(휴지통 없음) | 없는 `id` `NOT_FOUND` |

---

## 1. 생성 (`create`)

### 핵심 요구사항

<details>
<summary><strong><code>TPL-CRT-1</code></strong> 컬렉션의 템플릿을 저장하고 돌려준다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
- **행동**: 해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-1.1` 반환값의 `id`가 UUID 형식이고 `collection`, `name`, `content`가 입력과 같다
  - `TPL-CRT-1.2` `templates` 테이블에 반환값과 같은 행이 생긴다

</details>

<details>
<summary><strong><code>TPL-CRT-2</code></strong> 지정한 ID로 템플릿을 만든다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
- **행동**: 미리 정한 UUID `__preset_id`, 해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-2.1` 반환값의 `id`가 전달한 `__preset_id`이다
  - `TPL-CRT-2.2` `templates` 테이블에 해당 `id`의 행이 하나 생긴다

</details>

<details>
<summary><strong><code>TPL-CRT-3</code></strong> 다른 컬렉션에 같은 이름이 있어도 템플릿을 만든다</summary>

- **전제**: 스키마에 컬렉션이 두 개 있고 두 번째 컬렉션에 템플릿이 하나 있다
- **행동**: 첫 번째 `collection`에 두 번째 컬렉션 템플릿과 같은 `name`과 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-3.1` 반환값의 `collection`이 첫 번째 컬렉션이고 `name`이 입력과 같다
  - `TPL-CRT-3.2` `templates` 테이블에 두 컬렉션의 템플릿 두 개가 모두 있다

</details>

<details>
<summary><strong><code>TPL-CRT-4</code></strong> 본문 블록 트리의 미디어 참조를 대소문자 무시하고 한 번씩 기록한다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 활성 미디어 여럿이 있으며 `media_uses`가 비어 있다
- **행동**: 하위 블록을 포함한 블록 트리 곳곳에서 미디어를 참조하고, 같은 미디어를 대소문자만 달리해 다시 참조하는 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-4.1` `media_uses`에 `source_kind`가 `"template"`, `source_id`가 반환된 `id`, `field_path`가 `"content"`인 행이 참조한 미디어마다 정확히 하나씩 생긴다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TPL-CRT-5</code></strong> 스키마에 없는 컬렉션에는 템플릿을 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
- **행동**: 스키마의 `collections`에 없는 `collection`과 유효한 `name`·`content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-5.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-CRT-5.2` `templates` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>TPL-CRT-6</code></strong> 같은 컬렉션에 같은 이름의 템플릿이 이미 있으면 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 해당 컬렉션에 템플릿이 하나 있다
- **행동**: 같은 `collection`, 같은 `name`, 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-6.1` `CONFLICT` 오류를 던진다
  - `TPL-CRT-6.2` `templates` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>TPL-CRT-7</code></strong> 본문 형식이 맞지 않으면 문제 목록을 담아 템플릿 생성을 거절한다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `templates`가 비어 있다
- **행동**: 그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-7.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-CRT-7.2` 오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
  - `TPL-CRT-7.3` `templates` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>TPL-CRT-8</code></strong> 본문이 휴지통에 있는 미디어를 참조하면 템플릿을 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있으며 `templates`와 `media_uses`가 비어 있다
- **행동**: 해당 미디어를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-8.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-CRT-8.2` `templates` 테이블이 비어 있다
  - `TPL-CRT-8.3` `media_uses` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>TPL-CRT-9</code></strong> 빈 이름으로는 템플릿을 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
- **행동**: 해당 `collection`, 빈 문자열 `name: ""`, 유효한 `content`로 `templates.create`를 실행한다
- **결과**:
  - `TPL-CRT-9.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-CRT-9.2` `templates` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>TPL-CRT-10</code></strong> 같은 컬렉션에 같은 이름의 템플릿을 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
- **행동**: 같은 `collection`과 같은 `name`, 유효한 `content`로 `templates.create` 두 건을, 서로의 커밋을 보기 전에 겹치도록 동시에 실행한다
- **결과**:
  - `TPL-CRT-10.1` 한 건은 성공하고 나머지 한 건은 `CONFLICT` 오류를 던진다
  - `TPL-CRT-10.2` `templates` 테이블에 해당 `collection`·`name`의 행이 정확히 하나만 남는다

</details>

## 2. 조회 (`list` · `get`)

### 핵심 요구사항

<details>
<summary><strong><code>TPL-READ-1</code></strong> 조건 없이 목록을 조회하면 모든 컬렉션의 템플릿을 돌려준다</summary>

- **전제**: 서로 다른 두 컬렉션에 템플릿이 하나씩 있다
- **행동**: 인자 없이 `templates.list`를 실행한다
- **결과**:
  - `TPL-READ-1.1` 두 컬렉션의 템플릿 두 개를 모두 돌려준다

</details>

<details>
<summary><strong><code>TPL-READ-2</code></strong> 컬렉션을 지정해 목록을 조회하면 해당 컬렉션의 템플릿만 돌려준다</summary>

- **전제**: 서로 다른 두 컬렉션에 템플릿이 하나씩 있다
- **행동**: 첫 번째 `collection`으로 `templates.list`를 실행한다
- **결과**:
  - `TPL-READ-2.1` 첫 번째 컬렉션의 템플릿 하나만 돌려준다

</details>

<details>
<summary><strong><code>TPL-READ-3</code></strong> 지정한 ID의 템플릿 1건을 돌려준다</summary>

- **전제**: 템플릿이 두 개 있다
- **행동**: 첫 번째 템플릿의 `id`로 `templates.get`을 실행한다
- **결과**:
  - `TPL-READ-3.1` 반환값의 `id`, `collection`, `name`, `content`가 첫 번째 템플릿과 같다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TPL-READ-4</code></strong> 존재하지 않는 템플릿은 조회할 수 없다</summary>

- **전제**: 템플릿이 하나 있다
- **행동**: 존재하지 않는 UUID `id`로 `templates.get`을 실행한다
- **결과**:
  - `TPL-READ-4.1` `NOT_FOUND` 오류를 던진다

</details>

## 3. 수정 (`update`)

### 핵심 요구사항

<details>
<summary><strong><code>TPL-UPD-1</code></strong> 본문 없이 이름만 주면 이름만 바꾸고 본문과 미디어 사용처를 유지한다</summary>

- **전제**: 미디어를 참조하고 `media_uses` 행이 있는 템플릿이 하나 있다
- **행동**: 해당 `id`와 새 `name`만으로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-1.1` 반환값의 `name`이 새 `name`이고 `collection`과 `content`가 원래 그대로이다
  - `TPL-UPD-1.2` `templates` 테이블의 해당 행이 반환값과 같다
  - `TPL-UPD-1.3` `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

</details>

<details>
<summary><strong><code>TPL-UPD-2</code></strong> 본문을 바꾸면 본문을 갱신하고 해당 템플릿의 미디어 사용처만 교체한다</summary>

- **전제**: 첫 번째 미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행, 두 번째 미디어가 있다
- **행동**: 대상 템플릿의 `id`와 두 번째 미디어만 참조하는 새 `content`로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-2.1` 반환값의 `content`가 새 `content`이고 `name`과 `collection`이 원래 그대로이다
  - `TPL-UPD-2.2` `templates` 테이블에서 대상 템플릿의 행이 반환값과 같다
  - `TPL-UPD-2.3` `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조는 두 번째 미디어와 `field_path` `"content"` 하나뿐이다
  - `TPL-UPD-2.4` `media_uses`에서 다른 템플릿의 기존 참조는 그대로 남아 있다
  - `TPL-UPD-2.5` `media_uses`에서 `entry`의 기존 참조는 그대로 남아 있다

</details>

<details>
<summary><strong><code>TPL-UPD-7</code></strong> 이미 템플릿 본문에 들어 있던 미디어가 휴지통에 들어가도 그 미디어를 그대로 유지한 채 다른 문단을 수정할 수 있다</summary>

- **전제**: 미디어를 참조해 `media_uses` 행이 있는 템플릿이 하나 있고, 그 미디어가 휴지통으로 이동했다(`trashed_at` 설정)
- **행동**: 해당 템플릿의 `id`와 기존 미디어 참조는 그대로 두고 문단 글자만 바꾼 `content`로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-7.1` 반환값의 `content`가 새 `content`이다
  - `TPL-UPD-7.2` `media_uses`에 해당 템플릿의 기존 미디어 참조가 그대로 남아 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TPL-UPD-3</code></strong> 같은 컬렉션의 다른 템플릿과 이름이 겹치면 이름을 바꿀 수 없다</summary>

- **전제**: 같은 컬렉션에 템플릿이 두 개 있다
- **행동**: 두 번째 템플릿의 `id`와 첫 번째 템플릿의 `name`으로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-3.1` `CONFLICT` 오류를 던진다
  - `TPL-UPD-3.2` `templates` 테이블에서 두 번째 템플릿의 `name`이 원래 그대로이다

</details>

<details>
<summary><strong><code>TPL-UPD-4</code></strong> 본문 형식이 맞지 않으면 문제 목록을 담아 템플릿 수정을 거절한다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 템플릿이 하나 있다
- **행동**: 해당 `id`와, 그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-4.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-UPD-4.2` 오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
  - `TPL-UPD-4.3` `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다

</details>

<details>
<summary><strong><code>TPL-UPD-5</code></strong> 본문에 존재하지 않거나 기존에 없던 휴지통 미디어를 새로 넣어 템플릿을 수정할 수 없다</summary>

- **전제**: 첫 번째 미디어를 참조하고 `media_uses` 행이 있는 템플릿 하나와 그 템플릿이 참조하지 않던 휴지통(`trashed_at` 설정) 미디어가 하나 있다
- **행동**: 해당 `id`와 존재하지 않는 UUID 또는 휴지통 미디어의 `id`를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-5.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-UPD-5.2` `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다
  - `TPL-UPD-5.3` `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

</details>

<details>
<summary><strong><code>TPL-UPD-6</code></strong> 존재하지 않는 템플릿은 수정할 수 없다</summary>

- **전제**: 템플릿이 하나 있다
- **행동**: 존재하지 않는 UUID `id`와 새 `name`으로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-6.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>TPL-UPD-8</code></strong> 템플릿의 이름을 빈 문자열로 바꿀 수 없다</summary>

- **전제**: 템플릿이 하나 있다
- **행동**: 해당 템플릿의 `id`와 빈 문자열 `name: ""`로 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-8.1` `BAD_REQUEST` 오류를 던진다
  - `TPL-UPD-8.2` `templates` 테이블에서 해당 템플릿의 `name`이 원래 그대로이다

</details>

<details>
<summary><strong><code>TPL-UPD-9</code></strong> 같은 템플릿의 본문을 동시에 두 번 바꿔도 최종 본문과 미디어 사용처가 일치하고 중복 기록이 남지 않는다</summary>

- **전제**: 활성 미디어 둘(첫 번째 미디어, 두 번째 미디어)과 빈 본문의 템플릿 하나가 있다
- **행동**: 같은 템플릿 `id`에 첫 번째 미디어만 참조하는 `content`와 두 번째 미디어만 참조하는 `content`로 `templates.update` 두 건을, 첫 번째 수정이 커밋되기 전에 두 번째 수정이 진입하도록 동시에 실행한다
- **결과**:
  - `TPL-UPD-9.1` 두 호출 모두 오류 없이 끝난다
  - `TPL-UPD-9.2` `templates` 테이블의 최종 `content`가 제출한 두 본문 중 하나와 같다
  - `TPL-UPD-9.3` `media_uses`에서 해당 템플릿(`source_kind`가 `"template"`, `field_path`가 `"content"`)의 행이 최종 `content`의 미디어 ID와 정확히 일치하고 중복 행이 없다

</details>

<details>
<summary><strong><code>TPL-UPD-10</code></strong> 같은 템플릿의 이름과 본문을 동시에 각각 바꿔도 두 변경이 모두 남는다</summary>

- **전제**: 활성 미디어 하나와 빈 본문의 템플릿 하나가 저장되어 있다
- **행동**: 해당 템플릿의 `name`만 바꾸는 `templates.update`와 해당 미디어를 참조하는 `content`만 바꾸는 `templates.update`를, 첫 번째 수정이 커밋되기 전에 두 번째 수정이 진입하도록 동시에 실행한다
- **결과**:
  - `TPL-UPD-10.1` 두 호출 모두 오류 없이 끝난다
  - `TPL-UPD-10.2` `templates` 테이블에서 해당 템플릿의 `name`과 `content`가 모두 새 값이다
  - `TPL-UPD-10.3` `media_uses`에 해당 템플릿(`source_kind`가 `"template"`, `field_path`가 `"content"`)의 해당 미디어 행이 정확히 하나 있다

</details>

<details>
<summary><strong><code>TPL-UPD-12</code></strong> 미디어가 먼저 영구 삭제되면 그 미디어를 참조하는 템플릿 수정은 저장할 수 없다</summary>

- **전제**: `storage`가 설정되어 있고, 휴지통에 들어가 있는(`trashed_at` 설정) 미디어를 참조하며 `media_uses` 행이 있는 템플릿 하나가 있다
- **행동**: `trash.delete`가 그 미디어를 삭제한 뒤 그 변경이 커밋되기 전에, 그 미디어 참조를 그대로 두고 문단 글자만 바꾸는 `templates.update`를 실행한다
- **결과**:
  - `TPL-UPD-12.1` `trash.delete`가 성공하고, `templates.update`는 `BAD_REQUEST` 오류를 던진다
  - `TPL-UPD-12.2` `templates` 테이블에서 해당 템플릿의 `content`가 원래 그대로이다

</details>

## 4. 삭제 (`delete`)

### 핵심 요구사항

<details>
<summary><strong><code>TPL-DEL-1</code></strong> 해당 템플릿과 그 템플릿의 미디어 사용처만 지운다</summary>

- **전제**: 미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행이 있다
- **행동**: 대상 템플릿의 `id`로 `templates.delete`를 실행한다
- **결과**:
  - `TPL-DEL-1.1` `templates` 테이블에 다른 템플릿 하나만 남아 있다
  - `TPL-DEL-1.2` `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조가 사라진다
  - `TPL-DEL-1.3` `media_uses`에서 다른 템플릿의 참조는 그대로 남아 있다
  - `TPL-DEL-1.4` `media_uses`에서 `entry`의 참조는 그대로 남아 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TPL-DEL-2</code></strong> 존재하지 않는 템플릿은 지울 수 없다</summary>

- **전제**: 템플릿이 하나 있다
- **행동**: 존재하지 않는 UUID `id`로 `templates.delete`를 실행한다
- **결과**:
  - `TPL-DEL-2.1` `NOT_FOUND` 오류를 던진다

</details>
