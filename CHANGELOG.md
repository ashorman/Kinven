# Local Change Log

This log starts from the rollback baseline requested on 2026-09-09. Entries are intentionally numbered so later changes can be reversed one at a time.

## KV-027 — Storage migration and deployment header hardening

- Restricted storage migration to the current Kinven keys and explicit `aftertone-*` legacy keys, with schema validation before persisted tasks or groups are used.
- Persisted local data now carries a Kinven app/version marker, and unrelated same-origin task-shaped data or theme values are ignored.
- Added static deployment header config for Netlify-style hosts and Vercel, plus deployment guidance for hosts that need platform-level header setup.
- Regression: the identity suite verifies unrelated storage keys are not imported.
- Revert: restore broad `localStorage` key scanning, remove `public/_headers` and `vercel.json`, and delete the deployment-header docs.

## KV-026 — Public setup is clone, install, run

- SETUP.md is only clone, `npm install`, and `npm run dev`.
- Removed local folder paths from this changelog. Stopped tracking launcher `.rtf` files.
- Revert: restore the previous SETUP copy and changelog path mentions.

## KV-025 — Drop work GitHub wording from SETUP

- Removed extra GitHub-account instructions from SETUP so the public docs stay to running the app.
- Revert: restore that paragraph in `SETUP.md`.

## KV-024 — Public docs: localhost is not a hosted app

- README and SETUP now say `127.0.0.1:5173` is the local Vite URL after `npm run dev`, not a public site.
- Clone instructions use the GitHub repo instead of a local machine folder path.
- Revert: restore the previous README/SETUP copy.

## KV-023 — Setup brief for running and publishing Kinven

- Added `SETUP.md` covering local run and the GitHub remote.
- README now points at that brief.
- Revert: delete `SETUP.md` and the README pointer.

## KV-022 — Kinven workspace and branding cleanup

- Pointed the Cursor workspace at the Kinven project folder, renamed the chat title to Kinven, and replaced the generic Vite README with Kinven-specific docs.
- Added a Kinven wordmark in the titlebar and explicit migration from legacy `aftertone-local-v1` / `aftertone-theme` storage keys.
- Renamed changelog ticket prefixes from `AT-` to `KV-`.
- Regression: the identity suite verifies the titlebar brand and legacy storage migration.
- Revert: remove `.app-brand`, the legacy key constants, and restore the previous README/changelog prefixes.

## KV-021 — Enter deletes, Escape cancels on the delete dialog

- While a delete confirmation is open, Enter now confirms the deletion instead of opening the hovered task for editing.
- Escape dismisses the dialog and leaves the task in place. The same keys apply to the delete-all-completed confirm.
- Regression: the delete confirmation suite covers Enter deleting and Escape cancelling.
- Revert: remove the early `deletingTask`/`deletingAllCompleted` branch from the window keydown handler.

## KV-020 — Sidebar filters retarget the calendar planning pane

- On the calendar, sidebar filters now swap the planning pane instead of navigating away, so Upcoming, Today, Completed, and groups stay draggable onto the grid.
- Added an "Open full list" action in the pane heading that expands the current filter into the full-page list.
- Outside the calendar the sidebar still navigates, and the active highlight follows whichever target applies.
- Dropping a calendar task on the pane now toasts "Moved to Inbox" since the pane may be showing another filter.
- Regression: a planning pane suite covers retargeting and expanding; existing list suites reach full pages via the Tasks tab.
- Revert: remove `paneFilter`/`selectFilter`/`tasksForFilter`, point the sidebar back at `setView`, and restore the inbox-only planning pane.

## KV-019 — Drop the N badge from the planning quick add

- Removed the `N` hint from the calendar planning quick-add field, since typing in that field cannot trigger the shortcut.
- The global `N` shortcut still opens the new-task dialog when focus is outside a text field.
- Regression: the planning quick add suite asserts no badge renders and that `N` still opens the dialog.
- Revert: restore `<kbd>N</kbd>` inside the planning pane `quick-create` block.

