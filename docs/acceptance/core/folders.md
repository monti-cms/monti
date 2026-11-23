# `resources/folders/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6절(`folders`), 7절(`folders` 리소스)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `folders.create` | `scope`(컬렉션 키 또는 `"media"`)에 폴더 생성(`parent_id`, `__preset_id` 선택) | 없는 `scope`·빈 `name`·잘못된 부모 `BAD_REQUEST`, 같은 위치 이름 중복(동시 생성 포함) `CONFLICT` |
| `folders.list` | 지정한 `scope`의 활성 폴더 목록을 돌려준다 | 없음 |
| `folders.update` | 폴더 `name`·`parent_id`(`null`=루트) 변경(변경 항목 없으면 그대로 반환, 서로 다른 필드 동시 수정 보존) | 빈 `name`·순환 이동(동시 이동 포함)·다른 범위 부모 `BAD_REQUEST`, 휴지통·미존재 `NOT_FOUND`, 이름 중복(동시 수정 포함) `CONFLICT` |

---

## 1. 생성 (`create`)

### 핵심 요구사항

<details>
<summary><strong><code>FLD-CRT-1</code></strong> 컬렉션 범위의 루트 폴더를 만든다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `folders`가 비어 있다
- **행동**: 해당 컬렉션 `scope`와 `name`으로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-1.1` 반환값의 `scope`가 전달한 `scope`와 같다
  - `FLD-CRT-1.2` 반환값의 `name`이 전달한 `name`과 같다
  - `FLD-CRT-1.3` 반환값의 `parent_id`가 `null`이다
  - `FLD-CRT-1.4` `folders` 테이블에 해당 `id`의 행이 하나 생긴다

</details>

<details>
<summary><strong><code>FLD-CRT-2</code></strong> 미디어 범위의 하위 폴더를 지정한 ID로 만든다</summary>

- **전제**: `"media"` `scope`의 루트 폴더가 하나 있다
- **행동**: `scope` `"media"`, 미리 정한 UUID `__preset_id`, `name`, 루트 폴더의 `id`인 `parent_id`로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-2.1` 반환값의 `id`가 전달한 `__preset_id`이다
  - `FLD-CRT-2.2` 반환값의 `parent_id`가 루트 폴더의 `id`이다
  - `FLD-CRT-2.3` `folders` 테이블에서 해당 `id` 행의 `parent_id`가 루트 폴더의 `id`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>FLD-CRT-3</code></strong> 스키마에 없는 컬렉션 범위로는 폴더를 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `folders`가 비어 있다
- **행동**: `"media"`도 아니고 스키마의 `collections`에도 없는 `scope`와 `name`으로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-3.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-CRT-3.2` `folders` 테이블은 비어 있다

</details>

<details>
<summary><strong><code>FLD-CRT-4</code></strong> 휴지통에 있는 폴더 아래에는 새 폴더를 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 해당 `scope`에서 휴지통에 들어가 있는(`trashed_at` 설정) 폴더가 하나 있다
- **행동**: 해당 컬렉션 `scope`, `name`, 휴지통 폴더의 `id`인 `parent_id`로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-4.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-CRT-4.2` `folders` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>FLD-CRT-5</code></strong> 존재하지 않는 폴더 아래에는 새 폴더를 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 해당 `scope`에 활성 폴더가 하나 있다
- **행동**: 해당 컬렉션 `scope`, `name`, 존재하지 않는 UUID인 `parent_id`로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-5.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-CRT-5.2` `folders` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>FLD-CRT-6</code></strong> 같은 위치에 같은 이름의 활성 폴더가 이미 있으면 폴더를 만들 수 없다</summary>

- **전제**: 컬렉션 `scope`에 활성 루트 폴더가 하나 있다
- **행동**: 같은 `scope`와 같은 `name`으로 루트 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-6.1` `CONFLICT` 오류를 던진다
  - `FLD-CRT-6.2` `folders` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>FLD-CRT-7</code></strong> 빈 이름으로는 폴더를 만들 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `folders`가 비어 있다
