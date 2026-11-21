# `resources/translation-status/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 6.5절(`<collection>_data.translation_seen`), 7절(`translationStatus` 리소스)의 인수 조건이다.

- 번역 상태: 번역 언어(원문이 아닌 언어) 작업본(`status = 'draft'`)마다 번역하는 사람이 확인한 원문의 값을 그대로 기록해 두고, 읽을 때 지금의 원문과 비교해 미확인(`unseen`)·확인 완료(`seen`)·원문 변경(`outdated`)으로 알려 주는 기능이다. 기록은 번역 언어 작업본에만 하고 원문 언어 작업본에는 하지 않는다.
- 상태를 갖는 단위: 컬렉션의 최상위 필드 하나와, 원문 본문에서 글자나 내용을 직접 품는 블록(`holds`가 `text` 또는 `nothing`) 하나(본문 블록)이다. 다른 블록을 품는 컨테이너 블록(`holds`가 `blocks`)은 상태를 갖지 않고, 안에 든 블록이 깊이와 관계없이 각자 가진다.
- 상태 규칙: 기록이 없으면 `unseen`, 기록한 값이 지금의 원문 작업본(`status = 'draft'`) 값과 같으면 `seen`, 다르면 `outdated`이다. 원문 작업본이 참조하는 글이나 미디어가 휴지통에 들어가더라도 원문 작업본의 참조 ID 자체는 바뀌지 않으므로 번역 상태는 `outdated`로 바뀌지 않는다. `seen`은 원문을 확인했고 그 뒤 바뀌지 않았다는 뜻이지 번역 내용을 검사했다는 뜻은 아니다. 연결한 번역 블록이 번역 본문에서 지워진 본문 블록도 `outdated`이고, 번역 제외로 표시한 본문 블록도 같은 규칙을 따른다.
- `translationStatus.get`: `{ id, locale }`로 번역 언어 작업본 하나의 필드별 상태(`fields`)와 본문 블록별 상태(`blocks`, 읽는 순서)를 `id`, `collection`, `locale`, `source_locale`과 함께 돌려준다. 확인했던 원문 값은 `seen_value`, 연결한 번역 블록은 `link`, 이 언어에서 번역하지 않기로 한 표시는 `exclude`에 담는다. 원문 언어는 `BAD_REQUEST`, 글이 없거나 휴지통이거나 그 언어가 없으면 `NOT_FOUND`다.
- `translationStatus.list`: 선택 입력 `id`, `collection`, `locale`을 모두 만족하는 활성 글의 번역 언어마다 `{ id, collection, locale, source_locale, outdated_count, unseen_count }`를 한 줄씩 돌려준다. 개수는 필드와 본문 블록을 합쳐 세고, 원문 언어와 휴지통 글은 돌려주지 않으며, 입력을 생략하면 전체이다.
- `translationStatus.update`: `{ id, locale, fields?, blocks? }`로 번역 상태를 바꾸고 `get`과 같은 모양을 돌려준다. `fields`는 키마다 `true`(지금의 원문 값을 확인함) 또는 `null`(기록을 지움), `blocks`는 원문 블록 `id`마다 `{ link }`(번역 블록과 연결하고 확인함)·`{ exclude: true }`(번역 제외)·`null`(기록을 지움)이며, 요청에 없는 항목과 번역본의 `slug`·필드·`body`는 바꾸지 않는다. 원문 언어이거나 원문에 없는 필드·블록이거나 번역 본문에 없는 블록과 연결하면 `BAD_REQUEST`, 글이 없거나 휴지통이거나 그 언어가 없으면 `NOT_FOUND`다.
- 번역 언어 작업본이 만들어질 때(`entries.addLocale`)와 원문 언어가 바뀔 때(`entries.setSourceLocale`)의 `translation_seen`은 `entries.md`가 다룬다.

## 1. 조회 (`get` · `list`)

