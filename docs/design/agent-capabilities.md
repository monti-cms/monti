# 관리자 에이전트: 기능

상태: [관리자 에이전트 설계](agent.md)를 위한 목록. 관리자 화면에 지금 있는 모든 기능을 core와 플러그인의 라우트에서 찾아 적고,
각 기능이 에이전트에게 무엇이 되는지 적는다.

열:

- **동작**: 제안하는 `defineOperation` 이름.
- **종류**: `read`(에이전트가 마음대로 부른다), `write`(제안에 들어간다), `code`(풀 리퀘스트), `editor read`와 `editor write`(열린 글에 대해 브라우저에서 돈다. 쓰기는 편집기 안의 제안이다), 또는 `—`(동작이 아니다. 이유는 메모에 있다).
- **되돌리기**: 제안이 쓰기를 어떻게 되돌리는가. "불가"는 검토 화면이 되돌릴 수 없다고 알린다는 뜻이다.
- **단계**: 언제 들어오는가(agent.md 9절).

## 글

라우트 기준: `/v1/entries`.

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `entries.list` | read | `GET /entries` | | 1 | 컬렉션별. 에이전트에게 필요한 것은 필터가 이미 다룬다. 제목, 슬러그, 본문의 텍스트(`search`, `includeBody`), 상태(초안, 발행됨, 수정 중, 보관됨. 발행됨은 발행하지 않은 변경이 없고, 수정 중은 있다), 언어, 폴더(하위 포함), 필드 값과 빈 필드(`field`), 번역 상태(`translation`), 만든 날, 수정한 날, 발행한 날의 범위, 정렬, 페이지 |
| `entries.find` | read | `GET /entries/search` | | 1 | 고르기 화면용 제목이나 슬러그 찾기, 최대 50건. 에이전트는 주로 `entries.list`를 쓴다 |
| `entries.get` | read | `GET /entries/[id]` | | 1 | `?format=<name>`을 붙이면 본문이 텍스트(MDX)로 온다. 모델이 읽고 써야 하는 것이 이것이다 |
| `entries.usages` | read | `GET /entries/[id]/relations` | | 1 | 글이 쓰이는 곳, 초안과 발행본 |
| `entries.translations` | read | `GET /entries/[id]/translations` | | 1 | 번역 묶음 |
| `entries.checkPublish` | read | `POST /entries/[id]/check` | | 1 | 발행하지 않고 발행하면 무엇이 걸리는지 본다. `POST`지만 읽기다 |
| `entries.create` | write | `POST /entries` | 휴지통으로 | 2 | 제목, 슬러그, 메타데이터, 텍스트 본문, 폴더 |
| `entries.update` | write | `PATCH /entries/[id]` | 이전 값을 다시 쓴다 | 2 | 슬러그, 메타데이터 필드, 본문, 폴더 중 무엇이든. 미리보기는 필드별 비교, 본문은 텍스트 비교다 |
| `entries.duplicate` | write | `POST /entries/[id]/duplicate` | 사본을 휴지통으로 | 2 | |
| `entries.translate` | write | `POST /entries/[id]/translations` | 번역을 휴지통으로 | 3 | 번역을 만든다. 채우는 것은 `entries.update`나 번역 편집기의 기본 요청이다 |
| `entries.publish` | write | `POST /entries/[id]/publish`, 일괄 `publish` | 이미 발행된 글이었으면 **불가** | 2 | Monti는 기록을 남기지 않으므로 대체된 발행본은 사라진다. 첫 발행은 보관으로 되돌린다 |
| `entries.archive` | write | `POST /entries/[id]/archive`, 일괄 `archive` | 보관 풀기(초안으로 돌아가고, 다시 발행하지 않는다) | 2 | 발행을 끝낸다 |
| `entries.unarchive` | write | `POST /entries/[id]/unarchive`, 일괄 `unarchive` | 보관 | 2 | |
| `entries.trash` | write | `POST /entries/[id]/trash`, 일괄 `trash` | 복원 | 2 | 발행을 끝낸다 |
| `entries.restore` | write | `POST /entries/[id]/restore` | 휴지통으로 | 2 | |
| `entries.deletePermanently` | write | `DELETE /entries/[id]`, 일괄 `permanentDelete`, `POST /trash/delete` | **불가** | 3 | 이미 휴지통에 있는 글에만 쓴다. 다른 글의 관계 필드가 가리키는 동안에는 거절한다(`in_use`, 그 글들을 알려 준다). 본문 안의 링크는 막지 않는다. `POST /references/unlink`가 먼저 그 필드에서 대상을 뺀다 |
| `entries.moveToFolder` | write | 일괄 `folder.move`, `PATCH /entries/[id]` | 다시 옮긴다 | 2 | |
| `entries.setRelation` | write | 일괄 `relation.add`, `relation.remove`, `relation.set` | 반대 변경 | 2 | 태그와 카테고리는 관계 필드이므로 "이 글들에 태그 달아 줘"가 이것이다 |

