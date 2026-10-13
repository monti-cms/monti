import { isLocalUrl } from "../config/rules";
import type { InitAnswers } from "./init-answers";
import type { PackageManager } from "./init-detect";
import { ADMIN_PEER_PACKAGES, addCommand, commandText, exec, script } from "./init-install";
import type { InstallCommand } from "./init-types";
import { githubCallbackUrl } from "./templates";

/** The last stage of `monti init`: the plain list of what is left, in order, with the exact content to copy. */

export interface NextStepsInput {
	readonly cwd: string;
	readonly manager: PackageManager;
	readonly answers: InitAnswers;
	readonly typescript: boolean;
	/** The config file (relative to the project), for the step that names the repo to sync. */
	readonly configFile: string;
	/** The packages that were missing and the command that installs them. */
	readonly missing: readonly string[];
	readonly installCommand: InstallCommand;
	/** The packages are (or, on a dry run, would be) installed by init, so the person does not have to. */
	readonly willInstall: boolean;
	/** Steps for the files init could not edit safely. */
	readonly manual: readonly string[];
}

/** What is left to do after init, in order. */
export function nextSteps(input: NextStepsInput): string[] {
	const { cwd, manager, answers } = input;
	const todo: string[] = [];
	if (!input.typescript) {
		todo.push(
			"Add TypeScript (monti.config.ts and the Next files are .ts/.tsx): " +
				commandText(addCommand(manager, ["typescript", "@types/react", "@types/node"], cwd, true)),
		);
	}
	if (input.missing.length > 0 && !input.willInstall) {
		const peers = input.missing.filter((name) => (ADMIN_PEER_PACKAGES as readonly string[]).includes(name));
		todo.push(
			[
				"Install the packages:",
				commandText(input.installCommand),
				...(peers.length > 0
					? [
							`${peers.join(", ")} are libraries the admin shares with your app: they are peer dependencies, so your app installs them and both use one copy.`,
						]
					: []),
			].join("\n"),
		);
	}
	todo.push(...input.manual);
	todo.push(
		[
			"Create .env.local from the example and fill it in (.env.example says what each value is and where to get it):",
			"cp .env.example .env.local",
			"MONTI_SECRET is a long random value. Generate one with:",
			"openssl rand -base64 32",
			"or, without openssl:",
			`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
		].join("\n"),
	);
	todo.push(
		`Create Monti's tables in your database (once): ${exec(manager, "db:setup")}`,
		`Check the setup: ${exec(manager, "doctor")}\nIt lists every check as ok, warn or fail, and \`monti doctor\` will tell you if any of the steps above is missing.`,
		`Start the app: ${script(manager, "dev")}, then open ${answers.siteUrl}${answers.adminPath}`,
	);
	if (answers.gitSync) {
		todo.push(
			`Name the repo to sync: add a target to gitSync() in ${input.configFile}, then open ${answers.adminPath}/tools/git-sync to save the GitHub token.`,
		);
	}
	const siteBase = answers.siteUrl.replace(/\/+$/, "");
	const deployedAdmin = `${isLocalUrl(siteBase) ? "<your site>" : siteBase}${answers.adminPath}`;
	if (answers.login === "github") {
		todo.push(
			[
				"Create the GitHub OAuth app that signs people in (GitHub > Settings > Developer settings > OAuth Apps > New OAuth App):",
				`  Homepage URL: ${answers.siteUrl}`,
				`  Authorization callback URL: ${githubCallbackUrl(answers.siteUrl)}`,
				"Then put its Client ID in AUTH_GITHUB_ID and a new client secret in AUTH_GITHUB_SECRET, and your numeric GitHub id in MONTI_ADMIN_GITHUB_ID (.env.example says where to find it).",
				"Under `next dev` you are the admin without signing in; the GitHub login applies once the app is deployed.",
			].join("\n"),
		);
	} else {
		todo.push(
			[
				`Right after you deploy, open ${deployedAdmin} and create the first admin (an email and a password). That screen closes as soon as one admin exists.`,
				`Or create it beforehand: run the app in production mode (\`${script(manager, "build")}\` then \`${manager === "npm" || manager === "bun" ? `${manager} run start` : `${manager} start`}\`) pointed at the production database (its DATABASE_URL) and open ${answers.adminPath} on this machine. (Under \`next dev\` you are the admin without signing in, so that screen does not show.)`,
				`A forgotten password: ${exec(manager, "admin:reset-password")}`,
			].join("\n"),
		);
	}
	return todo;
}
