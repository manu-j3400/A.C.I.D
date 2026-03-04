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

## Scenario 2: Daily Security Digest

A separate Make scenario that emails you a morning health report every day.

### Setup

1. **Create a new scenario** in Make.
2. Add a **Schedule** trigger — set to run **once daily** (e.g. 8:00 AM your time zone).
3. Add an **HTTP > Make a request** module:

| Setting | Value |
|---|---|
| **URL** | `https://a-c-i-d-1.onrender.com/automation/digest` |
| **Method** | GET |
| **Headers** | `X-Automation-Secret`: your secret |
| **Parse response** | Yes |

4. Add a **Gmail > Send an Email** module (no Router needed — this always sends):

| Setting | Value |
|---|---|
| **To** | your email |
| **Subject** | `Soteria Daily Digest — {{1.data.health.grade}} ({{1.data.health.score}}/100)` |
| **Body type** | Raw HTML |
| **Content** | See template below |

```html
<h2>Soteria Daily Digest</h2>
<p><strong>{{1.data.notification_summary}}</strong></p>

<h3>Health: {{1.data.health.grade}} ({{1.data.health.score}}/100)</h3>
<ul>
{{#each 1.data.health.reasons}}
  <li>{{this}}</li>
{{/each}}
</ul>

<h3>Task Queue</h3>
<ul>
  <li>Pending: {{1.data.queue.pending}}</li>
  <li>In Progress: {{1.data.queue.in_progress}}</li>
  <li>Completed: {{1.data.queue.completed}}</li>
  <li>Failed: {{1.data.queue.failed}}</li>
</ul>

<h3>Scans (Last 24h)</h3>
<ul>
  <li>Total scans: {{1.data.scans_24h.total_scans}}</li>
  <li>Threats found: {{1.data.scans_24h.threats_found}}</li>
  <li>Top language: {{1.data.scans_24h.top_language}}</li>
  <li>Avg confidence: {{1.data.scans_24h.avg_confidence}}</li>
</ul>

<h3>Roadmap Progress</h3>
<ul>
  <li>Done: {{1.data.roadmap_progress.done}} / {{1.data.roadmap_progress.total}}</li>
  <li>In Progress: {{1.data.roadmap_progress.in_progress}}</li>
  <li>Available: {{1.data.roadmap_progress.available}}</li>
</ul>

<p><em>Generated at {{1.data.generated_at}}</em></p>
```

> **Note:** Make's template engine may not support `{{#each}}`. If the health reasons don't render, use the simpler fallback: replace the reasons list with just `{{1.data.notification_summary}}` which already includes the key info.

---

## Scenario 3: Scan-on-Push via GitHub Webhook

Automatically scans every push to `main` for security threats and emails you the results.

### Setup

1. **Create a new scenario** in Make.
2. Add a **Custom Webhook** trigger:
   - Make will give you a unique webhook URL (e.g. `https://hook.us1.make.com/abc123...`).
   - Copy this URL.
3. **Register the webhook in GitHub:**
   - Go to your repo **Settings > Webhooks > Add webhook**.
   - **Payload URL:** paste the Make webhook URL.
   - **Content type:** `application/json`.
   - **Secret:** leave blank (Make handles auth internally for its own webhooks).
   - **Events:** select **Just the push event**.
   - Click **Add webhook**.
4. Add an **HTTP > Make a request** module after the webhook:

| Setting | Value |
|---|---|
| **URL** | `https://a-c-i-d-1.onrender.com/automation/webhook/github-push?secret=YOUR_SECRET` |
| **Method** | POST |
| **Body type** | Raw |
| **Content type** | JSON (application/json) |
| **Request content** | `{{1.data}}` (pass the entire webhook payload through) |
| **Parse response** | Yes |

> **Important:** Use `?secret=YOUR_SECRET` in the URL since this forwards the GitHub payload as-is (no custom headers from GitHub).

5. Add a **Router** after the HTTP module with two routes:

**Route 1 — Success** (filter: `Status Code` < `400`):

Add a **Gmail > Send an Email** module:

| Setting | Value |
|---|---|
| **Subject** | `Soteria Scan: {{2.data.notification_summary}}` |
| **Body type** | Raw HTML |
| **Content** | See template below |

```html
<h2>Push Scan Results</h2>
<p><strong>{{2.data.notification_summary}}</strong></p>

<h3>Push Details</h3>
<ul>
  <li><strong>Repo:</strong> {{2.data.repo}}</li>
  <li><strong>Branch:</strong> {{2.data.branch}}</li>
  <li><strong>Pushed by:</strong> {{2.data.pusher}}</li>
  <li><strong>Head SHA:</strong> {{2.data.head_sha}}</li>
</ul>

<h3>Scan Summary</h3>
<ul>
  <li>Files scanned: {{2.data.scan_summary.total_scanned}}</li>
  <li>Threats found: {{2.data.scan_summary.threats_found}}</li>
  <li>High/Critical: {{2.data.scan_summary.high_risk}}</li>
  <li>Skipped: {{2.data.scan_summary.skipped}}</li>
  <li>Errors: {{2.data.scan_summary.errors}}</li>
</ul>

<p>Check <code>/automation/status</code> for full queue details.</p>
```

**Route 2 — Failure** (filter: `Status Code` >= `400`):

Add a **Gmail > Send an Email** module with the standard error template.

---

## Backend Endpoints and Their `notification_summary` Values

Every automation endpoint now returns a `notification_summary` string you can use directly.

| Endpoint | Status | Example `notification_summary` |
|---|---|---|
| `GET /automation/improve` | `improvement_task_enqueued` | `[P0] Enqueued: Fix race condition... — 3 pending, 1 in progress` |
| `GET /automation/improve` | `no_tasks` | `No roadmap tasks found — ROADMAP.md is empty or missing` |
| `GET /automation/improve` | `all_assigned` | `All roadmap tasks already assigned — 2 pending, 1 in progress` |
| `GET /automation/improve` | error (500) | `Improve endpoint crashed: <error message>` |
| `POST /automation/webhook/render-deploy` | `healing_task_enqueued` | `[HEALING] soteria-backend deploy failed...` |
| `POST /automation/webhook/render-deploy` | `circuit_breaker_open` | `[BLOCKED] Healing suppressed for soteria-backend...` |
| `GET /automation/status` | 200 | `Queue: 3 pending, 1 in progress, 5 completed \| Circuit breaker: 0 blocked` |
| `GET /automation/digest` | `digest_ready` | `Health: B (80/100) \| Queue: 9P/0IP/0C \| Scans: 5 total, 1 threat \| Roadmap: 2/17 done` |
| `POST /automation/webhook/github-push` | `scan_complete` | `Push to user/repo/main by user — 3 file(s) scanned, clean` |
| `POST /automation/webhook/github-push` | `no_commits` | `Push to user/repo/main by user — no commits to scan` |

---

## Operations Budget

| Scenario | Ops per run | Frequency | Ops/month |
|---|---|---|---|
| Proactive improvement loop | 3 | Every 12h | ~180 |
| Daily security digest | 2 | Once daily | ~60 |
| Scan-on-push | 3 | ~5 pushes/day | ~450 |
| **Total** | | | **~690** |

Make free tier allows 1,000 ops/month. All three scenarios combined use roughly 690 ops/month, leaving a comfortable buffer. Reduce push frequency or skip the "no commits" emails to save more.
