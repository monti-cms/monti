# `resources/media/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`StorageAdapter`), 6절(`media`, `loose_files`), 7절(`media` 리소스)의 인수 조건이다. `resources/media/uses.ts`는 `templates`·`entries` 단계에서 다룬다.

| 액션 / 함수 | 하는 일 | 주요 거절 |
|---|---|---|
| `media.startUpload` | 새 UUID `key`로 `storage.ticket` 발급 및 `loose_files` 24시간 만료 등록(`onEvent` 미통지) | `storage` 미설정·`dryRun` 실행·크기 범위 초과 시 `BAD_REQUEST` |
| `media.create` | `storage.stat` 확인 후 미디어 등록(`filename` 생략 시 `key`) 및 `loose_files` 제거(폴더의 휴지통 이동과 겹쳐도 휴지통 폴더 아래 활성 미디어를 남기지 않음) | `storage` 없음·미발급/삭제 대기 키·없는 파일·크기 범위 초과·빈 `filename`·잘못된 폴더 `BAD_REQUEST`, 중복 `key`(동시 등록 포함) `CONFLICT` |
| `media.list` · `get` | 활성 미디어를 `url`과 함께 조회(`get`은 `uses` 포함, `folder_id` 생략=전체·`null`=루트) | 휴지통·미존재 `NOT_FOUND` |
| `media.update` | 단건 메타 수정·폴더 이동·파일 교체(동시 교체 시에도 바뀌기 전 `key`를 모두 24시간 삭제 대기로 등록), 다건 폴더 일괄 이동(폴더의 휴지통 이동이 먼저 적용되면 미디어는 폴더와 함께 휴지통에 들어감) | 미발급/삭제 대기 키·빈 `filename`·잘못된 폴더 `BAD_REQUEST`, 휴지통 포함 시 전체 롤백 `NOT_FOUND` |
| `removeLooseFiles` | 만료된 `loose_files`만 동시 등록과 충돌하지 않게 `storage.remove`로 정리하고 `{ removed, failed }`를 돌려준다 | Operation 아님(`transaction`·`dryRun` 밖에서 호출) |

---

## 1. 업로드 시작 (`startUpload`)

### 핵심 요구사항

<details>
<summary><strong><code>MED-UPL-1</code></strong> 새 키로 업로드 티켓을 발급하고 임시 파일 목록에 24시간 뒤 만료로 기록한다</summary>

- **전제**: `storage`가 설정되어 있고 `loose_files`가 비어 있다
- **행동**: `mime_type`과 `size`로 `media.startUpload`를 실행한다
- **결과**:
  - `MED-UPL-1.1` 반환값의 `key`가 UUID 형식이다
  - `MED-UPL-1.2` `storage.ticket`이 반환된 `key`와 `{ mime, size }`로 호출된다
  - `MED-UPL-1.3` 반환값의 `url`과 `headers`가 `storage.ticket`의 결과와 같다
  - `MED-UPL-1.4` `loose_files`에 해당 `key`의 행이 생긴다
  - `MED-UPL-1.5` 실행 시각과 해당 행의 `remove_after` 차이가 24시간이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>MED-UPL-2</code></strong> 스토리지가 설정되지 않은 엔진에서는 업로드를 시작할 수 없다</summary>

- **전제**: `storage` 없이 엔진이 생성되어 있고 `loose_files`가 비어 있다
- **행동**: `mime_type`과 `size`로 `media.startUpload`를 실행한다
- **결과**:
  - `MED-UPL-2.1` `BAD_REQUEST` 오류를 던진다
  - `MED-UPL-2.2` `loose_files`가 비어 있다

</details>

<details>
<summary><strong><code>MED-UPL-3</code></strong> 시험 실행(dryRun)에서는 업로드 티켓을 발급할 수 없고 등록 시험 실행은 DB를 남기지 않는다</summary>

