# `rich-text/` 인수 조건

| 영역 | 하는 일 |
|---|---|
| 문서 · 기본 블록 | `validateDoc`은 예외를 던지지 않고 13종 내장 블록·인라인·마크의 구조와 중복 `id`를 검사해 문제 목록(`path`)을 돌려준다 |
| 블록 확장 · 중첩 | 사용자 정의 블록 추가 및 내장 블록 `attrs` 덮어쓰기, `holds`(`text`·`blocks`·`nothing`)와 허용 `children` 목록 및 최대 중첩 깊이(32단계)를 검사한다 |
| 인라인 · 마크 | `text`·`hardBreak`·`footnoteRef` 인라인과 8종 내장·사용자 정의 마크의 형식 및 내장 `link` 마크의 `href` 허용 스킴(`http:`, `https:`, `mailto:`, `/`, `#`)과 제어 문자 금지를 검사한다 |
| 미디어 예약 속성 | 모든 블록(`children` 포함)의 `attrs.mediaId`(UUID)·`attrs.mediaIds`(UUID 배열)를 사용자 스키마와 무관하게 검사한다 |

---

## 1. 문서 · 기본 블록

### 핵심 요구사항

<details>
<summary><strong><code>RT-DOC-1</code></strong> 유효한 본문 문서는 빈 문제 목록을 돌려준다</summary>

- **전제**: 모든 내장 블록·인라인 노드·마크와 중첩 목록이 담긴 유효한 문서가 있다(`content`·`children`은 생략하거나 빈 배열이어도 된다)
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-1.1` 빈 배열 `[]`을 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>RT-DOC-2</code></strong> 문서가 객체가 아니거나 블록 목록이 배열이 아니면 예외를 던지지 않고 문제를 돌려준다</summary>

- **전제**: 객체가 아닌 값(`null`)과 `blocks`가 배열이 아닌 객체(`{ blocks: {} }`)가 주어진다
- **행동**: `validateDoc`으로 각 값을 검사한다
- **결과**:
  - `RT-DOC-2.1` 객체가 아닌 값에서는 `path`가 `""`인 문제가 보고되고, `blocks`가 배열이 아닌 객체에서는 `path`가 `"blocks"`인 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-DOC-3</code></strong> 블록이 객체가 아니면 해당 블록 경로의 문제를 돌려준다</summary>

- **전제**: `blocks[0]`이 `null`인 문서가 주어진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-3.1` `blocks[0]` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-DOC-4</code></strong> 블록에 식별자나 종류가 빠졌으면 해당 속성 경로의 문제를 돌려준다</summary>

- **전제**: `id`가 빠진 블록과 `type`이 빠진 블록이 든 문서가 주어진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-4.1` 빠진 속성마다 그 경로(`blocks[n].id`, `blocks[n].type`)의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-DOC-5</code></strong> 블록의 속성·인라인 목록·하위 블록 목록 형식이 잘못되었으면 해당 경로의 문제를 돌려준다</summary>

- **전제**: `attrs`가 객체가 아니거나 `content`·`children`이 배열이 아닌 블록이 든 문서가 주어진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-5.1` 잘못된 속성마다 그 경로(`blocks[n].attrs`, `blocks[n].content`, `blocks[n].children`)의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-DOC-6</code></strong> 같은 ID를 가진 블록이 중복되면 나중에 나온 블록을 문제로 돌려준다</summary>

- **전제**: `blocks[0]` 최상위 블록과 `blocks[1]` `quote`의 첫 번째 하위 블록이 같은 `id`를 가진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-6.1` `blocks[1].children[0].id` 경로의 문제가 보고된다
  - `RT-DOC-6.2` 먼저 나온 `blocks[0].id` 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-DOC-7</code></strong> 등록되지 않은 종류의 블록은 문제를 돌려준다</summary>

- **전제**: 내장 블록에도 없고 `blocks`에도 등록되지 않은 `type`의 블록이 담긴 문서가 있다
- **행동**: 추가 블록 정의 없이 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-7.1` `blocks[0].type` 경로의 문제가 보고된다

