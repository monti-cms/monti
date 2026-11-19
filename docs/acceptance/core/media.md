# `resources/media/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`StorageAdapter`), 6절(`media`, `loose_files`), 7절(`media` 리소스)의 인수 조건이다. `resources/media/uses.ts`는 `templates`·`entries` 단계에서 다룬다.

- `storage`가 설정되지 않은 엔진에서는 `media` 리소스 전체를 `BAD_REQUEST`로 거절한다.
- `media.startUpload`: 새 UUID `key`로 `storage.ticket`을 발급하고 `loose_files`에 24시간 뒤 만료로 기록한다.
- `media.create`: 선택 `__preset_id`(UUID)를 받고 `storage.stat`으로 파일 존재와 `mime_type`을 확인해 `media`에 등록한 뒤 `loose_files`에서 해당 `key`를 지운다.
- `media.list`·`media.get`: `trashed_at`이 `null`인 미디어만 `url`과 함께 돌려준다. `list`의 `folder_id`는 생략=전체, `null`=루트, UUID=해당 폴더 직속이다.
- `media.update`: 단건(`id`)은 `metadata` 전체 교체·폴더 이동·파일 교체(`key` 변경 시 이전 `key`를 `loose_files`에 24시간 대기로 추가)를, 다건(`ids`)은 폴더 일괄 이동(`folder_id`)만 처리한다.

---