- **전제**: `storage`가 설정되어 있고 `media.startUpload`로 발급해 올린 파일 하나가 있으며 `media`가 비어 있다
- **행동**: `monti.dryRun` 안에서 `media.startUpload`를 실행하고, 이어서 `monti.dryRun` 안에서 발급해 올린 파일로 `media.create`를 실행한다
- **결과**:
  - `MED-UPL-3.1` `media.startUpload`는 `BAD_REQUEST` 오류를 던지고 `storage.ticket`이 호출되지 않으며 `loose_files`에 새 행이 늘지 않는다
  - `MED-UPL-3.2` `media.create`는 `storage.stat`·`url`로 계산한 결과를 돌려주고 `media` 테이블은 비어 있다

</details>

<details>
<summary><strong><code>MED-UPL-4</code></strong> 업로드 티켓 발급은 이벤트 구독자에게 통지하지 않는다</summary>

- **전제**: `storage`가 설정된 엔진에 `onEvent` 구독자가 등록되어 있다
- **행동**: 유효한 `mime_type`과 `size`로 `media.startUpload`를 실행한다
- **결과**:
  - `MED-UPL-4.1` `onEvent` 구독자가 호출되지 않는다

</details>

## 2. 생성 (`create`)

### 핵심 요구사항

<details>
<summary><strong><code>MED-CRT-1</code></strong> 스토리지 파일을 확인해 미디어로 등록하고 임시 목록에서 해당 키만 지운다</summary>

- **전제**: `storage`에 파일이 올라가 있고, 그 `key`와 다른 `key` 하나가 `loose_files`에 들어 있다
- **행동**: 올라간 `key`와 `width`, `height`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-1.1` 반환값의 `key`, `filename`(`key`), `mime_type`(`storage.stat`의 `mime`), `size`(`storage.stat`의 `size`), `folder_id`(`null`), `width`, `height`가 일치한다
  - `MED-CRT-1.2` 반환값의 `url`이 `storage.url(key)`이다
  - `MED-CRT-1.3` `media` 테이블에 해당 `id`, `key`, `filename`, `mime_type`, `size`, `folder_id`, `width`, `height`를 가진 행이 저장된다
  - `MED-CRT-1.4` `loose_files`에서 등록한 `key`는 삭제된다
  - `MED-CRT-1.5` `loose_files`에 원래 있던 다른 `key`는 남아 있다

</details>

<details>
<summary><strong><code>MED-CRT-2</code></strong> 지정한 ID로 미디어를 등록한다</summary>

- **전제**: `media.startUpload`로 발급해 `storage`에 올린 파일이 있고 `media`가 비어 있다
- **행동**: 미리 정한 UUID `__preset_id`와 올라간 `key`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-2.1` 반환값의 `id`가 전달한 `__preset_id`이다
  - `MED-CRT-2.2` `media` 테이블에 해당 `id`의 행이 하나 생긴다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>MED-CRT-3</code></strong> 스토리지에 파일이 없는 키로는 미디어를 등록할 수 없다</summary>

- **전제**: `storage`가 설정되어 있고 `media.startUpload`로 발급했지만 파일이 올라가지 않은 `key`가 있으며 `media`가 비어 있다
- **행동**: 파일이 없는 그 `key`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-3.1` `BAD_REQUEST` 오류를 던진다
  - `MED-CRT-3.2` `media` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>MED-CRT-4</code></strong> 이미 등록된 키로는 미디어를 다시 등록할 수 없다</summary>

- **전제**: `storage`에 파일이 있고, 같은 `key`를 가진 휴지통(`trashed_at` 설정) `media` 행이 하나 있다
- **행동**: 해당 `key`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-4.1` `CONFLICT` 오류를 던진다
  - `MED-CRT-4.2` `media` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>MED-CRT-5</code></strong> 미디어 범위가 아닌 폴더에는 미디어를 등록할 수 없다</summary>

- **전제**: `media.startUpload`로 발급해 `storage`에 올린 파일이 있고, 컬렉션 `scope`의 폴더가 하나 있으며 `media`가 비어 있다
- **행동**: 해당 컬렉션 폴더의 `id`를 `folder_id`로 주어 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-5.1` `BAD_REQUEST` 오류를 던진다
  - `MED-CRT-5.2` `media` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>MED-CRT-6</code></strong> 빈 파일 이름으로는 미디어를 등록할 수 없다</summary>

- **전제**: `media.startUpload`로 발급해 `storage`에 올린 파일이 있고 `media`가 비어 있다
- **행동**: 올라간 `key`와 빈 문자열 `filename: ""`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-6.1` `BAD_REQUEST` 오류를 던진다
  - `MED-CRT-6.2` `media` 테이블이 비어 있다

