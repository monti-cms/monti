# `resources/media/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`StorageAdapter`), 6절(`media`, `loose_files`), 7절(`media` 리소스)의 인수 조건이다. `resources/media/uses.ts`는 `templates`·`entries` 단계에서 다룬다.

- `storage`가 설정되지 않은 엔진에서는 `media` 리소스 전체를 `BAD_REQUEST`로 거절한다.
- `media.startUpload`: 새 UUID `key`로 `storage.ticket`을 발급하고 `loose_files`에 24시간 뒤 만료로 기록한다.
- `media.create`: 선택 `__preset_id`(UUID)를 받고 `storage.stat`으로 파일 존재와 `mime_type`을 확인해 `media`에 등록한 뒤 `loose_files`에서 해당 `key`를 지운다. 스토리지에 없는 `key`나 `"media"` 범위가 아닌 폴더면 `BAD_REQUEST`, 이미 등록된 `key`(휴지통 포함)면 `CONFLICT`로 거절한다.
- `media.list`·`media.get`: 활성 미디어만 `url`과 함께 돌려준다. `list`의 `folder_id`는 생략=전체, `null`=루트, UUID=해당 폴더 직속이며, `get`은 없거나 휴지통에 있으면 `NOT_FOUND`로 거절한다.
- `media.update`: 단건(`id`)은 `metadata` 전체 교체·폴더 이동·파일 교체(`key` 변경 시 이전 `key`를 `loose_files`에 24시간 대기로 추가)를, 다건(`ids`)은 폴더 일괄 이동(`folder_id`)만 처리하며 대상 중 하나라도 휴지통에 있으면 `NOT_FOUND`로 전체 롤백한다.
- `removeLooseFiles({ db, storage })`: `resources/media/`의 함수로 `trash`나 `media`의 Operation이 아니며, 삭제 대기 시각(`remove_after`)이 지난 `loose_files` 행의 `key`만 `storage.remove`로 지워 목록에서 빼고 지우지 못한 `key`는 목록에 남긴 채 나머지를 계속 지운다. Operation이 아니라서 `transaction`·`dryRun` 블록 안에서는 부를 수 없다.

---

## 1. 업로드 시작 (`startUpload`)

```
MED-UPL-1  새 키로 업로드 티켓을 발급하고 임시 파일 목록에 24시간 뒤 만료로 기록한다
  전제  `storage`가 설정되어 있고 `loose_files`가 비어 있다
  행동  `mime_type`과 `size`로 `media.startUpload`를 실행한다
  결과  MED-UPL-1.1  반환값의 `key`가 UUID 형식이다
        MED-UPL-1.2  `storage.ticket`이 반환된 `key`와 `{ mime, size }`로 호출된다
        MED-UPL-1.3  반환값의 `url`과 `headers`가 `storage.ticket`의 결과와 같다
        MED-UPL-1.4  `loose_files`에 해당 `key`의 행이 생긴다
        MED-UPL-1.5  실행 시각과 해당 행의 `remove_after` 차이가 24시간이다

MED-UPL-2  스토리지가 설정되지 않은 엔진에서는 `BAD_REQUEST`로 업로드를 거절한다
  전제  `storage` 없이 엔진이 생성되어 있고 `loose_files`가 비어 있다
  행동  `mime_type`과 `size`로 `media.startUpload`를 실행한다
  결과  MED-UPL-2.1  `BAD_REQUEST` 오류를 던진다
        MED-UPL-2.2  `loose_files`가 비어 있다
```

## 2. 생성 (`create`)

