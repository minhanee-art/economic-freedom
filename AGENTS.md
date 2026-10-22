<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:git-branch-workflow -->
# Git branch / PR workflow (agent-driven)

Default branch: `main` (origin: `minhanee-art/economic-freedom`). There is also a stale
`remotes/origin/quahog` branch — ignore it unless told otherwise.

Every unit of work follows this cycle. The agent does this by default, without being
asked each time.

## 1. Start of work (before touching code)
1. If the previous task's branch has since been merged, run the cleanup in step 4 first —
   don't let stale branches pile up.
2. `git checkout main && git pull`
3. Pick a short branch name from the task (e.g. `feat/dividend-export`,
   `fix/holding-card-nan`) and create it: `git checkout -b <name>`. State the chosen name
   and proceed — no need to ask permission for the name itself.

## 2. During work
- Commit in coherent chunks as work completes (not one giant commit at the end), using
  the repo's existing commit style (`feat:`, `fix:`, `chore:` — see `git log --oneline`).

## 3. Finish work
1. Final commit of any remaining changes.
2. Run `npm run lint` and `npm run build`; fix failures before proceeding — never hand off
   a red build.
3. Push the branch: `git push -u origin <name>`
4. Open the PR: `gh pr create --fill` (or with an explicit title/body).
5. **Stop here.** Merging is manual — the user merges on GitHub themselves. The agent does
   not merge or squash automatically.

## 4. After the user merges (branch cleanup + next branch)
Vercel auto-deploys `main` on merge, so "merged" ≈ "deployed" for this repo — no separate
deploy step needed.

Before starting the *next* task:
1. `git fetch origin --prune`
2. Check whether the previous branch's PR is merged:
   `gh pr view <branch> --json state,mergedAt` (or `gh pr list --state merged --head <branch>`)
3. If merged:
   - `git checkout main && git pull`
   - Delete the local branch: `git branch -d <name>`
   - Delete the remote branch if it still exists: `git push origin --delete <name>`
     (skip if GitHub's "delete branch on merge" already removed it — check `git branch -a`
     or `gh pr view` first)
4. Then go back to step 1 for the next task (recommend + create the next branch).

This keeps `main` always deployable and the branch list clean, so the agent never needs
to be told "clean up" or "start a new branch" explicitly — it's the default behavior for
every task in this repo.
<!-- END:git-branch-workflow -->
