import { defineMessages } from "@monti-cms/core";

/** Login screen text. `provider` carries the name (e.g. GitHub) only when there is a single login method. */
export const loginMessages = defineMessages("cms-admin.login", {
	en: {
		title: "CMS Admin",
		description: ({ provider }) => `Sign in with an approved ${provider ? `${provider} ` : ""}admin account.`,
		forbiddenTitle: "No access",
		forbidden: ({ provider, accountId }) =>
			`The ${provider ? `${provider} ` : ""}account ${accountId} doesn't have admin access.`,
		signOut: "Sign out",
		signIn: "Sign in with {provider}",
		noLoginTitle: "No login configured",
		noLogin: "This site has no way to sign in to the admin yet. The site owner adds a login in monti.config.ts.",
		passwordDescription: "Sign in with the email and password of an admin account.",
		email: "Email",
		password: "Password",
		confirmPassword: "Repeat the password",
		passwordHint: ({ min }) => `At least ${min} characters.`,
		signInSubmit: "Sign in",
		firstAdminTitle: "Create the first admin",
		firstAdminDescription:
			"No admin exists yet. The account you create here can manage the whole site. This screen closes as soon as it is created.",
		createFirstAdmin: "Create admin and sign in",
		errorCredentials: "The email or password is not right.",
		errorConfirm: "The two passwords are not the same.",
		errorEmail: "That is not an email address.",
		errorPassword: ({ min }) => `The password needs at least ${min} characters.`,
		errorClosed: "An admin already exists, so no new one can be created here. Sign in with that account.",
		errorOther: "Signing in did not work. Try again.",
	},
	ko: {
		title: "CMS 관리자",
		description: ({ provider }) => `승인된 ${provider ? `${provider} ` : ""}관리자 계정으로 로그인해 주세요.`,
		forbiddenTitle: "접근 권한이 없습니다",
		forbidden: ({ provider, accountId }) =>
			`로그인한 ${provider ? `${provider} ` : ""}계정 ${accountId}에는 관리자 권한이 없습니다.`,
		signOut: "로그아웃",
		signIn: "{provider} 계정으로 로그인",
		noLoginTitle: "로그인이 설정되지 않았습니다",
		noLogin:
			"이 사이트에는 아직 관리자 로그인 방법이 없습니다. 사이트 소유자가 monti.config.ts에 로그인을 추가해야 합니다.",
		passwordDescription: "관리자 계정의 이메일과 비밀번호로 로그인해 주세요.",
		email: "이메일",
		password: "비밀번호",
		confirmPassword: "비밀번호 확인",
		passwordHint: ({ min }) => `${min}자 이상이어야 합니다.`,
		signInSubmit: "로그인",
		firstAdminTitle: "첫 관리자 만들기",
		firstAdminDescription:
			"아직 관리자가 없습니다. 여기서 만드는 계정이 사이트 전체를 관리할 수 있습니다. 계정을 만들면 이 화면은 곧바로 닫힙니다.",
		createFirstAdmin: "관리자 만들고 로그인",
		errorCredentials: "이메일 또는 비밀번호가 맞지 않습니다.",
		errorConfirm: "두 비밀번호가 같지 않습니다.",
		errorEmail: "이메일 주소 형식이 아닙니다.",
		errorPassword: ({ min }) => `비밀번호는 ${min}자 이상이어야 합니다.`,
		errorClosed: "이미 관리자가 있어 여기서 새로 만들 수 없습니다. 그 계정으로 로그인해 주세요.",
		errorOther: "로그인하지 못했습니다. 다시 시도해 주세요.",
	},
});
