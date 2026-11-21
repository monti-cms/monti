# `resources/entries/` · `resources/media/uses.ts` (엔트리 확장) 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6.1~6.5절(`<collection>`, `<collection>_data`, `<collection>_rels`, `media_uses`), 7절(`entries` 리소스)의 인수 조건이다.

- 반환 모양: 작업본(`status: "draft"`)과 발행본(`status: "published"`) 조회 모두 `<collection>`의 공통 정보와 합쳐 `{ id, collection, locale, source_locale, folder_id, slug, data, published_at }` 모양으로 돌려준다. `id`는 `<collection>.id`이고 `data`는 `{ fields, body? }` 구조이며, `published_at`은 해당 `(entry_id, locale)`의 발행본 행이 있으면 그 시각, 없으면 `null`이다. 참조된 글이나 미디어가 휴지통에 들어가 있으면 DB에는 복원을 위해 남겨 두되 조회 결과의 `data.fields`에서는 빈칸(단건은 생략/`null`, 다건은 배열에서 제외)으로 걸러 돌려준다.
- `entries.create`: 필수 `collection`, `locale`과 선택 `__preset_id`(UUID), `slug`(`null` 허용), `folder_id`, `data`로 글(`<collection>`: `source_locale` = 입력 `locale`, `folder_id` 기본 `null`)과 원문 언어 작업본(`<collection>_data`: `status = 'draft'`, `slug` 기본 `null`, `translation_seen: {}`)을 만든다. 작업본에서는 `slug`와 `required` 필드를 비워 둘 수 있다.
- 쓰기 공통 검증(`create`, `update`, `duplicate`, `addLocale`):
  - `slug`: `null`(초안 빈칸) 또는 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 형식만 허용하며 형식이 어긋나면 `BAD_REQUEST`, `null`이 아닐 때 같은 `(collection, locale)`의 다른 활성 글 작업본과 겹치면 `CONFLICT`로 거절한다.
  - `folder_id`(`create`·`update`·`duplicate`만 해당): `null`(루트) 또는 같은 컬렉션 `scope`의 활성 폴더만 허용하며 아니면 `BAD_REQUEST`로 거절한다.
  - `data.fields`: 스키마에 정의된 키만 허용하고 8종 필드(`text`·`number`·`boolean`·`date`·`select`·`media`·`relation`·`conditional`)의 타입·제약에 어긋나거나, `media`가 없거나 휴지통 미디어를 가리키거나, `relation`이 `to` 컬렉션의 활성 글을 가리키지 않으면 `BAD_REQUEST`로 거절한다.
  - `data.body`: `collection.body`가 `true`일 때만 허용하며 `validateDoc(body, ctx.config)` 실패 시 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다.
- `media_uses` 색인: `source_kind`를 `"entry"`, `source_id`를 `<collection>.id`로 하여 그 글의 모든 언어 작업본 참조를 합쳐 본문은 `"body"`, 최상위 `media` 필드는 `"fields.<필드키>"`, `conditional` 하위 `media` 필드는 `"fields.<조건필드키>.fields.<하위필드키>"` 경로에 한 번씩 기록한다.
- `entries.get` · `entries.list`: `status?: "published" | "draft"`(기본값 `"published"`)로 발행본 또는 작업본을 돌려주며 휴지통 글은 제외한다. `get`은 `{ id, locale?, status? }` 또는 `{ collection, locale, slug, status? }`로, `list`는 `collection`·`locale`·`folder_id`·`relation`·`status`로 거른다. 없는 글이나 언어는 `NOT_FOUND`다(2절).
- `entries.update`: 단건은 한 언어 작업본의 `slug`·`data`(전체 교체)와 글 전체의 `folder_id`를 바꾸고, 다건(`{ ids, folder_id }`)은 폴더 일괄 이동만 한다. `data`를 바꿀 때만 `media_uses`를 모든 언어 기준으로 다시 계산하고, 발행본은 건드리지 않는다(3절).
- `entries.publish`: 활성 글의 한 언어 작업본을 발행본(`status = 'published'`)으로 저장한다(`published_at`은 생략하면 최초 발행은 지금, 재발행은 기존 시각). 발행할 때 작업본의 `slug`와 필수(`required: true`) 필드가 채워져 있는지 검사하며(휴지통에 들어간 참조 대상은 빈칸으로 취급한다), 비어 있으면 `BAD_REQUEST`, 같은 슬러그의 다른 활성 글 발행본이 있으면 `CONFLICT`로 거절한다(4절).
- `entries.unpublish`: 한 언어의 발행본(`status = 'published'`)만 지우고 작업본을 돌려준다. 이미 미발행이어도 성공한다(5절).
- `entries.duplicate`: 원문 언어 작업본만 복제해 새 미발행 글을 만들며 `__preset_id`를 받는다. `slug`를 생략하면 원본 `slug`가 있을 때는 겹치지 않는 `-copy`, `-copy-2`…를 붙이고 원본 `slug`가 `null`이면 `null`로 둔다(6절).
- `entries.replaceReferences`: 같은 컬렉션의 `from_id` 글을 가리키는 모든 `relation`(조건부 하위, 여러 개 선택 포함)을 `into_id`로 바꾼다. 모든 언어의 작업본과 발행본, 휴지통 글까지 고치고 `{ from_id, into_id, updated_ids }`를 돌려준다(7절).
- `entries.addLocale`: 활성 글에 새 비원문 언어 작업본을 추가하고 모든 언어 기준으로 `media_uses`를 다시 계산한다. `slug`를 생략하면 원문 언어 작업본의 `slug`를 기본으로 복사한다(8절).
- `entries.removeLocale`: 비원문 언어를 휴지통 없이 즉시 지우고(발행본 포함) 남은 언어 기준으로 `media_uses`를 다시 계산한다. 원문 언어는 지울 수 없다(`BAD_REQUEST`)(9절).
- `entries.setSourceLocale`: 기준 언어를 글에 이미 있는 다른 언어로 바꾸고 모든 언어의 `translation_seen`을 `{}`로 초기화한다. 이미 기준 언어면 그대로 돌려준다(10절).

---

## 1. 생성 (`create`)

