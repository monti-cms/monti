# `resources/templates/` · `resources/media/uses.ts` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `id`), 6절(`templates`, `media_uses`), 7절(`templates` 리소스)의 인수 조건이다.

- `templates` 리소스는 `storage` 없이 동작한다. `create`는 선택 `id`(UUID)를 받고 스키마에 존재하는 `collection`이 필수이며(스키마에 없으면 `BAD_REQUEST`), `update` 입력에는 `collection`이 없어 수정할 수 없다.
- `create`와 `content`가 주어진 `update`는 본문을 `validateDoc(content, ctx.config)`로 검사하고 실패 시 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다.
- 같은 `collection` 안에서 `name` 중복은 `CONFLICT`, 본문이 DB에 없거나 `trashed_at`이 설정된 미디어를 참조하면 `BAD_REQUEST`, 없는 `id`에 대한 `get`·`update`·`delete`는 `NOT_FOUND`로 거절한다.
- `resources/media/uses.ts`는 블록 트리 전체(`children` 재귀)에서 `attrs.mediaId`와 `attrs.mediaIds`를 중복 없이 모아 같은 트랜잭션 안에서 `media_uses`(`source_kind: "template"`, `field_path: "content"`)를 갱신·정리한다.

---

## 1. 생성 (`create`)

```
TPL-1  `templates.create`는 `storage` 없이도 컬렉션의 템플릿을 저장하고 돌려준다
  전제  `storage` 없이 엔진이 생성되어 있고, 스키마에 컬렉션이 하나 있으며 `templates`가 비어 있다
  행동  해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-1.1  반환값의 `id`가 UUID 형식이고 `collection`, `name`, `content`가 입력과 같다
        TPL-1.2  `templates` 테이블에 반환값과 같은 행이 생긴다

TPL-2  `templates.create`에 `id`를 주면 지정한 `id`로 템플릿을 만든다
  전제  스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
  행동  미리 정한 UUID `id`, 해당 `collection`, `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-2.1  반환값의 `id`가 전달한 `id`이다
        TPL-2.2  `templates` 테이블에 해당 `id`의 행이 하나 생긴다

TPL-3  `templates.create`는 다른 `collection`에 같은 `name`이 있어도 템플릿을 만든다
  전제  스키마에 컬렉션이 두 개 있고 두 번째 컬렉션에 템플릿이 하나 있다
  행동  첫 번째 `collection`에 두 번째 컬렉션 템플릿과 같은 `name`과 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-3.1  반환값의 `collection`이 첫 번째 컬렉션이고 `name`이 입력과 같다
        TPL-3.2  `templates` 테이블에 두 컬렉션의 템플릿 두 개가 모두 있다

TPL-4  `templates.create`는 본문 블록 트리의 `attrs.mediaId`·`attrs.mediaIds`를 `media_uses`에 중복 없이 기록한다
  전제  스키마에 컬렉션이 하나 있고 `trashed_at`이 `null`인 미디어 세 개가 있으며 `media_uses`가 비어 있다
  행동  최상위 블록이 첫 번째 미디어를 `attrs.mediaId`로, `quote`의 `children` 안 블록 하나가 두 번째 미디어를 `attrs.mediaId`로, 다른 `children` 블록이 두 번째·세 번째 미디어를 `attrs.mediaIds`로 참조하는 `content`로 `templates.create`를 실행한다
  결과  TPL-4.1  `media_uses`에 `source_kind`가 `"template"`, `source_id`가 반환된 `id`, `field_path`가 `"content"`인 행이 세 미디어당 하나씩 정확히 세 개 생긴다

TPL-5  `templates.create`는 스키마에 없는 `collection`이면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 하나 있고 `templates`가 비어 있다
  행동  스키마의 `collections`에 없는 `collection`과 유효한 `name`·`content`로 `templates.create`를 실행한다
  결과  TPL-5.1  `BAD_REQUEST` 오류를 던진다
        TPL-5.2  `templates` 테이블이 비어 있다

TPL-6  `templates.create`는 같은 `collection`에 같은 `name`이 이미 있으면 `CONFLICT`로 거절한다
  전제  스키마에 컬렉션이 하나 있고 해당 컬렉션에 템플릿이 하나 있다
  행동  같은 `collection`, 같은 `name`, 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-6.1  `CONFLICT` 오류를 던진다
        TPL-6.2  `templates` 테이블의 행은 원래 하나 그대로이다

TPL-7  `templates.create`는 본문 검증에 실패하면 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 `templates`가 비어 있다
  행동  그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.create`를 실행한다
  결과  TPL-7.1  `BAD_REQUEST` 오류를 던진다
        TPL-7.2  오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
        TPL-7.3  `templates` 테이블이 비어 있다

TPL-8  `templates.create`는 본문이 `trashed_at`이 설정된 미디어를 참조하면 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 하나 있고 `trashed_at`이 설정된 미디어가 하나 있으며 `templates`와 `media_uses`가 비어 있다
  행동  해당 미디어를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.create`를 실행한다
  결과  TPL-8.1  `BAD_REQUEST` 오류를 던진다
        TPL-8.2  `templates` 테이블이 비어 있다
        TPL-8.3  `media_uses` 테이블이 비어 있다
```

## 2. 조회 (`list` · `get`)

```
TPL-9  `templates.list`는 인자를 생략하면 모든 컬렉션의 템플릿을 돌려준다
  전제  서로 다른 두 컬렉션에 템플릿이 하나씩 있다
  행동  인자 없이 `templates.list`를 실행한다
  결과  TPL-9.1  두 컬렉션의 템플릿 두 개를 모두 돌려준다

