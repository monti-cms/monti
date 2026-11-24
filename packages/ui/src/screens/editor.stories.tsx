import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorCodeScreen, EditorDockedScreen } from "./editor";

/**
 * 기준 화면 · 편집기의 도구 막대. 승인된 시안(v5 `editor.html` · `editor-docked.html` · `editor-docked-narrow.html`)을 `@monti-cms/ui` 부품과 지어낸
 * 자료만으로 다시 그린 것이다. 관리자 앱이 아니다. 어시스턴트 대화 패널은 이 화면들에 없다: 이 세 시안에도 패널이 없어 글 단이 시안과 같은 폭(680)으로
 * 창 가운데에 서고, 어시스턴트는 머리 줄 끝의 ✦ 버튼(별 하나)뿐이다. 아래 상태 막대는 편집기의 것이다. 1440×900에서 시안과 견준다(좁은 폭은 1024×900).
 * 화면마다 밝은 바탕과 어두운 바탕(`…Dark`)이 있다. 코드 블록은 편집기의 `CodeFrame` 그대로다(시안의 테두리 상자는 시안 CSS에서 다른 부품의
 * `.cb`가 덮어쓴 모양이라 옮기지 않았다).
 */
const meta = {
	title: "Screens/Editor",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 시안의 내려 읽는 모습: 시안은 글 단을 236px 끌어올려(`margin-top:-236px`) 첫 절 "제목 크기"의 위끝이 창 위에서 5px(머리 줄과 막대에 가려진 자리)에 서고, 그 아래는 빈 종이다.
 * 같은 모습이 되게 글 단 아래에 그만큼 빈 자리를 두고 그 자리까지 내린다(편집기의 스크롤이 시안의 정지 화면에 닿도록 하는 것일 뿐, 부품의 규칙이 아니다).
 */
async function scrollDoc(canvasElement: HTMLElement) {
	const scroller = canvasElement.querySelector<HTMLElement>("[data-slot=editor-scroll]");
	const first = scroller?.querySelector<HTMLElement>("[data-slot=editor-body] h2");
	if (!scroller || !first) return;
	const column = scroller.firstElementChild as HTMLElement | null;
	if (column) column.style.marginBottom = `${scroller.clientHeight}px`;
	// 시안의 그 절 위끝은 창 위에서 5px(머리 줄과 막대 아래에 가려진 자리)다.
	scroller.scrollTop += first.getBoundingClientRect().top - 5;
}

/** 시안 `editor.html`: 발행된 글(바뀐 것 없음), 코드 블록이 골라져 그 도구 줄이 떠 있다. */
export const Editor: Story = { render: () => <EditorCodeScreen /> };

/** 시안 `editor-docked.html`: 머리 줄 아래 고정 도구 막대, 커서가 굵은 글자 안에 있어 B가 눌려 있다. */
export const EditorDocked: Story = {
	render: () => <EditorDockedScreen />,
	play: ({ canvasElement }) => scrollDoc(canvasElement),
};

/**
 * 시안 `editor-docked-narrow.html`(1024 폭, `render-v5-keep/editor-docked-narrow-1024.png`): 막대는 좁은 창에서도 글 단에 맞춰 가운데에 서고,
 * 글 단 앞에 자리가 모자라면 왼쪽 12px에서 시작한다. 1024×900에서 견준다.
 */
export const EditorDockedNarrow: Story = {
	render: () => <EditorDockedScreen />,
	play: ({ canvasElement }) => scrollDoc(canvasElement),
	globals: { viewport: { value: "narrow", isRotated: false } },
	parameters: {
		viewport: { options: { narrow: { name: "1024 × 900", styles: { width: "1024px", height: "900px" } } } },
	},
};

const dark = { globals: { theme: "dark" } };

export const EditorDark: Story = { ...Editor, ...dark };
export const EditorDockedDark: Story = { ...EditorDocked, ...dark };
export const EditorDockedNarrowDark: Story = {
	...EditorDockedNarrow,
	globals: { ...EditorDockedNarrow.globals, theme: "dark" },
};