</details>

## 2. 블록 확장 · 중첩 규칙

### 핵심 요구사항

<details>
<summary><strong><code>RT-BLK-1</code></strong> 추가로 등록한 사용자 정의 블록의 속성을 스키마로 검사한다</summary>

- **전제**: `blocks[0]`은 `attrs` 스키마를 만족하는 사용자 정의 블록이고, `blocks[1]`은 `attrs` 스키마를 어긴 같은 사용자 정의 블록인 문서가 있다
- **행동**: 사용자 정의 블록 정의를 넘겨 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-1.1` `blocks[1].attrs` 경로의 문제가 보고된다
  - `RT-BLK-1.2` `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-BLK-2</code></strong> 내장 블록과 같은 이름으로 블록을 등록하면 내장 블록의 속성 검사를 덮어쓴다</summary>

- **전제**: `blocks[0]`은 내장 `paragraph`이고, `blocks[1]`은 덮어쓴 `attrs` 스키마를 어긴 내장 `codeBlock`인 문서가 있다
- **행동**: `codeBlock` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-2.1` `blocks[1].attrs` 경로의 문제가 보고된다
  - `RT-BLK-2.2` `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>RT-BLK-3</code></strong> 글자만 담는 블록에 하위 블록이 들어 있으면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`에 `children`이 들어 있는 `paragraph`(`holds: "text"`)가 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-3.1` `blocks[0].children` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-BLK-4</code></strong> 하위 블록만 담는 블록에 인라인 글자가 들어 있으면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`에 `content`가 들어 있는 `quote`(`holds: "blocks"`)가 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-4.1` `blocks[0].content` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-BLK-5</code></strong> 내용을 담지 않는 블록에 글자나 하위 블록이 들어 있으면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`에 `content`와 `children`이 모두 들어 있는 `divider`(`holds: "nothing"`)가 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-5.1` `blocks[0].content` 경로의 문제가 보고된다
  - `RT-BLK-5.2` `blocks[0].children` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-BLK-6</code></strong> 허용된 자식 목록에 없는 하위 블록이 들어 있으면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`은 `children: ["tab"]`인 사용자 정의 블록 안에 등록된 `tab`과 허용되지 않은 `paragraph`가 순서대로 들어 있는 문서가 있다
- **행동**: 부모 블록과 `tab` 블록 정의를 함께 넘겨 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-6.1` `blocks[0].children[1]` 경로의 문제가 보고된다
  - `RT-BLK-6.2` 허용된 `blocks[0].children[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-BLK-8</code></strong> 블록 중첩은 32단계까지 통과하고 이를 넘으면 처음 한도를 넘긴 블록이 문제로 보고된다</summary>

- **전제**: `quote` 블록이 최상위 블록(1단계)부터 안쪽으로 32단계 중첩된 문서와 33단계 중첩된 문서가 있다
- **행동**: 각 문서를 `validateDoc`으로 검사한다
- **결과**:
  - `RT-BLK-8.1` 33단계 문서는 예외를 던지지 않고 33단계 블록의 경로(`blocks[0]` 아래 `.children[0]` 32회)를 문제로 돌려준다
  - `RT-BLK-8.2` 32단계 문서는 빈 배열 `[]`을 돌려준다

</details>

## 3. 인라인 · 마크

### 핵심 요구사항

<details>
<summary><strong><code>RT-INL-4</code></strong> 추가로 등록한 사용자 정의 마크의 속성을 스키마로 검사한다</summary>

- **전제**: `blocks[0]` `paragraph`의 `content[0]`은 `attrs` 스키마를 만족하는 사용자 정의 마크를 가진 `text`이고, `content[1]`은 `attrs` 스키마를 어긴 같은 사용자 정의 마크를 가진 `text`이다
- **행동**: 사용자 정의 마크 정의를 넘겨 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-4.1` `blocks[0].content[1].marks[0]` 경로의 문제가 보고된다
  - `RT-INL-4.2` `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-INL-5</code></strong> 내장 마크와 같은 이름으로 마크를 등록하면 내장 마크의 속성 검사를 덮어쓴다</summary>

- **전제**: `blocks[0]` `paragraph`의 `content[0]`은 내장 `bold` 마크를 가진 `text`이고, `content[1]`은 덮어쓴 `attrs` 스키마를 어긴 내장 `link` 마크를 가진 `text`이다
- **행동**: `link` 마크 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-5.1` `blocks[0].content[1].marks[0]` 경로의 문제가 보고된다
  - `RT-INL-5.2` `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>RT-INL-1</code></strong> 인라인 노드가 객체가 아니거나 등록되지 않은 종류이거나 각주 참조 ID가 문자열이 아니면 문제를 돌려준다</summary>

- **전제**: `paragraph`의 `content`에 객체가 아닌 노드, 등록되지 않은 종류의 노드, 문자열 `id`가 없는 `footnoteRef`가 들어 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-1.1` 잘못된 노드마다 그 경로(노드 자체, `type`, 각주 참조의 `id`)의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-INL-2</code></strong> 글자 노드의 텍스트가 문자열이 아니면 문제를 돌려준다</summary>