```
ENT-CRT-1  필수 정보만으로 빈 초안 작업본을 만들면 슬러그와 필수 필드를 비워 둔 채 기본값을 채운다
  전제  스키마에 `required: true` 필드가 있는 컬렉션과 `locale`이 있고 컬렉션 테이블들이 비어 있다
  행동  해당 `collection`과 `locale`만으로 `entries.create`를 실행한다
  결과  ENT-CRT-1.1  반환값의 `id`가 UUID 형식이고 `collection`과 `locale`이 입력과 같으며 `source_locale`이 입력 `locale`, `slug`는 `null`, `data`는 `{ fields: {} }`, `folder_id`와 `published_at`은 `null`이다
        ENT-CRT-1.2  `<collection>` 테이블에 `id`, `source_locale`이 반환값과 같고 `folder_id`와 `trashed_at`이 `null`인 행이 하나 생긴다
        ENT-CRT-1.3  `<collection>_data` 테이블에 `entry_id`, `locale`, `status: "draft"`, `slug: null`, `translation_seen: {}`인 행이 하나 생기고 `status: "published"` 행은 없다

ENT-CRT-2  지정한 ID와 슬러그로 작업본을 만든다
  전제  스키마에 컬렉션과 `locale`이 있고 컬렉션 테이블들이 비어 있다
  행동  미리 정한 UUID `__preset_id`, 해당 `collection`, `locale`, 유효한 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-2.1  반환값의 `id`가 전달한 `__preset_id`이고 `slug`가 입력한 `slug`이다
        ENT-CRT-2.2  `<collection>` 테이블에 해당 `id`의 행이 하나 생긴다
        ENT-CRT-2.3  `<collection>_data` 테이블에 해당 `entry_id`, `status: "draft"`, 입력한 `slug`의 행이 하나 생긴다

ENT-CRT-3  단일 값 필드와 본문, 폴더를 담아 작업본을 저장한다
  전제  스키마에 `body: true`이고 `text`, `number`, `boolean`, `date`, 단건·다건 `select` 필드를 가진 컬렉션과 해당 컬렉션 `scope`의 활성 폴더가 있다
  행동  해당 `folder_id`, 유효한 `slug`, 각 필드 값과 유효한 `body`로 `entries.create`를 실행한다
  결과  ENT-CRT-3.1  반환값의 `folder_id`, `slug`, `data`가 입력과 같다
        ENT-CRT-3.2  `<collection>` 테이블에 해당 `id`와 `folder_id`를 가진 행이 생긴다
        ENT-CRT-3.3  `<collection>_data` 테이블의 해당 작업본 행에 `slug`, `body`와 각 필드 열 값이 저장된다

ENT-CRT-4  단건·다건 미디어와 관계 및 조건부 필드를 데이터 테이블과 연결 테이블에 저장한다
  전제  스키마에 단건·다건 `media`, 단건·다건 `relation`, 하위 필드를 가진 `conditional` 필드가 있는 컬렉션과 활성 미디어, 대상 컬렉션의 활성 글이 있다
  행동  단건·다건 참조 값과 조건부 분기 값을 담아 `entries.create`를 실행한다
  결과  ENT-CRT-4.1  반환값의 `data.fields`가 입력과 같다
        ENT-CRT-4.2  `<collection>_data` 테이블에 단건 참조 열과 `<field>`, `<field>__<option>__<subfield>` 열 값이 저장된다
        ENT-CRT-4.3  `<collection>_rels` 테이블에 다건 미디어와 다건 관계가 입력 순서(`position`)와 `path`대로 저장된다

ENT-CRT-5  본문·최상위 미디어·조건부 하위 미디어의 참조를 경로별로 한 번씩 사용처에 기록한다
  전제  스키마에 `body: true`이고 최상위 `media`(`many: true`) 필드와 하위 `media` 필드가 있는 `conditional` 필드를 가진 컬렉션이 있고, 활성 미디어 세 개가 있으며 `media_uses`가 비어 있다
  행동  최상위 `media` 필드가 첫 번째 미디어를 소문자와 대문자로 중복 참조하고, `conditional` 하위 `media` 필드가 두 번째 미디어를 참조하며, `body`가 첫 번째 미디어와 세 번째 미디어를 참조하는 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-5.1  `media_uses`에 `source_kind`가 `"entry"`, `source_id`가 반환된 `id`인 행이 `"fields.<미디어필드>"`(첫 번째 미디어), `"fields.<조건필드>.fields.<하위미디어필드>"`(두 번째 미디어), `"body"`(첫 번째 미디어와 세 번째 미디어 각 하나)로 정확히 네 개 생긴다

ENT-CRT-6  스키마에 없는 컬렉션에는 글을 만들 수 없다
  전제  스키마에 컬렉션과 `locale`이 있고 컬렉션 테이블들이 비어 있다
  행동  스키마의 `collections`에 없는 `collection`과 유효한 `locale`로 `entries.create`를 실행한다
  결과  ENT-CRT-6.1  `BAD_REQUEST` 오류를 던진다

ENT-CRT-7  스키마에 없는 언어 코드로는 글을 만들 수 없다
  전제  스키마에 컬렉션과 `locales`가 있고 컬렉션 테이블들이 비어 있다
  행동  해당 `collection`과 `locales`에 없는 `locale`로 `entries.create`를 실행한다
  결과  ENT-CRT-7.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-7.2  `<collection>` 테이블이 비어 있다

ENT-CRT-8  다른 범위의 폴더에는 글을 넣을 수 없다
  전제  스키마에 컬렉션이 있고 `"media"` `scope`의 폴더가 하나 있으며 컬렉션 테이블들이 비어 있다
  행동  `"media"` 폴더의 `id`를 `folder_id`로 주어 `entries.create`를 실행한다
  결과  ENT-CRT-8.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-8.2  `<collection>` 테이블이 비어 있다

ENT-CRT-9  스키마에 정의되지 않은 필드가 들어 있으면 글을 만들 수 없다
  전제  스키마에 컬렉션이 있고 `<collection>` 테이블이 비어 있다
  행동  컬렉션의 `fields`에 없는 키가 포함된 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-9.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-9.2  `<collection>` 테이블이 비어 있다

ENT-CRT-10  필드의 타입이나 길이 제한에 어긋난 값이면 글을 만들 수 없다
  전제  스키마에 `number` 필드와 `max`가 설정된 `text` 필드가 있는 컬렉션이 있고 `<collection>` 테이블이 비어 있다
  행동  `number` 필드에 문자열을, `text` 필드에 `max`를 넘는 길이의 문자열을 담아 `entries.create`를 실행한다
  결과  ENT-CRT-10.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-10.2  `<collection>` 테이블이 비어 있다

ENT-CRT-11  조건부 필드에서 선택한 분기에 없는 하위 필드가 들어 있으면 글을 만들 수 없다
  전제  스키마에 서로 다른 하위 필드를 가진 두 분기의 `conditional` 필드가 있는 컬렉션이 있고 `<collection>` 테이블이 비어 있다
  행동  첫 번째 분기를 `option`으로 선택하면서 두 번째 분기의 하위 필드를 `fields`에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-11.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-11.2  `<collection>` 테이블이 비어 있다

ENT-CRT-12  본문을 쓰지 않는 컬렉션에는 본문을 넣을 수 없다
  전제  스키마에 `body`가 설정되지 않은 컬렉션이 있고 `<collection>` 테이블이 비어 있다
  행동  유효한 `body`를 포함한 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-12.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-12.2  `<collection>` 테이블이 비어 있다

ENT-CRT-13  본문 형식이 맞지 않으면 문제 목록을 담아 글 생성을 거절한다
  전제  스키마에 `body: true`인 컬렉션이 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `<collection>` 테이블이 비어 있다
  행동  그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `body`로 `entries.create`를 실행한다
  결과  ENT-CRT-13.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-13.2  오류의 `details`가 같은 `body`와 `config`에 대한 `validateDoc`의 반환값과 같다
        ENT-CRT-13.3  `<collection>` 테이블이 비어 있다

ENT-CRT-14  휴지통에 있는 미디어는 새로 연결할 수 없다
  전제  스키마에 `media` 필드가 있는 컬렉션이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있으며 `<collection>`과 `media_uses`가 비어 있다
  행동  해당 미디어의 `id`를 `media` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-14.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-14.2  `<collection>` 테이블이 비어 있다
        ENT-CRT-14.3  `media_uses` 테이블이 비어 있다

ENT-CRT-15  관계 필드에 대상 컬렉션이 아닌 다른 컬렉션의 글은 연결할 수 없다
  전제  스키마에 대상 컬렉션을 가리키는 `relation` 필드가 있는 컬렉션과 대상이 아닌 다른 컬렉션이 있고, 다른 컬렉션에 활성 글이 하나 있다
  행동  다른 컬렉션 글의 `id`를 `relation` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-15.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-15.2  `<collection>` 테이블이 비어 있다

ENT-CRT-16  슬러그 형식이 맞지 않으면 글을 만들 수 없다
  전제  스키마에 컬렉션과 `locale`이 있고 `<collection>` 테이블이 비어 있다
  행동  공백이 포함된 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-16.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-16.2  `<collection>` 테이블이 비어 있다

ENT-CRT-17  같은 컬렉션과 언어에 같은 슬러그의 활성 글이 이미 있으면 글을 만들 수 없다
  전제  스키마에 컬렉션과 `locale`이 있고, 해당 `collection`과 `locale`에 슬러그가 있는 활성 글이 하나 있다
  행동  같은 `collection`, `locale`, 같은 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-17.1  `CONFLICT` 오류를 던진다
        ENT-CRT-17.2  `<collection>` 테이블의 행은 원래 하나 그대로이다
```

