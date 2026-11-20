# Pool & Plan

A personal planner: a pool of tasks on the left, a 06:00–23:00 calendar for time blocking on the right.

- **Sections and lists**: a section (Admin, Creative, …) is a board; its lists are the columns.
- **Tasks**: date, optional time and duration, priority, labels, repeat, reminder, subtasks.
- **Views**: Today, Upcoming, Inbox, each section, Periodic, By labels; calendar over 1, 3, 5 days, a week or a month.
- **Zones**: shade recurring hours of the week (deep work, relaxed, …) behind the calendar.

## Using it

Open https://pool-and-plan.netlify.app, paste your Todoist API token (Todoist → Settings → Integrations → Developer) and your Todoist appears, laid out as described in [MAPPING.md](MAPPING.md). The token stays in that browser only.

For now the connection is **read-only**: you can look around freely, but nothing is written back to Todoist yet.

## Files

- `src/app.html`: the app itself (also runs as a Claude artifact, without Todoist).
- `todoist-mapping.js`: how Todoist maps to boards, lists and tasks, and back. Tested with `node test/mapping.test.js`.
- `build.py`: builds `index.html`, the website, from `src/app.html`. Run it after every change to the app.
- `index.html`: the built website that Netlify serves. Don't edit it by hand.