- **전제**: `blocks[0]` `paragraph`의 `content[0]`에 문자열이 아닌 `text` 속성을 가진 글자 노드가 들어 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-2.1` `blocks[0].content[0].text` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-INL-3</code></strong> 마크 목록이나 마크 항목 형식이 잘못되었거나 등록되지 않은 마크이면 문제를 돌려준다</summary>

- **전제**: `paragraph`의 `content`에 `marks`가 배열이 아니거나, 객체가 아닌 마크, `type`이 없는 마크, 등록되지 않은 마크를 가진 `text` 노드들이 들어 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-3.1` 잘못된 마크마다 그 경로(`marks`, `marks[n]`, `marks[n].type`)의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-INL-6</code></strong> 내장 링크 마크의 주소에 허용되지 않은 스킴이나 스킴 없는 네트워크 경로가 들어 있으면 문제를 돌려준다</summary>

- **전제**: `paragraph` 안에 허용 주소와 위험 주소를 가진 `link` 마크들이 들어 있다
- **행동**: 추가 마크 정의 없이 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-6.1` `https:`, `http:`, `mailto:` 주소의 `link` 마크 경로에는 문제가 보고되지 않는다
  - `RT-INL-6.2` 상대 경로와 문서 내 조각(`#`)의 `link` 마크 경로에는 문제가 보고되지 않는다
  - `RT-INL-6.3` 그 밖의 스킴(대소문자 무관)과 `//`로 시작하는 주소의 `link` 마크 경로(`blocks[0].content[n].marks[0]`)마다 문제가 보고된다
  - `RT-INL-6.4` 슬래시 사이에 탭 문자가 든 주소의 `link` 마크 경로에는 문제가 보고된다

</details>

## 4. 미디어 예약 속성

<details>
<summary><strong><code>RT-MED-1</code></strong> 블록의 단건 미디어 예약 속성이 유효한 UUID가 아니면 문제를 돌려준다</summary>

- **전제**: `attrs.mediaId`가 유효한 UUID인 블록, UUID가 아닌 문자열인 블록, `null`인 블록이 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-MED-1.1` UUID가 아니거나 `null`인 블록의 `attrs.mediaId` 경로에 문제가 보고된다
  - `RT-MED-1.3` 유효한 UUID 블록과 그 하위 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-MED-2</code></strong> 블록의 다건 미디어 예약 속성이 유효한 UUID 배열이 아니면 문제를 돌려준다</summary>

- **전제**: `attrs.mediaIds`가 유효한 UUID 배열인 블록, UUID가 아닌 원소가 섞인 블록, 배열이 아닌 블록이 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-MED-2.1` 유효한 UUID 배열이 아닌 블록의 `attrs.mediaIds` 경로에 문제가 보고된다
  - `RT-MED-2.3` 유효한 UUID 배열 블록과 그 하위 경로에는 문제가 보고되지 않는다

</details>
