# Pool & Plan

A personal planner: a pool of tasks on the left, a 06:00–23:00 calendar for time blocking on the right.

- **Sections and lists**: a section (Admin, Creative, …) is a board; its lists are the columns.
- **Tasks**: date, optional time and duration, priority, labels, repeat, reminder, subtasks.
- **Views**: Today, Upcoming, Inbox, each section, Periodic, By labels; calendar over 1, 3, 5 days, a week or a month.
- **Zones**: shade recurring hours of the week (deep work, relaxed, …) behind the calendar.

## Running it

The whole app is the single file `index.html`. Open it in a browser, or serve the folder with any static web host.

## Where data lives

For now, everything is saved in the browser of the device you use (local storage), so each device has its own copy.
Syncing with Todoist is being built. How every project, section and task maps between Todoist and Pool & Plan is described in [MAPPING.md](MAPPING.md); the code is in `todoist-mapping.js`, tested with `node test/mapping.test.js`.