```
TST-READ-1  아무것도 확인하지 않은 번역 언어는 필드가 모두 미확인 상태이다
  전제  `ko` 원문에 필드 둘이 있고 본문이 없는 컬렉션의 활성 글에 `en` 번역 언어 작업본을 방금 추가했다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-1.1  반환값의 `id`, `collection`, `locale`, `source_locale`이 해당 글과 `"en"`, `"ko"`이다
        TST-READ-1.2  반환값의 `fields`가 원문의 두 필드 모두 `{ status: "unseen" }`이다
        TST-READ-1.3  반환값의 `blocks`가 빈 목록이다

TST-READ-2  확인한 필드는 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다
  전제  `ko` 원문에 필드 둘이 있는 활성 글의 `en` 번역 언어에서 `translationStatus.update`로 두 필드를 확인한 뒤 첫 번째 필드의 원문 값을 바꿨다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-2.1  반환값의 `fields`에서 첫 번째 필드가 `status: "outdated"`이고 `seen_value`가 바뀌기 전의 원문 값이다
        TST-READ-2.2  반환값의 `fields`에서 두 번째 필드가 `status: "seen"`이고 `seen_value`가 원문 값이다

TST-READ-3  본문에서는 글자나 내용이 직접 들어 있는 블록마다 상태를 갖고 컨테이너 블록은 상태를 갖지 않는다
  전제  `ko` 원문 본문에 문단, 문단 하나를 품은 인용, 표가 이 순서로 있는 활성 글에 `en` 번역 언어 작업본을 방금 추가했다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-3.1  반환값의 `blocks`가 첫 문단, 인용 안의 문단, 표 순서로 세 개이고 모두 `status`가 `"unseen"`이다

TST-READ-4  연결한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다
  전제  `ko` 원문 본문에 문단 둘, `en` 번역 본문에도 문단 둘이 있는 활성 글에서 `translationStatus.update`로 각 원문 문단을 번역 문단과 연결한 뒤 첫 번째 원문 문단의 글을 바꿨다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-4.1  반환값의 `blocks`에서 첫 번째 문단이 `status: "outdated"`, `link`(첫 번째 번역 문단의 `id`), `seen_value`(바뀌기 전의 원문 문단)이다
        TST-READ-4.2  반환값의 `blocks`에서 두 번째 문단이 `status: "seen"`, `link`(두 번째 번역 문단의 `id`), `seen_value`(원문 문단)이다

TST-READ-5  번역 제외로 표시한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다
  전제  `ko` 원문 본문에 문단 둘이 있는 활성 글의 `en` 번역 언어에서 `translationStatus.update`로 두 원문 문단을 번역 제외로 표시한 뒤 첫 번째 원문 문단의 글을 바꿨다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-5.1  반환값의 `blocks`에서 첫 번째 문단이 `status: "outdated"`, `exclude: true`, `seen_value`(바뀌기 전의 원문 문단)이다
        TST-READ-5.2  반환값의 `blocks`에서 두 번째 문단이 `status: "seen"`, `exclude: true`, `seen_value`(원문 문단)이다

TST-READ-6  연결한 번역 블록이 번역 본문에서 지워지면 그 원문 블록은 원문 변경 상태가 된다
  전제  `ko` 원문 본문의 문단을 `en` 번역 본문의 문단과 `translationStatus.update`로 연결한 뒤 `entries.update`로 번역 본문에서 그 문단을 지웠다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-6.1  반환값의 `blocks`의 `status`가 `"outdated"`이다

TST-READ-7  원문 언어의 번역 상태는 조회할 수 없다
  전제  `ko` 원문 작업본과 `en` 번역 언어 작업본을 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "ko"`로 `translationStatus.get`을 실행한다
  결과  TST-READ-7.1  `BAD_REQUEST` 오류를 던진다

