# `engine/` 인수 조건

```
ENG-1  읽기 Operation을 직접 호출하면 트랜잭션 없이 실행한다
  전제  DB에서 행을 조회하는 읽기 Operation과 `onEvent` 구독자가 등록되어 있다
  행동  유효한 입력으로 읽기 Operation을 호출한다
  결과  ENG-1.1  트랜잭션 없이(`ctx.db.isTransaction === false`) `run`이 실행된다
        ENG-1.2  `run`이 조회한 결과가 반환된다
        ENG-1.3  `onEvent` 구독자가 호출되지 않는다

ENG-2  쓰기 Operation을 직접 호출하면 트랜잭션 안에서 실행하고 커밋 뒤 이벤트를 통지한다
  전제  DB에 행을 추가하는 쓰기 Operation과 `onEvent` 구독자가 등록되어 있다
  행동  유효한 입력으로 쓰기 Operation을 호출한다
  결과  ENG-2.1  트랜잭션 안에서(`ctx.db.isTransaction === true`) `run`이 실행된다
        ENG-2.2  DB에 행이 커밋된다
        ENG-2.3  `run`의 결과가 반환된다
        ENG-2.4  커밋된 뒤 `onEvent` 구독자가 키 경로(`operation`)와 `{ operation, input, output }`으로 호출된다

ENG-3  입력이 스키마에 맞지 않으면 `BAD_REQUEST` 오류를 던지고 실행하지 않는다
  전제  입력 스키마가 있는 쓰기 Operation과 `onEvent` 구독자가 등록되어 있다
  행동  스키마에 맞지 않는 입력으로 Operation을 호출한다
  결과  ENG-3.1  `code`가 `"BAD_REQUEST"`인 `MontiError`가 던져진다
        ENG-3.2  `run`이 실행되지 않는다
        ENG-3.3  `onEvent` 구독자가 호출되지 않는다

ENG-4  쓰기 Operation이 실행 중 실패하면 트랜잭션을 롤백하고 이벤트를 통지하지 않는다
  전제  DB에 행을 추가한 뒤 오류를 던지는 쓰기 Operation과 `onEvent` 구독자가 등록되어 있다
  행동  해당 쓰기 Operation을 호출한다
  결과  ENG-4.1  오류가 던져진다
        ENG-4.2  추가했던 행이 DB에 남아 있지 않는다
        ENG-4.3  `onEvent` 구독자가 호출되지 않는다

ENG-5  `onEvent` 구독자의 오류가 쓰기 결과와 다른 구독자의 통지를 막지 않는다
  전제  동기 예외를 던지는 구독자, 실패하는 Promise를 돌려주는 구독자, 정상 구독자가 순서대로 등록되어 있다
  행동  쓰기 Operation을 호출한다
  결과  ENG-5.1  `run`의 결과가 반환된다
        ENG-5.2  DB에 행이 커밋된다
        ENG-5.3  정상 구독자가 이벤트를 받는다

ENG-6  해제한 `onEvent` 구독자는 통지를 받지 않는다
  전제  `onEvent`로 등록한 구독자를 반환된 함수로 해제했다
  행동  쓰기 Operation을 호출한다
  결과  ENG-6.1  해제한 구독자가 호출되지 않는다

ENG-7  `transaction` 블록 안의 호출은 한 트랜잭션을 공유하고 커밋된 뒤 호출 순서대로 이벤트를 통지한다
  전제  DB에 행을 추가하는 쓰기 두 개, 행을 조회하는 읽기, `onEvent` 구독자가 등록되어 있다
  행동  `monti.transaction` 안에서 `tx`로 첫 번째 쓰기, 읽기, 두 번째 쓰기를 순서대로 호출한다
  결과  ENG-7.1  세 호출 모두 같은 트랜잭션(`ctx.db`)을 공유한다
        ENG-7.2  블록 안의 읽기가 첫 번째 쓰기가 추가한 행을 조회한다
        ENG-7.3  블록이 커밋되기 전에는 `onEvent` 구독자가 호출되지 않는다
        ENG-7.4  블록이 커밋된 뒤 `onEvent` 구독자가 두 쓰기의 이벤트만 첫 번째 쓰기, 두 번째 쓰기 순서로 받는다
        ENG-7.5  콜백의 반환값이 `monti.transaction`의 결과로 반환된다

ENG-8  `transaction` 블록이 중간에 실패하면 전체를 롤백하고 이벤트를 통지하지 않는다
  전제  DB에 행을 추가하는 쓰기 Operation과 `onEvent` 구독자가 등록되어 있다
  행동  `monti.transaction` 안에서 쓰기를 실행한 뒤 오류를 던진다
  결과  ENG-8.1  오류가 던져진다
        ENG-8.2  추가했던 행이 DB에 남아 있지 않는다
        ENG-8.3  `onEvent` 구독자가 호출되지 않는다

ENG-9  `dryRun` 블록은 쓰기만 노출하고 실행 뒤 롤백하며 이벤트를 통지하지 않는다
  전제  DB에 행을 추가하는 쓰기 Operation, 읽기 Operation, `onEvent` 구독자가 등록되어 있다
  행동  `monti.dryRun` 안에서 쓰기 Operation을 호출하고 그 결과를 반환한다
  결과  ENG-9.1  `tx`에 읽기 Operation이 노출되지 않는다
        ENG-9.2  쓰기 Operation이 실행되어 결과가 `monti.dryRun`의 반환값으로 돌아온다
        ENG-9.3  추가했던 행이 롤백되어 DB에 남아 있지 않는다
        ENG-9.4  `onEvent` 구독자가 호출되지 않는다

ENG-10  플러그인의 `operations`와 `onEvent`를 엔진에 연결한다
  전제  쓰기 Operation과 `onEvent`를 가진 플러그인이 등록되어 있다
  행동  플러그인이 등록한 쓰기 Operation을 `monti.<resource>.<action>`으로 호출한다
  결과  ENG-10.1 플러그인의 쓰기 Operation이 실행되어 결과가 반환된다
        ENG-10.2 커밋된 뒤 플러그인의 `onEvent(event, { monti })`가 호출된다

ENG-11  플러그인의 Operation 경로가 기존 경로와 겹치면 거절한다
  전제  이미 존재하는 `<resource>.<action>`과 같은 경로의 Operation을 가진 플러그인이 주어진다
  행동  엔진을 생성한다
  결과  ENG-11.1 오류가 던져진다
```
