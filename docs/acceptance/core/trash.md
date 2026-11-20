# `resources/trash/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 6절(`trashed_at`, `media_uses`, `loose_files`), 7절(`trash` 리소스)의 인수 조건이다.

- 휴지통 항목: `trashed_at`이 설정된 글(`entries`), 폴더(`folders`), 미디어(`media`)이고 `kind`는 `"entry"`, `"folder"`, `"media"`이다. 템플릿은 휴지통 없이 `templates.delete`로 지운다.
- `trash.move`: `{ id }`의 활성 글·폴더·미디어를 휴지통으로 보내고 그 항목의 `{ kind, id }`를 돌려준다. 폴더를 보내면 그 아래의 활성 하위 폴더·글·미디어가 같은 `trashed_at`으로 함께 들어가고, 글 자신과 그것을 가리키는 관계 값·미디어 사용처 기록은 그대로 두며, 이미 휴지통에 있거나 없는 대상은 `NOT_FOUND`로 거절한다.
- `trash.list` · `trash.get`: `trash.list`는 폴더와 함께 들어간 항목을 뺀 휴지통 항목(먼저 따로 버린 항목은 자기 줄로)을 `{ kind, id, name, trashed_at }`로 최근에 버린 것부터 돌려준다. `name`은 글의 원문 언어 `slug`, 폴더의 `name`, 미디어의 `key`다. `trash.get({ id })`는 한 항목을 같은 모양으로 돌려주며 휴지통 항목이 아니면 `NOT_FOUND`다. 목록에 나오지 않는 항목도 휴지통 항목이므로 `get`·`restore`·`delete`에 그 `id`를 줄 수 있다.
- `trash.restore`: `{ id }`의 휴지통 항목을 되살리고 그 항목의 `{ kind, id }`를 돌려준다. 글은 초안으로 돌아오고(모든 언어의 발행본 `entry_published`를 지우고 작업본은 둔다) 폴더는 함께 들어간 항목만 데려오며, 휴지통 항목이 아니면 `NOT_FOUND`로 거절한다.
- 되살릴 때의 위치와 이름: 상위 폴더가 휴지통에 있으면 그 폴더는 그대로 두고 같은 이름의 활성 폴더를 새로 만들어(같은 위치에 있으면 그 폴더를 써서) 그 안에 되살린다. 이름이 겹쳐도 실패하지 않고 겹치지 않는 첫 `<이름>-2`, `<이름>-3`…을 붙이며(폴더는 같은 `scope`·부모의 활성 폴더, 글은 같은 `collection`·`locale`의 활성 글 작업본 `slug`와 비교) 폴더를 합치지는 않는다.
- `trash.delete`: `{ id }`, `{ ids }`, `{ before }`(`trashed_at`이 그 시각보다 앞선 항목, 만료 정리용), `{ all: true }` 중 하나로 휴지통 항목을 영구 삭제한다. `{ id }`는 `{ kind, id }` 하나를, 나머지는 배열을 돌려주며 폴더와 함께 지워진 항목은 넣지 않고, 휴지통 항목이 아닌 `id`가 하나라도 있으면 `NOT_FOUND`로 거절하고 아무것도 지우지 않는다.
- 영구 삭제의 범위: 글은 모든 언어 작업본·발행본·미디어 사용처 기록과, 폴더는 함께 들어간 하위 폴더·글·미디어와, 미디어는 사용처 기록과 함께 지운다. 폴더보다 먼저 따로 버린 항목은 지우지 않고 `folder_id`·`parent_id`를 `null`로 옮겨 휴지통에 두며, 미디어의 파일은 이 호출에서 지우지 않고 임시 파일 목록(`loose_files`)에 올린다.
- 영구 삭제한 미디어의 파일을 스토리지에서 실제로 지우는 임시 파일 정리(`removeLooseFiles`)는 `media.md`의 `MED-CLN-1`, `MED-CLN-2`가 다룬다.

## 1. 휴지통에 보내기 (`move`)

