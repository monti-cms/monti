import { getOne } from "../../../entries.js";
export const GET = async (request, context) => getOne(request, (await context?.params) ?? { collection: "", slug: "" });
