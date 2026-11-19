# `resources/entries/` · `resources/media/uses.ts` (엔트리 확장) 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6절(`entries`, `entry_published`, `media_uses`), 7절(`entries` 리소스), 10절(역방향 관계 조회, `Schema` 8종 필드, `publish`·`unpublish`·`duplicate`·`replaceReferences`)의 인수 조건이다.

- 반환 모양: 작업본(`entries`)과 발행본(`entry_published`) 조회 모두 `{ id, collection, locale, source_entry_id, folder_id, slug, data, published_at }` 모양으로 돌려준다. `data`는 `{ fields, body? }` 구조이며, `published_at`은 `entry_published` 행이 있으면 그 시각, 없으면 `null`이다.
- `entries.create`: 필수 `collection`, `locale`, `slug`와 선택 `__preset_id`(UUID), `folder_id`, `data`로 작업본을 만든다(`source_entry_id: null`, `translation_seen: {}`). 생략한 `folder_id`는 `null`, `data`는 `{ fields: {} }`로 채우며 작업본에서는 `required` 필드를 비워 둘 수 있다.
- 쓰기 공통 검증(`create`, `update`, `duplicate`):
  - `slug`: 비어 있지 않은 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 형식만 허용하며 어긋나면 `BAD_REQUEST`, 같은 `(collection, locale)`의 다른 활성 글과 겹치면 `CONFLICT`로 거절한다.
  - `folder_id`: `null`(루트) 또는 같은 컬렉션 `scope`의 활성 폴더만 허용하며 아니면 `BAD_REQUEST`로 거절한다.
  - `data.fields`: 스키마에 정의된 키만 허용하고 8종 필드(`text`·`number`·`boolean`·`date`·`select`·`media`·`relation`·`conditional`)의 타입·제약에 어긋나거나, `media`가 없거나 휴지통 미디어를 가리키거나, `relation`이 `to` 컬렉션의 활성 원문 글이 아닌 대상을 가리키면 `BAD_REQUEST`로 거절한다.
  - `data.body`: `collection.body`가 `true`일 때만 허용하며 `validateDoc(body, ctx.config)` 실패 시 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다.
- `media_uses` 색인: `source_kind`를 `"entry"`로 하여 본문은 `"body"`, 최상위 `media` 필드는 `"fields.<필드키>"`, `conditional` 하위 `media` 필드는 `"fields.<조건필드키>.fields.<하위필드키>"` 경로에 대소문자를 무시하고 한 번씩 기록한다.
- `entries.get` · `entries.list`: `draft`를 생략하거나 `false`면 발행본(`entry_published`), `draft: true`면 작업본(`entries`)을 돌려주며 휴지통 글은 제외한다. `get`은 `id` 또는 `(collection, locale, slug)`로 조회해 없으면 `NOT_FOUND`로 거절하고, `list`는 `collection`, `locale`, `folder_id`(생략=전체, `null`=루트, UUID=직속), `relation`(`{ field, id }`), `draft`로 걸러 돌려준다.
- `entries.update`: 단건(`id`)은 `slug`, `folder_id`, `data`(전체 교체)를 바꾸되 생략한 항목과 `entry_published`는 유지하고 `data`를 바꿀 때만 `media_uses`를 교체한다. 다건(`ids`)은 `folder_id` 일괄 이동만 처리하며, 대상이 없거나 휴지통에 있으면 `NOT_FOUND`, 잘못된 폴더면 `BAD_REQUEST`로 전체 롤백한다.
- `entries.publish`: 활성 글의 작업본을 `entry_published`에 저장한다. `published_at`을 주면 그 시각으로, 생략하면 최초 발행은 현재 시각·재발행은 기존 시각을 유지한다. 필수 필드(선택한 `conditional` 하위 포함, `0`·`false`는 인정)가 비어 있으면 `BAD_REQUEST`, 같은 `(collection, locale)`에 같은 `slug`의 다른 발행본이 있으면 `CONFLICT`, 없거나 휴지통 글이면 `NOT_FOUND`로 거절한다.
- `entries.unpublish`: 활성 글의 `entry_published` 행을 지우고 `published_at: null`인 작업본을 돌려준다(이미 미발행이면 멱등 성공). 없거나 휴지통 글이면 `NOT_FOUND`로 거절한다.
- `entries.duplicate`: 활성 원문 글(`source_entry_id: null`)의 작업본으로 미발행 글(`translation_seen: {}`)을 만들고 쓰기 공통 검증과 `media_uses` 색인을 그대로 적용한다(선택 `__preset_id` 지원). `slug` 생략 시 겹치지 않는 첫 `<원본slug>-copy`, `-copy-2`…을 부여하며, 번역본 복제는 `BAD_REQUEST`, 없거나 휴지통 글은 `NOT_FOUND`로 거절한다.
- `entries.replaceReferences`: 같은 컬렉션의 서로 다른 원문 글 `from_id`(옛 글) → `into_id`(새 글)에 대해 모든 `relation` 필드(최상위·`conditional` 하위, 단일·`many: true`)의 참조를 바꾼다(`many: true`에 새 글이 이미 있으면 먼저 등장한 위치 하나만 유지). 작업본(휴지통 글 포함)과 발행본을 따로 고치며 발행본의 `slug`·`published_at`, `from_id`의 `trashed_at`, `media_uses`는 건드리지 않는다. `from_id`·`into_id`가 없거나 `into_id`가 휴지통이면 `NOT_FOUND`(`from_id`는 휴지통 허용), 같은 글·컬렉션 불일치·어느 한쪽이 번역본이면 `BAD_REQUEST`로 거절하고 `{ from_id, into_id, updated_ids }`를 돌려준다.