## 2. 조회 (`get` · `list`)

```
ENT-READ-1  기본 단건 조회는 발행된 글의 원문 언어 발행본을 돌려준다
  전제  작업본(`status: "draft"`)과 다른 `slug`·필드 값으로 발행본(`status: "published"`) 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-READ-1.1  반환값의 `id`, `collection`, `source_locale`, `folder_id`가 `<collection>` 행과 같고 `locale`이 `source_locale`이다
        ENT-READ-1.2  반환값의 `slug`, `data`, `published_at`이 `status = 'published'` 행과 같다

ENT-READ-2  컬렉션·언어·발행 슬러그로 발행본을 단건 조회한다
  전제  작업본과 다른 `slug`로 발행본 행이 있는 활성 글이 두 개 있다
  행동  첫 번째 글의 `collection`, `locale`, 발행된 `slug`로 `entries.get`을 실행한다
  결과  ENT-READ-2.1  반환값의 `id`, `slug`, `data`, `published_at`이 첫 번째 글의 발행본과 같다

ENT-READ-3  초안 상태로 단건 조회하면 발행본이 있더라도 작업본을 돌려준다
  전제  작업본과 다른 `slug`·필드 값으로 발행본 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`와 `status: "draft"`로 `entries.get`을 실행한다
  결과  ENT-READ-3.1  반환값의 `slug`와 `data`가 `status = 'draft'` 작업본과 같다
        ENT-READ-3.2  반환값의 `published_at`이 `status = 'published'` 행의 `published_at`과 같다

ENT-READ-4  아직 발행하지 않은 글은 기본 발행본 조회에서 찾을 수 없다
  전제  `status = 'published'` 행이 없는 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-READ-4.1  `NOT_FOUND` 오류를 던진다

ENT-READ-5  휴지통에 있는 글은 초안 상태로도 조회할 수 없다
  전제  발행본 행이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`와 `status: "draft"`로 `entries.get`을 실행한다
  결과  ENT-READ-5.1  `NOT_FOUND` 오류를 던진다

ENT-READ-6  조건 없이 목록을 조회하면 활성 글의 발행된 원문 언어만 돌려준다
  전제  원문 언어(`ko`)와 비원문 언어(`en`)가 모두 발행된 활성 글, 원문 언어는 미발행이고 비원문 언어만 발행된 활성 글, 원문 언어 발행본이 있지만 휴지통에 들어가 있는(`trashed_at` 설정) 글이 각각 하나씩 있다
  행동  인자 없이 `entries.list`를 실행한다
  결과  ENT-READ-6.1  첫 번째 글의 원문 언어(`"ko"`) 행 하나만 돌려준다
        ENT-READ-6.2  반환된 항목의 `slug`, `data`, `published_at`이 첫 번째 글 `"ko"`의 발행본 행과 같다

ENT-READ-7  초안 상태로 목록을 조회하면 모든 활성 글의 원문 언어 작업본을 돌려준다
  전제  발행본이 있는 활성 글, 미발행 활성 글, 휴지통에 들어가 있는(`trashed_at` 설정) 글이 각각 하나씩 있다
  행동  `status: "draft"`로 `entries.list`를 실행한다
  결과  ENT-READ-7.1  `trashed_at`이 `null`인 글 두 개만 작업본 `data`로 돌려준다
        ENT-READ-7.2  발행된 글의 `published_at`이 발행본 행의 시각이다
        ENT-READ-7.3  미발행 글의 `published_at`이 `null`이다

ENT-READ-8  컬렉션·언어·폴더를 지정하면 모두 일치하는 해당 폴더 직속 글만 돌려준다
  전제  대상 컬렉션과 `locale`에 속한 대상 폴더 직속 글, 그 하위 폴더의 글, `folder_id`가 `null`인 글, 다른 `locale`만 가진 글, 다른 컬렉션의 글이 각각 하나씩 있다
  행동  대상 `collection`, `locale`, 대상 폴더의 `id`인 `folder_id`, `status: "draft"`로 `entries.list`를 실행한다
  결과  ENT-READ-8.1  조건에 모두 일치하는 대상 폴더 직속 글 하나만 돌려준다

ENT-READ-9  폴더를 비워 목록을 조회하면 루트 글만 돌려준다
  전제  `folder_id`가 `null`인 글 하나와 폴더에 속한 글 하나가 있다
  행동  `folder_id: null`과 `status: "draft"`로 `entries.list`를 실행한다
  결과  ENT-READ-9.1  `folder_id`가 `null`인 글 하나만 돌려준다

ENT-READ-10  역방향 관계 조건으로 목록을 조회하면 해당 대상을 참조하는 글만 돌려준다
  전제  같은 필드 키로 단건 `relation` 필드를 가진 첫 번째 컬렉션과 `many: true` `relation` 필드를 가진 두 번째 컬렉션이 있다. 발행본에서 대상 글을 참조하는 글이 각 컬렉션에 하나씩 있고, 작업본에서만 대상 글을 참조하고 발행본에서는 참조하지 않는 글이 하나 더 있다
  행동  해당 필드 키와 대상 글 `id`를 `relation` 조건으로 주어 `entries.list`를 실행한다
  결과  ENT-READ-10.1  발행본에서 대상 글을 참조하는 글 두 개만 돌려준다

ENT-READ-11  비원문 언어를 지정해 단건 조회하면 해당 언어의 발행본을 돌려준다
  전제  원문 언어(`ko`)와 비원문 언어(`en`)가 모두 발행된 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.get`을 실행한다
  결과  ENT-READ-11.1  반환값의 `id`가 해당 글 `id`, `locale`이 `"en"`, `source_locale`이 `"ko"`이다
        ENT-READ-11.2  반환값의 `slug`, `data`, `published_at`이 `"en"`의 발행본 행과 같다

