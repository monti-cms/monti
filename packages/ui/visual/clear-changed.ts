import { rmSync } from "node:fs";
import { CHANGED_DIR } from "./paths";

/** Empties the folder of changed shots before a run, so what it holds is only this run's (`paths.ts`). */
export default () => rmSync(CHANGED_DIR, { recursive: true, force: true });
