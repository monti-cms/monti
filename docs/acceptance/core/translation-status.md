# `resources/translation-status/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 6.5절(`<collection>_data.translation_seen`), 7절(`translationStatus` 리소스)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `translationStatus.get` | 비원문 언어 초안의 필드·본문 말단 블록별 상태(`unseen`·`seen`·`outdated`), `seen_value`, `link`, `exclude` 조회(원문 휴지통 참조 유지) | 원문 언어 `BAD_REQUEST`, 휴지통·없는 글/언어 `NOT_FOUND` |
| `translationStatus.list` | 조건(`id`, `collection`, `locale`)에 맞는 활성 글 번역 언어별 `outdated_count`·`unseen_count` 집계 | 없는 컬렉션 `BAD_REQUEST` |
| `translationStatus.update` | 필드 확인(`true`/`null`, 서로 다른 필드 동시 확인 보존, 원문 언어 변경과 겹쳐도 이전 원문 기준 기록 방지), 본문 블록 연결(`{ link }`)·번역 제외(`{ exclude: true }`)·초기화(`null`) 기록 | 원문 언어·없는 필드/블록·컨테이너 연결 `BAD_REQUEST`, 휴지통·없는 글/언어 `NOT_FOUND` |

---

## 1. 조회 (`get` · `list`)

### 핵심 요구사항

<details>
<summary><strong><code>TST-READ-1</code></strong> 아무것도 확인하지 않은 번역 언어는 필드가 모두 미확인 상태이다</summary>

- **전제**: `ko` 원문에 필드 둘이 있고 본문이 없는 컬렉션의 활성 글에 `en` 번역 언어 작업본을 방금 추가했다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-1.1` 반환값의 `id`, `collection`, `locale`, `source_locale`이 해당 글과 `"en"`, `"ko"`이다
  - `TST-READ-1.2` 반환값의 `fields`가 원문의 두 필드 모두 `{ status: "unseen" }`이다
  - `TST-READ-1.3` 반환값의 `blocks`가 빈 목록이다

</details>

<details>
<summary><strong><code>TST-READ-2</code></strong> 확인한 필드는 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다</summary>

- **전제**: `ko` 원문에 필드 둘이 있는 활성 글의 `en` 번역 언어에서 `translationStatus.update`로 두 필드를 확인한 뒤 첫 번째 필드의 원문 값을 바꿨다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-2.1` 반환값의 `fields`에서 첫 번째 필드가 `status: "outdated"`이고 `seen_value`가 바뀌기 전의 원문 값이다
  - `TST-READ-2.2` 반환값의 `fields`에서 두 번째 필드가 `status: "seen"`이고 `seen_value`가 원문 값이다

</details>

<details>
<summary><strong><code>TST-READ-3</code></strong> 본문에서는 글자나 내용이 직접 들어 있는 블록마다 상태를 갖고 컨테이너 블록은 상태를 갖지 않는다</summary>

- **전제**: `ko` 원문 본문에 문단, 문단 하나를 품은 인용, 표가 이 순서로 있는 활성 글에 `en` 번역 언어 작업본을 방금 추가했다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-3.1` 반환값의 `blocks`가 첫 문단, 인용 안의 문단, 표 순서로 세 개이고 모두 `status`가 `"unseen"`이다

</details>

<details>
<summary><strong><code>TST-READ-4</code></strong> 연결한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다</summary>

- **전제**: `ko` 원문 본문에 문단 둘, `en` 번역 본문에도 문단 둘이 있는 활성 글에서 `translationStatus.update`로 각 원문 문단을 번역 문단과 연결한 뒤 첫 번째 원문 문단의 글을 바꿨다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-4.1` 반환값의 `blocks`에서 첫 번째 문단이 `status: "outdated"`, `link`(첫 번째 번역 문단의 `id`), `seen_value`(바뀌기 전의 원문 문단)이다
  - `TST-READ-4.2` 반환값의 `blocks`에서 두 번째 문단이 `status: "seen"`, `link`(두 번째 번역 문단의 `id`), `seen_value`(원문 문단)이다

</details>

<details>
<summary><strong><code>TST-READ-5</code></strong> 번역 제외로 표시한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다</summary>