## KV-018 — Full 24-hour calendar grid and search focus fix

- The time grid now spans midnight to midnight instead of 7:00–20:00, so evening and early-morning times are visible and the now line appears at times like 20:59.
- Grid geometry moved to shared `DAY_MINUTES`/`GRID_HEIGHT` constants covering drops, resizes, keyboard placement, and task positioning.
- The calendar scrolls to the current time on open, since the grid is now taller than the viewport.
- Search results no longer steal focus from the search box, so clearing the field returns to the previous view without using Clear search.
- Regression: calendar suites cover the 24-hour gutter and evening now line; search suites cover focus retention and clearing.
- Revert: restore the 7:00–20:00 constants, the `.hours span:nth-child` offsets, the 780px grid, and unconditional quick-add autofocus.

## KV-017 — Inbox scheduling copy and live calendar time marker

- Inbox now states that it holds unscheduled tasks only and that scheduling moves them to Today, Upcoming, and the calendar.
- Added a current-time line and gutter label on the calendar that re-syncs on an interval, on window focus, and on tab visibility so timezone changes are picked up.
- Past days render at a lighter hue and today gets an accent column tint plus a highlighted header.
- Regression: the inbox clarity and calendar time suites cover the copy, marker position, and day emphasis classes.
- Revert: remove `useCurrentTime`, the `now-line`/`now-label` markup and styles, the `past`/`today` column classes, and the inbox `view-hint`.

## KV-016 — Tasks appear in the active view after quick add

- Today now includes unscheduled tasks so quick-added items stay visible on Today without auto-scheduling them at 9:00.
- Upcoming quick add places new tasks on tomorrow so they appear in that view while other views stay unscheduled.
- Regression: the task creation suite verifies Today quick add renders immediately in the active view.
- Revert: restore the old Today filter and view-agnostic quick-add date handling.

## KV-015 — Unscheduled quick add, global search, completed cleanup

- Quick add and Add task now create unscheduled inbox tasks instead of defaulting to 9:00 today.
- Search now matches task titles across all tasks and replaces the main list while active, including from Calendar.
- Completed sidebar counts and lists collapse recurring series to one row so totals match what you see.
- Added Select all, Delete all completed, and clearer search clear controls for batch cleanup.
- Regression: task creation, search, and completed-collapse suites cover the new behavior.
- Revert: restore today quick-add scheduling, view-scoped search filtering, raw completed counts, and the new batch/search UI.

## KV-014 — Remove decorative titlebar traffic lights

- Removed the non-functional macOS-style red/yellow/green circles from the header.
- Simplified the titlebar layout so Tasks/Calendar stay centered and the theme toggle stays on the right.
- Regression: the header suite verifies `.traffic-lights` is not rendered.
- Revert: restore the `traffic-lights` markup and titlebar grid styles in `KinvenApp.tsx` and `Kinven.css`.

## KV-013 — Light-theme quick-add text contrast

- Switched quick-add input text from hardcoded white to theme text colors so typed tasks stay visible in light mode.
- Regression: the theme suite verifies quick-add input color after switching to light mode.
- Revert: restore `color: white` on `.quick-create input` and remove the light-theme input override.

## KV-012 — Task schedule clarity and select mode batching

- Added schedule badges, mixed-view section headers, and summary counts on Tasks list views.
- Restored batch actions behind an explicit Select mode so rows keep a single completion control outside selection.
- Batch actions now support complete, move to inbox, assign group, and delete.
- Regression: the task list suite verifies schedule sections, select mode batching, and the single-checkbox default.
- Revert: remove `ListView`, selection mode state, schedule badge styles, and batch group handling.

## KV-011 — Task list clarity and inbox semantics

- Removed the extra batch-selection checkbox from task list rows so each task has one completion control.
- Aligned list tasks with the quick-add field by rendering a single full-width task row.
- Clarified that the calendar planning inbox only shows unscheduled tasks; scheduled tasks stay on the calendar until dropped back into inbox.
- Regression: the task list suite verifies one completion control per row and that scheduled seed tasks do not appear in the planning inbox.
- Revert: restore `selected` state, batch bar, `.select-box` styles, and the previous inbox copy in `KinvenApp.tsx`.

