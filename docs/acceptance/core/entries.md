# `resources/entries/` · `resources/media/uses.ts` (엔트리 확장) 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6절(`entries`, `entry_published`, `media_uses`), 7절(`entries` 리소스), 10절(역방향 관계 조회 및 `Schema` 8종 필드)의 인수 조건이다. (`publish`, `unpublish`, `duplicate`, `merge`는 묶음 2에서 다룬다.)

- 작업본(`entries`)과 발행본(`entry_published`) 조회 모두 `{ id, collection, locale, source_entry_id, folder_id, slug, data, published_at }` 같은 모양으로 돌려준다. `data`는 `{ fields, body? }` 구조이며, `published_at`은 `entry_published` 행이 있으면 그 시각, 없으면 `null`이다.
- `entries.create`: 필수 `collection`, `locale`, `slug`와 선택 `__preset_id`(UUID), `folder_id`, `data`로 작업본을 만든다(`source_entry_id`는 `null`, `translation_seen`은 `{}`). 생략한 `folder_id`는 `null`, `data`는 `{ fields: {} }`로 저장하며(`data.fields` 생략 시도 `{}`), 작업본에서는 `required` 필드를 비워 둘 수 있다.
- 쓰기 공통 검증(`create`, `update`): `slug`는 비어 있지 않은 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 형식만 허용하며 어긋나면 `BAD_REQUEST`, 같은 `(collection, locale)`에서 `trashed_at`이 `null`인 다른 글과 겹치면 `CONFLICT`로 거절한다. `folder_id`는 `null`(루트) 또는 해당 글 컬렉션 `scope`에서 `trashed_at`이 `null`인 폴더만 허용하며 아니면 `BAD_REQUEST`로 거절한다. 스키마에 정의되지 않은 필드 키와 8종 필드 값의 타입·제약 위반(`text`: `max` 이하 문자열, `number`: 숫자, `boolean`: 불리언, `date`: 타임존이 포함된 ISO 8601 날짜·시각 문자열, `select`: `options` 안의 문자열 또는 `many: true` 배열, `media`: `trashed_at`이 `null`인 미디어 UUID 또는 `many: true` 배열, `relation`: `to` 컬렉션에서 `trashed_at`이 `null`이고 `source_entry_id`가 `null`인 원문 글 UUID 또는 `many: true` 배열, `conditional`: `{ option, fields }`로 정의된 분기와 그 하위 필드만 허용)은 `BAD_REQUEST`로 거절한다. `data.body`는 `collection.body`가 `true`일 때만 허용하며 `validateDoc(body, ctx.config)` 실패 시 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다.
- `media_uses` 색인: `source_kind`를 `"entry"`로 하여 본문은 `"body"`, 최상위 `media` 필드는 `"fields.<필드키>"`, `conditional` 하위 `media` 필드는 `"fields.<조건필드키>.fields.<하위필드키>"` 경로에 대소문자를 무시하고 한 번씩 기록한다.
- `entries.get` · `entries.list`: `draft`를 생략하거나 `false`로 주면 `trashed_at`이 `null`이고 `entry_published` 행이 있는 글의 발행본(`entry_published`의 `slug`, `data`, `published_at`)을, `draft: true`로 주면 `trashed_at`이 `null`인 글의 작업본(`entries`의 `slug`, `data`)을 돌려준다. `get`은 `id` 또는 `(collection, locale, slug)`로 조회하며(`draft: false`는 `entry_published.slug`, `draft: true`는 `entries.slug`) 조건에 맞는 글이 없으면 `NOT_FOUND`로 거절한다. `list`는 `collection`, `locale`, `folder_id`(생략=전체, `null`=루트 직속, UUID=해당 폴더 직속), `relation` 역방향 조회(`{ field, id }`), `draft` 조건을 받으며 조건에 맞는 글이 없으면 빈 배열을 돌려준다.
- `entries.update`: 단건(`id`)은 `slug`, `folder_id`, `data`(전체 교체)를 바꾸되 생략한 항목과 `entry_published`는 유지하고, `data`를 바꿀 때만 해당 글의 `media_uses`를 교체한다. 대상이 없거나 `trashed_at`이 설정되어 있으면 `NOT_FOUND`로 거절한다. 다건(`ids`)은 `folder_id`(`null` 포함)로 일괄 이동하며, 대상 중 하나라도 없거나 `trashed_at`이 설정되어 있으면 `NOT_FOUND`, `folder_id`가 대상 글 컬렉션 `scope`의 `trashed_at`이 `null`인 폴더가 아니면 `BAD_REQUEST`로 전체 롤백한다.

