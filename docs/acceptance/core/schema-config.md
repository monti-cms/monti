# `resources/schema/` · `resources/config/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`ReadContext`, `WriteContext`, `MontiConfig`), 4절(컨텍스트와 설정), 6.1~6.2절(컬렉션 테이블과 8종 필드 매핑, 스키마 변경), 7절(`schema`, `config` 리소스), 8절(`state.ts`, `schema-file.ts`, `config-file.ts`)의 인수 조건이다.

- `schema.get`: 현재 스키마(`ctx.schema`)를 돌려준다.
- `schema.update`: 개발 서버(`config.dev: true`)에서만 스키마를 바꾸고, 같은 트랜잭션 안에서 컬렉션별 테이블(`<collection>`, `<collection>_data`, `<collection>_rels`)과 필드 열을 DB에 맞춘 뒤 커밋 직후 공유 상태와 스키마 파일에 반영한다. 정의된 8종 필드(`text`·`number`·`boolean`·`date`·`select`·`media`·`relation`·`conditional`) 외의 `type`이거나 예약어 컬렉션 키(`templates`, `folders`, `media`, `media_uses`, `loose_files`, `admin`, `session`, `api_keys`, `migrations`, 또는 `_data`·`_rels`로 끝나는 이름)이면 `BAD_REQUEST`, 개발 서버가 아니면 `FORBIDDEN`으로 거절하며, 롤백·`dryRun`이면 DB 테이블과 공유 상태·파일을 바꾸지 않는다.
- `config.get`: 현재 사이트 설정(`ctx.config`)을 돌려준다.
- `config.update`: 개발 서버에서만 사이트 `name`을 바꾸고 커밋 뒤에 공유 상태와 설정 파일에 반영한다. 개발 서버가 아니면 `FORBIDDEN`으로 거절하며, 롤백·`dryRun`이면 공유 상태와 파일을 바꾸지 않는다.

---

## 1. 스키마 조회 (`schema.get`)

```
SCH-GET-1  현재 스키마를 돌려준다
  전제  초기 스키마로 엔진이 생성되어 있다
  행동  `schema.get`을 실행한다
  결과  SCH-GET-1.1  현재 스키마를 돌려준다
```

## 2. 스키마 수정 (`schema.update`)

```
SCH-UPD-1  개발 서버에서 스키마를 바꾸면 현재 스키마와 스키마 파일에 새 스키마가 기록된다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  새 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-1.1  반환값이 새 스키마이다
        SCH-UPD-1.2  `schema.get`을 실행하면 새 스키마를 돌려준다
        SCH-UPD-1.3  스키마 파일에서 읽은 값이 새 스키마이다

SCH-UPD-2  컬렉션을 추가하면 글 기본 테이블과 글자·숫자·참거짓·날짜·선택지 열을 가진 데이터 테이블이 만들어진다
  전제  `config.dev`가 `true`이고 초기 스키마에 컬렉션이 없다
  행동  `body: true`와 `text`, `number`, `boolean`, `date`, 단건·다건 `select` 필드를 가진 `posts` 컬렉션 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-2.1  `posts` 테이블에 `id`, `source_locale`, `folder_id`, `trashed_at` 열이 있다
        SCH-UPD-2.2  `posts_data` 테이블에 `entry_id`, `locale`, `status`, `slug`, `published_at`, `translation_seen`, `body`와 각 필드 열이 있다

SCH-UPD-3  하나를 고르는 미디어·관계 필드는 데이터 테이블의 외래 키 열로 만들어진다
  전제  `config.dev`가 `true`이고 `authors` 컬렉션이 있는 스키마가 적용되어 있다
  행동  단건 `media` 필드(`cover`)와 `authors`를 가리키는 단건 `relation` 필드(`author`)를 가진 `posts` 컬렉션 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-3.1  `posts_data` 테이블에 `media(id)`를 참조하는 `cover` 열이 있다
        SCH-UPD-3.2  `posts_data` 테이블에 `authors(id)`를 참조하는 `author` 열이 있다

SCH-UPD-4  여러 개를 고르는 미디어·관계 필드는 순서를 저장하는 연결 테이블로 만들어진다
  전제  `config.dev`가 `true`이고 `tags` 컬렉션이 있는 스키마가 적용되어 있다
  행동  `many: true`인 `media` 필드와 `tags`를 가리키는 `many: true`인 `relation` 필드를 가진 `posts` 컬렉션 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-4.1  `posts_rels` 테이블에 `entry_id`, `locale`, `status`, `path`, `position`, `media_id`, `tags_id` 열이 있다

SCH-UPD-5  조건부 필드는 선택한 분기 열과 각 분기의 하위 입력칸 열로 펼쳐져 만들어진다
  전제  `config.dev`가 `true`이고 초기 스키마에 컬렉션이 없다
  행동  `yes` 분기에 숫자 하위 필드(`price`)를 가진 `conditional` 필드(`discount`)가 있는 `products` 컬렉션 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-5.1  `products_data` 테이블에 선택한 분기를 담는 `discount` 열이 있다
        SCH-UPD-5.2  `products_data` 테이블에 하위 필드 값을 담는 `discount__yes__price` 열이 있다

SCH-UPD-6  컬렉션에 필드를 새로 넣으면 열이 추가되고 기존 필드를 빼면 열이 삭제된다
  전제  `config.dev`가 `true`이고 `old_field` 열을 가진 `posts` 컬렉션이 적용되어 있다
  행동  `posts`에서 `old_field`를 빼고 `new_field`를 추가한 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-6.1  `posts_data` 테이블에 `new_field` 열이 있다
        SCH-UPD-6.2  `posts_data` 테이블에 `old_field` 열이 없다

SCH-UPD-7  필드의 종류를 바꾸면 데이터 테이블의 열도 새 종류로 바뀐다
  전제  `config.dev`가 `true`이고 숫자 종류의 `code` 필드를 가진 `posts` 컬렉션이 적용되어 있다
  행동  `code` 필드의 종류를 글자(`text`)로 바꾼 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-7.1  `posts_data` 테이블에서 `code` 열의 데이터 타입이 `text`이다

SCH-UPD-8  스키마에서 컬렉션을 지우면 그 컬렉션의 테이블들이 모두 삭제된다
  전제  `config.dev`가 `true`이고 `posts` 컬렉션이 적용되어 `posts`, `posts_data`, `posts_rels` 테이블이 있다
  행동  `posts` 컬렉션을 제거한 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-8.1  DB에 `posts`, `posts_data`, `posts_rels` 테이블이 없다

SCH-UPD-9  개발 서버가 아니면 스키마를 수정할 수 없다
  전제  `config.dev`가 `false`이고 초기 스키마 파일이 있다
  행동  새 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-9.1  `FORBIDDEN` 오류를 던진다
        SCH-UPD-9.2  `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-9.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-UPD-10  트랜잭션이 실패해 롤백되면 DB 테이블과 스키마 파일은 원래대로 유지된다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  `transaction` 안에서 새 컬렉션이 추가된 스키마로 `schema.update`를 실행한 뒤 오류를 던져 롤백시킨다
  결과  SCH-UPD-10.1  롤백된 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-10.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다
        SCH-UPD-10.3  DB에 새 컬렉션의 테이블이 없다