```
TRH-MOVE-1  글을 휴지통에 보내면 모든 언어 작업본과 발행본이 그 글과 함께 휴지통에 들어가고 내용은 지워지거나 바뀌지 않는다
  전제  `ko` 원문과 `en` 번역 언어 작업본이 있고 발행된 활성 글이 있다
  행동  해당 글의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-1.1  `entries` 테이블에서 해당 글의 `trashed_at`이 설정된다
        TRH-MOVE-1.2  `entry_locales`와 `entry_published` 테이블의 해당 글의 행들이 지워지거나 바뀌지 않고 원래 그대로이다
        TRH-MOVE-1.3  반환값이 `kind: "entry"`와 해당 글의 `id` 한 개이다

TRH-MOVE-2  글을 휴지통에 보내도 그 글을 가리키던 다른 글의 관계 값은 끊지 않고 그대로 둔다
  전제  다른 컬렉션에서 `relation` 필드로 대상 글을 가리키는 활성 글이 있다
  행동  대상 글의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-2.1  `entry_locales` 테이블에서 가리키던 글의 `data`가 원래 그대로이다

TRH-MOVE-3  글이 쓰는 미디어를 휴지통에 보내도 사용처 기록은 그대로 둔다
  전제  `storage`가 설정되어 있고, 활성 글의 본문이 쓰는 활성 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-3.1  `media` 테이블에서 해당 미디어의 `trashed_at`이 설정된다
        TRH-MOVE-3.2  `media_uses` 테이블의 행들이 원래 그대로이다

TRH-MOVE-4  폴더를 휴지통에 보내면 그 아래 하위 폴더와 글이 같은 시각으로 함께 들어간다
  전제  컬렉션 `scope`에 상위 폴더와 그 아래 하위 폴더가 있고 두 폴더에 활성 글이 하나씩 있다
  행동  상위 폴더의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-4.1  두 폴더와 두 글의 `trashed_at`이 모두 설정되고 서로 같은 시각이다
        TRH-MOVE-4.2  반환값이 `kind: "folder"`와 상위 폴더의 `id` 한 개이다

TRH-MOVE-5  미디어 폴더를 휴지통에 보내면 그 아래 하위 폴더와 미디어가 같은 시각으로 함께 들어간다
  전제  `storage`가 설정되어 있고 `"media"` `scope`에 상위 폴더와 그 아래 하위 폴더가 있으며 두 폴더에 활성 미디어가 하나씩 있다
  행동  상위 폴더의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-5.1  두 폴더와 두 미디어의 `trashed_at`이 모두 설정되고 서로 같은 시각이다

TRH-MOVE-6  이미 휴지통에 있는 항목은 `NOT_FOUND`로 보내기를 거절한다
  전제  이미 휴지통에 있는(`trashed_at` 설정) 글이 하나 있다
  행동  해당 글의 `id`로 `trash.move`를 실행한다
  결과  TRH-MOVE-6.1  `NOT_FOUND` 오류를 던진다
        TRH-MOVE-6.2  `entries` 테이블에서 해당 글의 `trashed_at`이 원래 그대로이다
```

## 2. 보기 (`list` · `get`)