---

## 1. 생성 (`create`)

```
ENT-CRT-1  필수 정보만으로 작업본을 만들고 생략한 항목에 기본값을 채운다
  전제  스키마에 `required: true` 필드가 있는 컬렉션과 `locale`이 있고 `entries`와 `entry_published`가 비어 있다
  행동  해당 `collection`, `locale`, 유효한 `slug`만으로 `entries.create`를 실행한다
  결과  ENT-CRT-1.1  반환값의 `id`가 UUID 형식이고 `collection`, `locale`, `slug`가 입력과 같으며 `data`는 `{ fields: {} }`, `source_entry_id`, `folder_id`, `published_at`은 `null`이다
        ENT-CRT-1.2  `entries` 테이블에 반환값에서 `published_at`을 뺀 값과 같은 행이 `translation_seen`이 `{}`인 상태로 생긴다
        ENT-CRT-1.3  `entry_published` 테이블이 비어 있다

ENT-CRT-2  지정한 ID로 작업본을 만든다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  미리 정한 UUID `__preset_id`, 해당 `collection`, `locale`, 유효한 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-2.1  반환값의 `id`가 전달한 `__preset_id`이다
        ENT-CRT-2.2  `entries` 테이블에 해당 `id`의 행이 하나 생긴다

ENT-CRT-3  8종 필드, 본문, 폴더, 슬러그가 담긴 작업본을 저장한다
  전제  스키마에 `body: true`이고 8종 필드를 모두 가진 컬렉션, 해당 컬렉션 `scope`의 활성 폴더, 활성 미디어, `relation` 대상 컬렉션의 활성 원문 글이 있다
  행동  해당 `folder_id`, 유효한 `slug`, 8종 필드 값과 유효한 `body`로 `entries.create`를 실행한다
  결과  ENT-CRT-3.1  반환값의 `folder_id`, `slug`, `data`가 입력과 같다
        ENT-CRT-3.2  `entries` 테이블에 반환값에서 `published_at`을 뺀 값과 같은 행이 생긴다

ENT-CRT-4  본문·최상위 미디어·조건부 하위 미디어의 참조를 경로별로 한 번씩 기록한다
  전제  스키마에 `body: true`이고 최상위 `media`(`many: true`) 필드와 하위 `media` 필드가 있는 `conditional` 필드를 가진 컬렉션이 있고, 활성 미디어 세 개가 있으며 `media_uses`가 비어 있다
  행동  최상위 `media` 필드가 첫 번째 미디어를 소문자와 대문자로 중복 참조하고, `conditional` 하위 `media` 필드가 두 번째 미디어를 참조하며, `body`가 첫 번째 미디어와 세 번째 미디어를 참조하는 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-4.1  `media_uses`에 `source_kind`가 `"entry"`, `source_id`가 반환된 `id`인 행이 `"fields.<미디어필드>"`(첫 번째 미디어), `"fields.<조건필드>.fields.<하위미디어필드>"`(두 번째 미디어), `"body"`(첫 번째 미디어와 세 번째 미디어 각 하나)로 정확히 네 개 생긴다

ENT-CRT-5  스키마에 없는 컬렉션이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  스키마의 `collections`에 없는 `collection`과 유효한 `locale`, `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-5.2  `entries` 테이블이 비어 있다

