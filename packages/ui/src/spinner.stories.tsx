import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";

/**
 * The working mark: a 14px ring in the ink of the text beside it, a quarter open, one turn a second. Decorative; the words beside it say what is
 * happening. `Button`, `SplitButton` and `AiAction` show it themselves while they are `loading`: see their Loading stories.
 */
const meta = { title: "Primitives/Spinner", component: Spinner } satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
