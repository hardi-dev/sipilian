# Claude Code configuration

## Superpowers plugin

This repo ships a team-marketplace configuration in [`settings.json`](./settings.json)
that installs the [Superpowers](https://github.com/obra/superpowers) skills library
for everyone working on the project with Claude Code.

Superpowers adds a software-development methodology built on composable skills
(brainstorming → spec → plan → subagent-driven TDD execution, systematic debugging,
code review, git worktrees, and more). It's the same workflow the existing
`docs/superpowers/specs` and `docs/superpowers/plans` in this repo came from.

### How it's wired

- `extraKnownMarketplaces` registers the `superpowers-dev` marketplace from the
  `obra/superpowers` GitHub repo.
- `enabledPlugins` enables `superpowers@superpowers-dev`.

### Activating it

When you open this repo in Claude Code and trust the folder, Claude Code prompts
you to install the marketplace and plugin. After it installs, run:

```
/reload-plugins
```

to activate it without restarting. Once loaded, the skills are namespaced under
`superpowers:` (e.g. `superpowers:brainstorming`, `superpowers:writing-plans`,
`superpowers:test-driven-development`) and trigger automatically as you work.

Manual install, if you skipped the prompt:

```
/plugin marketplace add obra/superpowers
/plugin install superpowers@superpowers-dev
```
