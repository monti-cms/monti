/// <reference types="vite/client" />
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ScreenSpecDocument } from "../spec/format";
import { ScreenSpec } from "../spec-pack";
import dictionary from "./converted/dictionary.json";

// Specs converted from the design boards by `pnpm convert:board`, drawn as they are: each story is a board turned into a spec and drawn again.
const specs = import.meta.glob<{ default: ScreenSpecDocument }>("./converted/*.screen.json", { eager: true });
const datas = import.meta.glob<{ default: Record<string, unknown> }>("./converted/*.screen.data.json", { eager: true });

const meta = { title: "Screens/Spec/Converted", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const words = dictionary as Record<string, string>;
const draw = (name: string) => () => (
	<ScreenSpec
		spec={specs[`./converted/${name}.screen.json`]?.default as ScreenSpecDocument}
		data={{ ...datas[`./converted/${name}.screen.data.json`]?.default }}
		text={(key, values) => {
			const found = words[key];
			return found === undefined
				? undefined
				: found.replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
		}}
		actions={{}}
	/>
);

export const Login0: Story = { render: draw("login-0") };
export const Login1: Story = { render: draw("login-1") };
export const Login2: Story = { render: draw("login-2") };
export const Login3: Story = { render: draw("login-3") };
export const Login4: Story = { render: draw("login-4") };
export const Login5: Story = { render: draw("login-5") };
export const Login6: Story = { render: draw("login-6") };
export const Login7: Story = { render: draw("login-7") };
export const Login8: Story = { render: draw("login-8") };
export const Sidebar: Story = { render: draw("Sidebar") };
export const SidebarRail: Story = { render: draw("SidebarRail") };
export const SidebarTheme: Story = { render: draw("SidebarTheme") };
export const SidebarThemeRail: Story = { render: draw("SidebarThemeRail") };
export const Empty: Story = { render: draw("Empty") };
export const Main: Story = { render: draw("Main") };
export const AdminSettings: Story = { render: draw("AdminSettings") };
export const ApiKeys: Story = { render: draw("ApiKeys") };
export const CollectionBasics: Story = { render: draw("CollectionBasics") };
export const CollectionEditor: Story = { render: draw("CollectionEditor") };
export const Events: Story = { render: draw("Events") };
export const Locales: Story = { render: draw("Locales") };
export const Schema: Story = { render: draw("Schema") };
export const SchemaAddField: Story = { render: draw("SchemaAddField") };
export const SchemaReview: Story = { render: draw("SchemaReview") };
export const Settings: Story = { render: draw("Settings") };
export const SettingsProposal: Story = { render: draw("SettingsProposal") };
export const Templates: Story = { render: draw("Templates") };
export const Trash: Story = { render: draw("Trash") };
export const Media: Story = { render: draw("Media") };
export const Assistant: Story = { render: draw("Assistant") };
export const AssistantPanel: Story = { render: draw("AssistantPanel") };
export const Data: Story = { render: draw("Data") };
export const Taxonomy: Story = { render: draw("Taxonomy") };
export const ProposalReview: Story = { render: draw("ProposalReview") };
export const ProposalReviewSide: Story = { render: draw("ProposalReviewSide") };
export const AssistantFirst: Story = { render: draw("AssistantFirst") };
export const EditorCompare: Story = { render: draw("EditorCompare") };
export const TemplateEditor: Story = { render: draw("TemplateEditor") };
export const EditorNotion: Story = { render: draw("EditorNotion") };
export const EditorProposal: Story = { render: draw("EditorProposal") };
export const EditorTranslate: Story = { render: draw("EditorTranslate") };
export const TranslatePaired: Story = { render: draw("TranslatePaired") };
export const ImageInsert: Story = { render: draw("ImageInsert") };