```
MED-CRT-1  스토리지 파일을 확인해 미디어로 등록하고 임시 목록에서 해당 키만 지운다
  전제  `storage`에 파일이 올라가 있고, 그 `key`와 다른 `key` 하나가 `loose_files`에 들어 있다
  행동  올라간 `key`로 `media.create`를 실행한다
  결과  MED-CRT-1.1  반환값의 `key`, `mime_type`(`storage.stat`의 `mime`), `folder_id`(`null`), `metadata`(`{}`)가 일치한다
        MED-CRT-1.2  반환값의 `url`이 `storage.url(key)`이다
        MED-CRT-1.3  `media` 테이블에 해당 `id`, `key`, `mime_type`, `folder_id`, `metadata`를 가진 행이 저장된다
        MED-CRT-1.4  `loose_files`에서 등록한 `key`는 삭제된다
        MED-CRT-1.5  `loose_files`에 원래 있던 다른 `key`는 남아 있다

MED-CRT-2  지정한 ID로 미디어를 등록한다
  전제  `storage`에 파일이 올라가 있고 `media`가 비어 있다
  행동  미리 정한 UUID `__preset_id`와 올라간 `key`로 `media.create`를 실행한다
  결과  MED-CRT-2.1  반환값의 `id`가 전달한 `__preset_id`이다
        MED-CRT-2.2  `media` 테이블에 해당 `id`의 행이 하나 생긴다

MED-CRT-3  스토리지에 없는 키로 등록하려 하면 `BAD_REQUEST`로 거절한다
  전제  `storage`가 설정되어 있고 해당 `key`의 파일이 없으며 `media`가 비어 있다
  행동  없는 `key`로 `media.create`를 실행한다
  결과  MED-CRT-3.1  `BAD_REQUEST` 오류를 던진다
        MED-CRT-3.2  `media` 테이블이 비어 있다

MED-CRT-4  이미 등록된 키(휴지통 포함)로 등록하려 하면 `CONFLICT`로 거절한다
  전제  `storage`에 파일이 있고, 같은 `key`를 가진 휴지통(`trashed_at` 설정) `media` 행이 하나 있다
  행동  해당 `key`로 `media.create`를 실행한다
  결과  MED-CRT-4.1  `CONFLICT` 오류를 던진다
        MED-CRT-4.2  `media` 테이블의 행은 원래 하나 그대로이다

MED-CRT-5  미디어 범위가 아닌 폴더에 등록하려 하면 `BAD_REQUEST`로 거절한다
  전제  `storage`에 파일이 있고, 컬렉션 `scope`의 폴더가 하나 있으며 `media`가 비어 있다
  행동  해당 컬렉션 폴더의 `id`를 `folder_id`로 주어 `media.create`를 실행한다
  결과  MED-CRT-5.1  `BAD_REQUEST` 오류를 던진다
        MED-CRT-5.2  `media` 테이블이 비어 있다
```

## 3. 조회 (`list` · `get`)

```
MED-READ-1  지정한 폴더 직속의 미디어만 돌려준다
  전제  대상 폴더 직속의 미디어, 그 하위 폴더의 미디어, `folder_id`가 `null`인 미디어가 있다
  행동  `folder_id`로 대상 폴더의 `id`를 주어 `media.list`를 실행한다
  결과  MED-READ-1.1  대상 폴더 직속의 미디어 하나만 돌려준다

MED-READ-2  폴더를 비워 조회하면 루트 미디어만 돌려준다
  전제  `folder_id`가 `null`인 미디어와 폴더에 속한 미디어가 있다
  행동  `folder_id: null`로 `media.list`를 실행한다
  결과  MED-READ-2.1  `folder_id`가 `null`인 미디어 하나만 돌려준다

MED-READ-3  조건 없이 조회하면 모든 활성 미디어를 URL과 함께 돌려준다
  전제  `storage`가 설정되어 있고, 루트 미디어, 폴더에 속한 미디어, 휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 있다
  행동  인자 없이 `media.list`를 실행한다
  결과  MED-READ-3.1  `trashed_at`이 `null`인 미디어 두 개만 돌려준다
        MED-READ-3.2  반환된 각 항목의 `url`이 `storage.url(key)`이다

MED-READ-4  활성 미디어 1건을 URL과 함께 돌려준다
  전제  `storage`가 설정되어 있고 활성 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `media.get`을 실행한다
  결과  MED-READ-4.1  반환값의 `id`가 해당 미디어의 `id`이다
        MED-READ-4.2  반환값의 `url`이 `storage.url(key)`이다

MED-READ-5  휴지통에 있는 미디어는 `NOT_FOUND`로 조회를 거절한다
  전제  휴지통에 들어가 있는(`trashed_at` 설정) 미디어가 하나 있다
  행동  해당 미디어의 `id`로 `media.get`을 실행한다
  결과  MED-READ-5.1  `NOT_FOUND` 오류를 던진다
```

## 4. 수정 (`update`)