ENT-CRT-6  스키마에 없는 언어 코드이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locales`가 있고 `entries`가 비어 있다
  행동  해당 `collection`, `locales`에 없는 `locale`, 유효한 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-6.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-6.2  `entries` 테이블이 비어 있다

ENT-CRT-7  다른 범위의 폴더에 넣으려 하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 있고 `"media"` `scope`의 폴더가 하나 있으며 `entries`가 비어 있다
  행동  `"media"` 폴더의 `id`를 `folder_id`로 주어 `entries.create`를 실행한다
  결과  ENT-CRT-7.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-7.2  `entries` 테이블이 비어 있다

ENT-CRT-8  스키마에 정의되지 않은 필드가 들어 있으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 있고 `entries`가 비어 있다
  행동  컬렉션의 `fields`에 없는 키가 포함된 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-8.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-8.2  `entries` 테이블이 비어 있다

ENT-CRT-9  필드의 타입이나 제약에 어긋난 값이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `number` 필드와 `max`가 설정된 `text` 필드가 있는 컬렉션이 있고 `entries`가 비어 있다
  행동  `number` 필드에 문자열을, `text` 필드에 `max`를 넘는 길이의 문자열을 담아 `entries.create`를 실행한다
  결과  ENT-CRT-9.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-9.2  `entries` 테이블이 비어 있다

ENT-CRT-10  조건부 필드에서 선택한 분기에 없는 하위 필드가 들어 있으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 서로 다른 하위 필드를 가진 두 분기의 `conditional` 필드가 있는 컬렉션이 있고 `entries`가 비어 있다
  행동  첫 번째 분기를 `option`으로 선택하면서 두 번째 분기의 하위 필드를 `fields`에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-10.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-10.2  `entries` 테이블이 비어 있다

ENT-CRT-11  본문을 쓰지 않는 컬렉션에 본문을 주면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `body`가 설정되지 않은 컬렉션이 있고 `entries`가 비어 있다
  행동  유효한 `body`를 포함한 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-11.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-11.2  `entries` 테이블이 비어 있다

ENT-CRT-12  본문 검증에 실패하면 문제 목록을 담아 `BAD_REQUEST`로 거절한다
  전제  스키마에 `body: true`인 컬렉션이 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `entries`가 비어 있다
  행동  그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `body`로 `entries.create`를 실행한다
  결과  ENT-CRT-12.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-12.2  오류의 `details`가 같은 `body`와 `config`에 대한 `validateDoc`의 반환값과 같다
        ENT-CRT-12.3  `entries` 테이블이 비어 있다

ENT-CRT-13  미디어 필드가 휴지통에 있는 미디어를 참조하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `media` 필드가 있는 컬렉션이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있으며 `entries`와 `media_uses`가 비어 있다
  행동  해당 미디어의 `id`를 `media` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-13.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-13.2  `entries` 테이블이 비어 있다
        ENT-CRT-13.3  `media_uses` 테이블이 비어 있다

ENT-CRT-14  관계 필드가 지정된 대상 컬렉션 밖의 글을 참조하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 대상 컬렉션으로 지정된 컬렉션과 다른 컬렉션이 있고, 다른 컬렉션에 활성 원문 글이 하나 있다
  행동  다른 컬렉션 글의 `id`를 `relation` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-CRT-14.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-14.2  `entries` 테이블의 행은 원래 하나 그대로이다

ENT-CRT-15  관계 필드가 번역본을 참조하면 `BAD_REQUEST`로 거절한다
  전제  `to` 컬렉션에 원문 글과 그 원문 글을 가리키는 번역본(`source_entry_id` 설정)이 하나씩 있다
  행동  번역본의 `id`를 `relation` 필드에 담은 `data`로 `entries.create`를 실행한다
  결과  ENT-CRT-15.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-15.2  `entries` 테이블의 행은 원래 두 개 그대로이다

ENT-CRT-16  슬러그 형식이 맞지 않으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  공백이 포함된 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-16.1  `BAD_REQUEST` 오류를 던진다
        ENT-CRT-16.2  `entries` 테이블이 비어 있다

ENT-CRT-17  같은 컬렉션과 언어에 같은 슬러그의 활성 글이 이미 있으면 `CONFLICT`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고, 해당 `collection`과 `locale`에 활성 글이 하나 있다
  행동  같은 `collection`, `locale`, 같은 `slug`로 `entries.create`를 실행한다
  결과  ENT-CRT-17.1  `CONFLICT` 오류를 던진다
        ENT-CRT-17.2  `entries` 테이블의 행은 원래 하나 그대로이다
```

## 2. 조회 (`get` · `list`)