- **행동**: 해당 컬렉션 `scope`와 빈 문자열 `name: ""`로 `folders.create`를 실행한다
- **결과**:
  - `FLD-CRT-7.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-CRT-7.2` `folders` 테이블은 비어 있다

</details>

<details>
<summary><strong><code>FLD-CRT-8</code></strong> 루트에 같은 이름의 폴더를 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 `folders`가 비어 있다
- **행동**: 같은 `scope`와 같은 `name`으로 루트 `folders.create` 두 건을, 서로의 커밋을 보기 전에 겹치도록 동시에 실행한다
- **결과**:
  - `FLD-CRT-8.1` 한 건은 성공하고 나머지 한 건은 `CONFLICT` 오류를 던진다
  - `FLD-CRT-8.2` `folders` 테이블에 해당 `scope`·`name`의 활성 루트 폴더가 정확히 하나만 남는다

</details>

<details>
<summary><strong><code>FLD-CRT-9</code></strong> 폴더를 휴지통에 보내는 동안 그 아래에 새 폴더를 만들어도 휴지통 폴더 아래에 활성 폴더가 남지 않는다</summary>

- **전제**: 스키마에 컬렉션이 하나 있고 그 `scope`에 활성 루트 폴더(버릴 부모 폴더)가 하나 있다. `trash.move`가 버릴 부모 폴더의 하위 구조를 읽었지만 아직 커밋하지 않았다
- **행동**: 버릴 부모 폴더를 `parent_id`로 하는 `folders.create`를 별도 연결에서 실행한다
- **결과**:
  - `FLD-CRT-9.1` 두 호출이 끝난 뒤 `folders` 테이블에 `trashed_at`이 `null`이면서 부모 폴더의 `trashed_at`이 설정된 행이 없다

</details>

## 2. 목록 (`list`)

<details>
<summary><strong><code>FLD-LST-1</code></strong> 지정한 범위의 활성 폴더만 돌려준다</summary>

- **전제**: 같은 `scope`에 활성 폴더 하나와 휴지통에 들어가 있는(`trashed_at` 설정) 폴더 하나, 다른 `scope`의 폴더 하나가 있다
- **행동**: 해당 `scope`로 `folders.list`를 실행한다
- **결과**:
  - `FLD-LST-1.1` 해당 `scope`에서 `trashed_at`이 `null`인 폴더 하나만 돌려준다

</details>

## 3. 수정 (`update`)

### 핵심 요구사항

<details>
<summary><strong><code>FLD-UPD-1</code></strong> 폴더의 이름과 부모 폴더를 바꾼다</summary>

- **전제**: 같은 `scope`의 루트 폴더 두 개가 있다
- **행동**: 두 번째 폴더의 `id`와 새 `name`, 첫 번째 폴더의 `id`인 `parent_id`로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-1.1` 반환값의 `name`이 새 `name`이다
  - `FLD-UPD-1.2` 반환값의 `parent_id`가 첫 번째 폴더의 `id`이다
  - `FLD-UPD-1.3` `folders` 테이블에서 두 번째 폴더의 `name`이 새 `name`이다
  - `FLD-UPD-1.4` `folders` 테이블에서 두 번째 폴더의 `parent_id`가 첫 번째 폴더의 `id`이다

</details>

<details>
<summary><strong><code>FLD-UPD-2</code></strong> 부모를 생략하고 이름만 주면 이름만 바꾸고 기존 부모를 유지한다</summary>

- **전제**: 루트 폴더와 그 하위 폴더가 있다
- **행동**: 하위 폴더의 `id`와 새 `name`만으로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-2.1` 반환값의 `name`이 새 `name`이다
  - `FLD-UPD-2.2` 반환값의 `parent_id`가 루트 폴더의 `id` 그대로이다
  - `FLD-UPD-2.3` `folders` 테이블에서 하위 폴더의 `name`이 새 `name`이다
  - `FLD-UPD-2.4` `folders` 테이블에서 하위 폴더의 `parent_id`가 루트 폴더의 `id` 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-3</code></strong> 부모를 비우면 루트 폴더로 이동한다</summary>