TST-READ-8  글에 없는 언어의 번역 상태는 조회할 수 없다
  전제  `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-8.1  `NOT_FOUND` 오류를 던진다

TST-READ-9  휴지통에 있는 글의 번역 상태는 조회할 수 없다
  전제  `ko` 원문과 `en` 번역 언어 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-9.1  `NOT_FOUND` 오류를 던진다

TST-READ-10  번역 언어마다 원문이 바뀐 항목과 확인하지 않은 항목의 개수를 한 줄씩 돌려준다
  전제  `ko` 원문에 필드 하나와 문단 하나가 있고 `en`, `ja` 번역 언어 작업본을 가진 활성 글(첫 번째 글)과 `en` 번역 언어 작업본을 가진 휴지통 글이 있다. 첫 번째 글의 `en` 번역 본문에는 문단 하나가 있고, `translationStatus.update`로 필드를 확인하고 문단을 연결한 뒤 원문 문단의 글을 바꿨다. `ja`는 아무것도 확인하지 않았다
  행동  입력 없이 `translationStatus.list`를 실행한다
  결과  TST-READ-10.1  순서와 관계없이 첫 번째 글의 `en` 줄(`outdated_count` 1, `unseen_count` 0)과 `ja` 줄(`outdated_count` 0, `unseen_count` 2) 두 줄만 `id`, `collection`, `locale`, `source_locale`과 함께 돌려준다

TST-READ-11  글을 지정하면 그 글의 번역 언어 줄만 돌려준다
  전제  `en` 번역 언어 작업본을 가진 활성 글이 둘 있다
  행동  첫 번째 글의 `id`로 `translationStatus.list`를 실행한다
  결과  TST-READ-11.1  첫 번째 글의 `en` 줄 하나만 돌려준다

TST-READ-12  컬렉션과 언어를 지정하면 둘 다 일치하는 줄만 돌려준다
  전제  한 컬렉션의 활성 글(`en`, `ja` 번역 언어 작업본)과 다른 컬렉션의 활성 글(`en` 번역 언어 작업본)이 있다
  행동  첫 번째 컬렉션과 `locale: "en"`으로 `translationStatus.list`를 실행한다
  결과  TST-READ-12.1  첫 번째 컬렉션 글의 `en` 줄 하나만 돌려준다

TST-READ-13  확인한 원문 참조 필드의 대상이 휴지통에 들어가도 원문 참조 ID가 바뀌지 않았으면 확인 완료 상태를 유지한다
  전제  `ko` 원문 작업본이 활성 미디어를 참조하고 `en` 번역 언어에서 `translationStatus.update`로 그 필드를 확인한 뒤, 그 미디어가 휴지통으로 이동했다(`trashed_at` 설정)
  행동  해당 글의 `id`와 `locale: "en"`으로 `translationStatus.get`을 실행한다
  결과  TST-READ-13.1  반환값의 `fields`에서 그 필드가 `status: "seen"`이고 `seen_value`가 그 미디어의 `id`이다
```

## 2. 갱신 (`update`)

