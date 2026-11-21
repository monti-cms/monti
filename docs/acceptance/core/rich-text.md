# `rich-text/` 인수 조건

- 각 결과 줄의 "보고된다"는 `validateDoc`이 돌려준 문제 목록에 해당 `path`의 항목이 포함됨을 뜻한다.
- 예약 속성 `attrs.mediaId`·`attrs.mediaIds` 검사는 블록 정의의 `attrs` 스키마 유무와 상관없이 `children`을 포함한 모든 블록에 적용된다(생략·`undefined`·빈 배열 `[]` 허용). 사용자 블록 스키마로 재정의할 수 없다. 블록 정의의 `attrs` 스키마 검사는 이와 별개로 함께 적용되므로, 예약 검사가 허용하는 값(생략·`[]`)을 사용자 스키마가 거절할 수 있다.

---

## 1. 문서 · 기본 블록

```
RT-DOC-1  유효한 본문 문서는 빈 문제 목록을 돌려준다
  전제  13종 내장 블록(`content`·`children` 생략과 빈 배열 포함), 세 종류 인라인 노드(`text`·`hardBreak`·`footnoteRef`)와 8종 내장 `marks`, 중첩 목록이 담긴 문서가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-1.1  빈 배열 `[]`을 돌려준다

RT-DOC-2  문서의 블록 목록이 배열이 아니면 예외를 던지지 않고 문제를 돌려준다
  전제  `blocks`가 배열이 아닌 객체(`{ blocks: {} }`)가 주어진다
  행동  `validateDoc`으로 해당 값을 검사한다
  결과  RT-DOC-2.1  `path`가 `"blocks"`인 문제가 보고된다

RT-DOC-3  블록이 객체가 아니면 해당 블록 경로의 문제를 돌려준다
  전제  `blocks[0]`이 `null`인 문서가 주어진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-3.1  `blocks[0]` 경로의 문제가 보고된다

RT-DOC-4  블록에 식별자나 종류가 빠졌으면 해당 속성 경로의 문제를 돌려준다
  전제  `blocks[0]`은 `id`가 누락되고 `blocks[1]`은 `type`이 누락된 문서가 주어진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-4.1  `blocks[0].id` 경로의 문제가 보고된다
        RT-DOC-4.2  `blocks[1].type` 경로의 문제가 보고된다

RT-DOC-5  블록의 속성·인라인 목록·하위 블록 목록 형식이 잘못되었으면 해당 경로의 문제를 돌려준다
  전제  `blocks[0]`은 객체가 아닌 `attrs`, `blocks[1]`은 배열이 아닌 `content`를 가진 `paragraph`, `blocks[2]`는 배열이 아닌 `children`을 가진 `quote`인 문서가 주어진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-5.1  `blocks[0].attrs` 경로의 문제가 보고된다
        RT-DOC-5.2  `blocks[1].content` 경로의 문제가 보고된다
        RT-DOC-5.3  `blocks[2].children` 경로의 문제가 보고된다

RT-DOC-6  같은 ID를 가진 블록이 중복되면 나중에 나온 블록을 문제로 돌려준다
  전제  `blocks[0]` 최상위 블록과 `blocks[1]` `quote`의 첫 번째 하위 블록이 같은 `id`를 가진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-6.1  `blocks[1].children[0].id` 경로의 문제가 보고된다
        RT-DOC-6.2  먼저 나온 `blocks[0].id` 경로에는 문제가 보고되지 않는다

RT-DOC-7  등록되지 않은 종류의 블록은 문제를 돌려준다
  전제  내장 블록에도 없고 `blocks`에도 등록되지 않은 `type`의 블록이 담긴 문서가 있다
  행동  추가 블록 정의 없이 `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-7.1  `blocks[0].type` 경로의 문제가 보고된다
```

## 2. 블록 확장 · 중첩 규칙

```
RT-BLK-1  추가로 등록한 사용자 정의 블록의 속성을 스키마로 검사한다
  전제  `blocks[0]`은 `attrs` 스키마를 만족하는 사용자 정의 블록이고, `blocks[1]`은 `attrs` 스키마를 어긴 같은 사용자 정의 블록인 문서가 있다
  행동  사용자 정의 블록 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-1.1  `blocks[1].attrs` 경로의 문제가 보고된다
        RT-BLK-1.2  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-BLK-2  내장 블록과 같은 이름으로 블록을 등록하면 내장 블록의 속성 검사를 덮어쓴다
  전제  `blocks[0]`은 내장 `paragraph`이고, `blocks[1]`은 덮어쓴 `attrs` 스키마를 어긴 내장 `codeBlock`인 문서가 있다
  행동  `codeBlock` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-2.1  `blocks[1].attrs` 경로의 문제가 보고된다
        RT-BLK-2.2  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-BLK-3  글자만 담는 블록에 하위 블록이 들어 있으면 문제를 돌려준다
  전제  `blocks[0]`에 `children`이 들어 있는 `paragraph`(`holds: "text"`)가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-3.1  `blocks[0].children` 경로의 문제가 보고된다

