import { composeStories } from "@storybook/react-vite";
import { measureStories } from "../../../testing/measure-stories";

// Every screen story on its site, measured as the part stories are (packages/ui/src/measure.browser.test.tsx; T51). Part 3 of 4: one file took
// twelve minutes, longer than any other, and CI's runners share whole files.
measureStories(import.meta.glob("./**/*.stories.tsx", { eager: true }), composeStories, { index: 3, of: 4 });
