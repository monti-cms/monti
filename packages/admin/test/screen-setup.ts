import { setProjectAnnotations } from "@storybook/react-vite";
import "../../ui/.storybook/storybook.css";
import "../../../testing/setup";
import preview from "../.storybook/preview";

// A screen test draws a story's scene (`composeStories`) on the page the stories have: the admin root around it.
setProjectAnnotations(preview);