```
MED-UPD-1  단건 수정에서 메타데이터만 주면 통째로 교체하고 폴더와 파일 키는 유지한다
  전제  폴더에 속하고 `metadata`가 들어 있는 미디어가 하나 있다
  행동  `id`와 기존 키가 없는 새 `metadata`만으로 `media.update`를 실행한다
  결과  MED-UPD-1.1  반환값의 `metadata`가 기존 키 없이 새 값이다
        MED-UPD-1.2  반환값의 `folder_id`가 원래 그대로이다
        MED-UPD-1.3  반환값의 `key`가 원래 그대로이다
        MED-UPD-1.4  `media` 테이블에서 해당 행의 `metadata`가 새 값이다

MED-UPD-2  단건 수정에서 새 파일 키로 교체하면 MIME·URL을 갱신하고 이전 키를 임시 목록에 넣는다
  전제  `storage`에 다른 `mime`의 새 `key`가 올라가 있고 `loose_files`에 들어 있으며, 기존 미디어가 하나 있다
  행동  `id`와 새 `key`로 `media.update`를 실행한다
  결과  MED-UPD-2.1  반환값의 `key`와 `mime_type`(새 파일의 `storage.stat` `mime`)이 갱신된다
        MED-UPD-2.2  반환값의 `url`이 새 `key`의 `storage.url`이다
        MED-UPD-2.3  `media` 테이블에서 해당 행의 `key`와 `mime_type`이 새 값으로 바뀐다
        MED-UPD-2.4  `loose_files`에서 새 `key`는 삭제된다
        MED-UPD-2.5  `loose_files`에 이전 `key`의 행이 생긴다
        MED-UPD-2.6  실행 시각과 이전 `key` 행의 `remove_after` 차이가 24시간이다

MED-UPD-3  다건 수정은 지정한 미디어들을 한 폴더로 일괄 이동한다
  전제  폴더에 속하지 않은 미디어 두 개와 `"media"` `scope`의 폴더가 하나 있다
  행동  두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
  결과  MED-UPD-3.1  반환 목록이 요청한 두 미디어의 `{ id, folder_id: 새 folder_id }`로 이루어진다
        MED-UPD-3.2  `media` 테이블에서 두 행 모두 `folder_id`가 새 `folder_id`이다

MED-UPD-4  다건 수정 대상 중 하나라도 휴지통에 있으면 `NOT_FOUND`로 전체 롤백한다
  전제  폴더에 속하지 않은 활성 미디어 하나, 휴지통에 들어가 있는(`trashed_at` 설정) 미디어 하나, `"media"` `scope`의 폴더가 하나 있다
  행동  두 미디어의 `ids`와 해당 `folder_id`로 `media.update`를 실행한다
  결과  MED-UPD-4.1  `NOT_FOUND` 오류를 던진다
        MED-UPD-4.2  `media` 테이블에서 활성 미디어의 `folder_id`가 `null` 그대로이다
```

## 5. 임시 파일 정리 (`removeLooseFiles`)

```
MED-CLN-1  임시 파일 정리는 삭제 대기 시각이 지난 임시 파일만 스토리지에서 지우고 목록에서 뺀다
  전제  `storage`가 설정되어 있고, 삭제 대기 시각(`remove_after`)이 지금보다 앞선 `loose_files` 행과 뒤인 행이 하나씩 있다
  행동  `removeLooseFiles({ db, storage })`를 실행한다
  결과  MED-CLN-1.1  앞선 행의 `key`로 스토리지의 `remove`를 호출하고 `loose_files` 테이블에서 그 행이 없다
        MED-CLN-1.2  뒤인 행은 `loose_files` 테이블에 원래 그대로 있고 그 `key`로는 `remove`를 호출하지 않는다

MED-CLN-2  스토리지에서 지우지 못한 임시 파일은 목록에 남기고 나머지는 계속 지운다
  전제  `storage`가 설정되어 있고, 삭제 대기 시각이 지금보다 앞선 `loose_files` 행이 둘 있으며 스토리지가 그중 한 `key`를 지울 때만 오류를 던진다
  행동  `removeLooseFiles({ db, storage })`를 실행한다
  결과  MED-CLN-2.1  지울 수 있었던 `key`의 행은 `loose_files` 테이블에서 없어진다
        MED-CLN-2.2  지우지 못한 `key`의 행은 `loose_files` 테이블에 그대로 남는다
        MED-CLN-2.3  오류를 던지지 않는다
```