---

## 1. 생성 (`create`)

```
ENT-1  `entries.create`는 `collection`, `locale`, `slug`만으로 작업본을 만들고 생략한 항목에 기본값을 채운다
  전제  스키마에 `required: true` 필드가 있는 컬렉션과 `locale`이 있고 `entries`와 `entry_published`가 비어 있다
  행동  해당 `collection`, `locale`, 유효한 `slug`만으로 `entries.create`를 실행한다
  결과  ENT-1.1  반환값의 `id`가 UUID 형식이고 `collection`, `locale`, `slug`가 입력과 같으며 `data`는 `{ fields: {} }`, `source_entry_id`, `folder_id`, `published_at`은 `null`이다
        ENT-1.2  `entries` 테이블에 반환값에서 `published_at`을 뺀 값과 같은 행이 `translation_seen`이 `{}`인 상태로 생긴다
        ENT-1.3  `entry_published` 테이블이 비어 있다

ENT-2  `entries.create`에 `__preset_id`를 주면 지정한 `id`로 작업본을 만든다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  미리 정한 UUID `__preset_id`, 해당 `collection`, `locale`, 유효한 `slug`로 `entries.create`를 실행한다
  결과  ENT-2.1  반환값의 `id`가 전달한 `__preset_id`이다
        ENT-2.2  `entries` 테이블에 해당 `id`의 행이 하나 생긴다

ENT-3  `entries.create`는 8종 필드, `body`, `folder_id`, `slug`가 담긴 작업본을 저장한다
  전제  스키마에 `body: true`이고 8종 필드를 모두 가진 컬렉션, 해당 컬렉션 `scope`의 `trashed_at`이 `null`인 폴더, `trashed_at`이 `null`인 미디어, `relation` 대상 컬렉션의 `trashed_at`이 `null`인 원문 글이 있다
  행동  해당 `folder_id`, 유효한 `slug`, 8종 필드 값과 유효한 `body`로 `entries.create`를 실행한다
  결과  ENT-3.1  반환값의 `folder_id`, `slug`, `data`가 입력과 같다
        ENT-3.2  `entries` 테이블에 반환값에서 `published_at`을 뺀 값과 같은 행이 생긴다

ENT-4  `entries.create`는 `body`, 최상위 `media` 필드, `conditional` 하위 `media` 필드의 참조를 `media_uses`에 대소문자를 무시하고 경로별로 한 번씩 기록한다
  전제  스키마에 `body: true`이고 최상위 `media`(`many: true`) 필드와 하위 `media` 필드가 있는 `conditional` 필드를 가진 컬렉션이 있고, `trashed_at`이 `null`인 미디어 세 개가 있으며 `media_uses`가 비어 있다
  행동  최상위 `media` 필드가 첫 번째 미디어를 소문자와 대문자로 중복 참조하고, `conditional` 하위 `media` 필드가 두 번째 미디어를 참조하며, `body`가 첫 번째 미디어와 세 번째 미디어를 참조하는 `data`로 `entries.create`를 실행한다
  결과  ENT-4.1  `media_uses`에 `source_kind`가 `"entry"`, `source_id`가 반환된 `id`인 행이 `"fields.<미디어필드>"`(첫 번째 미디어), `"fields.<조건필드>.fields.<하위미디어필드>"`(두 번째 미디어), `"body"`(첫 번째 미디어와 세 번째 미디어 각 하나)로 정확히 네 개 생긴다

ENT-5  `entries.create`는 스키마에 없는 `collection`이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  스키마의 `collections`에 없는 `collection`과 유효한 `locale`, `slug`로 `entries.create`를 실행한다
  결과  ENT-5.1  `BAD_REQUEST` 오류를 던진다
        ENT-5.2  `entries` 테이블이 비어 있다

ENT-6  `entries.create`는 스키마의 `locales`에 없는 `locale`이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locales`가 있고 `entries`가 비어 있다
  행동  해당 `collection`, `locales`에 없는 `locale`, 유효한 `slug`로 `entries.create`를 실행한다
  결과  ENT-6.1  `BAD_REQUEST` 오류를 던진다
        ENT-6.2  `entries` 테이블이 비어 있다