```
ENT-READ-1  기본 단건 조회는 발행된 글의 발행본을 돌려준다
  전제  작업본(`entries`)과 다른 `slug`·`data`로 `entry_published` 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-READ-1.1  반환값의 `id`, `collection`, `locale`, `source_entry_id`, `folder_id`가 `entries` 행과 같다
        ENT-READ-1.2  반환값의 `slug`, `data`, `published_at`이 `entry_published` 행과 같다

ENT-READ-2  컬렉션·언어·발행 슬러그로 발행본을 단건 조회한다
  전제  작업본과 다른 `slug`로 `entry_published` 행이 있는 활성 글이 두 개 있다
  행동  첫 번째 글의 `collection`, `locale`, 발행된 `slug`로 `entries.get`을 실행한다
  결과  ENT-READ-2.1  반환값의 `id`, `slug`, `data`, `published_at`이 첫 번째 글의 발행본과 같다

ENT-READ-3  초안 모드로 단건 조회하면 발행본이 있더라도 작업본을 돌려준다
  전제  작업본과 다른 `slug`·`data`로 `entry_published` 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`와 `draft: true`로 `entries.get`을 실행한다
  결과  ENT-READ-3.1  반환값의 `slug`와 `data`가 `entries` 작업본과 같다
        ENT-READ-3.2  반환값의 `published_at`이 `entry_published` 행의 `published_at`과 같다

ENT-READ-4  미발행 글을 기본 모드로 단건 조회하면 `NOT_FOUND`로 거절한다
  전제  `entry_published` 행이 없는 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-READ-4.1  `NOT_FOUND` 오류를 던진다

ENT-READ-5  휴지통에 있는 글은 초안 모드로도 `NOT_FOUND`로 조회를 거절한다
  전제  `entry_published` 행이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`와 `draft: true`로 `entries.get`을 실행한다
  결과  ENT-READ-5.1  `NOT_FOUND` 오류를 던진다

ENT-READ-6  조건 없이 목록을 조회하면 활성 발행본만 돌려준다
  전제  작업본과 다른 `data`로 `entry_published` 행이 있는 활성 글, 미발행 글, `entry_published` 행이 있지만 휴지통에 들어가 있는(`trashed_at` 설정) 글이 각각 하나씩 있다
  행동  인자 없이 `entries.list`를 실행한다
  결과  ENT-READ-6.1  `trashed_at`이 `null`이고 발행된 글 하나만 돌려준다
        ENT-READ-6.2  반환된 항목의 `slug`, `data`, `published_at`이 `entry_published` 행과 같다

ENT-READ-7  초안 모드로 목록을 조회하면 모든 활성 글의 작업본을 돌려준다
  전제  작업본과 다른 `data`로 `entry_published` 행이 있는 활성 글, 미발행 글, 휴지통에 들어가 있는(`trashed_at` 설정) 글이 각각 하나씩 있다
  행동  `draft: true`로 `entries.list`를 실행한다
  결과  ENT-READ-7.1  `trashed_at`이 `null`인 글 두 개만 작업본 `data`로 돌려준다
        ENT-READ-7.2  발행된 글의 `published_at`이 `entry_published`의 시각이다
        ENT-READ-7.3  미발행 글의 `published_at`이 `null`이다

ENT-READ-8  컬렉션·언어·폴더를 지정하면 모두 일치하는 해당 폴더 직속 글만 돌려준다
  전제  대상 컬렉션과 `locale`에 속한 대상 폴더 직속 글, 그 하위 폴더의 글, `folder_id`가 `null`인 글, 다른 `locale`의 글, 다른 컬렉션의 글이 각각 하나씩 있다
  행동  대상 `collection`, `locale`, 대상 폴더의 `id`인 `folder_id`, `draft: true`로 `entries.list`를 실행한다
  결과  ENT-READ-8.1  조건에 모두 일치하는 대상 폴더 직속 글 하나만 돌려준다

ENT-READ-9  폴더를 비워 목록을 조회하면 루트 글만 돌려준다
  전제  `folder_id`가 `null`인 글 하나와 폴더에 속한 글 하나가 있다
  행동  `folder_id: null`과 `draft: true`로 `entries.list`를 실행한다
  결과  ENT-READ-9.1  `folder_id`가 `null`인 글 하나만 돌려준다

ENT-READ-10  역방향 관계 조건으로 목록을 조회하면 해당 대상을 참조하는 글만 돌려준다
  전제  같은 필드 키로 단일 `relation` 필드를 가진 첫 번째 컬렉션과 `many: true` `relation` 필드를 가진 두 번째 컬렉션이 있다. 발행본에서 대상 원문 글을 참조하는 글이 각 컬렉션에 하나씩 있고, 작업본에서만 대상 원문 글을 참조하고 발행본에서는 참조하지 않는 글이 하나 더 있다
  행동  해당 필드 키와 대상 원문 글 `id`를 `relation` 조건으로 주어 `entries.list`를 실행한다
  결과  ENT-READ-10.1  발행본에서 대상 원문 글을 참조하는 글 두 개만 돌려준다
```

## 3. 수정 (`update`)