</details>

<details>
<summary><strong><code>MED-CRT-7</code></strong> 같은 파일 키로 동시에 미디어를 등록하면 한 건만 성공하고 나머지는 충돌로 거절된다</summary>

- **전제**: `media.startUpload`로 발급해 `storage`에 올린 파일이 있고 `media`가 비어 있다
- **행동**: 같은 `key`로 `media.create` 두 건을 동시에 실행한다
- **결과**:
  - `MED-CRT-7.1` 한 건은 성공하고 나머지 한 건은 `CONFLICT` 오류를 던진다
  - `MED-CRT-7.2` `media` 테이블에 해당 `key`의 행이 정확히 하나만 저장된다

</details>

<details>
<summary><strong><code>MED-CRT-8</code></strong> 파일 크기가 DB 허용 범위를 벗어나면 업로드를 시작하거나 미디어를 등록할 수 없다</summary>

- **전제**: 정상 크기로 `media.startUpload` 발급을 받았지만 실제 `storage`에 `size`가 `2_147_483_648`인 파일이 올라간 `key`가 있고 `media`가 비어 있다
- **행동**: `size: 2_147_483_648`로 `media.startUpload`를 실행하고, 해당 `key`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-8.1` 두 호출 모두 `BAD_REQUEST` 오류를 던진다
  - `MED-CRT-8.2` `media` 테이블이 비어 있고 `startUpload` 실패로 `loose_files` 행이 늘지 않는다

</details>

<details>
<summary><strong><code>MED-CRT-9</code></strong> 업로드 시작을 통해 발급받지 않은 키나 삭제 대기 중인 이전 키로는 미디어를 등록할 수 없다</summary>

- **전제**: `storage`에 파일이 올라가 있지만 `media.startUpload`로 발급받지 않은 `key`나, 이전 파일 교체로 삭제 대기 상태가 된 `key`가 있다
- **행동**: 그 `key`로 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-9.1` `BAD_REQUEST` 오류를 던진다
  - `MED-CRT-9.2` `media` 테이블에 새 행이 생기지 않는다

</details>

<details>
<summary><strong><code>MED-CRT-11</code></strong> 미디어 폴더를 휴지통에 보내는 동안 그 폴더에 새 미디어를 등록해도 휴지통 폴더 아래 활성 미디어가 남지 않는다</summary>

- **전제**: `"media"` `scope`의 활성 폴더가 하나 있고, `media.startUpload`로 발급해 `storage`에 올린 파일이 있다
- **행동**: 그 폴더의 `trash.move`가 함께 옮길 항목을 정한 뒤, 그 처리가 끝나기 전에 그 폴더를 `folder_id`로 지정한 `media.create`를 실행한다
- **결과**:
  - `MED-CRT-11.1` `folders` 테이블에서 그 폴더에 `trashed_at`이 설정된다
  - `MED-CRT-11.2` `media` 테이블에 그 폴더를 `folder_id`로 두고 `trashed_at`이 `null`인 행이 없다

</details>

## 3. 조회 (`list` · `get`)

### 핵심 요구사항

<details>
<summary><strong><code>MED-READ-1</code></strong> 지정한 폴더 직속의 미디어만 돌려준다</summary>

- **전제**: 대상 폴더 직속의 미디어, 그 하위 폴더의 미디어, `folder_id`가 `null`인 미디어가 있다
- **행동**: `folder_id`로 대상 폴더의 `id`를 주어 `media.list`를 실행한다
- **결과**:
  - `MED-READ-1.1` 대상 폴더 직속의 미디어 하나만 돌려준다

</details>

<details>
<summary><strong><code>MED-READ-2</code></strong> 폴더를 비워 조회하면 루트 미디어만 돌려준다</summary>

- **전제**: `folder_id`가 `null`인 미디어와 폴더에 속한 미디어가 있다
- **행동**: `folder_id: null`로 `media.list`를 실행한다
- **결과**:
  - `MED-READ-2.1` `folder_id`가 `null`인 미디어 하나만 돌려준다

</details>