ENT-7  `entries.create`는 다른 `scope`의 폴더를 `folder_id`로 주면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 있고 `"media"` `scope`의 폴더가 하나 있으며 `entries`가 비어 있다
  행동  `"media"` 폴더의 `id`를 `folder_id`로 주어 `entries.create`를 실행한다
  결과  ENT-7.1  `BAD_REQUEST` 오류를 던진다
        ENT-7.2  `entries` 테이블이 비어 있다

ENT-8  `entries.create`는 스키마에 정의되지 않은 필드 키가 들어 있으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 있고 `entries`가 비어 있다
  행동  컬렉션의 `fields`에 없는 키가 포함된 `data`로 `entries.create`를 실행한다
  결과  ENT-8.1  `BAD_REQUEST` 오류를 던진다
        ENT-8.2  `entries` 테이블이 비어 있다

ENT-9  `entries.create`는 필드의 타입이나 제약에 어긋난 값이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `number` 필드와 `max`가 설정된 `text` 필드가 있는 컬렉션이 있고 `entries`가 비어 있다
  행동  `number` 필드에 문자열을, `text` 필드에 `max`를 넘는 길이의 문자열을 담아 `entries.create`를 실행한다
  결과  ENT-9.1  `BAD_REQUEST` 오류를 던진다
        ENT-9.2  `entries` 테이블이 비어 있다

ENT-10  `entries.create`는 `conditional` 필드에 선택한 분기에 없는 하위 필드가 들어 있으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 서로 다른 하위 필드를 가진 두 분기의 `conditional` 필드가 있는 컬렉션이 있고 `entries`가 비어 있다
  행동  첫 번째 분기를 `option`으로 선택하면서 두 번째 분기의 하위 필드를 `fields`에 담아 `entries.create`를 실행한다
  결과  ENT-10.1  `BAD_REQUEST` 오류를 던진다
        ENT-10.2  `entries` 테이블이 비어 있다

ENT-11  `entries.create`는 `body`를 쓰지 않는 컬렉션에 `data.body`를 주면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `body`가 설정되지 않은 컬렉션이 있고 `entries`가 비어 있다
  행동  유효한 `body`를 포함한 `data`로 `entries.create`를 실행한다
  결과  ENT-11.1  `BAD_REQUEST` 오류를 던진다
        ENT-11.2  `entries` 테이블이 비어 있다

ENT-12  `entries.create`는 `data.body` 검증에 실패하면 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다
  전제  스키마에 `body: true`인 컬렉션이 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `entries`가 비어 있다
  행동  그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `body`로 `entries.create`를 실행한다
  결과  ENT-12.1  `BAD_REQUEST` 오류를 던진다
        ENT-12.2  오류의 `details`가 같은 `body`와 `config`에 대한 `validateDoc`의 반환값과 같다
        ENT-12.3  `entries` 테이블이 비어 있다

ENT-13  `entries.create`는 `media` 필드가 `trashed_at`이 설정된 미디어를 참조하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 `media` 필드가 있는 컬렉션이 있고 `trashed_at`이 설정된 미디어가 하나 있으며 `entries`와 `media_uses`가 비어 있다
  행동  해당 미디어의 `id`를 `media` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-13.1  `BAD_REQUEST` 오류를 던진다
        ENT-13.2  `entries` 테이블이 비어 있다
        ENT-13.3  `media_uses` 테이블이 비어 있다

ENT-14  `entries.create`는 `relation` 필드가 `to` 컬렉션이 아닌 글을 참조하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 대상 컬렉션으로 지정된 컬렉션과 다른 컬렉션이 있고, 다른 컬렉션에 `trashed_at`이 `null`인 원문 글이 하나 있다
  행동  다른 컬렉션 글의 `id`를 `relation` 필드에 담아 `entries.create`를 실행한다
  결과  ENT-14.1  `BAD_REQUEST` 오류를 던진다
        ENT-14.2  `entries` 테이블의 행은 원래 하나 그대로이다

ENT-15  `entries.create`는 `relation` 필드가 번역본을 참조하면 `BAD_REQUEST`로 거절한다
  전제  `to` 컬렉션에 원문 글과 그 원문 글을 가리키는 번역본(`source_entry_id`가 설정된 글)이 하나씩 있다
  행동  번역본의 `id`를 `relation` 필드에 담은 `data`로 `entries.create`를 실행한다
  결과  ENT-15.1  `BAD_REQUEST` 오류를 던진다
        ENT-15.2  `entries` 테이블의 행은 원래 두 개 그대로이다

