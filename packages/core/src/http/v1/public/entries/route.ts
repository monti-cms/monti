import { publicRoute } from "../../handler";
import { list } from "../entries";

export const GET = publicRoute(({ request, cms }) => list(request, cms));
