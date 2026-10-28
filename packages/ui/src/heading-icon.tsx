import { Heading } from "@carbon/icons-react";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "./cn";
import type { MontiIcon } from "./monti-icon";

/**
 * The glyph of a heading block: Carbon's heading mark moved 2px left, with the level as a small mono number in the space it leaves, all inside the
 * 16px box ("H2", "H3", "H4"), so the three heading levels do not look alike. It is decorative; the words beside it name the level.
 */
function HeadingIcon({ level, className, ...props }: Omit<ComponentProps<"span">, "children"> & { level: number }) {
	return (
		<span
			data-slot="heading-icon"
			data-level={level}
			aria-hidden="true"
			// The number is drawn from `data-level`, so it is not text a menu item's name or a copy picks up.
			className={cn(
				"relative inline-flex size-4 flex-none after:absolute after:right-0 after:bottom-px after:font-mono after:font-semibold after:text-[8px] after:leading-[8px] after:content-[attr(data-level)]",
				className,
			)}
			{...props}
		>
			<Heading className="-ml-[2px] size-4 shrink-0" />
		</span>
	);
}

const LEVELS = [2, 3, 4] as const;

/** One icon per heading level, for the places that take an `icon` component (a slash menu item, a toolbar entry). The ref is not used. */
const headingIcons = Object.fromEntries(
	LEVELS.map((level) => {
		const Level = forwardRef<SVGSVGElement, ComponentProps<MontiIcon>>(({ className }, _ref) => (
			<HeadingIcon level={level} className={className} />
		));
		Level.displayName = `HeadingIcon${level}`;
		return [level, Level as MontiIcon];
	}),
) as Record<(typeof LEVELS)[number], MontiIcon>;

export { HeadingIcon, headingIcons };