```
MED-1  `media.startUpload`는 새 UUID `key`로 업로드 티켓을 발급하고 `loose_files`에 24시간 뒤 만료로 기록한다
  전제  `storage`가 설정되어 있고 `loose_files`가 비어 있다
  행동  `mime_type`과 `size`로 `media.startUpload`를 실행한다
  결과  MED-1.1  반환값의 `key`가 UUID 형식이다
        MED-1.2  `storage.ticket`이 반환된 `key`와 `{ mime, size }`로 호출된다
        MED-1.3  반환값의 `url`과 `headers`가 `storage.ticket`의 결과와 같다
        MED-1.4  `loose_files`에 해당 `key`의 행이 생긴다
        MED-1.5  실행 시각과 해당 행의 `remove_after` 차이가 24시간이다

MED-2  `storage`가 설정되지 않은 엔진에서 `media.startUpload`는 `BAD_REQUEST`로 거절한다
  전제  `storage` 없이 엔진이 생성되어 있고 `loose_files`가 비어 있다
  행동  `mime_type`과 `size`로 `media.startUpload`를 실행한다
  결과  MED-2.1  `BAD_REQUEST` 오류를 던진다
        MED-2.2  `loose_files`가 비어 있다

MED-3  `media.create`는 `storage.stat`으로 파일을 확인해 `media`에 등록하고 해당 `key`만 `loose_files`에서 지운다
  전제  `storage`에 파일이 올라가 있고, 그 `key`와 다른 `key` 하나가 `loose_files`에 들어 있다
  행동  올라간 `key`로 `media.create`를 실행한다
  결과  MED-3.1  반환값의 `key`, `mime_type`(`storage.stat`의 `mime`), `folder_id`(`null`), `metadata`(`{}`)가 일치한다
        MED-3.2  반환값의 `url`이 `storage.url(key)`이다
        MED-3.3  `media` 테이블에 해당 `id`, `key`, `mime_type`, `folder_id`, `metadata`를 가진 행이 저장된다
        MED-3.4  `loose_files`에서 등록한 `key`는 삭제된다
        MED-3.5  `loose_files`에 원래 있던 다른 `key`는 남아 있다

MED-4  `storage`에 없는 `key`로 `media.create`를 실행하면 `BAD_REQUEST`로 거절한다
  전제  `storage`가 설정되어 있고 해당 `key`의 파일이 없으며 `media`가 비어 있다
  행동  없는 `key`로 `media.create`를 실행한다
  결과  MED-4.1  `BAD_REQUEST` 오류를 던진다
        MED-4.2  `media` 테이블이 비어 있다

MED-5  `media`에 이미 있는 `key`(`trashed_at`이 설정된 행 포함)로 `media.create`를 실행하면 `CONFLICT`로 거절한다
  전제  `storage`에 파일이 있고, 같은 `key`를 가진 `trashed_at`이 설정된 `media` 행이 하나 있다
  행동  해당 `key`로 `media.create`를 실행한다
  결과  MED-5.1  `CONFLICT` 오류를 던진다
        MED-5.2  `media` 테이블의 행은 원래 하나 그대로이다

MED-6  `"media"` `scope`가 아닌 폴더를 `folder_id`로 주면 `media.create`는 `BAD_REQUEST`로 거절한다
  전제  `storage`에 파일이 있고, 컬렉션 `scope`의 폴더가 하나 있으며 `media`가 비어 있다
  행동  해당 컬렉션 폴더의 `id`를 `folder_id`로 주어 `media.create`를 실행한다
  결과  MED-6.1  `BAD_REQUEST` 오류를 던진다
        MED-6.2  `media` 테이블이 비어 있다

MED-7  `media.list`는 지정한 `folder_id` 직속의 미디어만 돌려준다
  전제  대상 폴더 직속의 미디어, 그 하위 폴더의 미디어, `folder_id`가 `null`인 미디어가 있다
  행동  `folder_id`로 대상 폴더의 `id`를 주어 `media.list`를 실행한다
  결과  MED-7.1  대상 폴더 직속의 미디어 하나만 돌려준다

MED-8  `media.list`에 `folder_id`를 `null`로 주면 `folder_id`가 `null`인 미디어만 돌려준다
  전제  `folder_id`가 `null`인 미디어와 폴더에 속한 미디어가 있다
  행동  `folder_id: null`로 `media.list`를 실행한다
  결과  MED-8.1  `folder_id`가 `null`인 미디어 하나만 돌려준다

MED-9  `media.list`에 인자를 생략하면 `trashed_at`이 `null`인 전체 미디어를 `url`과 함께 돌려준다
  전제  `storage`가 설정되어 있고, `folder_id`가 `null`인 미디어, 폴더에 속한 미디어, `trashed_at`이 설정된 미디어가 있다
  행동  인자 없이 `media.list`를 실행한다
  결과  MED-9.1  `trashed_at`이 `null`인 미디어 두 개만 돌려준다
        MED-9.2  반환된 각 항목의 `url`이 `storage.url(key)`이다

MED-10  `media.get`은 `trashed_at`이 `null`인 미디어 1건을 `url`과 함께 돌려준다
  전제  `storage`가 설정되어 있고 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `media.get`을 실행한다
  결과  MED-10.1  반환값의 `id`가 해당 미디어의 `id`이다
        MED-10.2  반환값의 `url`이 `storage.url(key)`이다

MED-11  `media.get`은 `trashed_at`이 설정된 미디어이면 `NOT_FOUND`로 거절한다
  전제  `trashed_at`이 설정된 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `media.get`을 실행한다
  결과  MED-11.1  `NOT_FOUND` 오류를 던진다

MED-12  단건 `media.update`는 `metadata`를 통째로 교체하고 생략한 `folder_id`·`key`는 유지한다
  전제  폴더에 속하고 `metadata`가 들어 있는 미디어가 하나 있다
  행동  `id`와 기존 키가 없는 새 `metadata`만으로 `media.update`를 실행한다
  결과  MED-12.1  반환값의 `metadata`가 기존 키 없이 새 값이다
        MED-12.2  반환값의 `folder_id`가 원래 그대로이다
        MED-12.3  반환값의 `key`가 원래 그대로이다
        MED-12.4  `media` 테이블에서 해당 행의 `metadata`가 새 값이다

MED-13  단건 `media.update`로 새 `key`를 교체하면 `mime_type`·`url`을 갱신하고 이전 `key`를 `loose_files`에 넣는다
  전제  `storage`에 다른 `mime`의 새 `key`가 올라가 있고 `loose_files`에 들어 있으며, 기존 미디어가 하나 있다
  행동  `id`와 새 `key`로 `media.update`를 실행한다
  결과  MED-13.1  반환값의 `key`와 `mime_type`(새 파일의 `storage.stat` `mime`)이 갱신된다
        MED-13.2  반환값의 `url`이 새 `key`의 `storage.url`이다
        MED-13.3  `media` 테이블에서 해당 행의 `key`와 `mime_type`이 새 값으로 바뀐다
        MED-13.4  `loose_files`에서 새 `key`는 삭제된다
        MED-13.5  `loose_files`에 이전 `key`의 행이 생긴다
        MED-13.6  실행 시각과 이전 `key` 행의 `remove_after` 차이가 24시간이다

MED-14  다건 `media.update`는 지정한 `ids`를 한 폴더(`folder_id`)로 일괄 이동한다
  전제  폴더에 속하지 않은 미디어 두 개와 `"media"` `scope`의 폴더가 하나 있다
  행동  두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
  결과  MED-14.1  반환 목록이 요청한 두 미디어의 `{ id, folder_id: 새 folder_id }`로 이루어진다
        MED-14.2  `media` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

MED-15  다건 `media.update`에서 대상 중 하나라도 `trashed_at`이 설정되어 있으면 `NOT_FOUND`로 전체 롤백한다
  전제  폴더에 속하지 않은 `trashed_at`이 `null`인 미디어 하나, `trashed_at`이 설정된 미디어 하나, `"media"` `scope`의 폴더가 하나 있다
  행동  두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
  결과  MED-15.1  `NOT_FOUND` 오류를 던진다
        MED-15.2  `media` 테이블에서 `trashed_at`이 `null`인 미디어의 `folder_id`가 `null` 그대로이다

MED-16  `media.create`에 `__preset_id`를 주면 지정한 `id`로 미디어를 등록한다
  전제  `storage`에 파일이 올라가 있고 `media`가 비어 있다
  행동  미리 정한 UUID `__preset_id`와 올라간 `key`로 `media.create`를 실행한다
  결과  MED-16.1  반환값의 `id`가 전달한 `__preset_id`이다
        MED-16.2  `media` 테이블에 해당 `id`의 행이 하나 생긴다
```
