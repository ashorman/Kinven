# Local Change Log

This log starts from the rollback baseline requested on 2026-09-09. Entries are intentionally numbered so later changes can be reversed one at a time.

## AT-009 — Kinven identity migration

- Renamed the application, source files, tests, stylesheet, launcher document, package metadata, browser title, and storage keys to Kinven.
- Added generic local-storage discovery so existing tasks and theme preferences remain available after the key migration.
- Regression: the complete test suite runs through the renamed Kinven entry point.
- Revert: restore the pre-AT-009 identity from version history as one atomic change.

## AT-008 — Disambiguate create-group action

- Added the unique accessible name `Create group` so it cannot be confused with the subtask Add action.
- Regression: the group-dropdown test selects this action by its unique accessible name.
- Revert: remove the `aria-label` from the inline create-group button and restore the previous test selector.

## AT-007 — Confirm hovered-task deletion

- Delete/Backspace on a hovered task opens a confirmation dialog before changing data.
- Recurring tasks continue into the existing recurrence-scope prompt after confirmation.
- Regression: the hover suite verifies the dialog opens and the task remains before confirmation.
- Revert: remove `deletingTask`, `DeleteTaskModal`, and its associated styles.

## AT-006 — Hover-scoped task shortcuts

- Hover highlights and targets a task for exactly these actions: Delete, `E`, `R`, Enter, `Cmd+D`, `Cmd+O`, and `Cmd+S`.
- `E` completes, `R` reopens, Enter edits, and Command shortcuts focus date, group, or subtasks.
- Other task actions are suppressed while hovering.
- Regression: the hover suite covers status changes, editing, field focus, suppression, and deletion confirmation.
- Revert: remove `hoveredTaskId`, task `data-task-id` attributes, the hovered-task keyboard branch, and hover outline style.

## AT-005 — Editable task subtasks

- Every task editor now includes subtasks with editable titles and reversible checkboxes.
- Subtasks can be added and removed without changing the parent task status.
- Regression: the subtask suite verifies add, edit, complete, and reopen behavior.
- Revert: remove the `subtasks-editor` block from `TaskModal` and its associated styles.

## AT-004 — Persisted light/dark themes

- Added a header theme switch and persisted the choice in `kinven-theme`.
- Added complete light-theme surface and text overrides.
- Regression: the theme suite verifies switching, persistence, and reverse-toggle availability.
- Revert: remove `theme` state/effect, the header theme button, and `html[data-theme='light']` styles.

## AT-003 — Remove inactive focus header pill

- Removed the `No active focus block` header section.
- Regression: the header suite verifies the text is absent.
- Revert: restore the `now-pill` element in the title bar and its previous grid sizing.

## AT-002 — Remove new-task “Capture something” heading

- New-task dialogs now show the existing `New task` eyebrow without the redundant `Capture something` heading.
- Regression: `src/KinvenApp.test.tsx` verifies the removed copy does not render.
- Revert: restore the new-task `<h2>` fallback in `TaskModal`.

## AT-001 — Create groups from the new-task dropdown

- Added `+ Create new group…` to the Group dropdown when creating a task.
- The inline flow creates the group, gives it the default purple color, and immediately selects it for the task.
- Regression: `src/KinvenApp.test.tsx` verifies creation and selection.
- Revert: remove `onCreateGroup`, the `__create__` option/inline controls, and `.inline-group-create` styles.

## Verification infrastructure

- Added Vitest, jsdom, and React Testing Library.
- Run all regressions with `npm test`.