<details>
<summary><strong><code>MED-READ-3</code></strong> 조건 없이 조회하면 모든 활성 미디어를 URL과 함께 돌려준다</summary>

- **전제**: `storage`가 설정되어 있고, 루트 미디어, 폴더에 속한 미디어, 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 있다
- **행동**: 인자 없이 `media.list`를 실행한다
- **결과**:
  - `MED-READ-3.1` `trashed_at`이 `null`인 미디어 두 개만 돌려준다
  - `MED-READ-3.2` 반환된 각 항목의 `url`이 `storage.url(key)`이다

</details>

<details>
<summary><strong><code>MED-READ-4</code></strong> 활성 미디어 1건을 URL 및 사용처 목록과 함께 돌려준다</summary>

- **전제**: `storage`가 설정되어 있고 활성 미디어가 하나 있으며 `media_uses`에 그 미디어를 가리키는 행이 하나 있다
- **행동**: 해당 미디어의 `id`로 `media.get`을 실행한다
- **결과**:
  - `MED-READ-4.1` 반환값의 `id`가 해당 미디어의 `id`이다
  - `MED-READ-4.2` 반환값의 `url`이 `storage.url(key)`이다
  - `MED-READ-4.3` 반환값의 `uses`가 `media_uses`에 기록된 `{ source_kind, source_id, field_path }` 목록이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>MED-READ-5</code></strong> 휴지통에 있는 미디어는 조회할 수 없다</summary>

- **전제**: 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있다
- **행동**: 해당 미디어의 `id`로 `media.get`을 실행한다
- **결과**:
  - `MED-READ-5.1` `NOT_FOUND` 오류를 던진다

</details>

## 4. 수정 (`update`)

### 핵심 요구사항

<details>
<summary><strong><code>MED-UPD-1</code></strong> 단건 수정에서 파일 정보만 주면 지정한 열을 바꾸고 폴더와 파일 키는 유지한다</summary>

- **전제**: 폴더에 속하고 `filename`, `width`, `height`가 들어 있는 미디어가 하나 있다
- **행동**: `id`와 새 `filename`, `width`, `height`만으로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-1.1` 반환값의 `filename`, `width`, `height`가 새 값이다
  - `MED-UPD-1.2` 반환값의 `folder_id`가 원래 그대로이다
  - `MED-UPD-1.3` 반환값의 `key`가 원래 그대로이다
  - `MED-UPD-1.4` `media` 테이블에서 해당 행의 `filename`, `width`, `height`가 새 값이다

</details>

<details>
<summary><strong><code>MED-UPD-2</code></strong> 단건 수정에서 새 파일 키로 교체하면 MIME·용량·URL을 갱신하고 이전 키를 임시 목록에 넣는다</summary>

- **전제**: `storage`에 다른 `mime`과 `size`의 새 `key`가 올라가 있고 `loose_files`에 들어 있으며, 기존 미디어가 하나 있다
- **행동**: `id`와 새 `key`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-2.1` 반환값의 `key`, `mime_type`, `size`(새 파일의 `storage.stat` `mime`·`size`)가 갱신된다
  - `MED-UPD-2.2` 반환값의 `url`이 새 `key`의 `storage.url`이다
  - `MED-UPD-2.3` `media` 테이블에서 해당 행의 `key`, `mime_type`, `size`가 새 값으로 바뀐다
  - `MED-UPD-2.4` `loose_files`에서 새 `key`는 삭제된다
  - `MED-UPD-2.5` `loose_files`에 이전 `key`의 행이 생긴다
  - `MED-UPD-2.6` 실행 시각과 이전 `key` 행의 `remove_after` 차이가 24시간이다

</details>

<details>
<summary><strong><code>MED-UPD-3</code></strong> 다건 수정은 지정한 미디어들을 한 폴더로 일괄 이동한다</summary>