ENT-READ-12  글에 없는 언어를 지정하면 조회할 수 없다
  전제  원문 언어(`ko`)만 있는 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`, `status: "draft"`로 `entries.get`을 실행한다
  결과  ENT-READ-12.1  `NOT_FOUND` 오류를 던진다

ENT-READ-13  언어를 생략해 목록을 조회하면 번역 언어가 있어도 글마다 원문 언어 한 행씩만 돌려준다
  전제  원문 언어(`ko`)와 번역 언어(`en`)가 모두 있는 활성 글 하나와, 원문 언어(`en`)만 있는 활성 글 하나가 있다
  행동  `status: "draft"`만으로 `entries.list`를 실행한다
  결과  ENT-READ-13.1  첫 번째 글의 `"ko"` 행과 두 번째 글의 `"en"` 행, 총 두 개만 돌려준다

ENT-READ-14  참조된 글이나 미디어가 휴지통에 들어가 있으면 조회 응답에서는 빈칸으로 걸러 돌려준다
  전제  단건 `media` 필드와 다건 `relation` 필드를 가진 활성 글이 미디어 하나와 대상 글 두 개(첫 번째 대상 글, 두 번째 대상 글)를 참조하도록 저장된 뒤, 그 미디어와 첫 번째 대상 글이 휴지통으로 이동했다
  행동  해당 글의 `id`와 `status: "draft"`로 `entries.get`을 실행한다
  결과  ENT-READ-14.1  반환값의 `data.fields`에서 단건 `media` 필드는 비어 있고, 다건 `relation` 필드는 활성 상태인 두 번째 대상 글 하나만 담고 있다
```

## 3. 수정 (`update`)

```
ENT-UPD-1  단건 수정에서 데이터 없이 슬러그와 폴더만 주면 지정한 항목만 바꾸고 데이터·미디어 사용처·발행본은 유지한다
  전제  `folder_id`가 `null`이고 미디어를 참조해 `media_uses` 행과 발행본 행이 있는 활성 글 하나와, 해당 컬렉션 `scope`의 활성 폴더가 있다
  행동  해당 글의 `id`, 새 `slug`, 해당 폴더의 `id`인 `folder_id`만으로 `entries.update`를 실행한다
  결과  ENT-UPD-1.1  반환값의 `slug`와 `folder_id`가 새 값이고 `data`와 `published_at`이 원래 그대로이다
        ENT-UPD-1.2  `<collection>` 테이블의 `folder_id`와 `<collection>_data` 작업본 행의 `slug`가 새 값이고 작업본의 필드 값들은 원래 그대로이다
        ENT-UPD-1.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다
        ENT-UPD-1.4  `<collection>_data` 발행본 행의 `slug`와 필드 값들이 원래 그대로이다

ENT-UPD-2  단건 수정에서 데이터를 바꾸면 작업본 데이터를 통째로 교체하고 해당 글의 미디어 사용처만 갱신한다
  전제  첫 번째 미디어를 참조해 각각 `media_uses` 행이 있는 대상 글과 다른 글, 대상 글과 같은 `source_id`를 가진 `template`의 `media_uses` 행, 활성 상태인 두 번째 미디어가 있다
  행동  대상 글의 `id`와 두 번째 미디어만 참조하는 새 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-2.1  반환값의 `data`가 새 `data`이고 `slug`와 `folder_id`가 원래 그대로이다
        ENT-UPD-2.2  `<collection>_data` 테이블에서 대상 글 작업본의 미디어 참조가 두 번째 미디어로 바뀐다
        ENT-UPD-2.3  `media_uses`에서 대상 글(`source_kind`가 `"entry"`)의 참조는 두 번째 미디어 하나뿐이다
        ENT-UPD-2.4  `media_uses`에서 다른 글의 기존 참조는 그대로 남아 있다
        ENT-UPD-2.5  `media_uses`에서 `template`의 기존 참조는 그대로 남아 있다

ENT-UPD-3  단건 수정에서 폴더를 비우면 글을 루트로 이동한다
  전제  폴더에 속한 글이 하나 있다
  행동  해당 글의 `id`와 `folder_id: null`로 `entries.update`를 실행한다
  결과  ENT-UPD-3.1  반환값의 `folder_id`가 `null`이다
        ENT-UPD-3.2  `<collection>` 테이블에서 해당 행의 `folder_id`가 `null`이다

ENT-UPD-4  단건 수정에서 존재하지 않는 미디어를 참조하면 수정을 거절하고 기존 상태를 유지한다
  전제  미디어를 참조해 `media_uses` 행이 있는 글이 하나 있다
  행동  해당 글의 `id`와 존재하지 않는 UUID를 `media` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-4.2  `<collection>_data` 테이블에서 해당 작업본 행이 원래 그대로이다
        ENT-UPD-4.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다

ENT-UPD-5  단건 수정에서 휴지통에 있는 글을 관계 필드에 연결하려 하면 거절한다
  전제  `relation` 필드를 가진 글 하나와 `to` 컬렉션에서 휴지통에 들어가 있는(`trashed_at` 설정) 글 하나가 있다
  행동  해당 글의 `id`와 휴지통 글의 `id`를 `relation` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-5.2  `<collection>_data` 테이블에서 해당 작업본 행이 원래 그대로이다

ENT-UPD-6  휴지통에 있는 글은 수정할 수 없다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`와 새 `slug`로 `entries.update`를 실행한다
  결과  ENT-UPD-6.1  `NOT_FOUND` 오류를 던진다
        ENT-UPD-6.2  `<collection>_data` 테이블에서 해당 작업본 행의 `slug`가 원래 그대로이다

ENT-UPD-7  같은 컬렉션과 언어의 다른 활성 글과 슬러그가 겹치면 슬러그를 바꿀 수 없다
  전제  같은 `collection`과 `locale`에 슬러그가 있는 활성 글이 두 개 있다
  행동  두 번째 글의 `id`와 첫 번째 글의 `slug`로 `entries.update`를 실행한다
  결과  ENT-UPD-7.1  `CONFLICT` 오류를 던진다
        ENT-UPD-7.2  `<collection>_data` 테이블에서 두 번째 글의 `slug`가 원래 그대로이다

ENT-UPD-8  다건 수정은 지정한 글들을 한 폴더로 일괄 이동한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`의 활성 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-8.1  반환 목록이 요청한 두 글의 `{ id, folder_id: 새 folder_id }`로 이루어진다
        ENT-UPD-8.2  `<collection>` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

ENT-UPD-9  다건 수정 대상 중 하나라도 휴지통에 있으면 전체 이동을 취소한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 활성 글 하나, 휴지통에 들어가 있는(`trashed_at` 설정) 글 하나, 해당 컬렉션 `scope`의 활성 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-9.1  `NOT_FOUND` 오류를 던진다
        ENT-UPD-9.2  `<collection>` 테이블에서 활성 글의 `folder_id`가 `null` 그대로이다

ENT-UPD-10  다건 수정에서 이동할 폴더가 휴지통에 있으면 전체 이동을 취소한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`에서 휴지통에 들어가 있는(`trashed_at` 설정) 폴더가 하나 있다
  행동  두 글의 `ids`와 휴지통 폴더의 `id`인 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-10.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-10.2  `<collection>` 테이블에서 두 글의 `folder_id`가 모두 `null` 그대로이다

