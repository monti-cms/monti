import { defineServerPlugin } from "@monti-cms/core/server";
import { markdownFormat, textFormat } from "./formats";

// `formats` returns a format or a list of them. It is called once, when the instance first needs its formats.
export default defineServerPlugin({ formats: () => [markdownFormat, textFormat] });
