import { publicRoute } from "../../handler.js";
import { list } from "../entries.js";
export const GET = publicRoute(({ request, cms }) => list(request, cms));
