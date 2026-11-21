# `resources/templates/` · `resources/media/uses.ts` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `__preset_id`), 6절(`templates`, `media_uses`), 7절(`templates` 리소스)의 인수 조건이다.

- `templates.create`: 선택 `__preset_id`(UUID)와 스키마에 존재하는 `collection`을 받아 템플릿을 만든다. 스키마에 없는 `collection`이면 `BAD_REQUEST`, 같은 `collection`에 같은 `name`이 있으면 `CONFLICT`로 거절한다.
- 본문 검증 및 미디어 색인(`create`, `content`가 주어진 `update`): 본문을 `validateDoc(content, ctx.config)`로 검사하고 실패 시 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다. 블록 트리 전체(`children` 재귀)의 `attrs.mediaId`·`attrs.mediaIds`를 대소문자 무시하고 모아 `media_uses`(`source_kind: "template"`, `field_path: "content"`)에 기록하며, 없거나 휴지통에 있는 미디어를 참조하면 `BAD_REQUEST`로 거절한다.
- `templates.list` · `templates.get`: 전체 또는 특정 `collection`의 템플릿을 조회하며, 없는 `id`는 `NOT_FOUND`로 거절한다.
- `templates.update` · `templates.delete`: `update`는 `name`·`content`만 바꾸며(`collection` 수정 불가) `name` 중복은 `CONFLICT`, 없는 `id`는 `NOT_FOUND`로 거절한다. `delete`는 해당 템플릿과 그 `media_uses`만 삭제하며 없는 `id`는 `NOT_FOUND`로 거절한다.

---

## 1. 생성 (`create`)

```
TPL-CRT-1  컬렉션의 템플릿을 저장하고 돌려준다
  전제  스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
  행동  해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-1.1  반환값의 `id`가 UUID 형식이고 `collection`, `name`, `content`가 입력과 같다
        TPL-CRT-1.2  `templates` 테이블에 반환값과 같은 행이 생긴다

TPL-CRT-2  지정한 ID로 템플릿을 만든다
  전제  스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
  행동  미리 정한 UUID `__preset_id`, 해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-2.1  반환값의 `id`가 전달한 `__preset_id`이다
        TPL-CRT-2.2  `templates` 테이블에 해당 `id`의 행이 하나 생긴다

TPL-CRT-3  다른 컬렉션에 같은 이름이 있어도 템플릿을 만든다
  전제  스키마에 컬렉션이 두 개 있고 두 번째 컬렉션에 템플릿이 하나 있다
  행동  첫 번째 `collection`에 두 번째 컬렉션 템플릿과 같은 `name`과 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-3.1  반환값의 `collection`이 첫 번째 컬렉션이고 `name`이 입력과 같다
        TPL-CRT-3.2  `templates` 테이블에 두 컬렉션의 템플릿 두 개가 모두 있다

TPL-CRT-4  본문 블록 트리의 미디어 참조를 대소문자 무시하고 한 번씩 기록한다
  전제  스키마에 컬렉션이 하나 있고 활성 미디어 세 개가 있으며 `media_uses`가 비어 있다
  행동  최상위 블록이 첫 번째 미디어를 `attrs.mediaId`로, `quote`의 `children` 안 블록 하나가 두 번째 미디어를 `attrs.mediaId`로, 다른 `children` 블록이 대문자 표기의 두 번째 미디어와 세 번째 미디어를 `attrs.mediaIds`로 참조하는 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-4.1  `media_uses`에 `source_kind`가 `"template"`, `source_id`가 반환된 `id`, `field_path`가 `"content"`인 행이 세 미디어당 하나씩 정확히 세 개 생긴다

TPL-CRT-5  스키마에 없는 컬렉션에는 템플릿을 만들 수 없다
  전제  스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
  행동  스키마의 `collections`에 없는 `collection`과 유효한 `name`·`content`로 `templates.create`를 실행한다
  결과  TPL-CRT-5.1  `BAD_REQUEST` 오류를 던진다
        TPL-CRT-5.2  `templates` 테이블이 비어 있다

TPL-CRT-6  같은 컬렉션에 같은 이름의 템플릿이 이미 있으면 만들 수 없다
  전제  스키마에 컬렉션이 하나 있고 해당 컬렉션에 템플릿이 하나 있다
  행동  같은 `collection`, 같은 `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-6.1  `CONFLICT` 오류를 던진다
        TPL-CRT-6.2  `templates` 테이블의 행은 원래 하나 그대로이다

TPL-CRT-7  본문 형식이 맞지 않으면 문제 목록을 담아 템플릿 생성을 거절한다
  전제  스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `templates`가 비어 있다
  행동  그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-7.1  `BAD_REQUEST` 오류를 던진다
        TPL-CRT-7.2  오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
        TPL-CRT-7.3  `templates` 테이블이 비어 있다

TPL-CRT-8  본문이 휴지통에 있는 미디어를 참조하면 템플릿을 만들 수 없다
  전제  스키마에 컬렉션이 하나 있고 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있으며 `templates`와 `media_uses`가 비어 있다
  행동  해당 미디어를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-CRT-8.1  `BAD_REQUEST` 오류를 던진다
        TPL-CRT-8.2  `templates` 테이블이 비어 있다
        TPL-CRT-8.3  `media_uses` 테이블이 비어 있다
