# Pool & Plan ↔ Todoist mapping

How Pool & Plan reads and writes Todoist. Todoist is the only place data is stored; the website reads it in your browser and sends every edit back.

## Structure

| Todoist | Pool & Plan |
|---|---|
| Project **POOL**, section `ADMIN Tasks` | Board **ADMIN**, list **Tasks** |
| Project **MUSIC** (overflow of POOL), section `MUSIC Albums` | Board **MUSIC**, list **Albums** (same rule as POOL) |
| Project named `BOARD_Name`, e.g. `ADMIN_Example` | Board **ADMIN**, list **LCDLS**, marked *restricted editing* |
| **Inbox** project | Inbox view |
| Task in POOL or MUSIC with no section | Inbox view |
| Section `NOTES Config` | Pool & Plan's settings (hidden from all views) |
| Any other project | Its own board, named after the project; its sections are its lists |

### Section names: `BOARD List title`

- The **first space** separates board and list: the first word, written in capitals, is the board; everything after it is the list title.
  - `ADMIN Tasks` → board ADMIN, list "Tasks"
  - `ADMIN LCDLS` → board ADMIN, list "LCDLS" (list titles may be in capitals)
  - `ADMIN Buy & Sell` → board ADMIN, list "Buy & Sell"
  - `SELF-GROWING Reading` → board SELF-GROWING, list "Reading"
- A board name is one word. For two words use a hyphen (`SELF-GROWING`); the planner turns spaces in a new board name into hyphens.
- A section in POOL or MUSIC without a capitalised board word goes to an **Unsorted** board, so it is never hidden.
- Boards are shown in the order they first appear in POOL, unless the settings say otherwise. Lists keep Todoist's section order.

### Restricted lists (`BOARD_Name` projects)

These projects belong to another system (ADMIN_Example is synced with Notion by a separate routine).

- Shown with a *restricted editing* marker.
- Tasks inside can be edited and completed as usual; the Notion routine carries the change over.
- Tasks cannot be dragged into or out of the list, because that would move them between Todoist projects and break the Notion sync.

## Several Todoist accounts

Pool & Plan can read more than one Todoist account (⋯ menu → Todoist accounts). The first one connected is the **main** account.

- Each account is read with the same rules as above.
- **Boards with the same name are shown together.** ADMIN from one account and ADMIN from another become one ADMIN board holding the lists of both.
- **Every list stays in its own account.** Lists from other accounts carry the account's name, e.g. "LCDLS · gas_rnd". Tasks are saved back to the account they came from.
- **Only the main account's Inbox and settings** (`NOTES Config`) are used. Other accounts contribute their lists only.
- **Moving a task between accounts is not possible**: Todoist can't move a task from one account to another, and copying would lose its comments, history and any Notion link. Dragging between lists of different accounts is blocked.
- **Placing a project from another account on a board:** a project like `LCDLS` that carries no board in its name shows as its own board. Dragging it onto another board (coming with write-back) records the placement in the `Layout` setting.

## Tasks

| Todoist field | Pool & Plan |
|---|---|
| `content` | Task name |
| `description` | Notes |
| `priority` 4 / 3 / 2 / 1 | P1 / P2 / P3 / P4 (Todoist stores P1 as 4) |
| `labels` | Labels |
| `parent_id` | Subtask of |
| `child_order` | Manual order inside a list, written back to Todoist, so its apps show the same order |
| `checked` | Done |
| `deadline` | Shown as a flag, read-only |
| `due` = `YYYY-MM-DD` | Date, no time (all-day) |
| `due` = `YYYY-MM-DDTHH:MM:SS` | Date and time = a time block |
| `duration` (minutes) | Block length |
| `due` = `YYYY-MM-DD` + `duration` (days) | Multi-day task without a time, from the due date over that many days |
| `due.is_recurring` + `due.string` | Repeat |