- **전제**: 폴더에 속하지 않은 미디어 두 개와 `"media"` `scope`의 폴더가 하나 있다
- **행동**: 두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-3.1` 반환 목록이 요청한 두 미디어의 `{ id, folder_id: 새 folder_id }`로 이루어진다
  - `MED-UPD-3.2` `media` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>MED-UPD-4</code></strong> 다건 수정 대상 중 하나라도 휴지통에 있으면 전체 이동을 취소한다</summary>

- **전제**: 폴더에 속하지 않은 활성 미디어 하나, 휴지통에 들어가 있는(`trashed_at` 설정) 미디어 하나, `"media"` `scope`의 폴더가 하나 있다
- **행동**: 두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-4.1` `NOT_FOUND` 오류를 던진다
  - `MED-UPD-4.2` `media` 테이블에서 활성 미디어의 `folder_id`가 `null` 그대로이다

</details>

<details>
<summary><strong><code>MED-UPD-5</code></strong> 단건 수정에서 파일 이름을 빈 문자열로 바꿀 수 없다</summary>

- **전제**: 활성 미디어가 하나 있다
- **행동**: 해당 미디어의 `id`와 빈 문자열 `filename: ""`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-5.1` `BAD_REQUEST` 오류를 던진다
  - `MED-UPD-5.2` `media` 테이블에서 해당 미디어의 `filename`이 원래 그대로이다

</details>

<details>
<summary><strong><code>MED-UPD-6</code></strong> 단건 수정에서 바꿀 항목이 없거나 같은 파일 키를 다시 주면 기존 미디어를 그대로 돌려준다</summary>

- **전제**: 활성 미디어가 하나 있다
- **행동**: 해당 미디어의 `id`만으로 `media.update`를 실행하고, 이어서 같은 `key`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-6.1` 두 호출 모두 기존 미디어와 같은 `id`, `key`, `filename`을 돌려주고 `loose_files`에 행이 생기지 않는다

</details>

<details>
<summary><strong><code>MED-UPD-7</code></strong> 미디어 수정에서 미디어 범위가 아닌 폴더로 옮길 수 없고, 다건 수정에서는 폴더를 비워 루트로 옮길 수 있다</summary>

- **전제**: `"media"` 폴더에 속한 활성 미디어 둘과 컬렉션 `scope`의 폴더가 하나 있다
- **행동**: `media.update`로 미디어를 컬렉션 폴더에 옮긴 뒤, 다건 `media.update`에 `folder_id: null`을 준다
- **결과**:
  - `MED-UPD-7.1` 컬렉션 폴더로 옮기는 호출은 `BAD_REQUEST` 오류를 던진다
  - `MED-UPD-7.2` `folder_id: null` 다건 호출은 두 미디어의 `folder_id`를 모두 `null`로 바꾼다

</details>

<details>
<summary><strong><code>MED-UPD-8</code></strong> 같은 미디어의 파일을 동시에 두 번 교체해도 바뀌기 전 파일들은 모두 삭제 대기 목록에 들어간다</summary>

- **전제**: 기존 키를 가진 활성 미디어가 하나 있고, `media.startUpload`로 발급해 `storage`에 올린 새 키 둘(첫 번째 새 키, 두 번째 새 키)이 있다
- **행동**: 먼저 시작한 첫 번째 새 키의 `media.update`가 끝나기 전에, 같은 미디어에 두 번째 새 키로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-8.1` 두 호출 모두 성공하고 최종 `media` 행의 `key`가 두 번째 새 키이다
  - `MED-UPD-8.2` `loose_files` 테이블에서 원래 키와 첫 번째 새 키의 행이 각각 `kind`가 `"cleanup"`이고 `remove_after`가 그 키가 교체된 시각의 24시간 뒤이다
  - `MED-UPD-8.3` `loose_files` 테이블에 두 번째 새 키의 행은 없다

</details>

<details>
<summary><strong><code>MED-UPD-9</code></strong> 업로드 시작을 통해 발급받지 않은 키나 삭제 대기 중인 이전 키로는 미디어 파일을 교체할 수 없다</summary>

- **전제**: 기존 활성 미디어가 하나 있고, `storage`에 올라가 있지만 `media.startUpload`로 발급받지 않은 `key`나 이전 파일 교체로 삭제 대기 상태가 된 `key`가 있다
- **행동**: 그 `key`로 기존 미디어의 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-9.1` `BAD_REQUEST` 오류를 던진다
  - `MED-UPD-9.2` 기존 미디어의 `key`가 원래 그대로이다

</details>

