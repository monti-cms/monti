import { toast } from "@monti-cms/ui";
import { setProjectAnnotations } from "@storybook/react-vite";
import { afterEach } from "vitest";
import "../../ui/.storybook/storybook.css";
import "../../../testing/setup";
import "../../../testing/after-each";
import preview from "../.storybook/preview";

// A screen test draws a story's scene (`composeStories`) on the page the stories have: the admin root around it.
setProjectAnnotations(preview);

// A toast outlives the screen that showed it: the toasts are kept outside React, and a screen drawn later is handed every one that has not
// ended (a test that ends within a toast's four seconds leaves it). The next test would start with that toast at the bottom of the page, over
// whatever stands there (the proposal bubble), and a pointer resting on a toast keeps it from leaving. Each test ends with none.
afterEach(() => {
	toast.dismiss();
});
