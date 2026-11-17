# 객체 저장소 연결 이관 기록

상태: 외부 어댑터 유지, core 계약 연결 작업 대기 (2026-11-18).

## 1. core와 어댑터의 경계

- core는 `StorageAdapter` 계약과 미디어 Operation, `loose_files` 삭제 대기 데이터를 관리한다. 실제 S3·R2 API 호출·인증·URL 발급은 `@monti-cms/storage-s3` 같은 외부 어댑터가 구현한다.
- 연결은 `defineConfig({ storage: ... })`로 한다. 옛 `Plugin.storage` 슬롯을 복원하지 않는다.
- 저장소는 선택 사항이다. 미설정 상태에서 저장소가 필요한 Operation을 직접 호출하면 core가 `MontiError`로 거절한다.
- `localFolderStorage`와 core의 로컬 파일 서빙 라우트는 폐기한다. 외부에서 같은 기능을 자동 재구현하지 않는다. 테스트용 메모리 저장소는 core의 `__test__/`에 둔다.
- core의 `sealed`, `ticket_size`, 파일 재복사 경로를 복원하지 않는다. 고아 파일은 `loose_files(key, remove_after)` 계약을 따른다.

## 2. 테스트 계획 전에 정할 것

- 확정될 `StorageAdapter`와 기존 업로드·URL 처리의 대응.
- `loose_files`의 실제 삭제 시점·실행 주체와 실패 처리. 이는 core의 미디어·휴지통 Operation 설계와 함께 정하며 `dryRun`에서 외부 삭제를 실행하지 않는다(T312).

기존 저장소 패키지 구현을 core 안으로 가져오거나, 저장소가 없을 때 자동으로 로컬 디스크를 사용하는 길을 만들지 않는다.