ENT-16  `entries.create`는 `slug`가 비어 있거나 형식에 맞지 않으면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고 `entries`가 비어 있다
  행동  공백이 포함된 `slug`로 `entries.create`를 실행한다
  결과  ENT-16.1  `BAD_REQUEST` 오류를 던진다
        ENT-16.2  `entries` 테이블이 비어 있다

ENT-17  `entries.create`는 같은 `collection`과 `locale`에 같은 `slug`의 `trashed_at`이 `null`인 글이 이미 있으면 `CONFLICT`로 거절한다
  전제  스키마에 컬렉션과 `locale`이 있고, 해당 `collection`과 `locale`에 `trashed_at`이 `null`인 글이 하나 있다
  행동  같은 `collection`, `locale`, 같은 `slug`로 `entries.create`를 실행한다
  결과  ENT-17.1  `CONFLICT` 오류를 던진다
        ENT-17.2  `entries` 테이블의 행은 원래 하나 그대로이다
```

## 2. 조회 (`get` · `list`)

```
ENT-18  `entries.get`은 `draft`를 생략하면 발행된 글의 발행본을 돌려준다
  전제  작업본(`entries`)과 다른 `slug`·`data`로 `entry_published` 행이 있는 `trashed_at`이 `null`인 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-18.1  반환값의 `id`, `collection`, `locale`, `source_entry_id`, `folder_id`가 `entries` 행과 같다
        ENT-18.2  반환값의 `slug`, `data`, `published_at`이 `entry_published` 행과 같다

ENT-19  `entries.get`은 `collection`, `locale`, `slug`로 발행본을 조회한다
  전제  작업본과 다른 `slug`로 `entry_published` 행이 있는 `trashed_at`이 `null`인 글이 두 개 있다
  행동  첫 번째 글의 `collection`, `locale`, 발행된 `slug`로 `entries.get`을 실행한다
  결과  ENT-19.1  반환값의 `id`, `slug`, `data`, `published_at`이 첫 번째 글의 발행본과 같다

ENT-20  `entries.get`에 `draft: true`를 주면 발행본이 있더라도 작업본을 돌려준다
  전제  작업본과 다른 `slug`·`data`로 `entry_published` 행이 있는 `trashed_at`이 `null`인 글이 하나 있다
  행동  해당 글의 `id`와 `draft: true`로 `entries.get`을 실행한다
  결과  ENT-20.1  반환값의 `slug`와 `data`가 `entries` 작업본과 같다
        ENT-20.2  반환값의 `published_at`이 `entry_published` 행의 `published_at`과 같다

ENT-21  `entries.get`은 `draft`를 생략했을 때 `entry_published` 행이 없는 글이면 `NOT_FOUND`로 거절한다
  전제  `entry_published` 행이 없는 `trashed_at`이 `null`인 글이 하나 있다
  행동  해당 글의 `id`만으로 `entries.get`을 실행한다
  결과  ENT-21.1  `NOT_FOUND` 오류를 던진다

ENT-22  `entries.get`은 `draft: true`여도 `trashed_at`이 설정된 글이면 `NOT_FOUND`로 거절한다
  전제  `entry_published` 행이 있고 `trashed_at`이 설정된 글이 하나 있다
  행동  해당 글의 `id`와 `draft: true`로 `entries.get`을 실행한다
  결과  ENT-22.1  `NOT_FOUND` 오류를 던진다

ENT-23  `entries.list`는 인자를 생략하면 `trashed_at`이 `null`이고 발행된 글의 발행본만 돌려준다
  전제  작업본과 다른 `data`로 `entry_published` 행이 있는 `trashed_at`이 `null`인 글, 미발행 글, `entry_published` 행이 있지만 `trashed_at`이 설정된 글이 각각 하나씩 있다
  행동  인자 없이 `entries.list`를 실행한다
  결과  ENT-23.1  `trashed_at`이 `null`이고 발행된 글 하나만 돌려준다
        ENT-23.2  반환된 항목의 `slug`, `data`, `published_at`이 `entry_published` 행과 같다

ENT-24  `entries.list`에 `draft: true`를 주면 `trashed_at`이 `null`인 모든 글의 작업본을 돌려준다
  전제  작업본과 다른 `data`로 `entry_published` 행이 있는 글, 미발행 글, `trashed_at`이 설정된 글이 각각 하나씩 있다
  행동  `draft: true`로 `entries.list`를 실행한다
  결과  ENT-24.1  `trashed_at`이 `null`인 글 두 개만 작업본 `data`로 돌려준다
        ENT-24.2  발행된 글의 `published_at`이 `entry_published`의 시각이다
        ENT-24.3  미발행 글의 `published_at`이 `null`이다