- **전제**: `ko` 원문 본문에 문단 둘이 있는 활성 글의 `en` 번역 언어에서 `translationStatus.update`로 두 원문 문단을 번역 제외로 표시한 뒤 첫 번째 원문 문단의 글을 바꿨다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-5.1` 반환값의 `blocks`에서 첫 번째 문단이 `status: "outdated"`, `exclude: true`, `seen_value`(바뀌기 전의 원문 문단)이다
  - `TST-READ-5.2` 반환값의 `blocks`에서 두 번째 문단이 `status: "seen"`, `exclude: true`, `seen_value`(원문 문단)이다

</details>

<details>
<summary><strong><code>TST-READ-6</code></strong> 연결한 번역 블록이 번역 본문에서 지워지면 그 원문 블록은 원문 변경 상태가 된다</summary>

- **전제**: `ko` 원문 본문의 문단을 `en` 번역 본문의 문단과 `translationStatus.update`로 연결한 뒤 `entries.update`로 번역 본문에서 그 문단을 지웠다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-6.1` 반환값의 `blocks`의 `status`가 `"outdated"`이다

</details>

<details>
<summary><strong><code>TST-READ-10</code></strong> 번역 언어마다 원문이 바뀐 항목과 확인하지 않은 항목의 개수를 한 줄씩 돌려준다</summary>

- **전제**: `ko` 원문에 필드 하나와 문단 하나가 있고 `en`, `ja` 번역 언어 작업본을 가진 활성 글(첫 번째 글)과 `en` 번역 언어 작업본을 가진 휴지통 글이 있다. 첫 번째 글의 `en` 번역 본문에는 문단 하나가 있고, `translationStatus.update`로 필드를 확인하고 문단을 연결한 뒤 원문 문단의 글을 바꿨다. `ja`는 아무것도 확인하지 않았다
- **행동**: 입력 없이 `translationStatus.list`를 실행한다
- **결과**:
  - `TST-READ-10.1` 순서와 관계없이 첫 번째 글의 `en` 줄(`outdated_count` 1, `unseen_count` 0)과 `ja` 줄(`outdated_count` 0, `unseen_count` 2) 두 줄만 `id`, `collection`, `locale`, `source_locale`과 함께 돌려준다

</details>

<details>
<summary><strong><code>TST-READ-11</code></strong> 글을 지정하면 그 글의 번역 언어 줄만 돌려준다</summary>

- **전제**: `en` 번역 언어 작업본을 가진 활성 글이 둘 있다
- **행동**: 첫 번째 글의 `id`로 `translationStatus.list`를 실행한다
- **결과**:
  - `TST-READ-11.1` 첫 번째 글의 `en` 줄 하나만 돌려준다

</details>

<details>
<summary><strong><code>TST-READ-12</code></strong> 컬렉션과 언어를 지정하면 둘 다 일치하는 줄만 돌려준다</summary>

- **전제**: 한 컬렉션의 활성 글(`en`, `ja` 번역 언어 작업본)과 다른 컬렉션의 활성 글(`en` 번역 언어 작업본)이 있다
- **행동**: 첫 번째 컬렉션과 `locale: "en"`으로 `translationStatus.list`를 실행한다
- **결과**:
  - `TST-READ-12.1` 첫 번째 컬렉션 글의 `en` 줄 하나만 돌려준다

</details>

<details>
<summary><strong><code>TST-READ-13</code></strong> 확인한 원문 필드가 가리키는 대상이 휴지통에 들어가도 확인 완료 상태가 유지된다</summary>

- **전제**: `ko` 원문 작업본이 활성 미디어를 참조하고 `en` 번역 언어에서 `translationStatus.update`로 그 필드를 확인한 뒤, 그 미디어가 휴지통으로 이동했다(`trashed_at` 설정)
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-13.1` 반환값의 `fields`에서 그 필드가 `status: "seen"`이고 `seen_value`가 그 미디어의 `id`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TST-READ-7</code></strong> 원문 언어의 번역 상태는 조회할 수 없다</summary>

- **전제**: `ko` 원문 작업본과 `en` 번역 언어 작업본을 가진 활성 글이 하나 있다
- **행동**: 해당 글의 `id`와 `locale: "ko"`로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-7.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-READ-8</code></strong> 글에 없는 언어의 번역 상태는 조회할 수 없다</summary>

- **전제**: `ko` 원문 작업본만 가진 활성 글이 하나 있다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-8.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-READ-9</code></strong> 휴지통에 있는 글의 번역 상태는 조회할 수 없다</summary>

- **전제**: `ko` 원문과 `en` 번역 언어 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
- **행동**: 해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
- **결과**:
  - `TST-READ-9.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-READ-14</code></strong> 스키마에 없는 컬렉션으로는 번역 상태 목록을 조회할 수 없다</summary>

