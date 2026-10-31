# 약속 없는 테스트 나누기

상태: 초안 (2026-10-31). 시험 조각(admin의 글 화면) 하나로 기준을 다듬은 뒤 나머지 조각에 쓴다.

요구사항 표를 채운 뒤에도 테스트의 절반쯤(2026-10-31에 2121개)은 어느 약속의 ID도 달지 않았다. 이것들이 필요한지 모른다. 이 문서는
그 테스트를 하나씩 판정하는 기준이다. 층마다 맡는 일은 [테스트](../testing.md#층)와 [방향](plan.md#층마다-맡는-일)에 있고, 여기서는
그것을 테스트 하나에 적용하는 법만 적는다.

## 먼저: 조각의 🟡 표

판정하기 전에, 그 조각이 다루는 🟡 기능에 표가 있는지 본다. 없으면 대표 약속 몇 줄로 표를 먼저 쓴다. 표가 없으면 🟡 기능의 테스트는
붙일 곳이 없어서, 모두 "새 줄"이 되어 판정이 아무것도 가르지 못한다(시험 조각에서 30개 중 7개가 그랬다).
[기능의 중요도](features.md)에 없는 기능(예: 본문 편집기의 코드 블록, 끌기, 각주)은 표를 쓰기 전에 소유자에게 등급을 묻는다.

## 판정

테스트 하나에 판정 하나다. 위에서부터 묻고, 처음 맞는 것을 고른다.

| 판정 | 언제 | 하는 일 |
|---|---|---|
| **세부** | 무엇이 아니라 어떻게를 본다. 내부 훅을 따로 렌더하기, 자기 모듈의 mock, 내부 함수의 호출 횟수, 상태 객체의 모양. 플러그인에게 공개한 훅(`useField`, `useEntryEditor`, `useBlockEditor`처럼 `@monti-cms/admin`이 내보내는 것)은 공개 함수와 같아서 세부가 아니다 | 같은 결함을 사용자가 보는 동작으로 잡게 고치거나(그러면 아래 판정을 다시 묻는다), 이미 동작으로 잡는 테스트가 있으면 지운다 |
| **작음** | 망가져도 사용자가 알아채지 못하거나, 다른 층이 이미 막는다([지우는 기준](../testing.md#테스트를-지우는-기준) 5번) | 지운다 |
| **붙임** | 이미 있는 약속을 지킨다 | 제목 앞에 ID를 단다. 그 약속의 층보다 위 층이면 아래 "층이 겹칠 때"를 먼저 본다 |
| **새 줄** | 표에 없는 약속을 지킨다 | 🔴 기능이면 표에 줄을 더한다(코드에서만 나왔으면 "확인 필요"). 🟡 기능이면 그 기능의 대표 약속일 때만 더한다. ⚪ 기능이면 줄을 더하지 않고 **겹침**이나 지울 후보로 본다 |
| **겹침** | 이 테스트가 잡는 결함을 다른 테스트가 모두 잡는다 | 지울 후보. 둘 중 낮은 층을 남긴다 |
| **아래로** | 위 층에서 판단의 경우를 하나씩 본다(화면에서 필드 종류마다, 상태마다) | 판단을 L1 함수로 뽑고 경우는 거기서 본다. 위 층에는 이어짐을 보는 테스트 하나만 남긴다. 함수를 뽑는 것은 코드 변경이라 따로 묶는다 |

어느 기능인지 정해지지 않은 테스트(기능의 중요도 표에 없는 것)는 판정하지 않고 질문으로 모은다.

## 층이 겹칠 때

같은 ID를 여러 층의 테스트가 달 수 있다. 그러면 층마다 맡는 몫이 달라야 한다.

- **표의 층**: 그 약속의 경우를 모두 본다.
- **위 층**: 이어짐만 본다. 사용자의 동작이 그 판단에 닿고, 판단의 결과가 요청이나 화면에 나오는지. 들어오는 길(화면, 라우트) 하나에
  테스트 하나면 된다. 같은 길에서 경우를 더 보는 테스트는 **겹침**이나 **아래로**다.
- **아래 층**: 표의 층보다 아래에서 그 약속을 다 볼 수 있으면 표의 층이 틀렸다. 표를 고친다.

## 뒤집힌 약속

약속 하나의 테스트는 표의 층에서 가장 많고, 위로 갈수록 적어야 한다. 표의 층은 경우를 모두 보고, 위 층은 이어짐만 보기 때문이다.
표의 층보다 위 층에 테스트가 더 많은 약속은 검토 대상이다. `node scripts/test-metrics/requirements.mjs --inverted`가 그 줄을 뽑는다.
이 수는 목표가 아니어서 CI는 막지 않는다. 줄마다 둘 중 하나다.

- **표의 층이 틀렸다**: 데이터베이스, 파일, 그린 화면이 있어야 볼 수 있는 약속을 아래 층으로 적었다. 표를 고친다.
- **위 층이 경우를 다시 본다**: 위 층의 테스트를 남김(들어오는 길마다 하나, 또는 아래 층이 볼 수 없는 것을 본다), 아래로, 겹침으로 나눈다.
  겹침은 위의 "지우기 전에"대로 변이 테스트로 잰 뒤에 지운다.

기능 단위로 위 층이 많은 것(본문 편집기, 플러그인의 화면 자리)은 그 기능이 화면이라 그럴 수 있다. 줄 단위로 본다.

## 지우기 전에

판정만으로는 지우지 않는다. **겹침**과 **작음**과 **세부**의 지울 후보는 [지우는 기준](../testing.md#테스트를-지우는-기준)의 1~4번대로
변이 테스트로 확인한다. 그 테스트가 다루는 소스 파일을 테스트를 뺀 채로 재고, 새로 살아남은 바꿈을 하나씩 판정한다. 하나라도 데이터를
잃거나 사용자가 틀린 것을 보게 되는 바꿈이면 테스트를 남긴다.

## 나눠 맡기

- **조각**: 파일이 겹치지 않는 폴더 묶음이다. admin L3는 글 화면, 편집기, 미디어, 스키마, 데이터와 설정으로 나누고, core는 L2와 L1을
  모듈 묶음으로 나눈다.
- **일꾼이 하는 일**: 조각의 테스트마다 판정을 적은 표를 만든다. 코드나 테스트를 고치지 않는다.

  | 파일 | 테스트 | 판정 | 대상 | 이유 | 고칠 것 |
  |---|---|---|---|---|---|
  | `entry-editor-shell.dom.test.tsx` | "the comparison shows a block that moved as moved…" | 겹침 | L1 TRANS-S2의 옮김 | 옮김을 가리는 판단은 L1이 본다. 화면은 비교 창을 여는 테스트 하나면 된다 | |

  대상은 붙임이면 ID, 새 줄이면 줄의 초안, 겹침이면 남는 테스트다. 이유는 한 줄이고, 어떤 결함을 잡거나 못 잡는지 말한다.
  고칠 것에는 판정과 따로, 그 테스트가 어기는 [금지](../testing.md#금지)(테스트 id, 위치로 읽는 mock 인자, DOM 순서, 아무 오류에나
  통과하는 `toHaveBeenCalled()`)와 흔들림의 냄새(긴 시간 제한, 될 때까지 다시 입력하는 고리)를 적는다. 붙이거나 남기는 테스트도 고칠 것이 있으면 고친다.
- **확인**: 판정표는 주장이다. 표본을 직접 읽고, 지울 후보는 변이 테스트로 잰 뒤에 지운다. ID 달기와 지우기는 조각마다 커밋 하나다.
- **질문**: 기능을 모르는 것, 약속인지 애매한 것은 조각마다 모아 소유자에게 한 번에 묻는다.

## 시험 조각: 글 편집기 화면 (2026-10-31)

`packages/admin/src/screens/entries/__test__/entry-editor-shell.dom.test.tsx`의 ID 없는 테스트 30개를 판정했다. 붙임과 새 줄은 ID를 달았고, 고칠 것은 고쳤고, 작음 둘은 지웠다.
겹침 7개는 변이 테스트(`entry-editor-shell.tsx`의 해당 줄, `language-tabs.tsx`, `source-change-dialog.tsx`, 배너, 옆 패널, 295개 바꿈)로 쟀다.
그 테스트만 잡는 바꿈이 없는 4개를 지우고, 있는 3개는 남겼다. 이 파일의 테스트는 모두 ID를 단다(46개 → 40개).

| 줄 | 테스트 | 판정 | 대상 | 고칠 것 |
|---|---|---|---|---|
| 357 | tells a missing entry how to find it again | 작음 | 안내 문구는 ⚪로 정했다. 지웠다 | |
| 431 | fills the slot in the source editor, after the to-do cell | 새 줄 🟡 | PLUG-A4 | |
| 445 | fills the slot in the translation editor too | 새 줄 🟡 | PLUG-A4 | |
| 580 | switches only the body to the source panel and keeps the title | 붙임 | FMT-P2 (위 층, 이어짐) | |
| 621 | shows the toggle of the registered panel under its label | 붙임 | FMT-P1 (위 층, 이어짐) | |
| 631 | takes the body the panel hands back as the body, which the next save sends | 새 줄 🔴 | FMT-R8 | |
| 645 | opens a body that could not be read in the panel | 겹침 | 555줄의 WRITE-P8. 변이: 이 테스트만 잡는 바꿈 0. 지웠다 | |
| 659 | tells the panel which block an issue is in | 붙임 | WRITE-P1. 변이: 이 테스트만 잡는 바꿈 5(블록으로 간 뒤 다시 묻지 않기). 남겼다 | |
| 679 | adds categories and tags through the add panel | 새 줄 🟡 | WRITE-W5 | 10초 시간 제한 넷, 될 때까지 다시 입력하는 고리 |
| 780 | exports this entry from the more menu | 붙임 | DATA-B4 (위 층, 이어짐) | 테스트 id(`export-headline`) |
| 808 | unarchives and restores at once without asking | 붙임 | TRASH-R1 (위 층, 이어짐) | |
| 827 | reports header action failures as a toast | 붙임 | WRITE-P2 (위 층, 이어짐) | 아무 오류에나 통과하는 `toast.error` 호출 검사 |
| 836 | sends record collections to their explicit-save form | 새 줄 🟡 | WRITE-W6 | 아무것도 검사하지 않는 `EMPTY_FORM.slug` |
| 861 | shows one tab per member above the title | 새 줄 🟡 | TRANS-L2 | DOM 순서 |
| 877 | moves to another language by its link | 겹침 | 861줄. 변이: 0. 지웠다 | |
| 887 | creates a translation from the missing-language button | 붙임 | TRANS-N1 (위 층, 이어짐) | |
| 899 | blocks translation creation while there are unsaved changes | 붙임 | WRITE-S6 | 아무 오류에나 통과하는 `toast.error` 호출 검사 |
| 926 | moves a draft translation at once… the toast's undo restores it | 붙임 | TRASH-T6 | 위치로 읽는 mock 인자 |
| 949 | asks first when the translation is published | 붙임 | TRASH-T3 (위 층, 이어짐) | |
| 973 | hides the language tabs of the editor | 작음 | 기능을 끄는 관리자 옵션은 ⚪로 정했다. 지웠다 | |
| 1023 | shows the full source beside only a translation | 붙임 | TRANS-S3 | |
| 1043 | when the source changes, notifies, and confirm makes a change that Save sends | 붙임 | TRANS-S1 (위 층, 이어짐) | 저장 요청의 내용을 보지 않는다 |
| 1054 | with no translation state or a malformed one | 겹침 | L1의 TRANS-N9. 변이: 0. 지웠다 | |
| 1060 | the comparison lists changed blocks as before and now | 붙임 | TRANS-S2 (위 층, 이어짐) | |
| 1071 | the comparison shows a block that moved as moved | 붙임 | TRANS-S2. 변이: 이 테스트만 잡는 바꿈 2(창이 옮김과 옮기고 고침을 가르는 곳은 L1이 아니라 창에 있다). 남겼다 | |
| 1083 | an unparseable source is reported as not comparable | 붙임 | TRANS-S2. 변이: 이 테스트만 잡는 바꿈 1(비교할 수 없다는 문장). 남겼다 | |
| 1121 | opens from the header and shows the plugin's component | 겹침 | `side-panel-slot.dom.test.tsx`의 PLUG-A5 "opens and closes from the button in the header…" | |
| 1130 | publishes the screen, the collection and the open entry | 새 줄 🟡 | PLUG-A5 | |
| 1137 | reads the entry as the form holds it, with the changes that are not saved | 새 줄 🟡 | PLUG-A5 | |
| 1145 | reads the selected text and the block the selection is in | 새 줄 🟡 | PLUG-A5 | |

합: 붙임 12, 새 줄 9(🔴 1, 🟡 8), 겹침 7, 작음 2. 처음에는 질문이 4개였고, 등급을 제안대로 정해 새 줄 2와 작음 2가 됐다. 1121줄은 플러그인 표를 쓰고 보니 다른 파일의 테스트와 겹쳤다. 고칠 것이 있는 테스트 8.

배운 것:

- 🟡 기능의 표가 없으면 판정이 갈리지 않는다. 그래서 "먼저: 조각의 🟡 표"를 더했다. 이 조각에는 플러그인 API 표가 필요하다.
- 플러그인에게 공개한 훅은 세부가 아니다. `use-field.dom.test.tsx`는 훅을 따로 렌더하지만 `useField`는 공개 API다.
- 약속 없는 테스트 가운데에도 🔴가 있었다(631줄). 지울 후보만 찾는 일이 아니다.
- 금지 패턴은 ID를 단 테스트에도 남아 있다. 판정과 따로 "고칠 것"으로 모은다.
- 겹침 판정의 절반 가까이가 틀렸다(7개 중 3개). 판정만으로 지우면 안 되고, 변이 테스트가 꼭 필요하다. 화면이 낮은 층의 판단을 다시 가르는 곳(창의 표시 규칙)은 위 층에만 있다.

## admin 전체 (2026-10-31)

시험 조각의 기준으로 admin의 나머지를 다섯 조각(글 화면, 편집기 바탕, 편집기 부품, 다른 화면, 바탕 코드)으로 나눠 판정했다. 일꾼 다섯이
판정표를 쓰고, 일꾼 하나가 새 줄을 한 벌의 ID로 합쳐 테스트에 달고, 일꾼 셋이 남는 테스트의 금지 패턴을 고쳤다. 일꾼의 판정은 표본으로,
ID 달기는 바뀐 줄이 제목뿐인지로, 고친 테스트는 파일마다 결함을 한 번 넣어 실패하는지로 확인했다.

| | 전 | 후 |
|---|---|---|
| ID 없는 테스트 | 약 770 | 0 (지울 후보만 남는다) |
| 새 표 | — | 편집기, 관리자의 바탕, 설정, 활동 기록, 템플릿, 어시스턴트 |
| 새 줄 | — | 67 (🔴 4: WRITE-S9, WRITE-S10, LIST-C7, SCHEMA-F16) |
| 금지 패턴(admin) | 533 | 197 |
| 작음으로 지운 테스트 | — | 155 |

판정에 쓴 등급은 [기능의 중요도](features.md)의 "제안대로 (2026-10-31)" 줄이다.

아직 남은 것:

- **겹침과 세부 123개**: 후보가 지나가는 줄(78개 파일, 바꿈 9,610개)을 변이 테스트로 쟀다(2026-11-01). 후보만 잡는 바꿈은 95개였다.
  그 바꿈을 모두 잡는 가장 적은 후보 21개와, 제목이 `%s`라 보고서에서 찾지 못한 1개를 남기고, 나머지 101개를 지웠다. 남긴 것 가운데 16개는
  ID를 달았고(예: `use-url-state`의 ADMIN-U1, `todo-rows`의 WRITE-P1), 3개는 이미 ID가 있었고, 3개는 맞는 약속이 없어 ID 없이 둔다(`ui-labels` 사전 검사,
  React 배관 둘: `store`, `entry-editor-store`).
  시간 초과로 잡힌 바꿈(341개)은 어느 테스트가 잡았는지 보고서가 말하지 않아 셈에 넣지 못했다.
- **코드 규칙을 소스 글자로 보는 테스트 28개**: lint나 `check:design`, 생성기 검사로 옮긴 뒤에 지운다(#378). 그전에 지우면 그 규칙을 아무것도 지키지 않는다.
- **아래로 9개**: 화면이 내리는 판단을 L1 함수로 뽑는 코드 변경이다. 소스를 읽는 테스트와 함께 #378.
- **React 배관 테스트 5개**(`entry-editor-store`, `use-entry-editor`, `use-field`): 글 쓰고 발행 표가 남기기로 한 것이라 ID 없이 둔다.

배운 것:

- 일꾼마다 같은 초안 ID를 다른 약속에 썼다. 표 파일은 한 사람만 고치게 하고, 그 사람이 ID를 합친다.
- ID가 없던 테스트에서도 고칠 것이 나왔다. 한 번도 돌지 않던 테스트 3개(`field-input-parts`, 없는 필드에서 `return`), 늘 통과하는 검사
  하나(`api-urls.test.ts`), 없는 모듈을 mock하던 파일 다섯이다.
- 테스트를 고치다 소스 결함 둘이 나왔다(#376 스키마의 지운 필드 되돌리기 자리, #377 그림 업로드 실패의 이유).

## core 전체 (2026-11-01)

admin과 같은 기준으로 판정했다. 새 표는 명령줄, 데이터베이스, API, 설정이고, 플러그인 표에 서버 쪽과 플러그인 저장소(🔴) 절을 더했다.
뒤집힌 약속 22개는 6개로 줄었다(층을 옮긴 것 5, 나눈 것 9).

- **겹침과 세부 192개**: 후보가 지나가는 줄(323개 파일, 바꿈 26,288개)을 변이 테스트로 쟀다. 후보만 잡는 바꿈은 82개였고, 그 바꿈을 모두
  잡는 가장 적은 후보 28개를 남겼다. 남긴 것 가운데 20개는 ID를 달았고(예: `init-command`의 INIT-K7, `body-limit`의 API-G4), 2개는 이미 ID가
  있었고, 5개는 맞는 약속이 없는 배관이라 ID 없이 둔다(Kysely 둘, 제목 SQL 둘, 관리자 기능의 기본값). 나머지 156개를 지웠고, 테스트가 하나도
  남지 않은 파일 7개도 지웠다.
- **변이로 잴 수 없는 것**: `database-types.int`의 8개는 소스를 읽어 보고서에서 찾지 못한다. 생성기가 생길 때까지 남긴다(#378).
  `store-contract-files.int`(계약 묶음마다 그것을 돌리는 파일이 있는지)도 변이가 볼 수 없어 지울 목록에 들었지만 되살렸다. 묶음 목록을 돌며
  모든 묶음을 돌리는 한 곳이 생기면 지운다(#378).
- **시간 초과**: 지운 테스트만 덮는 시간 초과 바꿈은 하나였다(`import-boundary.ts`의 끝없는 반복). CI의 `example:check`가 같은 검사를 예제에
  돌려 잡는다.

배운 것:

- 변이 테스트가 끝날 때까지 7시간 44분이 걸렸다. 남은 바꿈이 데이터베이스 코드에 몰리면 한 시간에 1,100개로 느려지고, 소스에 바꿈을 직접 쓰는
  방식이라 파일 감시가 CPU 하나를 쓴다. 다음에는 소스 사본에서 돌린다.
- 변이 결과만으로 지우면 소스를 읽는 테스트가 늘 지울 목록에 든다. 지우기 전에 파일을 읽는 테스트를 따로 본다.