SCH-UPD-11  드라이런으로 실행하면 DB 테이블과 스키마 파일은 원래대로 유지된다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  `dryRun` 안에서 새 컬렉션이 추가된 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-11.1  `dryRun`이 끝난 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-11.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다
        SCH-UPD-11.3  DB에 새 컬렉션의 테이블이 없다

SCH-UPD-12  지원하지 않는 필드 종류가 들어 있으면 스키마를 수정할 수 없다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  정의된 8종이 아닌 `type`을 가진 필드가 포함된 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-12.1  `BAD_REQUEST` 오류를 던진다
        SCH-UPD-12.2  `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-12.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-UPD-13  코어 기본 테이블 이름이나 `_data`·`_rels`로 끝나는 이름은 컬렉션 이름으로 쓸 수 없다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  예약어(`media` 또는 `posts_data`)를 컬렉션 키로 가진 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-13.1  `BAD_REQUEST` 오류를 던진다
        SCH-UPD-13.2  `schema.get`을 실행하면 원래 스키마 그대로이다
```

## 3. 설정 조회 (`config.get`)

```
CFG-GET-1  현재 사이트 설정을 돌려준다
  전제  초기 설정으로 엔진이 생성되어 있다
  행동  `config.get`을 실행한다
  결과  CFG-GET-1.1  현재 사이트 설정을 돌려준다
```

## 4. 설정 수정 (`config.update`)

```
CFG-UPD-1  개발 서버에서 사이트 이름을 바꾸고 설정 파일에 기록한다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-1.1  반환값의 `name`이 새 `name`이다
        CFG-UPD-1.2  `config.get`을 실행하면 `name`만 새 `name`으로 바뀐 설정을 돌려준다
        CFG-UPD-1.3  설정 파일의 `name`이 새 `name`으로 바뀐다
        CFG-UPD-1.4  설정 파일에서 `name`을 제외한 나머지 내용은 그대로이다

CFG-UPD-2  개발 서버가 아니면 사이트 설정을 수정할 수 없다
  전제  `config.dev`가 `false`이고 초기 설정 파일이 있다
  행동  새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-2.1  `FORBIDDEN` 오류를 던진다
        CFG-UPD-2.2  `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-2.3  설정 파일의 내용은 원래 그대로이다

CFG-UPD-3  트랜잭션이 실패해 롤백되면 설정과 설정 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  `transaction` 안에서 새 `name`으로 `config.update`를 실행한 뒤 오류를 던져 롤백시킨다
  결과  CFG-UPD-3.1  롤백된 뒤 `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-3.2  설정 파일의 내용은 원래 그대로이다

CFG-UPD-4  드라이런으로 실행하면 설정과 설정 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  `dryRun` 안에서 새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-4.1  `dryRun`이 끝난 뒤 `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-4.2  설정 파일의 내용은 원래 그대로이다
```
