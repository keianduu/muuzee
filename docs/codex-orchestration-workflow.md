# ChatGPT / Codex Orchestration Workflow

This document defines the durable operating loop for developing Muuzee with ChatGPT as the orchestrator/reviewer and Codex as the implementation agent.

The goal is that a new ChatGPT conversation can resume Muuzee work from durable project state without requiring the user to restate the previous conversation.

## Roles

### ChatGPT

ChatGPT owns orchestration and review:

- start from the Muuzee Notion backlog and the current active Task;
- inspect Git/current files and relevant provider state before giving implementation instructions;
- translate the approved Task into one self-contained Codex instruction;
- review Codex's completion report against the actual Git/Notion/provider state when those sources are accessible;
- add or refine Tasks when review reveals a separate bug, dependency, tech debt, or follow-up;
- close the current Task only when its Acceptance Criteria and Human gates are satisfied;
- then identify and prepare the next eligible Task.

ChatGPT should not rely on prior-chat memory when durable current sources can be checked.

### User

The user is the handoff point between ChatGPT and Codex:

1. receives the complete Codex instruction from ChatGPT;
2. copies it to Codex;
3. performs Human-only actions or approvals when required;
4. returns Codex's completion report, screenshots, or Human-operation result to ChatGPT.

The user should not need to repeatedly explain the project history when starting a new ChatGPT conversation.

### Codex

Codex owns the implementation/operation run described by the current instruction:

- inspect the required current files and provider state;
- implement only the current Task scope;
- validate the result;
- update the Task's Implementation / Operation Log when instructed;
- report the exact result back for ChatGPT review.

Codex must follow `AGENTS.md`, `docs/project-context.md`, `docs/git-workflow.md`, and any task-specific durable instructions.

## Canonical operating loop

Use this loop by default:

```text
Notion Task / Backlog
        ↓
ChatGPT loads durable context + current Git/provider state
        ↓
ChatGPT outputs one complete copyable Codex instruction
        ↓
User copies the instruction to Codex
        ↓
Codex implements / operates / validates and reports completion
        ↓
User returns the result to ChatGPT
        ↓
ChatGPT reviews actual Git / Notion / provider state
        ↓
Issues found? ── yes → correction instruction or separate Task
        │
        no
        ↓
Human Review / required Human gate
        ↓
Current Task Done
        ↓
Prepare the next eligible Task
```

Do not let one Codex run silently expand into multiple backlog Tasks. The user may ask to process multiple Tasks explicitly, otherwise preserve the one-task rule.

## New-chat bootstrap

When the user starts a new ChatGPT conversation with a short request such as:

`Muuzeeの続きをお願いします`

or

`Muuzee Backlogの次を進めてください`

the assistant should recover state from durable sources instead of asking the user to restate the previous conversation.

Read/inspect in this order:

1. `AGENTS.md`
2. `docs/project-context.md`
3. this file: `docs/codex-orchestration-workflow.md`
4. `docs/git-workflow.md` when Git operations are relevant
5. `prototype/CONTEXT.md` only for Prototype work
6. Notion `Muuzee Backlog Execution Flow`
7. the current `Doing` Task; if none, the next eligible `Todo` Task by the backlog rules
8. current Git state and only the files relevant to that Task
9. relevant external provider state when the Task depends on it

Do not read the entire repository, entire Notion workspace, or all past conversations by default. Expand only when the current Task cannot be understood or verified from the scoped sources.

Current files, current Git state, current Notion Task content, and current provider state take precedence over old chat summaries or memory.

## Task selection

Notion Tasks are the default work queue.

- If one Task is `Doing`, resume and review that Task first.
- If none is `Doing`, choose the smallest eligible Order according to `Muuzee Backlog Execution Flow`.
- Respect Dependencies, Environment, Execution, Milestone, and Human gates.
- Do not skip an active Task merely because a later Task looks easier.
- When a new issue is outside the current Acceptance Criteria, prefer creating/refining a separate Task instead of silently increasing scope.

