# 화면 부품 지도

이 폴더는 관리자 화면마다 어느 자리에 어떤 `@monti-cms/ui` 부품을 쓰는지 적는다. 화면을 만들거나 고치는 사람과 에이전트는 코드를 쓰기 전에 그 화면의 지도를 읽고, 지도에 적힌 부품만 쓴다.

[screens.md](../screens.md)는 보드마다 상태와 흐름 단계를 적는다. 이 폴더는 같은 보드를 자리별로 나누고, 흐름마다 더해지는 부품을 적는다. 부품의 규칙 자체는 [components](../components/)에 있다.

## 지도를 읽는 법

화면 하나가 절 하나다. 절은 이 순서다.

1. **기본 틀**: 그 화면에 늘 있는 자리다. 화면마다 한 번만 적는다. 표의 열은 셋이다.
   - **자리**: 보드에서 보이는 이름("요약", "발행하기 ▾").
   - **부품**: `@monti-cms/ui`에서 가져오는 이름과 그 prop.
   - **이렇게 쓴다**: 누르거나 입력하면 무엇이 되는지.

   흐름마다 값만 바뀌는 자리(발행 상태, 저장 상태)는 "늘 있는 자리의 값"에 적는다. 끝에 그 부품들의 스토리 이름을 적는다.
2. **뜨는 자리**: 흐름이 열 때만 있는 자리(시트, 창, 일괄 막대, 알림 띠)다. 열은 기본 틀과 같다.
3. **흐름 N**: 캔버스의 흐름(1–12) 가운데 이 화면을 지나는 것마다 하나다. 여러 화면을 지나는 흐름은 지나는 화면마다 절이 있다. 그 흐름의 단계 번호, 함께 열리는 화면, 그리고 이 흐름에서 기본 틀에 **더해지는 것만** 적는다. 표의 열은 상태 · 단계 · 더해지는 것 · 스토리다. 단계마다 보이는 것은 [flows/](../flows/README.md)에 있다.
4. **아직 없는 부품**: 보드에 있지만 `@monti-cms/ui`에 아직 없는 것. 그 자리의 행에 필요한 모양을 적고, "아직 없다. @monti-cms/ui에서 먼저 만든다."를 한 줄 붙인다. 이름이 정해지지 않은 부품에 이름을 지어 적지 않는다. 화면에서 직접 만들지 않는다. 먼저 부품을 만든다([README](../README.md)의 "부품 먼저, 그다음 화면").

어떤 흐름에도 쓰이지 않는 상태는 지도에 적지 않는다. 흐름이 지나지 않아도 관리자 화면인 보드(템플릿, 컬렉션 에디터)는 기본 틀을 적는다.

여러 화면이 함께 쓰는 틀(사이드바, 페이지 머리, 토스트, 시트, 대화상자)은 [common.md](common.md)에 한 번만 적는다. 각 지도는 그것을 "공통 틀"로 가리킨다.

## 지키는 것

- 지도에 적힌 부품만 쓴다. 적히지 않은 것은 쓰지 않는 것이다. 다른 부품이 필요하면 먼저 지도를 고친다. 지도와 코드가 다르면 코드가 틀린 것이다.
- 지도와 보드가 다르면 보드가 기준이다. 지도를 고치고, 혼자 정할 수 없으면 소유자에게 묻는다.
- 입력하는 자리에는 입력 부품(`Input`, `Textarea`, `Select`, `Combobox`, `Switch`, `Checkbox` …)을 처음부터 둔다. 버튼을 눌러야 입력 부품이 나타나게 바꾸지 않는다. 지도에 "누르면 열린다"고 적힌 것(메뉴, 팝오버, 시트, 대화상자)만 연다.
- 테스트는 지도의 "이렇게 쓴다"를 따른다. 지도에 없는 동작을 테스트로 고정하지 않는다.

## 지도 목록

| 파일 | 보드 |
|---|---|
| [common.md](common.md) | 여러 화면이 함께 쓰는 틀, Dialogs "고른 글 내보내기" |
| [sidebar.md](sidebar.md) | Sidebar, SidebarRail, SidebarTheme (모든 화면의 틀) |
| [list.md](list.md) | Main "게시글 목록", Empty "빈 목록" |
| [editor.md](editor.md) | EditorNotion "글 편집기" (속성 패널 포함) |
| [editor-more.md](editor-more.md) | EditorProposal "AI 제안", EditorCompare "비교" |
| [translation.md](translation.md) | EditorTranslate, TranslatePaired |
| [assistant.md](assistant.md) | AssistantPanel, Assistant, ProposalReview |
| [collections.md](collections.md) | Schema "컬렉션 · 필드", CollectionEditor "컬렉션 · 에디터" |
| [trash.md](trash.md) | Trash "휴지통" |
| [media.md](media.md) | Media "미디어", ImageInsert "이미지 넣기" |
| [taxonomy.md](taxonomy.md) | Taxonomy "카테고리 · 항목 열기" |
| [login.md](login.md) | Login "로그인" |
| [activity.md](activity.md) | Events "활동 기록" |
| [tools.md](tools.md) | Templates, TemplateEditor, Data, ApiKeys |
| [settings.md](settings.md) | Settings, Locales, AdminSettings, SettingsProposal |

Foundations "규칙 · 토큰"은 화면이 아니라 토큰 견본이라 지도가 없다. 토큰은 [tokens.md](../tokens.md)에 있다.