- **전제**: 루트 폴더와 그 하위 폴더가 있다
- **행동**: 하위 폴더의 `id`와 `parent_id: null`로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-3.1` 반환값의 `parent_id`가 `null`이다
  - `FLD-UPD-3.2` `folders` 테이블에서 하위 폴더의 `parent_id`가 `null`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>FLD-UPD-4</code></strong> 폴더를 자기 자신 아래로 옮길 수 없다</summary>

- **전제**: 루트 폴더가 하나 있다
- **행동**: 루트 폴더의 `parent_id`를 자기 자신의 `id`로 바꾸는 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-4.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-UPD-4.2` `folders` 테이블에서 루트 폴더의 `parent_id`가 `null` 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-5</code></strong> 폴더를 자기 하위 폴더 아래로 옮길 수 없다</summary>

- **전제**: 루트 폴더, 그 하위 폴더, 그 하위 폴더의 하위 폴더(손자 폴더)가 차례로 있다
- **행동**: 루트 폴더의 `parent_id`를 손자 폴더의 `id`로 바꾸는 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-5.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-UPD-5.2` `folders` 테이블에서 루트 폴더의 `parent_id`가 `null` 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-6</code></strong> 폴더를 다른 범위의 폴더 아래로 옮길 수 없다</summary>

- **전제**: 컬렉션 `scope`의 활성 폴더 하나와 `"media"` `scope`의 폴더 하나가 있다
- **행동**: 컬렉션 폴더의 `parent_id`를 `"media"` 폴더의 `id`로 바꾸는 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-6.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-UPD-6.2` `folders` 테이블에서 컬렉션 폴더의 `parent_id`가 `null` 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-7</code></strong> 휴지통에 있는 폴더는 수정할 수 없다</summary>

- **전제**: 같은 `scope`에 활성 폴더 하나와 휴지통에 들어가 있는(`trashed_at` 설정) 폴더 하나가 있다
- **행동**: 휴지통 폴더의 `id`와 새 `name`으로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-7.1` `NOT_FOUND` 오류를 던진다
  - `FLD-UPD-7.2` `folders` 테이블에서 해당 폴더의 `name`이 원래 `name` 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-8</code></strong> 옮긴 위치에 같은 이름의 활성 폴더가 이미 있으면 수정할 수 없다</summary>

- **전제**: 같은 `scope`의 루트 폴더 아래에 하위 폴더가 하나 있고, 루트에 그 하위 폴더와 같은 `name`의 다른 루트 폴더가 있다
- **행동**: 하위 폴더의 `parent_id`를 `null`로 바꾸는 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-8.1` `CONFLICT` 오류를 던진다
  - `FLD-UPD-8.2` `folders` 테이블에서 하위 폴더의 `parent_id`가 원래 부모 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-9</code></strong> 폴더의 이름을 빈 문자열로 바꿀 수 없다</summary>

- **전제**: 활성 폴더가 하나 있다
- **행동**: 해당 폴더의 `id`와 빈 문자열 `name: ""`로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-9.1` `BAD_REQUEST` 오류를 던진다
  - `FLD-UPD-9.2` `folders` 테이블에서 해당 폴더의 `name`이 원래 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-10</code></strong> 바꿀 항목 없이 폴더 수정을 호출하면 기존 폴더를 그대로 돌려준다</summary>

- **전제**: 활성 폴더가 하나 있다
- **행동**: 해당 폴더의 `id`만으로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-10.1` 반환값의 `id`, `scope`, `name`, `parent_id`가 기존 폴더 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-11</code></strong> 같은 위치의 다른 활성 폴더와 같은 이름으로 바꿀 수 없다</summary>

- **전제**: 같은 `scope`의 루트에 서로 다른 이름의 활성 폴더 둘이 있다
- **행동**: 두 번째 폴더의 `id`와 첫 번째 폴더의 `name`만으로 `folders.update`를 실행한다
- **결과**:
  - `FLD-UPD-11.1` `CONFLICT` 오류를 던진다
  - `FLD-UPD-11.2` `folders` 테이블에서 두 번째 폴더의 `name`이 원래 그대로이다