ENT-UPD-11  비원문 언어를 지정해 수정하면 그 언어의 작업본만 바꾸고 폴더는 글 전체에 적용한다
  전제  `folder_id`가 `null`이고 원문 언어(`ko`)와 비원문 언어(`en`) 작업본이 있는 활성 글 하나와, 해당 컬렉션 `scope`의 활성 폴더가 있다
  행동  해당 글의 `id`, `locale: "en"`, 새 `slug`, 해당 `folder_id`, 새 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-11.1  반환값의 `locale`이 `"en"`, `source_locale`이 `"ko"`이며 `slug`, `folder_id`, `data`가 새 값이다
        ENT-UPD-11.2  `<collection>_data` 테이블에서 `"en"` 작업본 행의 `slug`와 필드 값들이 새 값이고 `"ko"` 작업본 행은 원래 그대로이다
        ENT-UPD-11.3  `<collection>` 테이블에서 해당 글의 `folder_id`가 새 `folder_id`이다

ENT-UPD-12  한 언어의 데이터를 바꿔도 같은 글의 다른 언어가 참조하는 미디어 사용처는 유지한다
  전제  원문 언어(`ko`)가 첫 번째 미디어를, 비원문 언어(`en`)가 두 번째 미디어를 참조하고 `media_uses`에 두 참조가 모두 있는 활성 글과, 활성 상태인 세 번째 미디어가 있다
  행동  해당 글의 `id`, `locale: "en"`, 세 번째 미디어만 참조하는 새 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-12.1  `media_uses`에서 해당 글의 참조가 첫 번째 미디어와 세 번째 미디어 두 개이다

ENT-UPD-13  글에 없는 언어를 지정하면 수정할 수 없다
  전제  원문 언어(`ko`)만 있는 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`, 새 `slug`로 `entries.update`를 실행한다
  결과  ENT-UPD-13.1  `NOT_FOUND` 오류를 던진다
        ENT-UPD-13.2  `<collection>_data` 테이블의 `"ko"` 작업본 행이 원래 그대로이다
```

## 4. 발행 (`publish`)

```
ENT-PUB-1  슬러그와 필수 필드가 채워진 작업본으로 발행본을 만든다
  전제  유효한 `slug`와 필수(`required: true`)인 `text`, `number`(값 `0`), `boolean`(값 `false`) 필드가 채워져 있고 미발행 상태인 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.publish`를 실행한다
  결과  ENT-PUB-1.1  반환값의 `slug`와 `data`가 작업본과 같고 `published_at`이 실행 전후 시각 사이이다
        ENT-PUB-1.2  `<collection>_data` 테이블에 `status = 'published'`이고 `slug`, 필드 값, `published_at`이 반환값과 같은 행이 생긴다

ENT-PUB-2  이미 발행된 글을 다시 발행하면 기존 발행 시각을 유지한다
  전제  발행된 글의 작업본 `slug`와 필드 값을 다른 값으로 바꾼 상태이다
  행동  해당 글의 `id`만으로 `entries.publish`를 실행한다
  결과  ENT-PUB-2.1  반환값의 `slug`와 `data`가 새 작업본과 같고 `published_at`이 기존 발행 시각과 같다
        ENT-PUB-2.2  `<collection>_data` 테이블에서 `status = 'published'` 행의 `slug`와 필드 값이 갱신되고 `published_at`은 원래 그대로이다

ENT-PUB-3  발행 시각을 지정해 발행하면 그 시각으로 저장한다
  전제  이미 발행된 활성 글이 하나 있다
  행동  해당 글의 `id`와 기존과 다른 타임존 포함 ISO 8601 `published_at`으로 `entries.publish`를 실행한다
  결과  ENT-PUB-3.1  반환값의 `published_at`이 전달한 시각과 같다
        ENT-PUB-3.2  `<collection>_data` 테이블에서 `status = 'published'` 행의 `published_at`이 전달한 시각과 같다

ENT-PUB-4  슬러그가 비어 있으면 글을 발행할 수 없다
  전제  `slug`가 `null`인 미발행 활성 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-4.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-5  필수 필드가 비어 있으면 글을 발행할 수 없다
  전제  유효한 `slug`는 있지만 필수(`required: true`)인 `text` 필드 값이 비어 있는 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-5.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-6  선택한 조건부 분기의 필수 하위 필드가 비어 있으면 글을 발행할 수 없다
  전제  두 분기를 가진 `conditional` 필드의 첫 번째 분기에 필수(`required: true`) 하위 필드가 있고, 첫 번째 분기를 선택했지만 그 하위 필드를 비워 둔 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-6.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-6.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-7  같은 슬러그로 이미 발행된 다른 활성 글이 있으면 발행할 수 없다
  전제  같은 `collection`과 `locale`에, 첫 번째 글은 옛 `slug`로 발행된 뒤 작업본 `slug`를 바꿨고 두 번째 미발행 글의 작업본 `slug`가 그 옛 `slug`와 같다
  행동  두 번째 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-7.1  `CONFLICT` 오류를 던진다
        ENT-PUB-7.2  `<collection>_data` 테이블에 첫 번째 글의 `status = 'published'` 행만 그대로 남아 있다

ENT-PUB-8  휴지통에 있는 글은 발행할 수 없다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-8.1  `NOT_FOUND` 오류를 던진다
        ENT-PUB-8.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-9  비원문 언어를 지정해 발행하면 그 언어의 발행본만 만들고 원문 언어는 건드리지 않는다
  전제  원문 언어(`ko`)와 비원문 언어(`en`) 작업본이 모두 있고 둘 다 미발행 상태인 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.publish`를 실행한다
  결과  ENT-PUB-9.1  반환값의 `locale`이 `"en"`, `source_locale`이 `"ko"`이며 `slug`와 `data`가 `"en"` 작업본과 같다
        ENT-PUB-9.2  `<collection>_data` 테이블에 해당 글의 `"en"` `status = 'published'` 행 하나만 생긴다

ENT-PUB-10  글에 없는 언어를 지정하면 발행할 수 없다
  전제  원문 언어(`ko`)만 있는 미발행 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.publish`를 실행한다
  결과  ENT-PUB-10.1  `NOT_FOUND` 오류를 던진다
        ENT-PUB-10.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-11  필수 참조 필드가 가리키던 글이나 미디어가 휴지통에 들어가 있으면 빈칸으로 취급되어 발행할 수 없다
  전제  필수(`required: true`)인 `relation` 필드가 활성 글을 가리키도록 저장된 미발행 글이 있고, 가리키던 대상 글이 그 뒤에 휴지통으로 이동했다(`trashed_at` 설정)
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-11.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-11.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다