```
ENT-UPD-1  단건 수정에서 데이터 없이 슬러그와 폴더만 주면 지정한 항목만 바꾸고 데이터·미디어 사용처·발행본은 유지한다
  전제  `folder_id`가 `null`이고 미디어를 참조해 `media_uses` 행과 `entry_published` 행이 있는 활성 글 하나와, 해당 컬렉션 `scope`의 활성 폴더가 있다
  행동  해당 글의 `id`, 새 `slug`, 해당 폴더의 `id`인 `folder_id`만으로 `entries.update`를 실행한다
  결과  ENT-UPD-1.1  반환값의 `slug`와 `folder_id`가 새 값이고 `data`와 `published_at`이 원래 그대로이다
        ENT-UPD-1.2  `entries` 테이블에서 해당 행의 `slug`와 `folder_id`가 새 값이고 `data`는 원래 그대로이다
        ENT-UPD-1.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다
        ENT-UPD-1.4  `entry_published` 테이블에서 해당 행의 `slug`와 `data`가 원래 그대로이다

ENT-UPD-2  단건 수정에서 데이터를 바꾸면 작업본 데이터를 통째로 교체하고 해당 글의 미디어 사용처만 갱신한다
  전제  첫 번째 미디어를 참조해 각각 `media_uses` 행이 있는 대상 글과 다른 글, 대상 글과 같은 `source_id`를 가진 `template`의 `media_uses` 행, 활성 상태인 두 번째 미디어가 있다
  행동  대상 글의 `id`와 두 번째 미디어만 참조하는 새 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-2.1  반환값의 `data`가 새 `data`이고 `slug`와 `folder_id`가 원래 그대로이다
        ENT-UPD-2.2  `entries` 테이블에서 대상 글의 `data`가 새 `data`이다
        ENT-UPD-2.3  `media_uses`에서 대상 글(`source_kind`가 `"entry"`)의 참조는 두 번째 미디어 하나뿐이다
        ENT-UPD-2.4  `media_uses`에서 다른 글의 기존 참조는 그대로 남아 있다
        ENT-UPD-2.5  `media_uses`에서 `template`의 기존 참조는 그대로 남아 있다

ENT-UPD-3  단건 수정에서 폴더를 비우면 글을 루트로 이동한다
  전제  폴더에 속한 글이 하나 있다
  행동  해당 글의 `id`와 `folder_id: null`로 `entries.update`를 실행한다
  결과  ENT-UPD-3.1  반환값의 `folder_id`가 `null`이다
        ENT-UPD-3.2  `entries` 테이블에서 해당 행의 `folder_id`가 `null`이다

ENT-UPD-4  단건 수정에서 없는 미디어를 참조하면 `BAD_REQUEST`로 거절하고 기존 상태를 유지한다
  전제  미디어를 참조해 `media_uses` 행이 있는 글이 하나 있다
  행동  해당 글의 `id`와 존재하지 않는 UUID를 `media` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-4.2  `entries` 테이블에서 해당 행의 `data`가 원래 그대로이다
        ENT-UPD-4.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다

ENT-UPD-5  단건 수정에서 관계 필드가 휴지통 글을 참조하면 `BAD_REQUEST`로 거절한다
  전제  `relation` 필드를 가진 글 하나와 `to` 컬렉션에서 휴지통에 들어가 있는(`trashed_at` 설정) 원문 글 하나가 있다
  행동  해당 글의 `id`와 휴지통 원문 글의 `id`를 `relation` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-UPD-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-5.2  `entries` 테이블에서 해당 행의 `data`가 원래 그대로이다

ENT-UPD-6  휴지통에 있는 글은 `NOT_FOUND`로 단건 수정을 거절한다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`와 새 `slug`로 `entries.update`를 실행한다
  결과  ENT-UPD-6.1  `NOT_FOUND` 오류를 던진다
        ENT-UPD-6.2  `entries` 테이블에서 해당 행의 `slug`가 원래 그대로이다

ENT-UPD-7  같은 컬렉션과 언어의 다른 활성 글과 슬러그가 겹치면 `CONFLICT`로 거절한다
  전제  같은 `collection`과 `locale`에 활성 글이 두 개 있다
  행동  두 번째 글의 `id`와 첫 번째 글의 `slug`로 `entries.update`를 실행한다
  결과  ENT-UPD-7.1  `CONFLICT` 오류를 던진다
        ENT-UPD-7.2  `entries` 테이블에서 두 번째 글의 `slug`가 원래 그대로이다