```
TST-UPD-1  확인하지 않은 필드를 확인하면 확인 완료 상태가 된다
  전제  `ko` 원문에 필드 둘이 있는 활성 글에 `en` 번역 언어 작업본이 있다. 아직 아무것도 확인하지 않았다
  행동  해당 글의 `id`, `locale: "en"`과 함께 첫 번째 필드의 키만 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-1.1  반환값의 `fields`에서 첫 번째 필드가 `status: "seen"`이고 `seen_value`가 원문 값이며, 두 번째 필드가 `{ status: "unseen" }`이다
        TST-UPD-1.2  `<collection>_data` 테이블에서 `"en"` 작업본 행의 `slug`와 필드 값들이 원래 그대로이다

TST-UPD-2  원문이 바뀐 필드를 다시 확인하면 확인 완료 상태가 된다
  전제  `ko` 원문의 필드를 확인한 `en` 번역 언어에서 그 필드의 원문 값을 바꿨다
  행동  해당 글의 `id`, `locale: "en"`과 함께 그 필드의 키를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-2.1  반환값의 `fields`에서 그 필드가 `status: "seen"`이고 `seen_value`가 바뀐 뒤의 원문 값이다

TST-UPD-3  필드의 기록을 지우면 그 필드만 미확인 상태로 돌아간다
  전제  `ko` 원문에 필드 둘이 있는 활성 글의 `en` 번역 언어에서 두 필드를 모두 확인했다
  행동  해당 글의 `id`, `locale: "en"`과 함께 첫 번째 필드의 키만 `null`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-3.1  반환값의 `fields`에서 첫 번째 필드가 `{ status: "unseen" }`이다
        TST-UPD-3.2  반환값의 `fields`에서 두 번째 필드의 `status`가 `"seen"`이다

TST-UPD-4  아직 연결하지 않은 원문 블록을 번역 블록과 연결하면 확인 완료 상태가 된다
  전제  `ko` 원문 본문에 문단 하나를 품은 인용이 있고 `en` 번역 본문에도 문단 하나를 품은 인용이 있는 활성 글이 있다. 아직 아무것도 확인하지 않았다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문 인용 안 문단의 `id`를 키로, 번역 인용 안 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-4.1  반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `link`(번역 문단의 `id`), `seen_value`(원문 문단) 한 개를 포함한다
        TST-UPD-4.2  `<collection>_data` 테이블에서 `"en"` 작업본 행의 `slug`와 `body`가 원래 그대로이다
        TST-UPD-4.3  `<collection>_data` 테이블에서 `"ko"` 작업본 행의 `translation_seen`이 원래 그대로이다

TST-UPD-5  원문이 바뀐 블록을 같은 번역 블록과 다시 연결하면 확인 완료 상태가 된다
  전제  `ko` 원문 본문에 문단 하나, `en` 번역 본문에도 문단 하나가 있는 활성 글에서 `translationStatus.update`로 원문 문단을 번역 문단과 연결한 뒤 원문 문단의 글을 바꿨다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, 같은 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-5.1  반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `link`(번역 문단의 `id`), `seen_value`(바뀐 뒤의 원문 문단) 한 개이다

TST-UPD-6  아직 확인하지 않은 원문 블록을 번역 제외로 표시하면 확인 완료 상태가 된다
  전제  `ko` 원문 본문에 문단 하나가 있는 활성 글에 `en` 번역 언어 작업본이 있다. 아직 아무것도 확인하지 않았다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, `{ exclude: true }`를 값으로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-6.1  반환값의 `blocks`가 원문 문단의 `id`, `status: "seen"`, `exclude: true`, `seen_value`(원문 문단) 한 개이다

TST-UPD-7  블록의 기록을 지우면 그 블록만 미확인 상태로 돌아간다
  전제  `ko` 원문 본문에 문단 둘, `en` 번역 본문에도 문단 둘이 있는 활성 글에서 `translationStatus.update`로 각 원문 문단을 번역 문단과 연결했다
  행동  해당 글의 `id`, `locale: "en"`과 함께 첫 번째 원문 문단의 `id`를 키로, `null`을 값으로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-7.1  반환값의 `blocks`에서 첫 번째 문단의 `status`가 `"unseen"`이고 `link`가 없다
        TST-UPD-7.2  반환값의 `blocks`에서 두 번째 문단의 `status`가 `"seen"`이다

TST-UPD-8  원문에 없는 필드는 확인 완료로 표시할 수 없다
  전제  `ko` 원문에 필드 하나만 있는 활성 글에 `en` 번역 언어 작업본이 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문에 없는 필드의 키를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-8.1  `BAD_REQUEST` 오류를 던진다

TST-UPD-9  원문 본문에 없는 블록은 연결할 수 없다
  전제  `ko` 원문 본문에 문단 하나가 있고 `en` 번역 본문에도 문단 하나가 있는 활성 글이 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문에 없는 블록 `id`를 키로, 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-9.1  `BAD_REQUEST` 오류를 던진다

TST-UPD-10  컨테이너 블록은 번역 블록과 연결할 수 없다
  전제  `ko` 원문 본문에 문단 하나를 품은 인용이 있고 `en` 번역 본문에 문단 하나가 있는 활성 글이 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문 인용 블록의 `id`를 키로, 번역 문단의 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-10.1  `BAD_REQUEST` 오류를 던진다

TST-UPD-11  번역 본문에 없는 블록과는 연결할 수 없다
  전제  `ko` 원문 본문에 문단 하나가 있고 `en` 번역 본문에도 문단 하나가 있는 활성 글이 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 원문 문단의 `id`를 키로, 번역 본문에 없는 블록 `id`를 `link`로 넣어 `blocks`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-11.1  `BAD_REQUEST` 오류를 던진다

TST-UPD-12  원문 언어의 번역 상태는 수정할 수 없다
  전제  `ko` 원문 작업본과 `en` 번역 언어 작업본을 가진 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "ko"`와 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-12.1  `BAD_REQUEST` 오류를 던진다

TST-UPD-13  글에 없는 언어의 번역 상태는 수정할 수 없다
  전제  `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-13.1  `NOT_FOUND` 오류를 던진다

TST-UPD-14  휴지통에 있는 글의 번역 상태는 수정할 수 없다
  전제  `ko` 원문과 `en` 번역 언어 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`과 함께 필드 키 하나를 `true`로 넣어 `fields`로 `translationStatus.update`를 실행한다
  결과  TST-UPD-14.1  `NOT_FOUND` 오류를 던진다
```