## KV-010 — Sidebar typography balance

- Increased sidebar nav and group link size to 14px with medium weight for better legibility.
- Reduced the `+ New task` button to 13px so it no longer dominates the sidebar.
- Added light-theme contrast overrides so sidebar labels read clearly on the pale background.
- Regression: the sidebar typography suite verifies nav items stay larger than the new-task button and use readable light-theme colors.
- Revert: restore the previous `.sidebar-button`, `.group-link`, `.sidebar-new`, and light-theme sidebar color rules in `Kinven.css`.

## KV-009 — Kinven identity migration

- Renamed the application, source files, tests, stylesheet, launcher document, package metadata, browser title, and storage keys to Kinven.
- Added generic local-storage discovery so existing tasks and theme preferences remain available after the key migration.
- Regression: the complete test suite runs through the renamed Kinven entry point.
- Revert: restore the pre-KV-009 identity from version history as one atomic change.

## KV-008 — Disambiguate create-group action

- Added the unique accessible name `Create group` so it cannot be confused with the subtask Add action.
- Regression: the group-dropdown test selects this action by its unique accessible name.
- Revert: remove the `aria-label` from the inline create-group button and restore the previous test selector.

## KV-007 — Confirm hovered-task deletion

- Delete/Backspace on a hovered task opens a confirmation dialog before changing data.
- Recurring tasks continue into the existing recurrence-scope prompt after confirmation.
- Regression: the hover suite verifies the dialog opens and the task remains before confirmation.
- Revert: remove `deletingTask`, `DeleteTaskModal`, and its associated styles.

## KV-006 — Hover-scoped task shortcuts

- Hover highlights and targets a task for exactly these actions: Delete, `E`, `R`, Enter, `Cmd+D`, `Cmd+O`, and `Cmd+S`.
- `E` completes, `R` reopens, Enter edits, and Command shortcuts focus date, group, or subtasks.
- Other task actions are suppressed while hovering.
- Regression: the hover suite covers status changes, editing, field focus, suppression, and deletion confirmation.
- Revert: remove `hoveredTaskId`, task `data-task-id` attributes, the hovered-task keyboard branch, and hover outline style.

## KV-005 — Editable task subtasks

- Every task editor now includes subtasks with editable titles and reversible checkboxes.
- Subtasks can be added and removed without changing the parent task status.
- Regression: the subtask suite verifies add, edit, complete, and reopen behavior.
- Revert: remove the `subtasks-editor` block from `TaskModal` and its associated styles.

## KV-004 — Persisted light/dark themes

- Added a header theme switch and persisted the choice in `kinven-theme`.
- Added complete light-theme surface and text overrides.
- Regression: the theme suite verifies switching, persistence, and reverse-toggle availability.
- Revert: remove `theme` state/effect, the header theme button, and `html[data-theme='light']` styles.

## KV-003 — Remove inactive focus header pill

- Removed the `No active focus block` header section.
- Regression: the header suite verifies the text is absent.
- Revert: restore the `now-pill` element in the title bar and its previous grid sizing.

## KV-002 — Remove new-task “Capture something” heading

- New-task dialogs now show the existing `New task` eyebrow without the redundant `Capture something` heading.
- Regression: `src/KinvenApp.test.tsx` verifies the removed copy does not render.
- Revert: restore the new-task `<h2>` fallback in `TaskModal`.

## KV-001 — Create groups from the new-task dropdown

- Added `+ Create new group…` to the Group dropdown when creating a task.
- The inline flow creates the group, gives it the default purple color, and immediately selects it for the task.
- Regression: `src/KinvenApp.test.tsx` verifies creation and selection.
- Revert: remove `onCreateGroup`, the `__create__` option/inline controls, and `.inline-group-create` styles.

## Verification infrastructure

- Added Vitest, jsdom, and React Testing Library.
- Run all regressions with `npm test`.