```
TRH-READ-1  휴지통의 글·폴더·미디어만 최근에 버린 것부터 돌려준다
  전제  서로 다른 시각에 휴지통에 들어간 글, 폴더, 미디어가 하나씩 있고 활성 글도 하나 있다
  행동  입력 없이 `trash.list`를 실행한다
  결과  TRH-READ-1.1  휴지통의 글, 폴더, 미디어 세 항목만 돌려주고 활성 글은 돌려주지 않는다
        TRH-READ-1.2  가장 최근에 버린 항목부터 순서대로이다
        TRH-READ-1.3  각 항목이 `kind`, `id`, `name`, `trashed_at`을 가진다(`name`은 글은 원문 언어 작업본의 `slug`, 폴더는 `name`, 미디어는 `key`)

TRH-READ-2  폴더와 함께 들어간 항목은 목록에 따로 나오지 않고 먼저 따로 버린 항목은 자기 줄로 나온다
  전제  폴더 안의 글 하나를 먼저 따로 휴지통에 보냈고, 그 뒤 `trash.move`로 그 폴더(하위 폴더와 다른 글 하나 포함)를 보냈다
  행동  입력 없이 `trash.list`를 실행한다
  결과  TRH-READ-2.1  폴더 한 줄과 먼저 따로 버린 글 한 줄, 두 줄만 돌려준다

TRH-READ-3  휴지통의 항목 하나를 `id`로 조회한다
  전제  휴지통에 글이 하나 있다
  행동  해당 글의 `id`로 `trash.get`을 실행한다
  결과  TRH-READ-3.1  반환값의 `kind`가 `"entry"`, `id`가 그 글의 `id`, `name`이 원문 언어 작업본의 `slug`, `trashed_at`이 `entries`의 `trashed_at`이다

TRH-READ-4  휴지통 항목이 아닌 `id`로 조회하면 `NOT_FOUND`로 거절한다
  전제  휴지통에 들어가 있지 않은 글(`trashed_at`이 `null`)이 하나 있다
  행동  해당 글의 `id`로 `trash.get`을 실행한다
  결과  TRH-READ-4.1  `NOT_FOUND` 오류를 던진다
```

## 3. 되살리기 (`restore`)

