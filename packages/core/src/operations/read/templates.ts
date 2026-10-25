import { z } from "zod";
import { formatNameSchema } from "../../core/api";
import { templatesJson } from "../../http/v1/templates/body";
import { defineOperation } from "../define";

const bodyFormat = formatNameSchema
	.optional()
	.describe("Name of a body format (`site.describe` lists them). Adds each body as text in that format");

export const listTemplates = defineOperation({
	name: "templates.list",
	kind: "read",
	describe: "The body templates the admin starts new entries from: name and, with `format`, the body as text.",
	input: () => z.object({ format: bodyFormat }),
	run: async ({ format }, { cms }) => ({ items: await templatesJson(cms, await cms.store().listTemplates(), format) }),
});

export const getTemplate = defineOperation({
	name: "templates.get",
	kind: "read",
	describe: "One body template. Pass `format` to get its body as text.",
	input: () => z.object({ id: z.uuid().describe("The id of the template"), format: bodyFormat }),
	run: async ({ id, format }, { cms }) => {
		const [template] = await templatesJson(cms, [await cms.store().getTemplate(id)], format);
		return template;
	},
});