- **전제**: 스키마에 컬렉션이 하나 있다
- **행동**: 스키마에 없는 `collection`으로 `translationStatus.list`를 실행한다
- **결과**:
  - `TST-READ-14.1` `BAD_REQUEST` 오류를 던진다

</details>

## 2. 갱신 (`update`)

### 핵심 요구사항

<details>
<summary><strong><code>TST-UPD-1</code></strong> 확인하지 않은 필드를 확인하면 확인 완료 상태가 된다</summary>

- **전제**: `ko` 원문에 필드 둘이 있는 활성 글에 `en` 번역 언어 작업본이 있다. 아직 아무것도 확인하지 않았다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 첫 번째 필드의 키만 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-1.1` 반환값의 `fields`에서 첫 번째 필드가 `status: "seen"`이고 `seen_value`가 원문 값이며, 두 번째 필드가 `{ status: "unseen" }`이다
  - `TST-UPD-1.2` `<collection>_data` 테이블에서 `"en"` 작업본 행의 `slug`와 필드 값들이 원래 그대로이다

</details>

<details>
<summary><strong><code>TST-UPD-2</code></strong> 원문이 바뀐 필드를 다시 확인하면 확인 완료 상태가 된다</summary>

- **전제**: `ko` 원문의 필드를 확인한 `en` 번역 언어에서 그 필드의 원문 값을 바꿨다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 그 필드의 키를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-2.1` 반환값의 `fields`에서 그 필드가 `status: "seen"`이고 `seen_value`가 바뀐 뒤의 원문 값이다

</details>

<details>
<summary><strong><code>TST-UPD-3</code></strong> 필드의 기록을 지우면 그 필드만 미확인 상태로 돌아간다</summary>

- **전제**: `ko` 원문에 필드 둘이 있는 활성 글의 `en` 번역 언어에서 두 필드를 모두 확인했다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 첫 번째 필드의 키만 `null`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-3.1` 반환값의 `fields`에서 첫 번째 필드가 `{ status: "unseen" }`이다
  - `TST-UPD-3.2` 반환값의 `fields`에서 두 번째 필드의 `status`가 `"seen"`이다

</details>

<details>
<summary><strong><code>TST-UPD-4</code></strong> 아직 연결하지 않은 원문 블록을 번역 블록과 연결하면 확인 완료 상태가 된다</summary>

- **전제**: `ko` 원문 본문에 문단 하나를 품은 인용이 있고 `en` 번역 본문에도 문단 하나를 품은 인용이 있는 활성 글이 있다. 아직 아무것도 확인하지 않았다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문 인용 안 문단의 `id`를 키로, 번역 인용 안 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-4.1` 반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `link`(번역 문단의 `id`), `seen_value`(원문 문단) 한 개를 포함한다
  - `TST-UPD-4.2` `<collection>_data` 테이블에서 `"en"` 작업본 행의 `slug`와 `body`가 원래 그대로이다
  - `TST-UPD-4.3` `<collection>_data` 테이블에서 `"ko"` 작업본 행의 `translation_seen`이 원래 그대로이다

</details>

<details>
<summary><strong><code>TST-UPD-5</code></strong> 원문이 바뀐 블록을 같은 번역 블록과 다시 연결하면 확인 완료 상태가 된다</summary>

- **전제**: `ko` 원문 본문에 문단 하나, `en` 번역 본문에도 문단 하나가 있는 활성 글에서 `translationStatus.update`로 원문 문단을 번역 문단과 연결한 뒤 원문 문단의 글을 바꿨다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, 같은 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-5.1` 반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `link`(번역 문단의 `id`), `seen_value`(바뀐 뒤의 원문 문단) 한 개이다

</details>

<details>
<summary><strong><code>TST-UPD-6</code></strong> 아직 확인하지 않은 원문 블록을 번역 제외로 표시하면 확인 완료 상태가 된다</summary>

- **전제**: `ko` 원문 본문에 문단 하나가 있는 활성 글에 `en` 번역 언어 작업본이 있다. 아직 아무것도 확인하지 않았다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, `{ exclude: true }`를 값으로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-6.1` 반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `exclude: true`, `seen_value`(원문 문단) 한 개이다

</details>

<details>
<summary><strong><code>TST-UPD-7</code></strong> 블록의 기록을 지우면 그 블록만 미확인 상태로 돌아간다</summary>