TPL-10  `templates.list`에 `collection`을 주면 해당 컬렉션의 템플릿만 돌려준다
  전제  서로 다른 두 컬렉션에 템플릿이 하나씩 있다
  행동  첫 번째 `collection`으로 `templates.list`를 실행한다
  결과  TPL-10.1  첫 번째 컬렉션의 템플릿 하나만 돌려준다

TPL-11  `templates.get`은 지정한 `id`의 템플릿을 돌려준다
  전제  템플릿이 두 개 있다
  행동  첫 번째 템플릿의 `id`로 `templates.get`을 실행한다
  결과  TPL-11.1  반환값의 `id`, `collection`, `name`, `content`가 첫 번째 템플릿과 같다

TPL-12  `templates.get`은 없는 `id`이면 `NOT_FOUND`로 거절한다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`로 `templates.get`을 실행한다
  결과  TPL-12.1  `NOT_FOUND` 오류를 던진다
```

## 3. 수정 (`update`)

```
TPL-13  `templates.update`에 `content` 없이 `name`만 주면 이름만 바꾸고 `content`와 `media_uses`를 유지한다
  전제  미디어를 참조하고 `media_uses` 행이 있는 템플릿이 하나 있다
  행동  해당 `id`와 새 `name`만으로 `templates.update`를 실행한다
  결과  TPL-13.1  반환값의 `name`이 새 `name`이고 `collection`과 `content`가 원래 그대로이다
        TPL-13.2  `templates` 테이블의 해당 행이 반환값과 같다
        TPL-13.3  `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

TPL-14  `templates.update`로 `content`를 바꾸면 본문을 갱신하고 해당 템플릿의 `media_uses`만 새 참조로 교체한다
  전제  첫 번째 미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 그리고 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행이 있고, 두 번째 미디어가 있다
  행동  대상 템플릿의 `id`와 두 번째 미디어만 참조하는 새 `content`로 `templates.update`를 실행한다
  결과  TPL-14.1  반환값의 `content`가 새 `content`이고 `name`과 `collection`이 원래 그대로이다
        TPL-14.2  `templates` 테이블에서 대상 템플릿의 행이 반환값과 같다
        TPL-14.3  `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조는 두 번째 미디어와 `field_path` `"content"` 하나뿐이다
        TPL-14.4  `media_uses`에서 다른 템플릿의 기존 참조는 그대로 남아 있다
        TPL-14.5  `media_uses`에서 `entry`의 기존 참조는 그대로 남아 있다

TPL-15  `templates.update`는 같은 `collection`의 다른 템플릿과 `name`이 겹치면 `CONFLICT`로 거절한다
  전제  같은 컬렉션에 템플릿이 두 개 있다
  행동  두 번째 템플릿의 `id`와 첫 번째 템플릿의 `name`으로 `templates.update`를 실행한다
  결과  TPL-15.1  `CONFLICT` 오류를 던진다
        TPL-15.2  `templates` 테이블에서 두 번째 템플릿의 `name`이 원래 그대로이다

TPL-16  `templates.update`는 본문 검증에 실패하면 문제 목록 전체를 `details`에 담아 `BAD_REQUEST`로 거절한다
  전제  스키마에 컬렉션이 하나 있고 `config.blocks`에 사용자 정의 블록이 하나 등록되어 있으며 템플릿이 하나 있다
  행동  해당 `id`와, 그 사용자 정의 블록의 `id`가 비어 있고 두 번째 블록의 `type`이 미등록 블록인 `content`로 `templates.update`를 실행한다
  결과  TPL-16.1  `BAD_REQUEST` 오류를 던진다
        TPL-16.2  오류의 `details`가 같은 `content`와 `config`에 대한 `validateDoc`의 반환값과 같다
        TPL-16.3  `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다

TPL-17  `templates.update`는 본문이 DB에 없는 미디어 `id`를 참조하면 `BAD_REQUEST`로 거절하고 기존 상태를 유지한다
  전제  미디어를 참조하고 `media_uses` 행이 있는 템플릿이 하나 있다
  행동  해당 `id`와 존재하지 않는 UUID를 `attrs.mediaId`로 참조하는 유효한 `content`로 `templates.update`를 실행한다
  결과  TPL-17.1  `BAD_REQUEST` 오류를 던진다
        TPL-17.2  `templates` 테이블에서 해당 행의 `content`가 원래 그대로이다
        TPL-17.3  `media_uses`에 해당 템플릿의 기존 참조가 그대로 남아 있다

TPL-18  `templates.update`는 없는 `id`이면 `NOT_FOUND`로 거절한다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`와 새 `name`으로 `templates.update`를 실행한다
  결과  TPL-18.1  `NOT_FOUND` 오류를 던진다
```

## 4. 삭제 (`delete`)

```
TPL-19  `templates.delete`는 해당 템플릿과 그 템플릿의 `media_uses`만 지운다
  전제  미디어를 참조하고 각각 `media_uses` 행이 있는 대상 템플릿과 다른 템플릿, 그리고 대상 템플릿과 같은 `source_id`를 가진 `entry`의 `media_uses` 행이 있다
  행동  대상 템플릿의 `id`로 `templates.delete`를 실행한다
  결과  TPL-19.1  `templates` 테이블에 다른 템플릿 하나만 남아 있다
        TPL-19.2  `media_uses`에서 대상 템플릿(`source_kind`가 `"template"`)의 참조가 사라진다
        TPL-19.3  `media_uses`에서 다른 템플릿의 참조는 그대로 남아 있다
        TPL-19.4  `media_uses`에서 `entry`의 참조는 그대로 남아 있다

TPL-20  `templates.delete`는 없는 `id`이면 `NOT_FOUND`로 거절한다
  전제  템플릿이 하나 있다
  행동  존재하지 않는 UUID `id`로 `templates.delete`를 실행한다
  결과  TPL-20.1  `NOT_FOUND` 오류를 던진다
```