RT-BLK-4  하위 블록만 담는 블록에 인라인 글자가 들어 있으면 문제를 돌려준다
  전제  `blocks[0]`에 `content`가 들어 있는 `quote`(`holds: "blocks"`)가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-4.1  `blocks[0].content` 경로의 문제가 보고된다

RT-BLK-5  내용을 담지 않는 블록에 글자나 하위 블록이 들어 있으면 문제를 돌려준다
  전제  `blocks[0]`에 `content`와 `children`이 모두 들어 있는 `divider`(`holds: "nothing"`)가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-5.1  `blocks[0].content` 경로의 문제가 보고된다
        RT-BLK-5.2  `blocks[0].children` 경로의 문제가 보고된다

RT-BLK-6  허용된 자식 목록에 없는 하위 블록이 들어 있으면 문제를 돌려준다
  전제  `blocks[0]`은 `children: ["tab"]`인 사용자 정의 블록 안에 등록된 `tab`과 허용되지 않은 `paragraph`가 순서대로 들어 있는 문서가 있다
  행동  부모 블록과 `tab` 블록 정의를 함께 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-6.1  `blocks[0].children[1]` 경로의 문제가 보고된다
        RT-BLK-6.2  허용된 `blocks[0].children[0]`과 그 하위 경로에는 문제가 보고되지 않는다
```

## 3. 인라인 · 마크

```
RT-INL-1  등록되지 않은 종류의 인라인 노드는 문제를 돌려준다
  전제  `blocks[0]` `paragraph`의 `content[0]`에 알 수 없는 인라인 `type`이 들어 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-INL-1.1  `blocks[0].content[0].type` 경로의 문제가 보고된다

RT-INL-2  글자 노드의 텍스트가 문자열이 아니면 문제를 돌려준다
  전제  `blocks[0]` `paragraph`의 `content[0]`에 문자열이 아닌 `text` 속성을 가진 글자 노드가 들어 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-INL-2.1  `blocks[0].content[0].text` 경로의 문제가 보고된다

RT-INL-3  마크에 종류가 없거나 등록되지 않은 마크이면 문제를 돌려준다
  전제  `blocks[0]` `paragraph`의 `content[0]`은 첫 마크에 `type`이 없는 `text`이고, `content[1]`은 등록되지 않은 마크 `type`을 가진 `text`이다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-INL-3.1  `blocks[0].content[0].marks[0].type` 경로의 문제가 보고된다
        RT-INL-3.2  `blocks[0].content[1].marks[0].type` 경로의 문제가 보고된다

RT-INL-4  추가로 등록한 사용자 정의 마크의 속성을 스키마로 검사한다
  전제  `blocks[0]` `paragraph`의 `content[0]`은 `attrs` 스키마를 만족하는 사용자 정의 마크를 가진 `text`이고, `content[1]`은 `attrs` 스키마를 어긴 같은 사용자 정의 마크를 가진 `text`이다
  행동  사용자 정의 마크 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-INL-4.1  `blocks[0].content[1].marks[0]` 경로의 문제가 보고된다
        RT-INL-4.2  `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-INL-5  내장 마크와 같은 이름으로 마크를 등록하면 내장 마크의 속성 검사를 덮어쓴다
  전제  `blocks[0]` `paragraph`의 `content[0]`은 내장 `bold` 마크를 가진 `text`이고, `content[1]`은 덮어쓴 `attrs` 스키마를 어긴 내장 `link` 마크를 가진 `text`이다
  행동  `link` 마크 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-INL-5.1  `blocks[0].content[1].marks[0]` 경로의 문제가 보고된다
        RT-INL-5.2  `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다
```

## 4. 미디어 예약 속성

```
RT-MED-1  블록의 단건 미디어 예약 속성이 유효한 UUID가 아니면 문제를 돌려준다
  전제  `blocks[0]`은 유효한 UUID `attrs.mediaId`, `blocks[1]`은 UUID가 아닌 문자열 `attrs.mediaId`, `blocks[2]`는 `null`인 `attrs.mediaId`를 가진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-MED-1.1  `blocks[1].attrs.mediaId` 경로의 문제가 보고된다
        RT-MED-1.2  `blocks[2].attrs.mediaId` 경로의 문제가 보고된다
        RT-MED-1.3  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-MED-2  블록의 다건 미디어 예약 속성이 유효한 UUID 배열이 아니면 문제를 돌려준다
  전제  `blocks[0]`은 유효한 UUID 배열 `attrs.mediaIds`, `blocks[1]`은 UUID가 아닌 원소가 섞인 `attrs.mediaIds`, `blocks[2]`는 배열이 아닌 `attrs.mediaIds`를 가진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-MED-2.1  `blocks[1].attrs.mediaIds` 경로의 문제가 보고된다
        RT-MED-2.2  `blocks[2].attrs.mediaIds` 경로의 문제가 보고된다
        RT-MED-2.3  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다
```