ENT-UPD-8  다건 수정은 지정한 글들을 한 폴더로 일괄 이동한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`의 활성 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-8.1  반환 목록이 요청한 두 글의 `{ id, folder_id: 새 folder_id }`로 이루어진다
        ENT-UPD-8.2  `entries` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

ENT-UPD-9  다건 수정 대상 중 하나라도 휴지통에 있으면 `NOT_FOUND`로 전체 롤백한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 활성 글 하나, 휴지통에 들어가 있는(`trashed_at` 설정) 글 하나, 해당 컬렉션 `scope`의 활성 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-9.1  `NOT_FOUND` 오류를 던진다
        ENT-UPD-9.2  `entries` 테이블에서 활성 글의 `folder_id`가 `null` 그대로이다

ENT-UPD-10  다건 수정에서 대상 폴더가 휴지통에 있으면 `BAD_REQUEST`로 전체 롤백한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`에서 휴지통에 들어가 있는(`trashed_at` 설정) 폴더가 하나 있다
  행동  두 글의 `ids`와 휴지통 폴더의 `id`인 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-UPD-10.1  `BAD_REQUEST` 오류를 던진다
        ENT-UPD-10.2  `entries` 테이블에서 두 글의 `folder_id`가 모두 `null` 그대로이다
```


## 4. 발행 (`publish`)

```
ENT-PUB-1  작업본으로 발행본을 만든다
  전제  필수(`required: true`)인 `text`, `number`(값 `0`), `boolean`(값 `false`) 필드가 채워져 있고 미발행 상태인 활성 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.publish`를 실행한다
  결과  ENT-PUB-1.1  반환값의 `slug`와 `data`가 작업본과 같고 `published_at`이 실행 전후 시각 사이이다
        ENT-PUB-1.2  `entry_published` 테이블에 `entry_id`, `slug`, `data`, `published_at`이 반환값과 같은 행이 생긴다

ENT-PUB-2  이미 발행된 글을 다시 발행하면 기존 발행 시각을 유지한다
  전제  발행된 글의 작업본 `slug`와 `data`를 다른 값으로 바꾼 상태이다
  행동  해당 글의 `id`만으로 `entries.publish`를 실행한다
  결과  ENT-PUB-2.1  반환값의 `slug`와 `data`가 새 작업본과 같고 `published_at`이 기존 발행 시각과 같다
        ENT-PUB-2.2  `entry_published` 테이블에서 해당 행의 `slug`와 `data`가 갱신되고 `published_at`은 원래 그대로이다

ENT-PUB-3  발행 시각을 지정해 발행하면 그 시각으로 저장한다
  전제  이미 발행된 활성 글이 하나 있다
  행동  해당 글의 `id`와 기존과 다른 타임존 포함 ISO 8601 `published_at`으로 `entries.publish`를 실행한다
  결과  ENT-PUB-3.1  반환값의 `published_at`이 전달한 시각과 같다
        ENT-PUB-3.2  `entry_published` 테이블에서 해당 행의 `published_at`이 전달한 시각과 같다

ENT-PUB-4  필수 필드가 비어 있으면 `BAD_REQUEST`로 발행을 거절한다
  전제  필수(`required: true`)인 `text` 필드가 있는 컬렉션에, 그 필드 값이 빈 문자열(`""`)인 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-4.2  `entry_published` 테이블이 비어 있다

ENT-PUB-5  선택한 조건부 분기의 필수 하위 필드가 비어 있으면 `BAD_REQUEST`로 발행을 거절한다
  전제  두 분기를 가진 `conditional` 필드의 첫 번째 분기에 필수(`required: true`) 하위 필드가 있고, 첫 번째 분기를 선택했지만 그 하위 필드를 생략한 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-PUB-5.2  `entry_published` 테이블이 비어 있다

ENT-PUB-6  같은 슬러그로 이미 발행된 다른 글이 있으면 `CONFLICT`로 발행을 거절한다
  전제  같은 `collection`과 `locale`에, 첫 번째 글은 옛 `slug`로 발행된 뒤 작업본 `slug`를 바꿨고 두 번째 미발행 글의 작업본 `slug`가 그 옛 `slug`와 같다
  행동  두 번째 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-6.1  `CONFLICT` 오류를 던진다
        ENT-PUB-6.2  `entry_published` 테이블에 첫 번째 글의 행만 그대로 남아 있다

ENT-PUB-7  휴지통에 있는 글은 `NOT_FOUND`로 발행을 거절한다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 미발행 글이 하나 있다
  행동  해당 글의 `id`로 `entries.publish`를 실행한다
  결과  ENT-PUB-7.1  `NOT_FOUND` 오류를 던진다
        ENT-PUB-7.2  `entry_published` 테이블이 비어 있다
```

## 5. 발행 취소 (`unpublish`)