- **전제**: `ko` 원문 본문에 문단 둘, `en` 번역 본문에도 문단 둘이 있는 활성 글에서 `translationStatus.update`로 각 원문 문단을 번역 문단과 연결했다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 첫 번째 원문 문단의 `id`를 키로, `null`을 값으로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-7.1` 반환값의 `blocks`에서 첫 번째 문단의 `status`가 `"unseen"`이고 `link`가 없다
  - `TST-UPD-7.2` 반환값의 `blocks`에서 두 번째 문단의 `status`가 `"seen"`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>TST-UPD-8</code></strong> 원문에 없는 필드는 확인 완료로 표시할 수 없다</summary>

- **전제**: `ko` 원문에 필드 하나만 있는 활성 글에 `en` 번역 언어 작업본이 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문에 없는 필드의 키를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-8.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-9</code></strong> 원문 본문에 없는 블록은 연결할 수 없다</summary>

- **전제**: `ko` 원문 본문에 문단 하나가 있고 `en` 번역 본문에도 문단 하나가 있는 활성 글이 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문에 없는 블록 `id`를 키로, 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-9.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-10</code></strong> 컨테이너 블록은 번역 블록과 연결할 수 없다</summary>

- **전제**: `ko` 원문 본문에 문단 하나를 품은 인용이 있고 `en` 번역 본문에 문단 하나가 있는 활성 글이 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문 인용 블록의 `id`를 키로, 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-10.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-11</code></strong> 번역 본문에 없는 블록과는 연결할 수 없다</summary>

- **전제**: `ko` 원문 본문에 문단 하나가 있고 `en` 번역 본문에도 문단 하나가 있는 활성 글이 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, 번역 본문에 없는 블록 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-11.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-12</code></strong> 원문 언어의 번역 상태는 수정할 수 없다</summary>

- **전제**: `ko` 원문 작업본과 `en` 번역 언어 작업본을 가진 활성 글이 하나 있다
- **행동**: 해당 글의 `id`, `locale: "ko"`와 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-12.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-13</code></strong> 글에 없는 언어의 번역 상태는 수정할 수 없다</summary>

- **전제**: `ko` 원문 작업본만 가진 활성 글이 하나 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-13.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-14</code></strong> 휴지통에 있는 글의 번역 상태는 수정할 수 없다</summary>

- **전제**: `ko` 원문과 `en` 번역 언어 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
- **행동**: 해당 글의 `id`, `locale: "en"`과 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
- **결과**:
  - `TST-UPD-14.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>TST-UPD-15</code></strong> 같은 번역 언어에서 서로 다른 두 필드를 동시에 확인해도 두 확인 기록이 모두 남는다</summary>

- **전제**: `ko` 원문에 필드 둘(첫 번째 필드, 두 번째 필드)이 있는 활성 글에 `en` 번역 언어 작업본이 있다
- **행동**: 첫 번째 필드만 `true`로 확인하는 `translationStatus.update`와 두 번째 필드만 `true`로 확인하는 `translationStatus.update`를, 두 호출이 모두 변경 전 `translation_seen`을 읽은 뒤 쓰기 전에 겹치도록 실행한다
- **결과**:
  - `TST-UPD-15.1` 두 호출 모두 오류 없이 끝난다
  - `TST-UPD-15.2` `translationStatus.get` 결과에서 두 필드 모두 `status: "seen"`이다

</details>

<details>
<summary><strong><code>TST-UPD-16</code></strong> 원문 언어를 바꾸는 동안 번역 상태 확인이 겹쳐도 이전 원문 기준 기록이 남지 않는다</summary>

- **전제**: `ko` 원문(`title: "한국어 제목"`), `en`(`title: "English title"`), `ja` 번역 언어 작업본을 가진 활성 글이 있다
- **행동**: `ja`의 `title`을 확인하는 `translationStatus.update`가 `"ko"` 원문 값을 읽은 뒤 `translation_seen`에 쓰기 전에, `entries.setSourceLocale({ id, locale: "en" })`이 별도 연결에서 커밋되도록 실행한다
- **결과**:
  - `TST-UPD-16.1` `setSourceLocale`이 성공해 `source_locale`이 `"en"`이 된다
  - `TST-UPD-16.2` `ja`의 `translationStatus.get` 결과에서 `title`의 `seen_value`가 이전 `"ko"` 원문 값이 아니라 새 `"en"` 원문 값(`"English title"`)과 같다

</details>
