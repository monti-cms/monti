# `rich-text/` 인수 조건

각 결과 줄의 "보고된다"는 반환된 문제 목록에 해당 `path`의 항목이 포함됨을 뜻한다.

```
RT-1  유효한 본문 문서는 빈 문제 목록을 돌려준다
  전제  13종 내장 블록(`content`·`children` 생략과 빈 배열 포함), 세 종류 인라인 노드(`text`·`hardBreak`·`footnoteRef`)와 8종 내장 `marks`, 중첩 목록이 담긴 문서가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-1.1  빈 배열 `[]`을 돌려준다

RT-2  문서 최상위 구조가 잘못되어도 예외를 던지지 않고 문제를 돌려준다
  전제  `blocks`가 배열이 아닌 객체(`{ blocks: {} }`)가 주어진다
  행동  `validateDoc`으로 해당 값을 검사한다
  결과  RT-2.1  `path`가 `"blocks"`인 문제가 보고된다

RT-3  블록의 필수 속성이나 형식이 깨져 있으면 해당 경로의 문제를 모두 돌려준다
  전제  `blocks`에 `null`, `id`가 없는 블록, `type`이 없는 블록, `attrs`가 객체가 아닌 블록, `content`가 배열이 아닌 `paragraph`, `children`이 배열이 아닌 `quote`가 순서대로 들어 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-3.1  `blocks[0]` 경로의 문제가 보고된다
        RT-3.2  `blocks[1].id` 경로의 문제가 보고된다
        RT-3.3  `blocks[2].type` 경로의 문제가 보고된다
        RT-3.4  `blocks[3].attrs` 경로의 문제가 보고된다
        RT-3.5  `blocks[4].content` 경로의 문제가 보고된다
        RT-3.6  `blocks[5].children` 경로의 문제가 보고된다

RT-4  같은 `id`를 가진 블록이 중복되면 나중에 나온 블록을 문제로 돌려준다
  전제  `blocks[0]` 최상위 블록과 `blocks[1]` `quote`의 첫 번째 하위 블록이 같은 `id`를 가진다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-4.1  `blocks[1].children[0].id` 경로의 문제가 보고된다
        RT-4.2  먼저 나온 `blocks[0].id` 경로에는 문제가 보고되지 않는다

RT-5  등록되지 않은 블록 `type`은 문제를 돌려준다
  전제  내장 블록에도 없고 `blocks`에도 등록되지 않은 `type`의 블록이 담긴 문서가 있다
  행동  추가 블록 정의 없이 `validateDoc`으로 문서를 검사한다
  결과  RT-5.1  `blocks[0].type` 경로의 문제가 보고된다

RT-6  `blocks`로 등록한 블록 정의는 내장 블록을 유지·덮어쓰며 `attrs` 스키마로 검사한다
  전제  `blocks[0]`에 내장 `paragraph`, `blocks[1]`에 `attrs` 스키마를 만족하는 사용자 정의 블록(`holds: "blocks"`), `blocks[2]`에 `attrs` 스키마를 어긴 같은 사용자 정의 블록, `blocks[3]`에 `attrs` 스키마로 덮어쓴 내장 `codeBlock`의 스키마 위반 블록이 담긴 문서가 있다
  행동  사용자 정의 블록 정의와 `codeBlock` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-6.1  `blocks[2].attrs` 경로의 문제가 보고된다
        RT-6.2  `blocks[3].attrs` 경로의 문제가 보고된다
        RT-6.3  `blocks[0]`과 그 하위 경로에는 문제가 보고되지 않는다
        RT-6.4  `blocks[1]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-7  블록이 담을 수 있는 종류(`holds`)에 맞지 않는 `content`나 `children`이 있으면 문제를 돌려준다
  전제  `blocks[0]` `paragraph`(`text`)에 `children`, `blocks[1]` `quote`(`blocks`)에 `content`, `blocks[2]` `divider`(`nothing`)에 `content`와 `children`이 들어 있는 문서가 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-7.1  `blocks[0].children` 경로의 문제가 보고된다
        RT-7.2  `blocks[1].content` 경로의 문제가 보고된다
        RT-7.3  `blocks[2].content` 경로의 문제가 보고된다
        RT-7.4  `blocks[2].children` 경로의 문제가 보고된다

RT-8  허용된 `children` 목록에 없는 자식 블록은 문제를 돌려준다
  전제  `blocks[0]` `bulletList` 안에 `paragraph`가 들어 있고, `blocks[1]` `children: ["tab"]`인 사용자 정의 블록(`holds: "blocks"`) 안에 등록된 `tab`과 `paragraph`가 순서대로 들어 있는 문서가 있다
  행동  부모 블록과 `tab` 블록 정의를 함께 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-8.1  `blocks[0].children[0]` 경로의 문제가 보고된다
        RT-8.2  `blocks[1].children[1]` 경로의 문제가 보고된다
        RT-8.3  허용된 `blocks[1].children[0]`과 그 하위 경로에는 문제가 보고되지 않는다

RT-9  잘못된 인라인 노드나 등록되지 않은 `marks`가 있으면 문제를 돌려준다
  전제  `blocks[0]` `paragraph`의 `content`에 알 수 없는 인라인 `type`, 문자열이 아닌 `text`, `marks` 첫 원소에 `type`이 없는 `text` 노드, 등록되지 않은 `mark` `type`을 가진 `text` 노드가 순서대로 들어 있다
  행동  `validateDoc`으로 문서를 검사한다
  결과  RT-9.1  `blocks[0].content[0].type` 경로의 문제가 보고된다
        RT-9.2  `blocks[0].content[1].text` 경로의 문제가 보고된다
        RT-9.3  `blocks[0].content[2].marks[0].type` 경로의 문제가 보고된다
        RT-9.4  `blocks[0].content[3].marks[0].type` 경로의 문제가 보고된다

RT-10  `marks`로 등록한 마크 정의는 내장 마크를 유지·덮어쓰며 `type`을 뺀 평탄한 속성을 `attrs` 스키마로 검사한다
  전제  `blocks[0]` `paragraph`의 `content`에 내장 `bold` 마크가 달린 `text`, 평탄한 속성이 `attrs` 스키마(`type` 키 미허용)를 만족하는 사용자 정의 마크가 달린 `text`, `attrs` 스키마를 어긴 같은 사용자 정의 마크가 달린 `text`, `attrs` 스키마로 덮어쓴 내장 `link`의 스키마 위반 마크가 달린 `text`가 순서대로 들어 있다
  행동  사용자 정의 마크 정의와 `link` 덮어쓰기 정의를 넘겨 `validateDoc`으로 문서를 검사한다
  결과  RT-10.1  `blocks[0].content[2].marks[0]` 경로의 문제가 보고된다
        RT-10.2  `blocks[0].content[3].marks[0]` 경로의 문제가 보고된다
        RT-10.3  `blocks[0].content[0]`과 그 하위 경로에는 문제가 보고되지 않는다
        RT-10.4  `blocks[0].content[1]`과 그 하위 경로에는 문제가 보고되지 않는다
```
