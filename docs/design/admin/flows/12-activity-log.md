# Flow 12: Activity log

This file lists every row and step of canvas flow 12, "흐름 12 · 활동 기록". The failed-delivery notice, resend, cancel, resend all, details, filters and the empty screen.

Canvas note: "흐름 12 · 활동 기록 — 전송 실패 알림 · 다시 보내기 · 취소 · 모두 다시 보내기 · 자세히 · 필터 · 빈 화면"

Screens used: [`Events`](../screens.md#events).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "전송 실패 · 다시 보내기" · Failed delivery, resend

### Step 01: "전송 실패 · 사이드바 “도구 1” → 활동 기록이 거르지 않은 채 열림 · 목록 위 알림 “전송 실패 1건 · 10. 26 · 보기 · 모두 다시 보내기”"

- Board: `Flow12Step01.dc.html`
- Renders: `Events` (stage "실패 알림")
- The sidebar shows Tools with a count of 1. The user opens it and the activity log opens unfiltered. Above the list a notice says "전송 실패 1건 · 10. 26" (1 delivery failed) with "보기" (view) and "모두 다시 보내기" (resend all).

### Step 01b: "전송 실패 · 보기 → 종류 › 전송 › 실패가 걸림 · 칩 “전송: 실패 ×” · 알림에서 보기가 빠짐"

- Board: `Flow12Step01b.dc.html`
- Renders: `Events` (stage "실패만")
- The user presses view. The filter kind › delivery › failed is applied, the chip "전송: 실패 ×" shows, and "보기" is gone from the notice.

### Step 02: "다시 보내기 · 그 줄에서 보내는 중…"

- Board: `Flow12Step02.dc.html`
- Renders: `Events` (stage "다시 보내는 중")
- The user presses resend on a row. That row shows "보내는 중…" (sending).

### Step 02b: "다시 보내기 · 보냄 → 알림과 사이드바 숫자가 사라짐 · 거른 목록이 비어 필터 끄기 · 토스트 (필터에 맞는 기록이 없는 화면을 겸함)"

- Board: `Flow12Step02b.dc.html`
- Renders: `Events` (stage "다시 보냄")
- Sent. The notice and the sidebar count disappear, the filtered list becomes empty with "실패한 전송이 없어요" and "필터 끄기" (turn the filter off), and a toast says it was sent. This screen doubles as the "no records match the filter" state.

## "자세히" · Details

### Step 03: "자세히 · 줄 누르기 → 옆 판 · 이벤트 · 항목 · 받는 곳마다 상태 · 시도 횟수 · 마지막 오류 (흐름 9 · 10과 같은 옆 판)"

- Board: `Flow12Step03.dc.html`
- Renders: `Events` (stage "자세히")
- The user clicks a row. A side panel shows the event: when, who, ID, item (first post), collection, language and version (KO · v12), address, and the deliveries (2), each recipient with status, attempt count and last error. It is the same side panel as in flows 9 and 10.

## "취소" · Cancel

### Step 04: "취소 · 받는 곳의 취소 → 확인 “이 전송을 취소할까요?” · 닫기 / 취소하기 (다시 보내지 않음, 되돌릴 수 없음)"

- Board: `Flow12Step04.dc.html`
- Renders: `Events` (stage "취소 확인")
- The user presses cancel on a recipient. A confirm asks "이 전송을 취소할까요?" and says it will not be resent and this cannot be undone. Buttons: close, "취소하기".

### Step 04b: "취소 · 줄에 “취소됨” (실패로 세지 않음) · 알림과 사이드바 숫자가 사라짐 · 토스트 “전송을 취소했어요”"

- Board: `Flow12Step04b.dc.html`
- Renders: `Events` (stage "취소됨")
- The row shows "취소됨" (cancelled), which does not count as a failure. The notice and sidebar count disappear and a toast says the delivery was cancelled.

## "모두 다시 보내기" · Resend all

### Step 05: "모두 다시 보내기 · 실패 3건 (줄마다 회색으로 “N번 실패”) · 거르지 않은 목록 · 알림 “전송 실패 3건 · 보기 · 모두 다시 보내기”"

- Board: `Flow12Step05.dc.html`
- Renders: `Events` (stage "실패 3건")
- Three failures. Each failed row shows a grey "N번 실패" (failed N times), the list is unfiltered, and the notice reads "전송 실패 3건" with "보기" and "모두 다시 보내기".

### Step 06: "모두 다시 보내기 · 누름 → 알림의 같은 자리에서 보내는 중… · 실패한 줄도 보내는 중… (실패는 모두 보내고 시도 수를 새로 셈 — 코드는 지금 8번 실패한 것을 빼요)"

- Board: `Flow12Step06.dc.html`
- Renders: `Events` (stage "모두 보내는 중")
- The user presses resend all. The notice shows "보내는 중…" in the same place and the failed rows also show sending. Every failure is sent and the attempt count starts over (the code now skips one that already failed 8 times).

### Step 07: "모두 다시 보내기 · 다 보냄 → 알림과 사이드바 숫자가 함께 사라짐 · 토스트 “3건 보냈어요”"

- Board: `Flow12Step07.dc.html`
- Renders: `Events` (stage "모두 보냄")
- All sent. The notice and the sidebar count disappear together and a toast says "3건 보냈어요".

### Step 08: "모두 다시 보내기 · 일부 다시 실패 → 알림이 “전송 실패 1건”으로 남음 · 토스트 “2건 보냈어요 · 1건 실패”"

- Board: `Flow12Step08.dc.html`
- Renders: `Events` (stage "일부 실패")
- Some fail again. The notice stays as "전송 실패 1건" and a toast says "2건 보냈어요 · 1건 실패".

## "필터" · Filter

### Step 09: "필터 · 종류 ▾ (AI 제안 · 글 저장 · 글 발행 · 휴지통 · 가져오기 · 설정 · 미디어) → 전송 › 대기 · 보냄 · 실패 · 취소됨"

- Board: `Flow12Step09.dc.html`
- Renders: `Events` (stage "필터 메뉴")
- The kind filter menu lists AI suggestion, post save, post publish, trash, import, settings, media; under delivery it has pending, sent, failed, cancelled.

### Step 09b: "필터 · 걸린 필터는 칩 “전송: 대기 ×” (보내는 중인 것도 대기에 들어감)"

- Board: `Flow12Step09b.dc.html`
- Renders: `Events` (stage "필터 걸림")
- An applied delivery filter becomes a chip "전송: 대기 ×". Deliveries that are still sending count as pending.

## "기록만 · 빈 화면" · Records only, empty screen

### Step 10: "받는 곳이 없는 사이트 · 전송 표시 없이 기록만"

- Board: `Flow12Step10.dc.html`
- Renders: `Events` (stage "구독자 없음")
- A site with no recipients: records only, with no delivery marks or notice.

### Step 11: "빈 화면 · 아직 기록이 없음"

- Board: `Flow12Step11.dc.html`
- Renders: `Events` (stage "비어 있음")
- Empty state: "아직 기록이 없어요" (no records yet).
