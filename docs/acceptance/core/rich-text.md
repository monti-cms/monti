# `rich-text/` 인수 조건

- 각 결과 줄의 "보고된다"는 `validateDoc`이 돌려준 문제 목록에 해당 `path`의 항목이 포함됨을 뜻한다.
- 예약 속성 `attrs.mediaId`·`attrs.mediaIds` 검사는 블록 정의의 `attrs` 스키마 유무와 상관없이 `children`을 포함한 모든 블록에 적용된다(생략·`undefined`·빈 배열 `[]` 허용). 사용자 블록 스키마로 재정의할 수 없다.

---

## 1. 문서 · 기본 블록

```
RT-DOC-1  유효한 본문 문서는 빈 문제 목록을 돌려준다
  전제  13종 내장 블록(`content`·`children` 생략과 빈 배열 포함), 세 종류 인라인 노드(`text`·`hardBreak`·`footnoteRef`)와 8종 내장 `marks`, 중첩 목록이 담긴 문서가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-1.1  빈 배열 `[]`을 돌려준다

RT-DOC-2  문서 최상위 구조가 잘못되어도 예외를 던지지 않고 문제를 돌려준다
  전제  `blocks`가 배열이 아닌 객체(`{ blocks: {} }`)가 주어진다
  행동  `validateDoc`으로 해당 값을 검사한다
  결과  RT-DOC-2.1  `path`가 `"blocks"`인 문제가 보고된다

RT-DOC-3  블록의 필수 속성이나 형식이 깨져 있으면 해당 경로의 문제를 모두 돌려준다
  전제  `blocks`에 아래 6개 잘못된 블록이 순서대로 들어 있다: `[0]` `null`, `[1]` `id` 누락, `[2]` `type` 누락, `[3]` 객체가 아닌 `attrs`, `[4]` 배열이 아닌 `content`를 가진 `paragraph`, `[5]` 배열이 아닌 `children`을 가진 `quote`
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-3.1  `blocks[0]` 경로의 문제가 보고된다
        RT-DOC-3.2  `blocks[1].id` 경로의 문제가 보고된다
        RT-DOC-3.3  `blocks[2].type` 경로의 문제가 보고된다
        RT-DOC-3.4  `blocks[3].attrs` 경로의 문제가 보고된다
        RT-DOC-3.5  `blocks[4].content` 경로의 문제가 보고된다
        RT-DOC-3.6  `blocks[5].children` 경로의 문제가 보고된다

RT-DOC-4  같은 ID를 가진 블록이 중복되면 나중에 나온 블록을 문제로 돌려준다
  전제  `blocks[0]` 최상위 블록과 `blocks[1]` `quote`의 첫 번째 하위 블록이 같은 `id`를 가진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-4.1  `blocks[1].children[0].id` 경로의 문제가 보고된다
        RT-DOC-4.2  먼저 나온 `blocks[0].id` 경로에는 문제가 보고되지 않는다

RT-DOC-5  등록되지 않은 종류의 블록은 문제를 돌려준다
  전제  내장 블록에도 없고 `blocks`에도 등록되지 않은 `type`의 블록이 담긴 문서가 있다
  행동  추가 블록 정의 없이 `validateDoc`으로 문서를 검사한다
  결과  RT-DOC-5.1  `blocks[0].type` 경로의 문제가 보고된다
```

## 2. 블록 확장 · 중첩 규칙

```
RT-BLK-1  추가로 등록한 블록 정의는 내장 블록을 유지·덮어쓰며 속성을 검사한다
  전제  `blocks`에 4개 블록이 순서대로 들어 있다: `[0]` 내장 `paragraph`, `[1]` `attrs` 스키마를 만족하는 사용자 정의 블록(`holds: "blocks"`), `[2]` `attrs` 스키마를 어긴 같은 사용자 정의 블록, `[3]` 덮어쓴 `attrs` 스키마를 어긴 내장 `codeBlock`
  행동  사용자 정의 블록 정의와 `codeBlock` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-1.1  `blocks[2].attrs` 경로의 문제가 보고된다
        RT-BLK-1.2  `blocks[3].attrs` 경로의 문제가 보고된다
        RT-BLK-1.3  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다
        RT-BLK-1.4  `blocks[1]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-BLK-2  블록이 담을 수 있는 종류에 맞지 않는 내용이나 자식이 있으면 문제를 돌려준다
  전제  `blocks`에 3개 블록이 순서대로 들어 있다: `[0]` `children`이 들어 있는 `paragraph`(`holds: "text"`), `[1]` `content`가 들어 있는 `quote`(`holds: "blocks"`), `[2]` `content`와 `children`이 모두 들어 있는 `divider`(`holds: "nothing"`)
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-2.1  `blocks[0].children` 경로의 문제가 보고된다
        RT-BLK-2.2  `blocks[1].content` 경로의 문제가 보고된다
        RT-BLK-2.3  `blocks[2].content` 경로의 문제가 보고된다
        RT-BLK-2.4  `blocks[2].children` 경로의 문제가 보고된다