```
TRH-RST-1  글을 되살리면 휴지통에서 나와 초안으로 돌아온다
  전제  `ko` 원문과 `en` 번역 언어가 모두 발행된 글이 휴지통에 있다
  행동  해당 글의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-1.1  `entries` 테이블에서 해당 글의 `trashed_at`이 `null`이다
        TRH-RST-1.2  `entry_published` 테이블에 해당 글의 행이 없다
        TRH-RST-1.3  `entry_locales` 테이블의 해당 글의 행들이 원래 그대로이다
        TRH-RST-1.4  반환값이 `kind: "entry"`와 해당 글의 `id` 한 개이다

TRH-RST-2  폴더를 되살리면 함께 들어갔던 항목은 돌아오고 먼저 따로 버린 항목은 휴지통에 남는다
  전제  컬렉션 `scope`의 폴더(하위 폴더 하나와 발행된 직속 글 하나 포함)와, 폴더를 보내기 전에 따로 휴지통에 보낸 직속 글이 있고 그 뒤 폴더를 `trash.move`로 보냈다
  행동  폴더의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-2.1  폴더, 하위 폴더, 함께 들어갔던 글의 `trashed_at`이 `null`이다
        TRH-RST-2.2  함께 돌아온 글의 `entry_published` 행이 없다
        TRH-RST-2.3  먼저 따로 버린 글의 `trashed_at`이 원래 그대로이다
        TRH-RST-2.4  반환값이 `kind: "folder"`와 폴더의 `id` 한 개이다

TRH-RST-3  글의 상위 폴더가 휴지통에 있을 때 그 글을 되살리면 같은 이름의 새 폴더를 만들어 그 안에 되살리고 휴지통의 폴더는 그대로 둔다
  전제  상위 폴더 아래 하위 폴더 안의 글을 먼저 따로 휴지통에 보냈고, 그 뒤 상위 폴더를 `trash.move`로 보냈다. 상위 폴더에는 함께 들어간 다른 글도 하나 있다
  행동  먼저 따로 버린 글의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-3.1  `folders` 테이블에 휴지통의 두 폴더와 같은 `scope`·`name`인 활성 폴더가 새 `id`로 하나씩 생긴다
        TRH-RST-3.2  새 하위 폴더의 `parent_id`가 새 상위 폴더의 `id`이다
        TRH-RST-3.3  글의 `trashed_at`이 `null`이고 `folder_id`가 새 하위 폴더의 `id`이다
        TRH-RST-3.4  휴지통의 두 폴더와 함께 들어갔던 다른 글의 `trashed_at`이 원래 그대로이다

TRH-RST-4  글의 상위 폴더가 휴지통에 있어도 같은 위치에 같은 이름의 활성 폴더가 있으면 새로 만들지 않고 그 폴더 안에 되살린다
  전제  폴더 안의 글을 먼저 따로 휴지통에 보내고 그 폴더를 `trash.move`로 보낸 뒤, 같은 `scope`·부모·`name`의 활성 폴더를 새로 만들어 두었다
  행동  먼저 따로 버린 글의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-4.1  `folders` 테이블에 그 `scope`·부모·`name`의 활성 폴더가 새로 늘지 않는다
        TRH-RST-4.2  글의 `trashed_at`이 `null`이고 `folder_id`가 이미 있던 활성 폴더의 `id`이다

TRH-RST-5  폴더를 되살릴 때 같은 위치에 같은 이름의 활성 폴더가 있으면 번호를 붙여 되살린다
  전제  휴지통에 폴더(직속 글 하나 포함)가 있고, 같은 `scope`·부모·`name`의 활성 폴더가 있다
  행동  휴지통 폴더의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-5.1  휴지통 폴더의 `name`이 원래 `name`에 `-2`를 붙인 값이고 `trashed_at`이 `null`이다
        TRH-RST-5.2  함께 들어갔던 글의 `trashed_at`이 `null`이고 `folder_id`가 그 폴더의 `id`이다
        TRH-RST-5.3  활성 폴더의 `name`은 원래 그대로이다

TRH-RST-6  슬러그가 활성 글과 겹치는 글은 번호를 붙여 되살린다
  전제  휴지통에 있는 글의 작업본과 같은 `collection`, `locale`, `slug`의 작업본을 가진 활성 글이 있다
  행동  휴지통 글의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-6.1  휴지통 글의 해당 언어 작업본 `slug`가 원래 `slug`에 `-2`를 붙인 값이고 `trashed_at`이 `null`이다
        TRH-RST-6.2  활성 글의 `slug`는 원래 그대로이다

TRH-RST-7  미디어를 되살리면 휴지통에서 나온다
  전제  `storage`가 설정되어 있고 휴지통에 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-7.1  `media` 테이블에서 해당 미디어의 `trashed_at`이 `null`이다
        TRH-RST-7.2  반환값이 `kind: "media"`와 해당 미디어의 `id` 한 개이다

TRH-RST-8  휴지통 항목이 아닌 `id`로 되살리면 `NOT_FOUND`로 거절한다
  전제  휴지통에 들어가 있지 않은 글(`trashed_at`이 `null`)이 하나 있다
  행동  해당 글의 `id`로 `trash.restore`를 실행한다
  결과  TRH-RST-8.1  `NOT_FOUND` 오류를 던진다
```

## 4. 영구 삭제 (`delete`)