```

## 2. 조회 (`list` · `get`)

```
TPL-READ-1  조건 없이 목록을 조회하면 모든 컬렉션의 템플릿을 돌려준다
  전제  서로 다른 두 컬렉션에 템플릿이 하나씩 있다
  행동  인자 없이 `templates.list`를 실행한다
  결과  TPL-READ-1.1  두 컬렉션의 템플릿 두 개를 모두 돌려준다

TPL-READ-2  컬렉션을 지정해 목록을 조회하면 해당 컬렉션의 템플릿만 돌려준다
  전제  서로 다른 두 컬렉션에 템플릿이 하나씩 있다
  행동  첫 번째 `collection`으로 `templates.list`를 실행한다
  결과  TPL-READ-2.1  첫 번째 컬렉션의 템플릿 하나만 돌려준다

TPL-READ-3  지정한 ID의 템플릿 1건을 돌려준다
  전제  템플릿이 두 개 있다
  행동  첫 번째 템플릿의 `id`로 `templates.get`을 실행한다
  결과  TPL-READ-3.1  반환값의 `id`, `collection`, `name`, `content`가 첫 번째 템플릿과 같다

TPL-READ-4  존재하지 않는 템플릿은 조회할 수 없다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`로 `templates.get`을 실행한다
  결과  TPL-READ-4.1  `NOT_FOUND` 오류를 던진다
```

## 3. 수정 (`update`)

```
TPL-UPD-1  본문 없이 이름만 주면 이름만 바꾸고 본문과 미디어 사용처를 유지한다
  전제  미디어를 참조하고 `media_uses` 행이 있는 템플릿이 하나 있다
  행동  해당 `id`와 새 `name`만으로 `templates.update`를 실행한다
  결과  TPL-UPD-1.1  반환값의 `name`이 새 `name`이고 `collection`과 `content`가 원래 그대로이다
        TPL-UPD-1.2  `templates` 테이블의 해당 행이 반환값과 같다
        TPL-UPD-1.3  `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

TPL-UPD-2  본문을 바꾸면 본문을 갱신하고 해당 템플릿의 미디어 사용처만 교체한다
  전제  첫 번째 미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행, 두 번째 미디어가 있다
  행동  대상 템플릿의 `id`와 두 번째 미디어만 참조하는 새 `content`로 `templates.update`를 실행한다
  결과  TPL-UPD-2.1  반환값의 `content`가 새 `content`이고 `name`과 `collection`이 원래 그대로이다
        TPL-UPD-2.2  `templates` 테이블에서 대상 템플릿의 행이 반환값과 같다
        TPL-UPD-2.3  `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조는 두 번째 미디어와 `field_path` `"content"` 하나뿐이다
        TPL-UPD-2.4  `media_uses`에서 다른 템플릿의 기존 참조는 그대로 남아 있다
        TPL-UPD-2.5  `media_uses`에서 `entry`의 기존 참조는 그대로 남아 있다

TPL-UPD-3  같은 컬렉션의 다른 템플릿과 이름이 겹치면 이름을 바꿀 수 없다
  전제  같은 컬렉션에 템플릿이 두 개 있다
  행동  두 번째 템플릿의 `id`와 첫 번째 템플릿의 `name`으로 `templates.update`를 실행한다
  결과  TPL-UPD-3.1  `CONFLICT` 오류를 던진다
        TPL-UPD-3.2  `templates` 테이블에서 두 번째 템플릿의 `name`이 원래 그대로이다

TPL-UPD-4  본문 형식이 맞지 않으면 문제 목록을 담아 템플릿 수정을 거절한다
  전제  스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 템플릿이 하나 있다
  행동  해당 `id`와, 그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.update`를 실행한다
  결과  TPL-UPD-4.1  `BAD_REQUEST` 오류를 던진다
        TPL-UPD-4.2  오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
        TPL-UPD-4.3  `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다

TPL-UPD-5  본문이 존재하지 않는 미디어를 참조하면 템플릿을 수정할 수 없다
  전제  미디어를 참조하고 `media_uses` 행이 있는 템플릿이 하나 있다
  행동  해당 `id`와 존재하지 않는 UUID를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.update`를 실행한다
  결과  TPL-UPD-5.1  `BAD_REQUEST` 오류를 던진다
        TPL-UPD-5.2  `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다
        TPL-UPD-5.3  `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

TPL-UPD-6  존재하지 않는 템플릿은 수정할 수 없다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`와 새 `name`으로 `templates.update`를 실행한다
  결과  TPL-UPD-6.1  `NOT_FOUND` 오류를 던진다
```

## 4. 삭제 (`delete`)

```
TPL-DEL-1  해당 템플릿과 그 템플릿의 미디어 사용처만 지운다
  전제  미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행이 있다
  행동  대상 템플릿의 `id`로 `templates.delete`를 실행한다
  결과  TPL-DEL-1.1  `templates` 테이블에 다른 템플릿 하나만 남아 있다
        TPL-DEL-1.2  `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조가 사라진다
        TPL-DEL-1.3  `media_uses`에서 다른 템플릿의 참조는 그대로 남아 있다
        TPL-DEL-1.4  `media_uses`에서 `entry`의 참조는 그대로 남아 있다

TPL-DEL-2  존재하지 않는 템플릿은 지울 수 없다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`로 `templates.delete`를 실행한다
  결과  TPL-DEL-2.1  `NOT_FOUND` 오류를 던진다
```