RT-BLK-3  허용된 자식 목록에 없는 하위 블록은 문제를 돌려준다
  전제  `blocks[0]` `bulletList` 안에 `paragraph`가 들어 있고, `blocks[1]` `children: ["tab"]`인 사용자 정의 블록(`holds: "blocks"`) 안에 등록된 `tab`과 `paragraph`가 순서대로 들어 있는 문서가 있다
  행동  부모 블록과 `tab` 블록 정의를 함께 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-BLK-3.1  `blocks[0].children[0]` 경로의 문제가 보고된다
        RT-BLK-3.2  `blocks[1].children[1]` 경로의 문제가 보고된다
        RT-BLK-3.3  허용된 `blocks[1].children[0]`과 그 하위 경로에는 문제가 보고되지 않는다
```

## 3. 인라인 · 마크

```
RT-INL-1  잘못된 인라인 노드나 등록되지 않은 마크가 있으면 문제를 돌려준다
  전제  `blocks[0]` `paragraph`의 `content`에 4개 잘못된 노드가 순서대로 들어 있다: `[0]` 알 수 없는 인라인 `type`, `[1]` 문자열이 아닌 `text`, `[2]` 첫 마크에 `type`이 없는 `text`, `[3]` 등록되지 않은 마크 `type`을 가진 `text`
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-INL-1.1  `blocks[0].content[0].type` 경로의 문제가 보고된다
        RT-INL-1.2  `blocks[0].content[1].text` 경로의 문제가 보고된다
        RT-INL-1.3  `blocks[0].content[2].marks[0].type` 경로의 문제가 보고된다
        RT-INL-1.4  `blocks[0].content[3].marks[0].type` 경로의 문제가 보고된다

RT-INL-2  추가로 등록한 마크 정의는 내장 마크를 유지·덮어쓰며 속성을 검사한다
  전제  `blocks[0]` `paragraph`의 `content`에 4개 `text` 노드가 순서대로 들어 있다: `[0]` 내장 `bold` 마크, `[1]` 평탄한 속성이 `attrs` 스키마(`type` 키 미허용)를 만족하는 사용자 정의 마크, `[2]` `attrs` 스키마를 어긴 같은 사용자 정의 마크, `[3]` 덮어쓴 `attrs` 스키마를 어긴 내장 `link` 마크
  행동  사용자 정의 마크 정의와 `link` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-INL-2.1  `blocks[0].content[2].marks[0]` 경로의 문제가 보고된다
        RT-INL-2.2  `blocks[0].content[3].marks[0]` 경로의 문제가 보고된다
        RT-INL-2.3  `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다
        RT-INL-2.4  `blocks[0].content[1]`과 그 하위 경로에는 문제가 보고되지 않는다
```

## 4. 미디어 예약 속성

```
RT-MED-1  블록의 미디어 예약 속성에 값이 주어지면 UUID 형식으로 검사한다
  전제  `blocks`에 6개 블록이 순서대로 들어 있다: `[0]` 유효한 UUID `attrs.mediaId`, `[1]` 유효한 UUID 배열 `attrs.mediaIds`, `[2]` UUID가 아닌 문자열 `attrs.mediaId`, `[3]` `null`인 `attrs.mediaId`, `[4]` UUID가 아닌 원소가 섞인 `attrs.mediaIds`, `[5]` 배열이 아닌 `attrs.mediaIds`
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-MED-1.1  `blocks[2].attrs.mediaId` 경로의 문제가 보고된다
        RT-MED-1.2  `blocks[3].attrs.mediaId` 경로의 문제가 보고된다
        RT-MED-1.3  `blocks[4].attrs.mediaIds` 경로의 문제가 보고된다
        RT-MED-1.4  `blocks[5].attrs.mediaIds` 경로의 문제가 보고된다
        RT-MED-1.5  `blocks[0]`과 `blocks[1]` 및 그 하위 경로에는 문제가 보고되지 않는다
```