ENT-25  `entries.list`에 `collection`, `locale`, `folder_id`를 주면 모두 일치하는 해당 폴더 직속 글만 돌려준다
  전제  대상 컬렉션과 `locale`에 속한 대상 폴더 직속 글, 그 하위 폴더의 글, `folder_id`가 `null`인 글, 다른 `locale`의 글, 다른 컬렉션의 글이 각각 하나씩 있다
  행동  대상 `collection`, `locale`, 대상 폴더의 `id`인 `folder_id`, `draft: true`로 `entries.list`를 실행한다
  결과  ENT-25.1  조건에 모두 일치하는 대상 폴더 직속 글 하나만 돌려준다

ENT-26  `entries.list`에 `folder_id`를 `null`로 주면 `folder_id`가 `null`인 글만 돌려준다
  전제  `folder_id`가 `null`인 글 하나와 폴더에 속한 글 하나가 있다
  행동  `folder_id: null`과 `draft: true`로 `entries.list`를 실행한다
  결과  ENT-26.1  `folder_id`가 `null`인 글 하나만 돌려준다

ENT-27  `entries.list`에 `relation` 조건을 주면 해당 필드가 지정한 글을 참조하는 글만 돌려준다
  전제  같은 필드 키로 단일 `relation` 필드를 가진 첫 번째 컬렉션과 `many: true` `relation` 필드를 가진 두 번째 컬렉션이 있다. 발행본에서 대상 원문 글을 참조하는 글이 각 컬렉션에 하나씩 있고, 작업본에서만 대상 원문 글을 참조하고 발행본에서는 참조하지 않는 글이 하나 더 있다
  행동  해당 필드 키와 대상 원문 글 `id`를 `relation` 조건으로 주어 `entries.list`를 실행한다
  결과  ENT-27.1  발행본에서 대상 원문 글을 참조하는 글 두 개만 돌려준다
```

## 3. 수정 (`update`)

```
ENT-28  단건 `entries.update`에 `data` 없이 `slug`와 `folder_id`만 주면 지정한 항목만 바꾸고 `data`, `media_uses`, `entry_published`를 유지한다
  전제  `folder_id`가 `null`이고 미디어를 참조해 `media_uses` 행과 `entry_published` 행이 있는 글 하나와, 해당 컬렉션 `scope`의 `trashed_at`이 `null`인 폴더가 있다
  행동  해당 글의 `id`, 새 `slug`, 해당 폴더의 `id`인 `folder_id`만으로 `entries.update`를 실행한다
  결과  ENT-28.1  반환값의 `slug`와 `folder_id`가 새 값이고 `data`와 `published_at`이 원래 그대로이다
        ENT-28.2  `entries` 테이블에서 해당 행의 `slug`와 `folder_id`가 새 값이고 `data`는 원래 그대로이다
        ENT-28.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다
        ENT-28.4  `entry_published` 테이블에서 해당 행의 `slug`와 `data`가 원래 그대로이다

ENT-29  단건 `entries.update`로 `data`를 바꾸면 작업본 `data`를 통째로 교체하고 해당 글의 `media_uses`만 갱신한다
  전제  첫 번째 미디어를 참조해 각각 `media_uses` 행이 있는 대상 글과 다른 글, 대상 글과 같은 `source_id`를 가진 `template`의 `media_uses` 행, `trashed_at`이 `null`인 두 번째 미디어가 있다
  행동  대상 글의 `id`와 두 번째 미디어만 참조하는 새 `data`로 `entries.update`를 실행한다
  결과  ENT-29.1  반환값의 `data`가 새 `data`이고 `slug`와 `folder_id`가 원래 그대로이다
        ENT-29.2  `entries` 테이블에서 대상 글의 `data`가 새 `data`이다
        ENT-29.3  `media_uses`에서 대상 글(`source_kind`가 `"entry"`)의 참조는 두 번째 미디어 하나뿐이다
        ENT-29.4  `media_uses`에서 다른 글의 기존 참조는 그대로 남아 있다
        ENT-29.5  `media_uses`에서 `template`의 기존 참조는 그대로 남아 있다

