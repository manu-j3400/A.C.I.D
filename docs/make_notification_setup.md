# Make: Notification Routing Setup

How to add success/failure notifications to your existing Make automation scenarios so you get alerted on every run.

## Prerequisites

- Existing Make scenario with an **HTTP** module hitting your Render backend (e.g. `POST /automation/improve`)
- A notification channel: **Email** (built-in) or **Slack** (free Make integration)

---

## Step 1 — Add a Router After the HTTP Module

1. Open your scenario in the Make editor.
2. Click the **+** between the HTTP module and the end of the flow.
3. Select **Flow Control > Router**.

The Router evaluates the HTTP response and sends it down different paths based on filters you define.

---

## Step 2 — Route 1: Success (Task Enqueued)

### Filter

| Field | Operator | Value |
|---|---|---|
| `Body > status` | Text operators: Equal to | `improvement_task_enqueued` |

For the healing scenario, also match `healing_task_enqueued`.

### Email Module

| Setting | Value |
|---|---|
| **To** | your email |
| **Subject** | `Soteria: {{body.notification_summary}}` |
| **Body (HTML)** | See template below |

```html
<h3>New task enqueued</h3>
<ul>
  <li><strong>Task ID:</strong> {{body.task_id}}</li>
  <li><strong>Priority:</strong> {{body.priority}}</li>
  <li><strong>Description:</strong> {{body.description}}</li>
</ul>
<h4>Queue</h4>
<ul>
  <li>Pending: {{body.queue_summary.pending}}</li>
  <li>In Progress: {{body.queue_summary.in_progress}}</li>
  <li>Completed: {{body.queue_summary.completed}}</li>
</ul>
<p><em>Cursor will pick this up on next check-in.</em></p>
```

### Slack Module (Alternative)

| Setting | Value |
|---|---|
| **Channel** | `#soteria-ops` (or your channel) |
| **Text** | `{{body.notification_summary}}` |

---

## Step 3 — Route 2: No Work Available (Optional)

### Filter

| Field | Operator | Value |
|---|---|---|
| `Body > status` | Text operators: Matches pattern (regex) | `no_tasks\|all_assigned` |

### Action

Either skip notifications for this route (leave it empty) or send a low-priority digest:

| Setting | Value |
|---|---|
| **Subject** | `Soteria: No new tasks` |
| **Body** | `{{body.notification_summary}}` |

---

## Step 4 — Route 3: Failure

### Filter

| Field | Operator | Value |
|---|---|---|
| `Status code` | Numeric operators: Greater than or equal to | `400` |

### Email Module

| Setting | Value |
|---|---|
| **To** | your email |
| **Subject** | `ALERT — Soteria automation failed` |
| **Body (HTML)** | See template below |

```html
<h3>Automation endpoint returned an error</h3>
<ul>
  <li><strong>Status code:</strong> {{statusCode}}</li>
  <li><strong>Error code:</strong> {{body.error_code}}</li>
  <li><strong>Message:</strong> {{body.message}}</li>
  <li><strong>Summary:</strong> {{body.notification_summary}}</li>
</ul>
<p>Check the Render logs and <code>/automation/status</code> for details.</p>
```

### Slack Module (Alternative)

| Setting | Value |
|---|---|
| **Channel** | `#soteria-ops` |
| **Text** | `:rotating_light: *Automation failed* ({{statusCode}}): {{body.notification_summary}}` |

---

## Backend Endpoints and Their `notification_summary` Values

Every automation endpoint now returns a `notification_summary` string you can use directly.

| Endpoint | Status | Example `notification_summary` |
|---|---|---|
| `POST /automation/improve` | `improvement_task_enqueued` | `[P0] Enqueued: Fix race condition... — 3 pending, 1 in progress` |
| `POST /automation/improve` | `no_tasks` | `No roadmap tasks found — ROADMAP.md is empty or missing` |
| `POST /automation/improve` | `all_assigned` | `All roadmap tasks already assigned — 2 pending, 1 in progress` |
| `POST /automation/improve` | error (500) | `Improve endpoint crashed: <error message>` |
| `POST /automation/webhook/render-deploy` | `healing_task_enqueued` | `[HEALING] soteria-backend deploy failed (build_failed, commit abc123) — task enqueued...` |
| `POST /automation/webhook/render-deploy` | `circuit_breaker_open` | `[BLOCKED] Healing suppressed for soteria-backend — circuit breaker open...` |
| `GET /automation/status` | 200 | `Queue: 3 pending, 1 in progress, 5 completed \| Circuit breaker: 0 blocked error(s)` |

---

## Operations Budget

| Component | Ops per run | Runs/day | Ops/month |
|---|---|---|---|
| HTTP module | 1 | 2 | 60 |
| Router | 1 | 2 | 60 |
| Email or Slack | 1 | 2 | 60 |
| **Total** | **3** | **2** | **~180** |

Make free tier allows 1,000 ops/month. This setup uses roughly 180 ops/month, leaving plenty of room for the health-check and cleanup scenarios later.