ENT-PUB-12  선택 참조 필드가 가리키던 대상이 휴지통에 들어가 있으면 빈칸으로 취급되어 정상 발행된다
  전제  필수가 아닌(`required: false`) `media` 필드가 활성 미디어를 가리키도록 저장된 미발행 글이 있고, 그 미디어가 그 뒤에 휴지통으로 이동했다(`trashed_at` 설정)
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-12.1  반환값의 `data.fields`에서 그 `media` 필드는 비어 있고 `published_at`이 설정된다
        ENT-PUB-12.2  `<collection>_data` 테이블에 `status = 'published'` 행이 생긴다
```

## 5. 발행 취소 (`unpublish`)

```
ENT-UNPUB-1  발행을 취소하면 발행본만 지우고 작업본과 미디어 사용처는 남긴다
  전제  미디어를 참조해 `media_uses` 행과 발행본 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-1.1  반환값의 `slug`와 `data`가 작업본과 같고 `published_at`이 `null`이다
        ENT-UNPUB-1.2  `<collection>_data` 테이블에 `status = 'published'` 행이 없다
        ENT-UNPUB-1.3  `<collection>_data` 테이블의 `status = 'draft'` 작업본 행이 원래 그대로이다
        ENT-UNPUB-1.4  `media_uses`의 해당 글 참조가 원래 그대로이다

ENT-UNPUB-2  이미 미발행 상태인 글도 오류 없이 발행 취소된다
  전제  `status = 'published'` 행이 없는 활성 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-2.1  반환값의 `id`, `slug`, `data`가 작업본과 같고 `published_at`이 `null`이다

ENT-UNPUB-3  휴지통에 있는 글은 발행을 취소할 수 없다
  전제  발행본 행이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-3.1  `NOT_FOUND` 오류를 던진다
        ENT-UNPUB-3.2  `<collection>_data` 테이블의 `status = 'published'` 행이 원래 그대로이다

ENT-UNPUB-4  비원문 언어를 지정해 발행을 취소하면 그 언어의 발행본만 지우고 다른 언어 발행본은 유지한다
  전제  원문 언어(`ko`)와 비원문 언어(`en`)가 모두 발행된 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-4.1  반환값의 `locale`이 `"en"`, `published_at`이 `null`이다
        ENT-UNPUB-4.2  `<collection>_data` 테이블에 `"ko"`의 `status = 'published'` 행만 그대로 남아 있다

ENT-UNPUB-5  글에 없는 언어를 지정하면 발행을 취소할 수 없다
  전제  원문 언어(`ko`)만 발행된 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-5.1  `NOT_FOUND` 오류를 던진다
        ENT-UNPUB-5.2  `<collection>_data` 테이블에 `"ko"`의 `status = 'published'` 행이 그대로 남아 있다
```

## 6. 복제 (`duplicate`)

```
ENT-DUP-1  글의 원문 언어 작업본과 미디어 사용처를 새 슬러그의 미발행 글로 복제하고 번역 언어는 복제하지 않는다
  전제  폴더에 속하고 원문 언어(`ko`)가 첫 번째 미디어를 참조하며 발행본과 비원문 언어(`en`, 두 번째 미디어 참조)가 있는 활성 글이 하나 있다
  행동  해당 글의 `id`와 새 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-1.1  반환값의 `id`가 원본과 다른 UUID이고 `collection`, `locale`, `source_locale`, `folder_id`, `data`는 원본 원문 언어 작업본과 같으며 `slug`는 새 `slug`, `published_at`은 `null`이다
        ENT-DUP-1.2  `<collection>` 테이블에 새 글 행이 하나 추가되고 `<collection>_data` 테이블에 새 글의 `"ko"` `status = 'draft'` 행만 `translation_seen`이 `{}`인 상태로 하나 추가된다
        ENT-DUP-1.3  원본 글의 `<collection>` 행과 `"ko"`·`"en"`의 `<collection>_data` 행들은 원래 그대로이다
        ENT-DUP-1.4  `<collection>_data` 테이블에 새 글의 `status = 'published'` 행은 생기지 않는다
        ENT-DUP-1.5  `media_uses`에 새 글의 참조가 첫 번째 미디어의 경로만 생긴다

ENT-DUP-2  슬러그를 생략하고 복제하면 겹치지 않는 `-copy` 슬러그를 붙인다
  전제  같은 `collection`과 `locale`에 `slug`가 `"hello"`인 활성 글과 `"hello-copy"`인 활성 글이 하나씩 있다
  행동  `"hello"` 글의 `id`만으로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-2.1  반환값의 `slug`가 `"hello-copy-2"`이다
        ENT-DUP-2.2  `<collection>_data` 테이블에 `slug`가 `"hello-copy-2"`인 새 작업본 행이 생긴다

ENT-DUP-3  지정한 ID로 복제한다
  전제  활성 글이 하나 있다
  행동  해당 글의 `id`와 미리 정한 UUID `__preset_id`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-3.1  반환값의 `id`가 전달한 `__preset_id`이다
        ENT-DUP-3.2  `<collection>` 테이블에 해당 `id`의 행이 생긴다

ENT-DUP-4  슬러그 형식이 맞지 않으면 글을 복제할 수 없다
  전제  활성 글이 하나 있다
  행동  해당 글의 `id`와 공백이 포함된 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-DUP-4.2  `<collection>` 테이블의 행은 원래 하나 그대로이다

ENT-DUP-5  이미 쓰이고 있는 슬러그로는 글을 복제할 수 없다
  전제  슬러그가 있는 활성 글이 하나 있다
  행동  해당 글의 `id`와 그 글과 같은 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-5.1  `CONFLICT` 오류를 던진다
        ENT-DUP-5.2  `<collection>` 테이블의 행은 원래 하나 그대로이다

ENT-DUP-6  휴지통에 있는 글은 복제할 수 없다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-6.1  `NOT_FOUND` 오류를 던진다
        ENT-DUP-6.2  `<collection>` 테이블의 행은 원래 하나 그대로이다
```

## 7. 참조 교체 (`replaceReferences`)

```
ENT-REF-1  다른 글들이 가리키던 대상을 작업본과 발행본 모두 새 대상으로 바꾸고 옛 글은 그대로 둔다
  전제  같은 컬렉션에 활성 글 둘(옛 글, 새 글)이 있다. 다른 컬렉션의 발행된 글 하나가 작업본과 발행본 모두에서 옛 글을 가리키고 있고, 작업본과 발행본의 다른 필드는 서로 다르다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-1.1  반환값의 `from_id`가 옛 글, `into_id`가 새 글이고 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-1.2  그 글의 작업본(`status = 'draft'`)과 발행본(`status = 'published'`) 모두 참조가 새 글로 바뀐다
        ENT-REF-1.3  발행본의 나머지 필드, `slug`, `published_at`은 작업본으로 덮이지 않고 원래 그대로이다
        ENT-REF-1.4  옛 글의 `trashed_at`은 `null` 그대로이다

