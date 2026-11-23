# `rich-text/` 인수 조건

| 영역 | 하는 일 |
|---|---|
| 문서 · 기본 블록 | `validateDoc`은 예외를 던지지 않고 13종 내장 블록·인라인·마크의 구조와 중복 `id`를 검사해 문제 목록(`path`)을 돌려준다 |
| 블록 확장 · 중첩 | 사용자 정의 블록 추가 및 내장 블록 `attrs` 덮어쓰기, `holds`(`text`·`blocks`·`nothing`)와 허용 `children` 목록 및 최대 중첩 깊이(32단계)를 검사한다 |
| 인라인 · 마크 | `text`·`hardBreak`·`footnoteRef` 인라인과 8종 내장·사용자 정의 마크의 형식 및 내장 `link` 마크의 `href` 허용 스킴(`http:`, `https:`, `mailto:`, `/`, `#`)을 검사한다 |
| 미디어 예약 속성 | 모든 블록(`children` 포함)의 `attrs.mediaId`(UUID)·`attrs.mediaIds`(UUID 배열)를 사용자 스키마와 무관하게 검사한다 |

---

## 1. 문서 · 기본 블록

### 핵심 요구사항

<details>
<summary><strong><code>RT-DOC-1</code></strong> 유효한 본문 문서는 빈 문제 목록을 돌려준다</summary>

- **전제**: 13종 내장 블록(`content`·`children` 생략과 빈 배열 포함), 세 종류 인라인 노드(`text`·`hardBreak`·`footnoteRef`)와 8종 내장 `marks`, 중첩 목록이 담긴 문서가 있다
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

- **전제**: `blocks[0]`은 `id`가 누락되고 `blocks[1]`은 `type`이 누락된 문서가 주어진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-4.1` `blocks[0].id` 경로의 문제가 보고된다
  - `RT-DOC-4.2` `blocks[1].type` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-DOC-5</code></strong> 블록의 속성·인라인 목록·하위 블록 목록 형식이 잘못되었으면 해당 경로의 문제를 돌려준다</summary>

- **전제**: `blocks[0]`은 객체가 아닌 `attrs`, `blocks[1]`은 배열이 아닌 `content`를 가진 `paragraph`, `blocks[2]`는 배열이 아닌 `children`을 가진 `quote`인 문서가 주어진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-DOC-5.1` `blocks[0].attrs` 경로의 문제가 보고된다
  - `RT-DOC-5.2` `blocks[1].content` 경로의 문제가 보고된다
  - `RT-DOC-5.3` `blocks[2].children` 경로의 문제가 보고된다

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
<summary><strong><code>RT-BLK-7</code></strong> 블록 중첩이 최대 깊이인 32단계까지는 통과한다</summary>

- **전제**: `quote` 블록이 최상위 블록(1단계)부터 안쪽으로 32단계 중첩된 문서가 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-7.1` 빈 배열 `[]`을 돌려준다

</details>

<details>
<summary><strong><code>RT-BLK-8</code></strong> 블록 중첩이 최대 깊이(32단계)를 넘으면 예외를 던지지 않고 초과 위치 경로의 문제로 돌려준다</summary>

- **전제**: `quote` 블록이 최상위 블록(1단계)부터 안쪽으로 33단계 중첩된 문서가 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-BLK-8.1` 예외를 던지지 않고 33단계 위치 경로(`blocks[0]` 아래 `.children[0]` 32회)의 문제를 돌려준다

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

- **전제**: `blocks[0]` `paragraph`의 `content[0]`에 객체가 아닌 값(`null`), `content[1]`에 알 수 없는 인라인 `type`, `content[2]`에 문자열 `id`가 없는 `footnoteRef`가 들어 있다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-1.1` `blocks[0].content[0]` 경로의 문제가 보고된다
  - `RT-INL-1.2` `blocks[0].content[1].type` 경로의 문제가 보고된다
  - `RT-INL-1.3` `blocks[0].content[2].id` 경로의 문제가 보고된다

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

- **전제**: `blocks[0]` `paragraph`의 `content[0]`은 첫 마크에 `type`이 없는 `text`, `content[1]`은 등록되지 않은 마크 `type`을 가진 `text`, `content[2]`는 배열이 아닌 `marks`를 가진 `text`, `content[3]`은 객체가 아닌 마크(`null`)를 가진 `text`이다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-3.1` `blocks[0].content[0].marks[0].type` 경로의 문제가 보고된다
  - `RT-INL-3.2` `blocks[0].content[1].marks[0].type` 경로의 문제가 보고된다
  - `RT-INL-3.3` `blocks[0].content[2].marks` 경로의 문제가 보고된다
  - `RT-INL-3.4` `blocks[0].content[3].marks[0]` 경로의 문제가 보고된다

</details>

<details>
<summary><strong><code>RT-INL-6</code></strong> 내장 링크 마크의 주소에 허용되지 않은 스킴이나 스킴 없는 네트워크 경로가 들어 있으면 문제를 돌려준다</summary>

- **전제**: `blocks[0]` `paragraph` 안에 허용 주소(`https://example.com`, `http://example.com`, `mailto:a@example.com`, 상대 경로 `/about`, 문서 내 조각 `#top`)를 가진 `link` 마크들과 위험 주소(`javascript:alert(1)`, `JavaScript:alert(1)`, `data:text/html,<script>`, `//example.com`)를 가진 `link` 마크들이 들어 있다
- **행동**: 추가 마크 정의 없이 `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-INL-6.1` `https:`, `http:`, `mailto:` 주소의 `link` 마크 경로에는 문제가 보고되지 않는다
  - `RT-INL-6.2` 상대 경로(`/about`)와 문서 내 조각(`#top`)의 `link` 마크 경로에는 문제가 보고되지 않는다
  - `RT-INL-6.3` `javascript:`, `JavaScript:`, `data:`, `//example.com` 주소의 각 `link` 마크 경로(`blocks[0].content[n].marks[0]`의 `href`)에는 각각 문제가 보고된다

</details>

## 4. 미디어 예약 속성

<details>
<summary><strong><code>RT-MED-1</code></strong> 블록의 단건 미디어 예약 속성이 유효한 UUID가 아니면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`은 유효한 UUID `attrs.mediaId`, `blocks[1]`은 UUID가 아닌 문자열 `attrs.mediaId`, `blocks[2]`는 `null`인 `attrs.mediaId`를 가진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-MED-1.1` `blocks[1].attrs.mediaId` 경로의 문제가 보고된다
  - `RT-MED-1.2` `blocks[2].attrs.mediaId` 경로의 문제가 보고된다
  - `RT-MED-1.3` `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>

<details>
<summary><strong><code>RT-MED-2</code></strong> 블록의 다건 미디어 예약 속성이 유효한 UUID 배열이 아니면 문제를 돌려준다</summary>

- **전제**: `blocks[0]`은 유효한 UUID 배열 `attrs.mediaIds`, `blocks[1]`은 UUID가 아닌 원소가 섞인 `attrs.mediaIds`, `blocks[2]`는 배열이 아닌 `attrs.mediaIds`를 가진다
- **행동**: `validateDoc`으로 문서를 검사한다
- **결과**:
  - `RT-MED-2.1` `blocks[1].attrs.mediaIds` 경로의 문제가 보고된다
  - `RT-MED-2.2` `blocks[2].attrs.mediaIds` 경로의 문제가 보고된다
  - `RT-MED-2.3` `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

</details>
