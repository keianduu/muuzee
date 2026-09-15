# Git Workflow

This document defines the repository hygiene rules for Muuzee. The goal is to keep `main` canonical, linear, and synchronized between local and GitHub, with no stale task branches after work is complete.

## Idle-state invariant

When no task is actively in progress, the repository should satisfy all of the following:

- local `main` and `origin/main` point to the same commit;
- the working tree is clean;
- there are no unpushed commits on local `main`;
- there are no unpulled commits from `origin/main`;
- completed task branches are deleted locally and remotely;
- temporary `sync-*`, `temp-*`, `recovery-*`, or backup branches do not remain after they are no longer needed.

Use `main` as the canonical repository state. Task branches are temporary workspaces, not long-lived sources of truth.

## Before starting any implementation task

Start from the local repository and synchronize `main` first:

```bash
cd /Users/kei.ando/Documents/my-project/muuzee
git switch main
git fetch origin --prune
git status
git pull --ff-only origin main
```

Do not start implementation if:

- the working tree is not clean;
- `main` and `origin/main` have diverged;
- there are unverified local-only commits;
- another task branch contains work that has not yet been classified as merged, intentionally retained, or abandoned.

Never solve an unexpected divergence by immediately running `git reset --hard`, force-pushing, or deleting branches. First identify unique commits and confirm whether their content is already represented in `main`.

## Create one temporary branch per task

After `main` is clean and current, create a branch from it.

For a Notion task with an Order number, prefer:

```text
order<NUMBER>-<short-slug>
```

For work without an Order number, use a clear semantic prefix such as:

```text
feat/<short-slug>
fix/<short-slug>
chore/<short-slug>
```

Example:

```bash
git switch -c order640-guest-artwall
```

Do not create multiple parallel `work`, `squash`, `final`, or `sync` branches for the same task unless there is a concrete recovery need. If a temporary recovery branch is necessary, delete it after the recovery is verified.

## During implementation

- Commit only files that belong to the current task.
- Prefer small, meaningful commits.
- Do not mix unrelated local work into a task commit.
- Do not use duplicate branches as version storage; Git history is the version history.
- Do not merge `main` into the task branch merely to synchronize history. Prefer rebasing the task branch onto the latest `origin/main` before integration.
- If an external tool, connector, or automation can write to GitHub, do not let it write directly to remote `main` while the local repository may contain unpublished work. Either verify that local `main` is synchronized first or use a task branch.

## Before integrating a completed task

Run the task-specific validation required by `AGENTS.md`, then update the branch against the latest remote `main`:

```bash
git fetch origin --prune
git rebase origin/main
```

If conflicts appear, resolve them deliberately and rerun the relevant validation. Do not hide conflicts with force operations.

For the normal local workflow, keep history linear with a fast-forward merge:

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only <task-branch>
git push origin main
```

If a pull request is used instead, merge it through GitHub, delete the remote head branch immediately after merge, then update local `main` with `git pull --ff-only origin main` before starting another task.

## Mandatory cleanup after merge

After the task is present in `main`, remove the completed branch:

```bash
git branch -d <task-branch>
git push origin --delete <task-branch>  # only if the branch was pushed
git fetch origin --prune
```

Do not leave merged task branches, `sync-*` branches, or temporary recovery branches behind "just in case". Create a temporary backup branch only before a genuinely risky history operation, and remove it once the resulting `main` has been verified.

## Final repository check

At the end of a Git-publishing task, verify:

```bash
git fetch origin --prune

echo "===== STATUS ====="
git status

echo "===== LOCAL ====="
git branch -vv

echo "===== REMOTE ====="
git branch -r

echo "===== LOCAL ONLY ====="
git log --oneline origin/main..main

echo "===== REMOTE ONLY ====="
git log --oneline main..origin/main
```

The expected idle result is:

- `git status` reports a clean working tree and `main` up to date with `origin/main`;
- local branch listing contains only `main`, unless another task is actively in progress;
- remote branch listing contains only `origin/main`, unless another task is actively in progress;
- `LOCAL ONLY` is empty;
- `REMOTE ONLY` is empty.

## Auditing an old branch before deletion

`git cherry -v main <branch>` is useful for identifying patch-equivalent commits, but a `+` does not automatically mean the branch contains product changes missing from `main`. Squash merges, rebases, or later rewrites can change commit identity while preserving or superseding the file content.

Before deleting an old branch that still shows `+` commits:

1. inspect the branch-to-main diff;
2. compare the current affected files with `main`;
3. confirm whether `main` already contains the same or newer implementation;
4. only then delete the branch.

Never delete an old branch solely because its name looks temporary.

## Rule for agents and automation

When an agent performs Git work for Muuzee:

1. inspect the current local Git state first when local access is available;
2. treat the current files and current Git state as source of truth, not prior conversation memory;
3. avoid direct remote-`main` writes that can create local/remote divergence;
4. use one task branch, integrate it into `main`, and clean it up in the same work cycle when the user has authorized commit/push/merge operations;
5. do not claim Git cleanup is complete until the final repository check passes.

This workflow is an implementation-operating rule. It does not require a Notion Decision unless the repository strategy itself is intentionally changed.