<details>
<summary><strong><code>MED-UPD-11</code></strong> 미디어 폴더를 휴지통에 보내는 동안 그 안의 미디어를 폴더 밖으로 옮기려 해도 미디어는 폴더와 함께 휴지통에 들어간다</summary>

- **전제**: `"media"` `scope`의 활성 폴더 안에 활성 미디어가 하나 있다
- **행동**: 그 폴더의 `trash.move`가 함께 옮길 항목을 정한 뒤, 그 처리가 끝나기 전에 그 미디어의 `ids`와 `folder_id: null`로 `media.update`를 실행한다
- **결과**:
  - `MED-UPD-11.1` `folders` 테이블에서 그 폴더에 `trashed_at`이 설정된다
  - `MED-UPD-11.2` `media` 테이블에서 그 미디어의 `folder_id`가 그 폴더이고 `trashed_at`이 그 폴더의 `trashed_at`과 같다

</details>

## 5. 임시 파일 정리 (`removeLooseFiles`)

### 핵심 요구사항

<details>
<summary><strong><code>MED-CLN-1</code></strong> 임시 파일 정리는 삭제 대기 시각이 지난 임시 파일만 스토리지에서 지우고 목록에서 뺀다</summary>

- **전제**: `storage`가 설정되어 있고, 삭제 대기 시각(`remove_after`)이 지금보다 앞선 `loose_files` 행과 뒤인 행이 하나씩 있다
- **행동**: `removeLooseFiles({ db, storage })`를 실행한다
- **결과**:
  - `MED-CLN-1.1` 앞선 행의 `key`로 스토리지의 `remove`를 호출하고 `loose_files` 테이블에서 그 행이 없으며 반환값의 `removed`에 포함된다
  - `MED-CLN-1.2` 뒤인 행은 `loose_files` 테이블에 원래 그대로 있고 그 `key`로는 `remove`를 호출하지 않으며 반환값의 `failed`가 비어 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>MED-CLN-2</code></strong> 스토리지에서 지우지 못한 임시 파일은 목록에 남기고 실패 정보를 돌려주며 나머지는 계속 지운다</summary>

- **전제**: `storage`가 설정되어 있고, 삭제 대기 시각이 지금보다 앞선 `loose_files` 행이 둘 있으며 스토리지가 그중 한 `key`를 지울 때만 오류를 던진다
- **행동**: `removeLooseFiles({ db, storage })`를 실행한다
- **결과**:
  - `MED-CLN-2.1` 지울 수 있었던 `key`의 행은 `loose_files` 테이블에서 없어진다
  - `MED-CLN-2.2` 지우지 못한 `key`의 행은 `loose_files` 테이블에 그대로 남는다
  - `MED-CLN-2.3` 오류를 던지지 않고 반환값의 `removed`에 성공 키, `failed`에 실패 키가 담긴다

</details>

<details>
<summary><strong><code>MED-CLN-3</code></strong> 임시 파일 정리와 미디어 등록이 같은 키로 동시에 실행되어도 등록에 성공한 파일이 스토리지에서 지워지지 않는다</summary>

- **전제**: 스토리지에 두 파일(`keyA`, `keyB`)이 올라가 있고 둘 다 삭제 대기 시각이 지난 `loose_files` 행이 있다. `keyA`는 정리가 `storage.remove`를 실행하는 도중 `media.create`가 시작되고, `keyB`는 `media.create`가 `storage.stat`을 실행하는 도중 정리가 시작된다
- **행동**: `keyA`와 `keyB` 각각에 대해 `removeLooseFiles({ db, storage })`와 `media.create`를 동시에 실행한다
- **결과**:
  - `MED-CLN-3.1` 정리가 먼저 잡은 `keyA`는 정리가 완료되어 `removed`에 포함되고 `loose_files`에서 삭제되며, 동시 실행된 `media.create`는 `BAD_REQUEST`로 거절되어 `media`에 저장되지 않는다
  - `MED-CLN-3.2` 등록이 먼저 잡은 `keyB`는 정리가 건너뛰어 `storage.remove`를 호출하지 않고, `media.create`가 성공해 파일이 스토리지에 남고 `media`에 저장되며 `loose_files`에서 삭제된다

</details>