ENT-30  단건 `entries.update`에 `folder_id`를 `null`로 주면 글을 루트로 이동한다
  전제  폴더에 속한 글이 하나 있다
  행동  해당 글의 `id`와 `folder_id: null`로 `entries.update`를 실행한다
  결과  ENT-30.1  반환값의 `folder_id`가 `null`이다
        ENT-30.2  `entries` 테이블에서 해당 행의 `folder_id`가 `null`이다

ENT-31  단건 `entries.update`는 `data`가 DB에 없는 미디어 `id`를 참조하면 `BAD_REQUEST`로 거절하고 기존 상태를 유지한다
  전제  미디어를 참조해 `media_uses` 행이 있는 글이 하나 있다
  행동  해당 글의 `id`와 존재하지 않는 UUID를 `media` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-31.1  `BAD_REQUEST` 오류를 던진다
        ENT-31.2  `entries` 테이블에서 해당 행의 `data`가 원래 그대로이다
        ENT-31.3  `media_uses`에 해당 글의 기존 참조가 그대로 남아 있다

ENT-32  단건 `entries.update`는 `relation` 필드가 `trashed_at`이 설정된 글을 참조하면 `BAD_REQUEST`로 거절한다
  전제  `relation` 필드를 가진 글 하나와 `to` 컬렉션에서 `trashed_at`이 설정된 원문 글 하나가 있다
  행동  해당 글의 `id`와 `trashed_at`이 설정된 원문 글의 `id`를 `relation` 필드에 담은 `data`로 `entries.update`를 실행한다
  결과  ENT-32.1  `BAD_REQUEST` 오류를 던진다
        ENT-32.2  `entries` 테이블에서 해당 행의 `data`가 원래 그대로이다

ENT-33  단건 `entries.update`는 `trashed_at`이 설정된 글이면 `NOT_FOUND`로 거절한다
  전제  `trashed_at`이 설정된 글이 하나 있다
  행동  해당 글의 `id`와 새 `slug`로 `entries.update`를 실행한다
  결과  ENT-33.1  `NOT_FOUND` 오류를 던진다
        ENT-33.2  `entries` 테이블에서 해당 행의 `slug`가 원래 그대로이다

ENT-34  단건 `entries.update`는 같은 `collection`과 `locale`의 다른 `trashed_at`이 `null`인 글과 `slug`가 겹치면 `CONFLICT`로 거절한다
  전제  같은 `collection`과 `locale`에 `trashed_at`이 `null`인 글이 두 개 있다
  행동  두 번째 글의 `id`와 첫 번째 글의 `slug`로 `entries.update`를 실행한다
  결과  ENT-34.1  `CONFLICT` 오류를 던진다
        ENT-34.2  `entries` 테이블에서 두 번째 글의 `slug`가 원래 그대로이다

ENT-35  다건 `entries.update`는 지정한 `ids`의 글들을 한 폴더(`folder_id`)로 일괄 이동한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`의 `trashed_at`이 `null`인 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-35.1  반환 목록이 요청한 두 글의 `{ id, folder_id: 새 folder_id }`로 이루어진다
        ENT-35.2  `entries` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

ENT-36  다건 `entries.update`에서 대상 중 하나라도 `trashed_at`이 설정되어 있으면 `NOT_FOUND`로 전체 롤백한다
  전제  같은 컬렉션에서 `folder_id`가 `null`이고 `trashed_at`이 `null`인 글 하나, `trashed_at`이 설정된 글 하나, 해당 컬렉션 `scope`의 `trashed_at`이 `null`인 폴더가 하나 있다
  행동  두 글의 `ids`와 해당 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-36.1  `NOT_FOUND` 오류를 던진다
        ENT-36.2  `entries` 테이블에서 `trashed_at`이 `null`인 글의 `folder_id`가 `null` 그대로이다

ENT-37  다건 `entries.update`에서 `folder_id`가 `trashed_at`이 설정된 폴더이면 `BAD_REQUEST`로 전체 롤백한다
  전제  같은 컬렉션에서 `folder_id`가 `null`인 글 두 개와 해당 컬렉션 `scope`에서 `trashed_at`이 설정된 폴더가 하나 있다
  행동  두 글의 `ids`와 `trashed_at`이 설정된 폴더의 `id`인 `folder_id`로 `entries.update`를 실행한다
  결과  ENT-37.1  `BAD_REQUEST` 오류를 던진다
        ENT-37.2  `entries` 테이블에서 두 글의 `folder_id`가 모두 `null` 그대로이다
```
