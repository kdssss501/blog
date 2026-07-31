import assert from "node:assert/strict";
import {
	DESKTOP_EXPANDED_COMMANDS,
	DESKTOP_PINNED_COMMANDS,
	dockCommands,
	isDockCommandVisible,
	MOBILE_PRIMARY_COMMANDS,
	MOBILE_TOOL_COMMANDS,
} from "../../src/app/shell/model/dock-command.ts";

const context = {
	pathname: "/posts/example/",
	scrollY: 320,
	hasComments: true,
	hasToc: true,
};

assert.deepEqual(DESKTOP_PINNED_COMMANDS, ["theme", "guestbook", "toggle"]);
assert.deepEqual(MOBILE_PRIMARY_COMMANDS, [
	"home",
	"theme",
	"search",
	"tools",
	"menu",
]);
assert.ok(DESKTOP_EXPANDED_COMMANDS.includes("xiao"));
assert.ok(DESKTOP_EXPANDED_COMMANDS.includes("posts"));
assert.ok(MOBILE_TOOL_COMMANDS.includes("categories"));
assert.ok(MOBILE_TOOL_COMMANDS.includes("announcement"));

assert.equal(isDockCommandVisible(dockCommands.home, context), true);
assert.equal(isDockCommandVisible(dockCommands.comment, context), true);
assert.equal(isDockCommandVisible(dockCommands.toc, context), true);
assert.equal(isDockCommandVisible(dockCommands.posts, context), true);
assert.equal(isDockCommandVisible(dockCommands.top, context), true);
assert.equal(
	isDockCommandVisible(dockCommands.guestbook, {
		...context,
		pathname: "/guestbook/",
	}),
	false,
);
assert.equal(
	isDockCommandVisible(dockCommands.guestbook, {
		...context,
		pathname: "/life/guestbook/",
	}),
	false,
);
assert.equal(
	isDockCommandVisible(dockCommands.guestbook, {
		...context,
		pathname: "/posts/",
	}),
	true,
);
assert.equal(
	isDockCommandVisible(dockCommands.books, {
		...context,
		pathname: "/books/example/",
	}),
	true,
);
assert.equal(
	isDockCommandVisible(dockCommands.home, { ...context, pathname: "/" }),
	false,
);
assert.equal(
	isDockCommandVisible(dockCommands.comment, {
		...context,
		hasComments: false,
	}),
	false,
);
assert.equal(
	isDockCommandVisible(dockCommands.toc, {
		...context,
		pathname: "/about/",
	}),
	false,
);

console.log("Dock command checks passed.");
