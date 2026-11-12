import "../.storybook/storybook.css";
import "../../../testing/setup";
import "../../../testing/after-each";
import { afterEach } from "vitest";
import { commands } from "vitest/browser";

// A test leaves the pointer where its last press or hover was, and the next test draws its parts under it: a browser then points at them
// some time later, on its own, and a part's pointed-at look (or a tooltip's first move) comes at a moment no test chose. Each test starts
// with the pointer in the page's corner, in the page's padding, on no part.
afterEach(() => commands.movePointer([{ x: 0, y: 0 }], { steps: 1 }));
