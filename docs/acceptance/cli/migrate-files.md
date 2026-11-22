# `migrate/files.ts` 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 5.1~5.2절(스냅샷 기반 운영 마이그레이션 파일 생성)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `generateMigration` | `migrations/_snapshot.json`과 현재 스키마의 차이를 `core`의 `planSchemaDiff`로 계산해 다음 4자리 번호 `.sql` 파일을 만들고 `_snapshot.json`을 원자적으로 갱신한다 (`--dry-run`이면 디스크에 쓰지 않고 SQL만 반환) | 잘못된 스키마 시 `BAD_REQUEST` |
| `listMigrationFiles` | `migrations/*.sql` 파일 목록을 파일명 오름차순으로 돌려준다(폴더가 없으면 빈 배열) | 없음 |

---

## 1. 마이그레이션 파일 생성 (`generateMigration`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-MGF-1</code></strong> 처음 마이그레이션을 만들면 `0001_<이름>.sql` 파일과 `_snapshot.json`을 저장한다</summary>

- **전제**: 빈 임시 디렉터리와 `posts` 컬렉션이 정의된 스키마가 있다
- **행동**: 이름 `"init posts"`로 `generateMigration`을 실행한다
- **결과**:
  - `CLI-MGF-1.1` 반환된 파일 이름이 `"0001_init_posts.sql"`이고 `sql` 문자열이 비어 있지 않다
  - `CLI-MGF-1.2` 디렉터리에 `0001_init_posts.sql` 파일이 생성되고 `posts` 테이블 생성 SQL이 들어 있다
  - `CLI-MGF-1.3` 디렉터리에 `_snapshot.json` 파일이 생성되고 `snapshotOf(schema)`와 같은 JSON이 들어 있다

</details>

<details>
<summary><strong><code>CLI-MGF-2</code></strong> 기존 마이그레이션이 있으면 다음 4자리 번호로 변경분 SQL 파일을 추가하고 `_snapshot.json`을 갱신한다</summary>

- **전제**: `0001_init_posts.sql`과 직전 `_snapshot.json`이 있는 디렉터리에서, `posts` 컬렉션에 새 `text` 필드 `subtitle`을 추가한 스키마가 있다
- **행동**: 이름을 생략해 `generateMigration`을 실행한다
- **결과**:
  - `CLI-MGF-2.1` 반환된 파일 이름이 `"0002_schema_update.sql"`이다
  - `CLI-MGF-2.2` `0002_schema_update.sql`에 `subtitle` 열 추가 SQL만 들어 있고 `posts` 테이블 생성 SQL은 다시 들어 있지 않다
  - `CLI-MGF-2.3` `_snapshot.json`이 `subtitle`이 포함된 최신 `snapshotOf(schema)`로 갱신된다

</details>

<details>
<summary><strong><code>CLI-MGF-3</code></strong> 스키마가 직전 `_snapshot.json`과 같으면 새 `.sql` 파일을 만들지 않는다</summary>

- **전제**: `0001_init_posts.sql`과 같은 스키마의 `_snapshot.json`이 이미 저장되어 있다
- **행동**: 같은 스키마로 `generateMigration`을 실행한다
- **결과**:
  - `CLI-MGF-3.1` 반환값이 변경 없음(`null`)이다
  - `CLI-MGF-3.2` 디렉터리에 `0001_init_posts.sql` 외의 새 `.sql` 파일이 생기지 않는다

</details>

<details>
<summary><strong><code>CLI-MGF-4</code></strong> `--dry-run`으로 마이그레이션을 만들면 파일을 쓰지 않고 생성될 SQL만 돌려준다</summary>

- **전제**: 빈 임시 디렉터리와 `posts` 컬렉션이 정의된 스키마가 있다
- **행동**: `dryRun: true` 옵션으로 `generateMigration`을 실행한다
- **결과**:
  - `CLI-MGF-4.1` 반환값에 생성될 `sql` 문자열이 들어 있다
  - `CLI-MGF-4.2` 디렉터리에 `.sql` 파일과 `_snapshot.json`이 모두 생성되지 않는다

</details>