```
TRH-DEL-1  글을 영구 삭제하면 모든 언어 작업본과 발행본, 그 글의 미디어 사용처 기록이 지워진다
  전제  `ko` 원문과 `en` 번역 언어 작업본, 발행본이 있고 미디어를 쓰는 글이 휴지통에 있다
  행동  해당 글의 `id`로 `trash.delete`를 실행한다
  결과  TRH-DEL-1.1  `entries`, `entry_locales`, `entry_published` 테이블에 해당 글의 행이 없다
        TRH-DEL-1.2  `media_uses` 테이블에 해당 글의 사용처 행이 없다

TRH-DEL-2  미디어를 영구 삭제하면 DB에서는 완전히 지워지고 파일은 나중에 지울 임시 파일 목록에 올라간다
  전제  `storage`가 설정되어 있고, 활성 글이 쓰던 미디어가 휴지통에 있다
  행동  해당 미디어의 `id`로 `trash.delete`를 실행한다
  결과  TRH-DEL-2.1  `media` 테이블에 해당 미디어의 행이 없다
        TRH-DEL-2.2  `media_uses` 테이블에 해당 미디어의 사용처 행이 없다
        TRH-DEL-2.3  `loose_files` 테이블에 미디어의 `key` 행이 있고 `remove_after`가 실행을 마친 시각보다 늦지 않다
        TRH-DEL-2.4  스토리지의 `remove`를 호출하지 않는다

TRH-DEL-3  컬렉션 폴더를 영구 삭제하면 함께 들어간 하위 폴더와 글이 지워지고 먼저 따로 버린 글은 휴지통에 남는다
  전제  휴지통에 컬렉션 `scope`의 폴더(하위 폴더 하나와 미디어를 쓰는 직속 글 하나 포함)가 있고, 같은 폴더 안에서 폴더보다 먼저 따로 휴지통에 보낸 글이 하나 더 있다
  행동  폴더의 `id`로 `trash.delete`를 실행한다
  결과  TRH-DEL-3.1  `folders` 테이블에 폴더와 하위 폴더의 행이 없다
        TRH-DEL-3.2  `entries` 테이블에 함께 들어갔던 글의 행이 없고 `media_uses` 테이블에 그 글의 사용처 행이 없다
        TRH-DEL-3.3  먼저 따로 버린 글은 `entries` 테이블에 `trashed_at`이 원래 그대로이고 `folder_id`가 `null`인 행으로 남는다

TRH-DEL-4  미디어 폴더를 영구 삭제하면 하위 폴더와 안의 미디어가 지워지고 미디어의 파일은 임시 파일 목록에 올라간다
  전제  `storage`가 설정되어 있고, 휴지통에 `"media"` `scope`의 폴더(하위 폴더 하나와 활성 글이 쓰던 직속 미디어 하나 포함)가 있다
  행동  폴더의 `id`로 `trash.delete`를 실행한다
  결과  TRH-DEL-4.1  `folders` 테이블에 폴더와 하위 폴더의 행이 없고 `media` 테이블에 미디어의 행이 없다
        TRH-DEL-4.2  `media_uses` 테이블에 해당 미디어의 사용처 행이 없다
        TRH-DEL-4.3  `loose_files` 테이블에 미디어의 `key` 행이 있고 `remove_after`가 실행을 마친 시각보다 늦지 않다

TRH-DEL-5  여러 개를 한 번에 영구 삭제한다
  전제  휴지통에 글 하나와 폴더 하나가 있다
  행동  두 항목의 `id`를 `ids`로 넣어 `trash.delete`를 실행한다
  결과  TRH-DEL-5.1  `entries` 테이블에 글의 행이 없고 `folders` 테이블에 폴더의 행이 없다
        TRH-DEL-5.2  반환값이 두 항목의 `kind`와 `id`이다

TRH-DEL-6  휴지통을 모두 비우고 활성 항목은 그대로 둔다
  전제  휴지통에 글, 폴더가 하나씩 있고 활성 글이 하나 있다
  행동  `all: true`로 `trash.delete`를 실행한다
  결과  TRH-DEL-6.1  휴지통 글과 폴더의 행이 없다
        TRH-DEL-6.2  활성 글의 행이 원래 그대로이다

TRH-DEL-7  기준 시각보다 먼저 휴지통에 들어간 항목만 영구 삭제한다
  전제  기준 시각보다 먼저 휴지통에 들어간 글과 그 뒤에 들어간 글이 하나씩 있다
  행동  기준 시각을 `before`로 넣어 `trash.delete`를 실행한다
  결과  TRH-DEL-7.1  먼저 들어간 글의 행이 없다
        TRH-DEL-7.2  그 뒤에 들어간 글의 행이 원래 그대로이다

TRH-DEL-8  휴지통 항목이 아닌 `id`가 하나라도 있으면 `NOT_FOUND`로 거절하고 아무것도 지우지 않는다
  전제  휴지통에 글 하나와 활성 글 하나가 있다
  행동  두 글의 `id`를 `ids`로 넣어 `trash.delete`를 실행한다
  결과  TRH-DEL-8.1  `NOT_FOUND` 오류를 던진다
        TRH-DEL-8.2  `entries` 테이블에서 두 글의 행이 원래 그대로이다
```
