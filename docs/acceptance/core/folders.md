# `resources/folders/` 인수조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.1절(선택 입력 `id`), 6절(`folders`), 7절(`folders` 리소스)의 인수조건이다.

- `folders.create`: `scope`(컬렉션 키 또는 `"media"`), `name`, 선택적 `parent_id`와 선택적 `id`(UUID)를 받아 폴더를 만든다. 존재하지 않는 `scope`이거나, 부모 폴더가 같은 `scope`의 활성 폴더(`trashed_at`이 `null`)가 아니면 `BAD_REQUEST`로 거절한다.
- `folders.list`: 지정한 `scope`의 폴더 중 `trashed_at`이 `null`인 폴더 목록을 돌려준다.
- `folders.update`: `id`로 폴더의 `name`이나 `parent_id`(`null`이면 루트로 이동)를 바꾼다. 대상 폴더가 없거나 `trashed_at`이 설정되어 있으면 `NOT_FOUND`, 새 부모 폴더가 같은 `scope`의 활성 폴더가 아니거나 자기 자신·자손 폴더이면 `BAD_REQUEST`로 거절한다.

---

```
FLD-1  folders.create는 루트 폴더를 만든다
  전제  스키마에 컬렉션이 하나 있고 folders가 비어 있다
  행동  해당 컬렉션 scope와 name으로 folders.create를 실행한다
  결과  FLD-1.1  반환값의 scope가 전달한 scope와 같다
        FLD-1.2  반환값의 name이 전달한 name과 같다
        FLD-1.3  반환값의 parent_id가 null이다
        FLD-1.4  folders 테이블에 해당 id의 행이 하나 생긴다

FLD-2  folders.create는 부모 폴더 아래에 하위 폴더를 만든다
  전제  스키마에 컬렉션이 하나 있고 해당 scope의 루트 폴더가 하나 있다
  행동  같은 scope와 name, 루트 폴더의 id인 parent_id로 folders.create를 실행한다
  결과  FLD-2.1  반환값의 parent_id가 루트 폴더의 id이다
        FLD-2.2  folders 테이블에서 새 폴더의 parent_id가 루트 폴더의 id이다

FLD-3  folders.create에 선택적 id를 주면 그 id로 폴더를 만든다
  전제  folders가 비어 있다
  행동  scope "media"와 미리 정한 UUID id, name으로 folders.create를 실행한다
  결과  FLD-3.1  반환값의 id가 전달한 id이다
        FLD-3.2  folders 테이블에 해당 id의 행이 하나 생긴다

FLD-4  folders.create는 스키마에 없는 컬렉션 scope이면 BAD_REQUEST로 거절한다
  전제  스키마에 컬렉션이 하나 있고 folders가 비어 있다
  행동  "media"도 아니고 스키마의 collections에도 없는 scope와 name으로 folders.create를 실행한다
  결과  FLD-4.1  BAD_REQUEST 오류를 던진다
        FLD-4.2  folders 테이블은 비어 있다

FLD-5  folders.create는 다른 scope의 폴더를 parent_id로 주면 BAD_REQUEST로 거절한다
  전제  스키마에 컬렉션이 하나 있고 "media" scope의 폴더가 하나 있다
  행동  해당 컬렉션 scope, name, "media" 폴더의 id인 parent_id로 folders.create를 실행한다
  결과  FLD-5.1  BAD_REQUEST 오류를 던진다
        FLD-5.2  folders 테이블의 행은 원래 하나 그대로이다

FLD-6  folders.create는 trashed_at이 설정된 폴더를 parent_id로 주면 BAD_REQUEST로 거절한다
  전제  스키마에 컬렉션이 하나 있고 해당 scope에서 trashed_at이 설정된 폴더가 하나 있다
  행동  해당 컬렉션 scope, name, trashed_at이 설정된 폴더의 id인 parent_id로 folders.create를 실행한다
  결과  FLD-6.1  BAD_REQUEST 오류를 던진다
        FLD-6.2  folders 테이블의 행은 원래 하나 그대로이다

FLD-7  folders.create는 존재하지 않는 parent_id이면 BAD_REQUEST로 거절한다
  전제  스키마에 컬렉션이 하나 있고 folders가 비어 있다
  행동  해당 컬렉션 scope, name, 존재하지 않는 UUID인 parent_id로 folders.create를 실행한다
  결과  FLD-7.1  BAD_REQUEST 오류를 던진다
        FLD-7.2  folders 테이블은 비어 있다

FLD-8  folders.list는 해당 scope에서 trashed_at이 null인 폴더만 돌려준다
  전제  같은 scope에서 trashed_at이 null인 폴더 하나와 trashed_at이 설정된 폴더 하나, 다른 scope의 폴더 하나가 있다
  행동  해당 scope로 folders.list를 실행한다
  결과  FLD-8.1  해당 scope에서 trashed_at이 null인 폴더 하나만 돌려준다

FLD-9  folders.update는 폴더의 이름과 부모 폴더를 바꾼다
  전제  같은 scope의 루트 폴더 두 개가 있다
  행동  두 번째 폴더의 id와 새 name, 첫 번째 폴더의 id인 parent_id로 folders.update를 실행한다
  결과  FLD-9.1  반환값의 name이 새 name이다
        FLD-9.2  반환값의 parent_id가 첫 번째 폴더의 id이다
        FLD-9.3  folders 테이블에서 두 번째 폴더의 name이 새 name이다
        FLD-9.4  folders 테이블에서 두 번째 폴더의 parent_id가 첫 번째 폴더의 id이다

FLD-10  folders.update에 parent_id 없이 name만 주면 이름만 바꾸고 기존 parent_id는 유지한다
  전제  루트 폴더와 그 하위 폴더가 있다
  행동  하위 폴더의 id와 새 name만으로 folders.update를 실행한다
  결과  FLD-10.1  반환값의 name이 새 name이다
        FLD-10.2  반환값의 parent_id가 루트 폴더의 id 그대로이다
        FLD-10.3  folders 테이블에서 하위 폴더의 name이 새 name이다
        FLD-10.4  folders 테이블에서 하위 폴더의 parent_id가 루트 폴더의 id 그대로이다

FLD-11  folders.update에 parent_id를 null로 주면 루트 폴더로 이동한다
  전제  루트 폴더와 그 하위 폴더가 있다
  행동  하위 폴더의 id와 parent_id null로 folders.update를 실행한다
  결과  FLD-11.1  반환값의 parent_id가 null이다
        FLD-11.2  folders 테이블에서 하위 폴더의 parent_id가 null이다

FLD-12  folders.update는 자기 자신 아래로 이동하면 BAD_REQUEST로 거절한다
  전제  루트 폴더가 하나 있다
  행동  루트 폴더의 parent_id를 자기 자신의 id로 바꾸는 folders.update를 실행한다
  결과  FLD-12.1  BAD_REQUEST 오류를 던진다
        FLD-12.2  folders 테이블에서 루트 폴더의 parent_id가 null 그대로이다

FLD-13  folders.update는 자손 폴더 아래로 이동하면 BAD_REQUEST로 거절한다
  전제  루트 폴더, 그 하위 폴더, 그 하위 폴더의 하위 폴더(손자 폴더)가 차례로 있다
  행동  루트 폴더의 parent_id를 손자 폴더의 id로 바꾸는 folders.update를 실행한다
  결과  FLD-13.1  BAD_REQUEST 오류를 던진다
        FLD-13.2  folders 테이블에서 루트 폴더의 parent_id가 null 그대로이다

FLD-14  folders.update는 다른 scope의 폴더를 parent_id로 주면 BAD_REQUEST로 거절한다
  전제  컬렉션 scope의 폴더 하나와 "media" scope의 폴더 하나가 있다
  행동  컬렉션 폴더의 parent_id를 "media" 폴더의 id로 바꾸는 folders.update를 실행한다
  결과  FLD-14.1  BAD_REQUEST 오류를 던진다
        FLD-14.2  folders 테이블에서 컬렉션 폴더의 parent_id가 null 그대로이다

FLD-15  folders.update는 trashed_at이 설정된 폴더를 parent_id로 주면 BAD_REQUEST로 거절한다
  전제  같은 scope에 trashed_at이 null인 폴더 하나와 trashed_at이 설정된 폴더 하나가 있다
  행동  활성 폴더의 parent_id를 trashed_at이 설정된 폴더의 id로 바꾸는 folders.update를 실행한다
  결과  FLD-15.1  BAD_REQUEST 오류를 던진다
        FLD-15.2  folders 테이블에서 활성 폴더의 parent_id가 null 그대로이다

FLD-16  folders.update는 존재하지 않는 parent_id로 이동하면 BAD_REQUEST로 거절한다
  전제  루트 폴더가 하나 있다
  행동  루트 폴더의 parent_id를 존재하지 않는 UUID로 바꾸는 folders.update를 실행한다
  결과  FLD-16.1  BAD_REQUEST 오류를 던진다
        FLD-16.2  folders 테이블에서 루트 폴더의 parent_id가 null 그대로이다

FLD-17  folders.update는 trashed_at이 설정된 폴더이면 NOT_FOUND로 거절한다
  전제  trashed_at이 설정된 폴더가 하나 있다
  행동  해당 폴더의 id와 새 name으로 folders.update를 실행한다
  결과  FLD-17.1  NOT_FOUND 오류를 던진다
        FLD-17.2  folders 테이블에서 해당 폴더의 name이 원래 name 그대로이다

FLD-18  folders.update는 존재하지 않는 id이면 NOT_FOUND로 거절한다
  전제  folders가 비어 있다
  행동  존재하지 않는 UUID id와 새 name으로 folders.update를 실행한다
  결과  FLD-18.1  NOT_FOUND 오류를 던진다
        FLD-18.2  folders 테이블은 비어 있다
```