```
ENT-UNPUB-1  발행을 취소하면 발행본만 지우고 작업본과 미디어 사용처는 남긴다
  전제  미디어를 참조해 `media_uses` 행과 `entry_published` 행이 있는 활성 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-1.1  반환값의 `slug`와 `data`가 작업본과 같고 `published_at`이 `null`이다
        ENT-UNPUB-1.2  `entry_published` 테이블이 비어 있다
        ENT-UNPUB-1.3  `entries` 테이블의 해당 글 행이 원래 그대로이다
        ENT-UNPUB-1.4  `media_uses`의 해당 글 참조가 원래 그대로이다

ENT-UNPUB-2  이미 미발행 상태인 글도 오류 없이 발행 취소된다
  전제  `entry_published` 행이 없는 활성 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-2.1  반환값의 `id`, `slug`, `data`가 작업본과 같고 `published_at`이 `null`이다

ENT-UNPUB-3  휴지통에 있는 글은 `NOT_FOUND`로 발행 취소를 거절한다
  전제  `entry_published` 행이 있고 휴지통에 들어가 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`로 `entries.unpublish`를 실행한다
  결과  ENT-UNPUB-3.1  `NOT_FOUND` 오류를 던진다
        ENT-UNPUB-3.2  `entry_published` 테이블의 해당 행이 원래 그대로이다
```

## 6. 복제 (`duplicate`)

```
ENT-DUP-1  원문 글의 작업본과 미디어 사용처를 새 슬러그의 미발행 글로 복제한다
  전제  폴더에 속하고 미디어를 참조하며 발행본과 번역본이 있는 활성 원문 글이 하나 있다
  행동  원문 글의 `id`와 새 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-1.1  반환값의 `id`가 원본과 다른 UUID이고 `collection`, `locale`, `folder_id`, `data`는 원본 작업본과 같으며 `slug`는 새 `slug`, `source_entry_id`와 `published_at`은 `null`이다
        ENT-DUP-1.2  `entries` 테이블에 새 행이 `translation_seen`이 `{}`인 상태로 하나만 추가된다
        ENT-DUP-1.3  원본 글과 번역본 행은 원래 그대로이다
        ENT-DUP-1.4  `entry_published` 테이블에 새 글의 행은 생기지 않는다
        ENT-DUP-1.5  `media_uses`에 새 글의 참조가 원본과 같은 미디어·경로로 생긴다

ENT-DUP-2  슬러그를 생략하고 복제하면 겹치지 않는 `-copy` 슬러그를 붙인다
  전제  같은 `collection`과 `locale`에 `slug`가 `"hello"`인 활성 원문 글과 `"hello-copy"`인 활성 글이 하나씩 있다
  행동  `"hello"` 글의 `id`만으로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-2.1  반환값의 `slug`가 `"hello-copy-2"`이다
        ENT-DUP-2.2  `entries` 테이블에 `slug`가 `"hello-copy-2"`인 새 행이 생긴다

ENT-DUP-3  지정한 ID로 복제한다
  전제  활성 원문 글이 하나 있다
  행동  해당 글의 `id`와 미리 정한 UUID `__preset_id`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-3.1  반환값의 `id`가 전달한 `__preset_id`이다
        ENT-DUP-3.2  `entries` 테이블에 해당 `id`의 행이 생긴다

ENT-DUP-4  슬러그 형식이 맞지 않으면 `BAD_REQUEST`로 복제를 거절한다
  전제  활성 원문 글이 하나 있다
  행동  해당 글의 `id`와 공백이 포함된 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-4.1  `BAD_REQUEST` 오류를 던진다
        ENT-DUP-4.2  `entries` 테이블의 행은 원래 하나 그대로이다

ENT-DUP-5  이미 쓰이고 있는 슬러그로는 `CONFLICT`로 복제를 거절한다
  전제  활성 원문 글이 하나 있다
  행동  해당 글의 `id`와 그 글과 같은 `slug`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-5.1  `CONFLICT` 오류를 던진다
        ENT-DUP-5.2  `entries` 테이블의 행은 원래 하나 그대로이다

ENT-DUP-6  번역본은 `BAD_REQUEST`로 복제를 거절한다
  전제  원문 글 하나와 그 원문 글을 가리키는 번역본 하나가 있다
  행동  번역본의 `id`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-6.1  `BAD_REQUEST` 오류를 던진다
        ENT-DUP-6.2  `entries` 테이블의 행은 원래 두 개 그대로이다

ENT-DUP-7  휴지통에 있는 글은 `NOT_FOUND`로 복제를 거절한다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 원문 글이 하나 있다
  행동  해당 글의 `id`로 `entries.duplicate`를 실행한다
  결과  ENT-DUP-7.1  `NOT_FOUND` 오류를 던진다
        ENT-DUP-7.2  `entries` 테이블의 행은 원래 하나 그대로이다
