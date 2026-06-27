# Task Manager

A small full stack Task Manager built with a dependency-free Node.js backend and a vanilla JavaScript frontend.

## Features

- View all tasks
- Create a new task
- Mark a task as completed
- Delete a task
- Filter tasks by all, active, and completed
- Show loading, success, and error states
- Persist tasks in a local JSON file

## Requirements

- Node.js 18+ (tested with Node.js 22)

## Run locally

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

For auto-reload while developing:

```bash
npm run dev
```

## API

- `GET /tasks` returns all tasks
- `POST /tasks` creates a task with `{ "title": "Task name" }`
- `PATCH /tasks/:id` updates a task with `{ "completed": true }` or `{ "title": "Updated title" }`
- `DELETE /tasks/:id` deletes a task

## Notes and trade-offs

- I used Node's built-in `http` module to keep the solution intentionally small and avoid external dependencies.
- Tasks are persisted in `data/tasks.json`, which is enough for this exercise but not suitable for concurrent multi-user access.
- I included task filtering and persistence as small bonus items once the core CRUD flow was complete.