ENT-REF-2  여러 개를 고르는 관계 필드에 바꿀 대상이 이미 들어 있으면 먼저 등장한 위치 하나만 남긴다
  전제  같은 컬렉션에 활성 글 셋(옛 글, 다른 글, 새 글)이 있고, 다른 컬렉션의 글 하나가 `many: true` 관계 필드에 `[옛 글, 다른 글, 새 글]`을 가지고 있다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-2.1  반환값의 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-2.2  그 글의 관계 필드가 `[새 글, 다른 글]`로 바뀐다

ENT-REF-3  조건부 필드 안에 들어 있는 관계 참조도 함께 바꾼다
  전제  같은 컬렉션에 활성 글 둘(옛 글, 새 글)이 있고, 다른 컬렉션의 글 하나가 `conditional` 필드 안 관계 필드로 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-3.1  반환값의 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-3.2  그 글의 `conditional` 안 관계 필드가 새 글로 바뀐다

ENT-REF-4  휴지통에 있는 다른 글이 가리키던 참조도 함께 바꾼다
  전제  같은 컬렉션에 활성 글 둘(옛 글, 새 글)이 있고, 휴지통에 들어가 있는(`trashed_at` 설정) 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-4.1  반환값의 `updated_ids`가 그 휴지통 글의 `id` 하나뿐이다
        ENT-REF-4.2  그 휴지통 글의 참조가 새 글로 바뀐다

ENT-REF-5  옛 글이 이미 휴지통에 있어도 다른 글의 참조를 새 글로 바꿀 수 있다
  전제  같은 컬렉션에 휴지통에 들어가 있는 글(옛 글)과 활성 글(새 글)이 있고, 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-5.1  반환값의 `updated_ids`가 참조하던 글의 `id` 하나뿐이다
        ENT-REF-5.2  참조하던 글의 참조가 새 글로 바뀐다

ENT-REF-6  글의 참조를 자기 자신으로 바꿀 수는 없다
  전제  활성 글이 하나 있다
  행동  같은 `id`를 `from_id`와 `into_id` 모두에 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-6.1  `BAD_REQUEST` 오류를 던진다

ENT-REF-7  서로 다른 컬렉션의 글끼리는 참조를 바꿀 수 없다
  전제  서로 다른 두 컬렉션에 활성 글 둘(옛 글, 새 글)이 하나씩 있다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-7.1  `BAD_REQUEST` 오류를 던진다

ENT-REF-8  바꿀 새 글이 휴지통에 있으면 아무 참조도 바꾸지 않고 거절한다
  전제  같은 컬렉션에 활성 글(옛 글)과 휴지통에 들어가 있는 글(새 글)이 있고, 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-8.1  `NOT_FOUND` 오류를 던진다
        ENT-REF-8.2  참조하던 글의 참조 값이 원래 그대로이다

ENT-REF-9  여러 언어가 있는 글의 참조를 바꾸면 모든 언어의 작업본과 발행본을 고치고 글 ID는 한 번만 돌려준다
  전제  같은 컬렉션에 활성 글 둘(옛 글, 새 글)이 있고, 다른 컬렉션의 글 하나가 원문 언어(`ko`)와 비원문 언어(`en`) 모두에서 작업본과 발행본에 옛 글을 가리키고 있다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-9.1  반환값의 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-9.2  `<collection>_data` 테이블의 `"ko"`와 `"en"` 작업본(`status = 'draft'`) 행 모두 참조가 새 글로 바뀐다
        ENT-REF-9.3  `<collection>_data` 테이블의 `"ko"`와 `"en"` 발행본(`status = 'published'`) 행 모두 참조가 새 글로 바뀐다
```

## 8. 언어 추가 (`addLocale`)

```
ENT-LOC-1  활성 글에 비원문 언어를 추가할 때 슬러그를 생략하면 원문 언어의 슬러그를 기본으로 복사한다
  전제  스키마에 두 언어(`ko`, `en`)와 `required: true` 필드가 있는 컬렉션, 해당 컬렉션 `scope`의 활성 폴더가 있고, 그 폴더 안에 `slug`가 `"open-notice"`인 `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`만으로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-1.1  반환값의 `id`가 해당 글 `id`, `locale`이 `"en"`, `source_locale`이 `"ko"`, `slug`가 `"open-notice"`, `data`가 `{ fields: {} }`, `published_at`이 `null`이고 `collection`과 `folder_id`가 해당 글과 같다
        ENT-LOC-1.2  `<collection>_data` 테이블에 `(entry_id, "en", "draft")` 행이 추가되고 `slug`가 `"open-notice"`, `translation_seen`이 `{}`이다
        ENT-LOC-1.3  `<collection>_data` 테이블에 `(entry_id, "en", "published")` 행이 없다

ENT-LOC-2  데이터를 담아 언어를 추가하면 글 전체 언어 기준으로 미디어 사용처를 갱신한다
  전제  스키마에 `media` 필드가 있는 컬렉션과 두 언어(`ko`, `en`), 활성 미디어 둘이 있고, `ko` 작업본만 첫 번째 미디어를 참조하는 활성 글이 하나 있다
  행동  두 번째 미디어를 참조하는 `data`와 `locale: "en"`으로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-2.1  반환값의 `data`가 입력과 같다
        ENT-LOC-2.2  `media_uses`에 해당 글(`source_kind: "entry"`, `source_id: id`)의 참조로 첫 번째 미디어와 두 번째 미디어가 모두 있다

ENT-LOC-3  스키마에 없는 언어 코드는 추가할 수 없다
  전제  스키마에 `ko`, `en` 두 언어만 있고 `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  스키마에 없는 `locale`(`"ja"`)로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-3.1  `BAD_REQUEST` 오류를 던진다
        ENT-LOC-3.2  `<collection>_data` 테이블에 `"ja"` 행이 생기지 않는다

ENT-LOC-4  이미 있는 언어는 다시 추가할 수 없다
  전제  `ko` 원문과 `en` 작업본을 모두 가진 활성 글이 하나 있다
  행동  그 글에 `locale: "en"`을 주어 `entries.addLocale`을 실행한다
  결과  ENT-LOC-4.1  `CONFLICT` 오류를 던진다
        ENT-LOC-4.2  기존 `<collection>_data`의 `"en"` 작업본 행이 원래 그대로이다

ENT-LOC-5  같은 컬렉션·언어의 다른 활성 글과 슬러그가 겹치면 언어를 추가할 수 없다
  전제  같은 컬렉션에 활성 글 둘이 있고, 첫 번째 글에는 `en` 언어 작업본이 `"hello"` 슬러그로 있으며 두 번째 글에는 `ko` 원문 작업본만 있다
  행동  두 번째 글의 `id`, `locale: "en"`, `slug: "hello"`로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-5.1  `CONFLICT` 오류를 던진다
        ENT-LOC-5.2  두 번째 글에 `"en"` 행이 생기지 않는다

ENT-LOC-6  슬러그 형식이 맞지 않으면 언어를 추가할 수 없다
  전제  스키마에 두 언어(`ko`, `en`)가 있고 `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`, 공백이 포함된 `slug`로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-6.1  `BAD_REQUEST` 오류를 던진다
        ENT-LOC-6.2  `<collection>_data` 테이블에 `"en"` 행이 생기지 않는다

ENT-LOC-7  필드의 타입이나 제약에 어긋난 데이터로는 언어를 추가할 수 없다
  전제  스키마에 `number` 필드가 있는 컬렉션과 두 언어(`ko`, `en`)가 있고, `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`, `locale: "en"`, `number` 필드에 문자열을 담은 `data`로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-7.1  `BAD_REQUEST` 오류를 던진다
        ENT-LOC-7.2  `<collection>_data` 테이블에 `"en"` 행이 생기지 않는다

ENT-LOC-8  휴지통에 있는 글에는 언어를 추가할 수 없다
  전제  스키마에 두 언어(`ko`, `en`)가 있고 `ko` 원문 작업본만 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
  행동  휴지통 글의 `id`와 `locale: "en"`으로 `entries.addLocale`을 실행한다
  결과  ENT-LOC-8.1  `NOT_FOUND` 오류를 던진다
        ENT-LOC-8.2  휴지통 글에 `"en"` 행이 생기지 않는다
```

