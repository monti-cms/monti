import { composeStories } from "@storybook/react-vite";
import { measureStories } from "../../../testing/measure-stories";

// Every screen story on its site, measured as the part stories are (packages/ui/src/measure.browser.test.tsx; T51).
measureStories(import.meta.glob("./**/*.stories.tsx", { eager: true }), composeStories);
