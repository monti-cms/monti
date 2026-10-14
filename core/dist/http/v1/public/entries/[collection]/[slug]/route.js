import { publicRoute } from "../../../../handler.js";
import { getOne } from "../../../entries.js";
export const GET = publicRoute(({ request, params, cms }) => getOne(request, params, cms));
