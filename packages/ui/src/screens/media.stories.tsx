import type { Meta, StoryObj } from "@storybook/react-vite";
import { MediaEmptyScreen, MediaScreen } from "./media";

/**
 * 기준 화면 · 미디어. 승인된 시안(v5 `media.html` · `media-deep.html` · `media-empty.html`)을 `@monti-cms/ui` 부품과 지어낸 자료만으로 다시
 * 그린 것이다. 관리자 앱이 아니다. 1440×900에서 시안과 견준다. 화면마다 밝은 바탕과 어두운 바탕(`…Dark`)이 있다.
 */
const meta = {
	title: "Screens/Media",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 시안 `media.html`: 폴더 셋과 파일 다섯(종류 필터가 켜짐), 연 파일이 오른쪽 패널에. */
export const Media: Story = { render: () => <MediaScreen /> };

/** 시안 `media-deep.html`: 깊은 빈 폴더. 길의 가운데가 ⋯로 접히고 그 메뉴가 열려 있다. */
export const MediaDeep: Story = { render: () => <MediaEmptyScreen deep /> };

/** 시안 `media-empty.html`: 빈 폴더. 제목 줄이 폴더까지의 길이고, 목록 자리는 파일을 끌어 놓는 틀이다. */
export const MediaEmpty: Story = { render: () => <MediaEmptyScreen /> };

/** 어두운 바탕을 늘 켜 둔다(도구 막대의 테마를 바꾸지 않아도 된다). */
const dark = { globals: { theme: "dark" } };

/** `Media`의 어두운 바탕. */
export const MediaDark: Story = { ...Media, ...dark };
/** `MediaDeep`의 어두운 바탕. */
export const MediaDeepDark: Story = { ...MediaDeep, ...dark };
/** `MediaEmpty`의 어두운 바탕. */
export const MediaEmptyDark: Story = { ...MediaEmpty, ...dark };