일괄 라우트는 한 번에 최대 100개를 받는다. 그보다 많은 항목이 든 제안은 적용할 때 여러 번의 일괄 호출로 나눈다.

## 열린 글 (편집기)

이것들은 편집기에 열린 글에 대해 브라우저에서 돈다(agent.md 5절). 라우트는 없다. 서버가 아니라 폼에 작용한다. 쓰기는
관리자가 편집기에서 받거나 버리는 제안이고, 관리자가 저장할 때까지 아무것도 저장되지 않는다.

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `editor.read` | editor read | 없음 | | 1 | 폼이 쥔 그대로의 열린 글, 저장하지 않은 변경 포함: 필드와, 사이트 형식의 텍스트 본문 |
| `editor.selection` | editor read | 없음 | | 1 | 선택한 텍스트와 커서가 있는 블록, 그 블록 id와 함께. 화면 맥락과 함께 보내기도 한다 |
| `editor.replaceSelection` | editor write | 없음 | 제안을 버린다 | 2 | |
| `editor.rewriteBlock` | editor write | 없음 | 제안을 버린다 | 2 | 블록 id로 문단, 제목, 목록, 블록을 다시 쓴다 |
| `editor.insertBlocks` | editor write | 없음 | 제안을 버린다 | 2 | 블록 앞이나 뒤. 블록은 사이트 형식의 텍스트이므로 코드 블록, 이미지, 사용자 정의 블록이 된다 |
| `editor.moveBlocks` | editor write | 없음 | 제안을 버린다 | 2 | |
| `editor.removeBlocks` | editor write | 없음 | 제안을 버린다 | 2 | |
| `editor.setField` | editor write | 없음 | 제안을 버린다 | 2 | 속성 패널의 필드: 제목, 슬러그, 요약, 태그, 컬렉션의 다른 필드 |

편집기에 열린 글에 대한 서버 쓰기는 거절되고, 모델에게 대신 이것들을 쓰라고 알린다. 열린 글의 발행, 보관, 휴지통으로 보내기는
서버 동작으로 남는다. 편집기 자신의 버튼처럼 편집기가 먼저 저장한다.

## 폴더

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `folders.list` | read | `GET /folders` | | 1 | 컬렉션 하나의 트리 |
| `folders.get` | read | `GET /folders/[id]/contents` | | 1 | 폴더에 든 것, 하위 폴더 포함: 글(발행된 것은 따로 센다), 폴더, 파일(쓰이는 것은 따로 센다), 삭제 미리보기 |
| `folders.create` | write | `POST /folders` | 지운다 | 2 | |
| `folders.update` | write | `PATCH /folders/[id]` | 이전 값을 다시 쓴다 | 2 | 이름 바꾸기, 다른 부모 아래로 옮기기, 순서 바꾸기 |
| `folders.delete` | write | `DELETE /folders/[id]` | `POST /trash/restore` | 3 | 폴더를 하위 폴더와 글과 함께 한 덩어리로 휴지통에 옮긴다(쓰이는 파일이 있는 미디어 폴더는 쓰이지 않는 파일만 간다). 아무것도 영구히 지우지 않는다 |

## 미디어

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `media.list` | read | `GET /media` | | 1 | 파일 이름 검색, 종류, 폴더, 올린 날, 그리고 `used: "unused"`. 이것이 이미 "쓰이지 않는 미디어 찾기"다 |
| `media.get` | read | `GET /media/[id]` | | 1 | 쓰이는 곳과 함께 |
| `media.update` | write | `PATCH /media/[id]` | 이전 값을 다시 쓴다 | 2 | 파일 이름, 기본 대체 텍스트와 캡션, 폴더 |
| `media.trash` | write | `POST /media/trash` | `POST /trash/restore` | 2 | 파일을 휴지통에 옮긴다. 무엇이든 가리키는 파일은 남으므로(`kept`) 에이전트가 실수로라도 쓰이는 파일을 버릴 수 없다. 파일은 휴지통에서만 영구히 지운다(`POST /trash/delete`) |
| — | — | `POST /media/uploads`, `POST /media/[id]/complete` | | | 올리려면 관리자 컴퓨터의 파일이 필요하다. 나중에: 관리자가 준 URL에서 올리기 |