```

## 7. 참조 교체 (`replaceReferences`)

```
ENT-REF-1  다른 글들이 가리키던 대상을 작업본과 발행본 모두 새 대상으로 바꾸고, 옛 글은 그대로 둔다
  전제  같은 컬렉션에 활성 원문 글 둘(옛 글, 새 글)이 있다. 다른 컬렉션의 발행된 글 하나가 작업본과 발행본 모두에서 옛 글을 가리키고 있고, 작업본과 발행본의 다른 필드는 서로 다르다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-1.1  반환값의 `from_id`가 옛 글, `into_id`가 새 글이고 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-1.2  그 글의 작업본(`entries.data`)과 발행본(`entry_published.data`) 모두 참조가 새 글로 바뀐다
        ENT-REF-1.3  발행본의 나머지 필드, `slug`, `published_at`은 작업본으로 덮이지 않고 원래 그대로이다
        ENT-REF-1.4  옛 글의 `trashed_at`은 `null` 그대로이다

ENT-REF-2  여러 개를 고르는 관계 필드에 바꿀 대상이 이미 들어 있으면 먼저 등장한 위치 하나만 남긴다
  전제  같은 컬렉션에 활성 원문 글 셋(옛 글, 다른 글, 새 글)이 있고, 다른 컬렉션의 글 하나가 `many: true` 관계 필드에 `[옛 글, 다른 글, 새 글]`을 가지고 있다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-2.1  반환값의 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-2.2  그 글의 관계 필드가 `[새 글, 다른 글]`로 바뀐다

ENT-REF-3  조건부 필드 안에 들어 있는 관계 참조도 함께 바꾼다
  전제  같은 컬렉션에 활성 원문 글 둘(옛 글, 새 글)이 있고, 다른 컬렉션의 글 하나가 `conditional` 필드 안 관계 필드로 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-3.1  반환값의 `updated_ids`가 그 글의 `id` 하나뿐이다
        ENT-REF-3.2  그 글의 `conditional` 안 관계 필드가 새 글로 바뀐다

ENT-REF-4  휴지통에 있는 다른 글이 가리키던 참조도 함께 바꾼다
  전제  같은 컬렉션에 활성 원문 글 둘(옛 글, 새 글)이 있고, 휴지통에 들어가 있는(`trashed_at` 설정) 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-4.1  반환값의 `updated_ids`가 그 휴지통 글의 `id` 하나뿐이다
        ENT-REF-4.2  그 휴지통 글의 참조가 새 글로 바뀐다

ENT-REF-5  옛 글이 이미 휴지통에 있어도 다른 글의 참조를 새 글로 바꿀 수 있다
  전제  같은 컬렉션에 휴지통에 들어가 있는 원문 글(옛 글)과 활성 원문 글(새 글)이 있고, 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-5.1  반환값의 `updated_ids`가 참조하던 글의 `id` 하나뿐이다
        ENT-REF-5.2  참조하던 글의 참조가 새 글로 바뀐다

ENT-REF-6  자기 자신으로 참조를 바꾸려 하면 `BAD_REQUEST`로 거절한다
  전제  활성 원문 글이 하나 있다
  행동  같은 `id`를 `from_id`와 `into_id` 모두에 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-6.1  `BAD_REQUEST` 오류를 던진다

ENT-REF-7  서로 다른 컬렉션의 글끼리 참조를 바꾸려 하면 `BAD_REQUEST`로 거절한다
  전제  서로 다른 두 컬렉션에 활성 원문 글 둘(옛 글, 새 글)이 하나씩 있다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-7.1  `BAD_REQUEST` 오류를 던진다

ENT-REF-8  번역본을 대상으로 참조를 바꾸려 하면 `BAD_REQUEST`로 거절한다
  전제  같은 컬렉션에 원문 글 둘과 첫 번째 원문 글의 번역본 하나가 있다
  행동  번역본을 `from_id`, 두 번째 원문 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-8.1  `BAD_REQUEST` 오류를 던진다

ENT-REF-9  바꿀 새 글이 휴지통에 있으면 `NOT_FOUND`로 거절하고 아무 참조도 바꾸지 않는다
  전제  같은 컬렉션에 활성 원문 글(옛 글)과 휴지통에 들어가 있는 원문 글(새 글)이 있고, 다른 컬렉션의 글 하나가 옛 글을 가리킨다
  행동  옛 글을 `from_id`, 새 글을 `into_id`로 넣어 `entries.replaceReferences`를 실행한다
  결과  ENT-REF-9.1  `NOT_FOUND` 오류를 던진다
        ENT-REF-9.2  참조하던 글의 `data`가 원래 그대로이다
```