## Before writing a Codex instruction

ChatGPT should establish enough current state to make the instruction self-contained.

At minimum, check as applicable:

- current Notion Task, Acceptance Criteria, Decision / Discussion Log, and handoffs;
- current `main` / `origin/main` and active task branch state;
- relevant current files rather than assumed selectors/functions/architecture;
- recent implementation or provider state that materially changes the task;
- whether the Task is AI, Human, or Hybrid;
- whether a billing, destructive-operation, credential, production-data, legal, or other Human gate is required.

If a critical fact cannot be verified, make the uncertainty explicit in the Codex instruction and require a stop/Human gate rather than guessing.

## Codex instruction output rule

Every Codex instruction generated for the user must be presented as **one contiguous, fully copyable text block**.

The user should be able to copy the entire instruction in one action and paste it directly into Codex.

Rules:

- do not split the Codex instruction across multiple blocks;
- do not place required steps only in prose outside the block;
- make the instruction self-contained; avoid references such as "as described above";
- include the Task title / Order / Notion URL when known;
- include the durable files Codex must read;
- include current verified state needed to avoid repeating completed work;
- define Goal, Scope, Out of Scope / Forbidden operations, Human gates, Validation, Notion/Git closeout, and final-report requirements when applicable;
- keep secrets, passwords, access tokens, service-role keys, database passwords, and other credential values out of the instruction;
- distinguish clearly between commands Codex may run and actions that require the user;
- when the Task is provider/operations work, state which downstream Order owns deferred setup so Codex does not expand scope.

A brief ChatGPT note may appear before or after the block, but **nothing required for Codex execution may exist only outside the single copyable block**.

## Review after Codex reports completion

Do not treat the completion report itself as proof when the actual sources are accessible.

Review the relevant evidence, for example:

- current Git commit / diff / branch / `main` synchronization;
- changed current files;
- tests, lint, typecheck, build, schema/docs checks, or visual verification appropriate to the Task;
- Notion Task Status and Operation Log;
- Supabase/Vercel/other provider configuration for infrastructure Tasks;
- whether forbidden Production/destructive/secret operations remained at zero;
- whether Acceptance Criteria are actually satisfied.

If the implementation is incomplete or incorrect:

1. keep the Task `Doing` unless it is truly blocked;
2. explain the concrete gap;
3. output one new fully copyable correction instruction for Codex;
4. avoid opening unrelated work in the same correction.

If review discovers a separate issue outside current scope, create/refine a backlog Task with an appropriate Order/dependency rather than hiding it in chat.

## Closing and moving forward

When all Acceptance Criteria and required Human actions are satisfied:

1. record the final result in the Task;
2. set the Task to `Done`;
3. ensure Git/provider state is clean and consistent where applicable;
4. identify the next eligible Task from Notion;
5. prepare the next Codex instruction when the user wants to continue.

"Proceed to the next Task" means start the next orchestration cycle; it does not authorize Codex to combine multiple Tasks into one implementation run unless the user explicitly asks for that.

## Human / Hybrid boundaries

For Hybrid work:

- ChatGPT/Codex may prepare, inspect, configure, and validate within the authorized scope.
- Human-only login, billing approval, legal confirmation, account recovery, or other gated steps must be surfaced clearly.
- After the user performs the Human action, resume from the current Task rather than restarting it.
- Keep the Task `Doing` until the Human action and final validation are complete.

Never store secret values in Notion, Git, Codex prompts, or completion reports. Record only the secret name, target environment/store, and whether configuration was completed.

## Durable-state principle

The operating workflow must survive a chat reset.

Therefore, any decision or process rule that would materially affect future Muuzee work should live in one of the durable sources:

- approved product/operational intent → Notion;
- agent execution rules → `AGENTS.md`;
- cross-chat ChatGPT/Codex orchestration → this document;
- Git hygiene → `docs/git-workflow.md`;
- implementation state → current repository files;
- Task-specific discussion and result → the relevant Notion Task.

Do not make the user reconstruct important project state from old chats.
