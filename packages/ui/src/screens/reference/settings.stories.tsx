import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminSettingsScreen } from "./admin-settings";
import { ApiKeysScreen } from "./api-keys";
import { LocalesScreen } from "./locales";
import { SchemaScreen } from "./schema";
import { SchemaAddFieldScreen } from "./schema-add-field";
import { SchemaFieldScreen } from "./schema-field";
import { SchemaReviewScreen } from "./schema-review";
import { SettingsScreen } from "./settings";
import { SettingsProposalScreen } from "./settings-proposal";

/** The settings screens as the design reference, drawn only with design-system parts. */
const meta = {
	title: "Screens/Reference/Settings",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = { render: () => <SettingsScreen /> };
export const SettingsProposal: Story = { render: () => <SettingsProposalScreen /> };
export const AdminSettings: Story = { render: () => <AdminSettingsScreen /> };
export const ApiKeys: Story = { render: () => <ApiKeysScreen /> };
/** The states of flow 10 (API keys), on a site whose plugins ask for no key. */
/** Flow 10 on a site whose plugins ask for no key: the AI keys and the quick-task model, no third table. */
export const ApiKeysBuilt: Story = { render: () => <ApiKeysScreen stage="기본" plugins={false} /> };
/** No key yet: the AI keys say so, and the quick-task model has nothing to pick from. */
/** A key row's ⋯ open: "편집" and "지우기". */
export const ApiKeysRowMenu: Story = { render: () => <ApiKeysScreen stage="줄 메뉴" plugins={false} /> };
export const ApiKeysEmpty: Story = { render: () => <ApiKeysScreen stage="키 없음" plugins={false} /> };
/** 10.01: "+ 키 추가" opens the services. */
export const ApiKeysPickService: Story = { render: () => <ApiKeysScreen stage="서비스 고르기" plugins={false} /> };
/** 10.02: the add window, the name filled in from the service. */
export const ApiKeysAdd: Story = { render: () => <ApiKeysScreen stage="키 입력" plugins={false} /> };
/** 10.02b: an OpenAI-compatible server is added by its address; the name is the address's host, the key may be left out. */
export const ApiKeysAddAddress: Story = { render: () => <ApiKeysScreen stage="호환 주소" plugins={false} /> };
/** 10.03: the service is asked about the key. */
export const ApiKeysChecking: Story = { render: () => <ApiKeysScreen stage="확인하는 중" plugins={false} /> };
/** 10.04: the service refused the key; the window stays open. */
export const ApiKeysRefused: Story = { render: () => <ApiKeysScreen stage="키 거절" plugins={false} /> };
/** The service could not be reached: the same line, another reason. */
export const ApiKeysNoAnswer: Story = { render: () => <ApiKeysScreen stage="서비스 답 없음" plugins={false} /> };
/** 10.05: another key has the service's name, so the name is filled in as "Anthropic 2". */
export const ApiKeysNameTaken: Story = { render: () => <ApiKeysScreen stage="이름 겹침" plugins={false} /> };
/** "추가" with an empty key: the field says so and takes the focus. */
export const ApiKeysMissingField: Story = { render: () => <ApiKeysScreen stage="빈 칸" plugins={false} /> };
/** 10.06: the new row, and a toast. */
export const ApiKeysAdded: Story = { render: () => <ApiKeysScreen stage="추가됨" plugins={false} /> };
/** 10.07: the edit window; the service is text, the key is shown by its ending. */
export const ApiKeysEdit: Story = { render: () => <ApiKeysScreen stage="편집" plugins={false} /> };
/** 10.08: "바꾸기" opens an empty key field; "그대로" goes back. */
export const ApiKeysEditKey: Story = { render: () => <ApiKeysScreen stage="편집 키 열기" plugins={false} /> };
/** 10.09: a new key is checked again. */
export const ApiKeysEditChecking: Story = { render: () => <ApiKeysScreen stage="편집 확인 중" plugins={false} /> };
/** 10.10: the row's new ending, and a toast. */
export const ApiKeysEdited: Story = { render: () => <ApiKeysScreen stage="편집 저장됨" plugins={false} /> };
/** 10.11: removing a key names what stops. */
export const ApiKeysRemove: Story = { render: () => <ApiKeysScreen stage="지우기 확인" plugins={false} /> };
/** 10.11b: a key nothing uses is confirmed too. */
export const ApiKeysRemoveUnused: Story = {
	render: () => <ApiKeysScreen stage="쓰는 곳 없이 지우기" plugins={false} />,
};
/** After removing: the row is gone, and a toast. */
export const ApiKeysRemoved: Story = { render: () => <ApiKeysScreen stage="지움" plugins={false} /> };
/** 10.13: the quick-task model's menu, the models under their keys. */
export const ApiKeysPickModel: Story = { render: () => <ApiKeysScreen stage="모델 고르기" plugins={false} /> };
/** 10.13b: the picked model, and a toast. */
export const ApiKeysModelChanged: Story = { render: () => <ApiKeysScreen stage="모델 바뀜" plugins={false} /> };
/** 10.14: the server's secret changed; every key says it cannot be read. */
export const ApiKeysUnreadable: Story = { render: () => <ApiKeysScreen stage="읽을 수 없음" plugins={false} /> };
/** 10.14b: editing an unreadable key asks for the key again. */
export const ApiKeysEnterAgain: Story = { render: () => <ApiKeysScreen stage="다시 넣기" plugins={false} /> };
/** 10.15: without MONTI_SECRET nothing can be stored; what cannot be done is hidden. */
export const ApiKeysNoSecret: Story = { render: () => <ApiKeysScreen stage="비밀값 없음" plugins={false} /> };
/** Without MONTI_SECRET on a site that has keys: they are listed and can only be removed. */
export const ApiKeysNoSecretWithKeys: Story = {
	render: () => <ApiKeysScreen stage="비밀값 없음 · 키 있음" plugins={false} />,
};
/** 10.12: a plugin's empty slot opens the same key window, its service set. */
export const ApiKeysSlot: Story = { render: () => <ApiKeysScreen stage="키 넣기" /> };
/** 10.12b: the slot shows the key's ending and the same two actions as an AI key. */
export const ApiKeysSlotFilled: Story = { render: () => <ApiKeysScreen stage="키 넣음" /> };
export const Locales: Story = { render: () => <LocalesScreen /> };
export const Schema: Story = { render: () => <SchemaScreen /> };
export const SchemaAddField: Story = { render: () => <SchemaAddFieldScreen /> };
/** A saved field's sheet, opened by clicking its row. */
export const SchemaField: Story = { render: () => <SchemaFieldScreen /> };
export const SchemaReview: Story = { render: () => <SchemaReviewScreen /> };