## 템플릿

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `templates.list` | read | `GET /templates` | | 1 | |
| `templates.get` | read | `GET /templates/[id]` | | 1 | `?format=`을 붙이면 본문이 텍스트로 온다 |
| `templates.create` | write | `POST /templates` | 지운다 | 3 | |
| `templates.update` | write | `PATCH /templates/[id]` | 이전 값을 다시 쓴다 | 3 | |
| `templates.delete` | write | `DELETE /templates/[id]` | 다시 만든다 | 3 | |

## 사이트 구조

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `site.describe` | read | `GET /meta` | | 1 | 컬렉션, 필드, 본문 블록, 제한. 에이전트는 실행할 때마다 처음에 이것을 읽어 사이트의 모양을 안다. 2단계부터는 필드와 컬렉션 설명을 담아, 각 필드가 무엇을 위한 것인지 에이전트에게 알려 준다(agent.md 7절) |
| `schema.read` | read | `GET /schema` | | 1 | 스키마 파일 |
| `schema.edit` | code | `POST /schema/preview`, `PUT /schema` | 풀 리퀘스트를 되돌린다 | 4 | 개발 환경에서는 파일을 쓰고, 그 밖에서는 풀 리퀘스트다. 미리보기가 찾은 저장된 글에 대한 영향은 검토에 들어가고, 관리자가 거기서 확인한다 |
| — | — | 없음 | | | 코드 안의 사이트 설정(`defineSite`: 언어, 플러그인). 스키마 수정이 풀 리퀘스트로 동작할 때까지 범위 밖 |

## 전달과 동기화

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `events.list` | read | `GET /events` | | 3 | 실패했거나 죽은 웹훅 전달 |
| `events.retry` | write | `POST /events/[id]/retry` | 필요 없음 | 3 | |
| `events.dismiss` | write | `POST /events/[id]/dismiss` | 불가 | 3 | |

## AI와 검사

| 동작 | 종류 | 지금 라우트 | 되돌리기 | 단계 | 메모 |
| --- | --- | --- | --- | --- | --- |
| `spellcheck.run` | read | 텍스트 검사 플러그인 라우트 | | 3 | 맞춤법 검사 플러그인이 설치됐을 때의 플러그인 동작 |
| — | — | `POST /ai/run`, `/ai/actions`, `/ai/snippets` | | | 3단계에서 액션, 사용자 정의 액션, 스니펫과 함께 없앤다(agent.md 7절). `ai.<action>` 동작은 없다. 요약, 대체 텍스트, 번역은 에이전트가 직접 쓴다 |
| — | — | `/ai/providers`, `/ai/settings`, `/ai/models` | | | 모델은 대화마다 어시스턴트 입력란의 고르기로 옮긴다. API 키 화면은 키마다 한 달 사용량과 상한을 보여 준다. 에이전트는 자기가 쓰는 모델이나 쓸 수 있는 금액을 바꾸지 않는다 |
| — | — | 없음 | | | 글쓰기 말투(설정 › 사이트). 모든 실행이 맥락으로 받는다. 도구 호출이 아니다 |

### 기본 요청

동작이 아니다. 각각 화면 맥락과 함께 에이전트에게 보내는 정해진 문장이고, 필요한 도구만 가지고 한 턴으로 돈다(agent.md 7절).

| 곳 | 요청 | 도구 | 단계 |
| --- | --- | --- | --- |
| 발행 할 일 | 요약 쓰기 | `editor.read`, `editor.setField` | 3 |
| 발행 할 일 | 빠진 대체 텍스트 채우기 | `editor.read`, `media.get`, `editor.rewriteBlock` | 3 |
| 번역 편집기 | 원문에서 번역하기 | `entries.get`(원문), `editor.read`, `editor.rewriteBlock`, `editor.setField` | 3 |
| 번역 편집기 | 바뀐 블록만 번역하기 | 같은 도구, 번역 뒤 원문에서 바뀐 블록으로 한정 | 3 |
| 미디어 목록의 일괄 막대 | 대체 텍스트 채우기 | `media.get`, `media.update` | 3 |

## 동작이 아닌 것

| 지금 라우트 | 동작이 아닌 이유 |
| --- | --- |
| `/session/*`(로그인, 로그아웃, 첫 관리자) | 로그인은 관리자의 일이다 |
| `/api-keys/*` | 키 값은 에이전트에게 가지 않고, 키와 그 월 상한을 고르는 것은 관리자의 일이다 |
| `/preferences` | 관리자 자신의 목록 열과 화면 상태이지, 사이트 콘텐츠가 아니다 |
| `/import/*` | 관리자 컴퓨터의 파일을 받는다 |
| `/export/*` | 관리자를 위한 내려받기를 만든다. 에이전트는 글을 직접 읽는다 |
| `/events/retry`(cron), 플러그인 웹훅, `/public/*` | 관리자가 아니라 기계나 공개 사이트가 부른다 |
| CLI(`db:*`, `schema:*`, `admin:reset-password`, `events:retry`, `content:rewrite`) | 사이트를 호스팅하는 기계에서 돈다 |