</details>

<details>
<summary><strong><code>FLD-UPD-12</code></strong> 같은 부모 아래의 두 폴더를 같은 이름으로 동시에 바꾸면 한 건만 성공하고 나머지는 거절된다</summary>

- **전제**: 같은 `scope`의 활성 부모 폴더 아래에 서로 다른 이름의 활성 하위 폴더 둘이 있다
- **행동**: 두 하위 폴더의 `id`에 같은 새 `name`을 넣어 `folders.update` 두 건을, 서로의 커밋을 보기 전에 겹치도록 동시에 실행한다
- **결과**:
  - `FLD-UPD-12.1` 한 건은 성공하고 나머지 한 건은 `CONFLICT` 오류를 던진다
  - `FLD-UPD-12.2` `folders` 테이블에서 해당 부모 아래 그 새 `name`을 가진 활성 폴더가 정확히 하나만 남는다

</details>

<details>
<summary><strong><code>FLD-UPD-13</code></strong> 두 폴더를 서로의 하위 폴더로 동시에 옮겨도 순환 구조가 생기지 않는다</summary>

- **전제**: 같은 `scope`에 활성 루트 폴더 둘(첫 번째 폴더, 두 번째 폴더)이 있다
- **행동**: 첫 번째 폴더의 `parent_id`를 두 번째 폴더로, 두 번째 폴더의 `parent_id`를 첫 번째 폴더로 바꾸는 `folders.update` 두 건을, 첫 번째 이동이 커밋되기 전에 두 번째 이동이 진입하도록 동시에 실행한다
- **결과**:
  - `FLD-UPD-13.1` 한 건은 성공하고 나머지 한 건은 `BAD_REQUEST` 오류를 던진다
  - `FLD-UPD-13.2` `folders` 테이블에서 두 폴더 중 하나만 다른 폴더를 `parent_id`로 가리키고 나머지 하나의 `parent_id`는 `null`이다

</details>

<details>
<summary><strong><code>FLD-UPD-14</code></strong> 폴더를 휴지통에 넣는 동안 그 폴더 아래로 다른 폴더를 옮겨도 휴지통 폴더 아래에 활성 폴더가 남지 않는다</summary>

- **전제**: 같은 `scope`에 활성 루트 폴더 둘(버릴 부모 폴더, 옮길 폴더)이 있다. `trash.move`가 버릴 부모 폴더를 휴지통에 넣는 도중, 옮길 폴더의 `parent_id`를 버릴 부모 폴더로 바꾸는 `folders.update`가 겹쳐 실행된다
- **행동**: 버릴 부모 폴더의 `trash.move`와 옮길 폴더의 `folders.update`를 별도 연결에서 동시에 실행한다
- **결과**:
  - `FLD-UPD-14.1` `trash.move`가 성공해 `folders` 테이블에서 버릴 부모 폴더에 `trashed_at`이 설정된다
  - `FLD-UPD-14.2` 두 호출이 끝난 뒤 `folders` 테이블에 버릴 부모 폴더를 `parent_id`로 두고 `trashed_at`이 `null`인 행이 없다

</details>

<details>
<summary><strong><code>FLD-UPD-15</code></strong> 같은 폴더의 이름과 부모를 동시에 각각 바꿔도 두 변경이 모두 남는다</summary>

- **전제**: 같은 `scope`에 활성 루트 폴더 둘(대상 폴더, 새 부모 폴더)이 있다
- **행동**: 대상 폴더의 `name`만 바꾸는 `folders.update`와 `parent_id`만 새 부모 폴더로 바꾸는 `folders.update`를, 첫 번째 수정이 커밋되기 전에 두 번째 수정이 진입하도록 동시에 실행한다
- **결과**:
  - `FLD-UPD-15.1` 두 호출 모두 오류 없이 끝난다
  - `FLD-UPD-15.2` `folders` 테이블에서 대상 폴더의 `name`이 새 이름이고 `parent_id`가 새 부모 폴더의 `id`이다

</details>