- **Fixed events are ordinary tasks.** There is no separate event type.
- **A block without a duration** in Todoist is shown as 60 minutes, but no duration is written back unless you change it.
- **Several blocks for one task** are made as subtasks, each with its own date and time.
- **Multi-day tasks without a time** (a trip, a 3-day workshop) use Todoist's due date as the first day and a duration in days. Todoist stores this faithfully, but its own apps don't display day durations, so in Todoist the task looks like a one-day task on its first day. In Pool & Plan it spans every day, in the all-day row and in Today and Upcoming.
- **Times are floating** (no timezone), i.e. in your local time, as Todoist does by default.

### Repeats

Todoist interprets every repeat; Pool & Plan never rewrites one on its own guess.

- **Changing the pattern:** pick a common repeat from the menu, or choose *Custom* and type exactly what you would type in Todoist (`every 2nd tue`, `every 3rd thu of the quarter`, …). The phrase goes to Todoist unchanged, and Todoist works out the dates.
- **Moving one occurrence** (dragging a repeating task to another day or time) sends the new date together with the unchanged phrase. Todoist moves that occurrence and keeps the pattern, like its own *reschedule*.
- **Completing** a repeating task completes that occurrence, exactly like ticking it in Todoist.
- **Drawing future occurrences** is the one thing Pool & Plan works out itself, to show a repeat across the week or month. It understands `every day`, `every 3 days`, `every weekday`, `every weekend`, `every week`, `every other week`, `every 2 weeks`, `every mon, wed, fri`, `every month`, `every 15th`, `every last day`, `every 2nd tue`, `every last friday`, `every year`, `every 2 years`, each optionally with `at 07:00`. For any other phrase it shows the next date only. That is a display limit; editing is never refused.

## Settings (`NOTES Config`)

One task per setting. The task name is the setting; its description holds the data as JSON.

| Task name | Holds |
|---|---|
| `Zones` | Zone names and colours |
| `Zone grid` | Which zone each half hour of the week belongs to |
| `Rules` | Automation rules |
| `Sorting` | Sorting chosen for each board |
| `Layout` | Board order and colours |
| `Order` | Your manual order in views that mix lists: Today, each day in Upcoming, each label |

These tasks are hidden in Pool & Plan. Editing them by hand in Todoist works but is not needed.

## Syncing

- On opening, the planner loads everything once, then asks Todoist only for changes: every minute, and whenever the tab comes back into focus.
- Every edit is sent straight away. If the connection drops, edits wait in a queue and are sent when it returns.
- If the same task changes in two places between checks, the last change to reach Todoist wins.
- Todoist allows 1,000 change checks and 100 full loads per 15 minutes per user; one check a minute stays far below that.

## Limits, on purpose

- The website stores nothing on a server. Your Todoist token stays in the browser of each device you connect.
- Nothing about Notion is handled here; the separate routine keeps Notion and Todoist in step.

### Events

- A task with the label `ev`, `evS`, `evC` or `evH` is an **event**; every other task is a task.
- Events without a time show in the calendar row (multi-day ones as bars); events with a time show in the agenda.
- Events without a time (all-day and multi-day) appear only on the calendar, never in lists. Events with a time appear in both.
- A completed event stays on the calendar, faded and struck through; it leaves the lists.
- Todoist keeps at most 24 hours of length, so a multi-day duration is kept as a last line in the description: `↔ 3 days`.
- In the calendar each type has its colour: ev purple, evS mustard-khaki, evC red (as P1), evH brown. A priority (P1–P3) replaces it. Lists are not coloured.
- Clicking an empty spot in the month view or the calendar row adds an event on that day; you must pick its type. Every task with an event label is moved into `CALENDAR <Type>` (Ev, EvS, EvC, EvH) automatically, and a task has one event type: choosing another replaces it, and its colour and list follow.
- **Import calendar** (Pool & Plan menu) copies an `.ics` file or calendar link once, for example a calendar from Proton, into the same lists. Only events from today onwards; repeats stay repeating when Todoist can say the same thing, otherwise they become separate dates for the next 12 months. Importing again skips what is already there and corrects durations and times.
- Earlier labels (event, eventS, eventC, eventH, eventH2, evSug, evCump, evHome) and their CALENDAR lists are renamed once, automatically.