## 9. 언어 삭제 (`removeLocale`)

```
ENT-RLOC-1  비원문 언어를 즉시 삭제하면 발행본도 함께 지워지고 남은 언어 기준으로 미디어 사용처를 갱신한다
  전제  스키마에 `many: true`인 `media` 필드가 있는 컬렉션과 두 언어(`ko`, `en`), 활성 미디어 둘이 있고, 활성 글 하나의 `ko` 작업본·발행본은 첫 번째 미디어를, `en` 작업본·발행본은 첫 번째와 두 번째 미디어를 모두 참조하며 `media_uses`에 두 미디어 참조가 모두 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.removeLocale`을 실행한다
  결과  ENT-RLOC-1.1  반환값이 `{ id, locale: "en" }`이다
        ENT-RLOC-1.2  `<collection>_data` 테이블에서 `(entry_id, "en")`의 작업본과 발행본 행이 모두 사라진다
        ENT-RLOC-1.3  `<collection>` 행과 `<collection>_data` 테이블의 `(entry_id, "ko")` 작업본·발행본 행이 모두 그대로 남는다
        ENT-RLOC-1.4  `media_uses`에 첫 번째 미디어 참조는 남고 두 번째 미디어 참조는 사라진다

ENT-RLOC-2  아직 발행하지 않은 비원문 언어도 즉시 삭제할 수 있다
  전제  `ko` 원문과 미발행 `en` 작업본을 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.removeLocale`을 실행한다
  결과  ENT-RLOC-2.1  반환값이 `{ id, locale: "en" }`이다
        ENT-RLOC-2.2  `<collection>_data` 테이블에서 `(entry_id, "en", "draft")` 행이 사라지고 `(entry_id, "ko", "draft")` 행과 `<collection>` 행은 그대로 남는다

ENT-RLOC-3  원문 언어는 바로 삭제할 수 없다
  전제  `ko` 원문과 `en` 작업본을 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "ko"`로 `entries.removeLocale`을 실행한다
  결과  ENT-RLOC-3.1  `BAD_REQUEST` 오류를 던진다
        ENT-RLOC-3.2  `<collection>` 행과 `<collection>_data`의 `"ko"`·`"en"` 행이 모두 그대로 남아 있다

ENT-RLOC-4  글에 없는 언어는 삭제할 수 없다
  전제  `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.removeLocale`을 실행한다
  결과  ENT-RLOC-4.1  `NOT_FOUND` 오류를 던진다
        ENT-RLOC-4.2  `<collection>_data`의 `"ko"` 행이 원래 그대로이다

ENT-RLOC-5  휴지통에 있는 글의 언어는 삭제할 수 없다
  전제  `ko` 원문과 `en` 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
  행동  휴지통 글의 `id`와 `locale: "en"`으로 `entries.removeLocale`을 실행한다
  결과  ENT-RLOC-5.1  `NOT_FOUND` 오류를 던진다
        ENT-RLOC-5.2  휴지통 글의 `"en"` 행이 원래 그대로이다
```

## 10. 원문 언어 변경 (`setSourceLocale`)

```
ENT-SRC-1  기준 언어를 다른 언어로 바꾸면 원문 언어가 바뀌고 그 글의 모든 언어 번역 추적 기록이 초기화된다
  전제  `ko` 원문(발행됨), `en` 작업본(발행됨, `translation_seen` 기록 있음), `ja` 작업본(`translation_seen` 기록 있음)을 가진 활성 글과 `translation_seen` 기록이 있는 다른 활성 글이 하나씩 있다
  행동  첫 번째 글의 `id`와 `locale: "en"`으로 `entries.setSourceLocale`을 실행한다
  결과  ENT-SRC-1.1  반환값의 `id`, `collection`, `folder_id`, `slug`, `data`, `published_at`이 첫 번째 글의 `"en"` 작업본 행과 같고 `locale`과 `source_locale`이 모두 `"en"`이다
        ENT-SRC-1.2  `<collection>` 테이블에서 첫 번째 글의 `source_locale`이 `"en"`이다
        ENT-SRC-1.3  `<collection>_data` 테이블에서 첫 번째 글의 `"ko"`, `"en"`, `"ja"` 작업본 행 `translation_seen`이 모두 `{}`이다
        ENT-SRC-1.4  첫 번째 글의 `status = 'published'` 행들과 다른 활성 글의 `translation_seen`이 원래 그대로이다

ENT-SRC-2  이미 원문 언어인 언어를 다시 지정하면 번역 추적 기록을 유지한 채 그대로 돌려준다
  전제  `ko` 원문과 `translation_seen` 기록이 있는 `en` 작업본을 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "ko"`로 `entries.setSourceLocale`을 실행한다
  결과  ENT-SRC-2.1  반환값의 `locale`과 `source_locale`이 모두 `"ko"`이고 나머지 항목이 `"ko"` 작업본 행과 같다
        ENT-SRC-2.2  `<collection>_data` 테이블에서 `"en"` 작업본 행의 `translation_seen`이 원래 그대로이다

ENT-SRC-3  글에 없는 언어는 원문 언어로 지정할 수 없다
  전제  `ko` 원문 작업본만 가진 활성 글이 하나 있다
  행동  해당 글의 `id`와 `locale: "en"`으로 `entries.setSourceLocale`을 실행한다
  결과  ENT-SRC-3.1  `NOT_FOUND` 오류를 던진다
        ENT-SRC-3.2  `<collection>` 테이블에서 해당 글의 `source_locale`이 `"ko"` 그대로이다

ENT-SRC-4  휴지통에 있는 글은 원문 언어를 바꿀 수 없다
  전제  `ko` 원문과 `translation_seen` 기록이 있는 `en` 작업본을 가진 휴지통 글(`trashed_at` 설정)이 하나 있다
  행동  휴지통 글의 `id`와 `locale: "en"`으로 `entries.setSourceLocale`을 실행한다
  결과  ENT-SRC-4.1  `NOT_FOUND` 오류를 던진다
        ENT-SRC-4.2  휴지통 글의 `source_locale`과 `"en"` 작업본 행의 `translation_seen`이 원래 그대로이다
```
