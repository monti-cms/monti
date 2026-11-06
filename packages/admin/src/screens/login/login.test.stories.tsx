import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";
import { Closed, password, site } from "./login.stories";

type Loaded = { site: StorySite };

/** What only a play checks: that an action works. Kept out of the screens a person reviews (2026-11-06 owner). */
const meta = {
	tags: ["test"],
	title: "Tests/Login",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** After "이미 관리자가 있어요", "로그인하기" leads to signing in: the screen keeps knowing there is an admin and never shows the first-admin form again. */
export const ClosedThenSignIn: Story = {
	loaders: site({ schema, auth: password }),
	play: async (context) => {
		await Closed.play?.(context);
		const page = within(context.canvasElement);
		await userEvent.click(page.getByRole("button", { name: "로그인하기" }));
		await expect(await page.findByLabelText("이메일")).toBeInTheDocument();
		await expect(page.queryByLabelText("비밀번호 확인")).toBeNull();
	},
};