## 1단계에 필요한데 없는 것

에이전트에게 필요한 읽기는 거의 모두 이미 라우트가 있다. 빈틈은 이렇다.

1. **컬렉션을 가로지르는 목록.** `entries.list`는 컬렉션 하나를 받는다. "이번 주에 뭘 바꿨지" 같은 질문은 컬렉션마다 한 번씩 불러야 한다.
   `site.describe`를 먼저 읽는 에이전트에게는 괜찮다.
2. **관계 값별 개수.** "어떤 태그가 가장 덜 쓰이나"는 태그 컬렉션을 나열하고 `entries.usages`로 세는 것이라, 태그마다 한 번씩 부른다.
   `relations.counts` 읽기가 있으면 한 번이면 된다. 1단계 시험에서 에이전트가 애를 먹을 때만 더한다.
3. **제안의 크기.** 일괄 라우트는 100개에서 멈춘다. 그보다 큰 적용은 제안이 스스로 나눈다(위 참고).

## 하나의 AI 경로에 필요한 것 (agent.md 7절)

core, 2단계, 에이전트가 쓰기 전에:

1. **필드 설명을 에이전트 입력으로.** 필드의 `description`(`packages/core/src/schema/fields.ts`)은 `site.describe`와 함께 에이전트에게 가고,
   더는 입력란 아래에 그리지 않는다. 스키마 설정의 필드 설정 시트에서 고친다. 컬렉션 설명도 같은 길을 간다.
2. **필드 정의 안의 검사.** 필드의 `max`, `required`와 다른 제한은 쓰기 동작의 미리보기가 검사하고, 고유한 슬러그는
   `entries.create`와 `entries.update`의 검사다. 그래서 이를 어기는 값은 제안에 닿기 전에 거절된다.
3. **글쓰기 말투.** 설정 › 사이트의 글 하나로, 사이트 설정과 함께 저장되고 모든 실행의 맥락에 더해진다.
4. **대화별 모델.** 어시스턴트 입력란에 저장된 키의 모델을 공급자별로 묶어 나열하는 모델 고르기가 있다. 실행은
   그 모델과 함께 저장되고, 새 대화는 마지막에 쓴 모델로 시작한다.
5. **사용량과 월 상한.** 실행마다 쓴 키에 토큰을 기록한다. API 키 화면은 키마다 한 달 사용량을
   대략의 비용과 선택적인 상한과 함께 보여 준다. 상한을 넘은 키로 하는 실행이나 기본 요청은 거절되고, 패널은 입력란 자리에 알림을 보여 준다.

3단계에서 AI를 옮긴다. 지금 액션이 붙은 곳마다 기본 요청이 되거나 없어진다.

| 지금 | 바뀐 뒤 |
| --- | --- |
| 필드 옆 AI 버튼(슬러그, 요약, 태그, 카테고리) | 없앤다. 요약은 발행 할 일의 "요약 쓰기"다 |
| 본문 이미지의 대체 텍스트와 캡션, 올릴 때 자동 채우기(`auto-image-text.ts`) | 없앤다. 빠진 대체 텍스트는 발행 할 일의 "빠진 대체 텍스트 채우기"다 |
| 미디어 파일 이름, 기본 대체 텍스트와 캡션 | 기본 대체 텍스트는 미디어 일괄 막대의 "대체 텍스트 채우기"다. 나머지는 없앤다 |
| 번역 편집기의 블록 번역과 "모두 번역" | "원문에서 번역하기"와 "바뀐 블록만 번역하기" |
| 코드 접기 규칙 | 없앤다 |
| 선택 메뉴(다듬기), 넣기 메뉴(초안), 본문 블록 버튼 | 없앤다. 패널에서 묻고, 선택은 화면 맥락에 담긴다 |
| 사용자 정의 액션, 프롬프트 스니펫, AI 설정 탭 | 없앤다. `styleGuide` 스니펫은 글쓰기 말투가 된다. 모델은 어시스턴트 입력란에서 고르고, 사용량과 상한은 API 키 화면에 있다 |

지금은 범위 밖: 여러 관리자가 한꺼번에 내는 제안. Monti 사이트의 관리자는 한 명이다.

## 개수

| 종류 | 동작 |
| --- | --- |
| read | 18 |
| write | 26 |
| code | 1 |
| editor read | 2 |
| editor write | 6 |

1단계는 읽기 14개와 편집기 읽기 2개다. 2단계는 쓰기 14개와 편집기 쓰기 6개를 더한다.
