# Make: Notification Routing Setup

How to add success/failure notifications to your existing Make automation scenarios so you get alerted on every run.

> **Simplified email setup:** Every automation endpoint now returns an `email_html` field containing a fully detailed, styled HTML email body. In any Gmail module, just set Body type to **Raw HTML** and Content to `{{N.data.email_html}}` (where N is your HTTP module number). No manual HTML templates needed.

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

## Scenario 4: ML Health Check (Daily)

Monitors model accuracy and auto-triggers retraining when it degrades.

### Setup

1. **Create a new scenario** in Make.
2. **Schedule** trigger: once daily (e.g. 9:00 AM).
3. **HTTP > Make a request**:

| Setting | Value |
|---|---|
| **URL** | `https://a-c-i-d-1.onrender.com/automation/ml-health` |
| **Method** | GET |
| **Headers** | `X-Automation-Secret`: your secret |
| **Parse response** | Yes |

4. **Router** with two routes:

**Route 1 — Retrain triggered** (filter: `1. data: status` equals `retrain_triggered`):

Gmail subject: `ALERT — Soteria ML auto-retrain triggered`
Gmail body: `{{1.data.notification_summary}}`

**Route 2 — Healthy** (fallback):

Gmail subject: `Soteria ML: {{1.data.notification_summary}}`
Gmail body: `Accuracy: {{1.data.metrics.accuracy}} | FP: {{1.data.metrics.false_positives}} | FN: {{1.data.metrics.false_negatives}}`

---

## Scenario 5: Lead Generation Scan (Daily)

Finds vulnerable repos on GitHub and builds your sales pipeline automatically.

### Setup

1. **Create a new scenario** in Make.
2. **Schedule** trigger: once daily (e.g. 10:00 AM).
3. **HTTP > Make a request**:

| Setting | Value |
|---|---|
| **URL** | `https://a-c-i-d-1.onrender.com/automation/lead-scan` |
| **Method** | POST |
| **Headers** | `X-Automation-Secret`: your secret |
| **Body type** | Raw / JSON |
| **Request content** | `{}` |
| **Parse response** | Yes |

4. **Gmail > Send an Email** (no Router needed):

| Setting | Value |
|---|---|
| **Subject** | `Soteria Leads: {{1.data.notification_summary}}` |
| **Body type** | Raw HTML |

```html
<h2>Lead Scan Results</h2>
<p><strong>{{1.data.notification_summary}}</strong></p>
<h3>Stats</h3>
<ul>
  <li>Repos scanned: {{1.data.stats.repos_scanned}}</li>
  <li>Vulnerabilities found: {{1.data.stats.total_vulnerabilities}}</li>
  <li>High-value targets: {{1.data.stats.high_value_targets}}</li>
</ul>
<p>View full pipeline at <code>GET /automation/leads</code></p>
```

---

## Scenario 6: Lead Outreach (Weekly)

Fetches top leads and prepares personalized outreach emails.

### Setup

1. **Create a new scenario** in Make.
2. **Schedule** trigger: once weekly (e.g. Monday 11:00 AM).
3. **HTTP > Make a request** to `GET /automation/leads`.
4. **Iterator** module: iterate over `1.data.top_leads`.
5. For each lead, **Gmail > Send an Email**:

| Setting | Value |
|---|---|
| **To** | your email (review before forwarding to lead) |
| **Subject** | `Outreach draft: {{item.repo_full_name}} — {{item.vulnerabilities_found}} vulnerabilities found` |
| **Body type** | Raw HTML |

```html
<h3>Lead: {{item.repo_full_name}}</h3>
<ul>
  <li>Stars: {{item.stars}}</li>
  <li>Vulnerabilities: {{item.vulnerabilities_found}}</li>
  <li>Highest risk: {{item.highest_risk}}</li>
  <li>Owner: {{item.owner}}</li>
</ul>
<h4>Draft outreach message:</h4>
<p>Hi {{item.owner}},</p>
<p>I ran a security scan on {{item.repo_full_name}} and found
{{item.vulnerabilities_found}} potential vulnerability(ies), including
{{item.highest_risk}}-severity issues. Happy to share the full report
if you're interested.</p>
<p>We built <a href="https://soteria.app">Soteria</a> specifically for
this — free scan, instant results.</p>
```

> **Note:** Emails go to YOU first for review. Once you approve the draft, forward it to the repo owner. This keeps outreach authentic and avoids spam.

---

## Scenario 7: GTM Intelligence (Daily)

Monitors communities, competitors, and trending topics for go-to-market opportunities.

### Setup

1. **Create a new scenario** in Make.
2. **Schedule** trigger: once daily.
3. **HTTP > Make a request**:

| Setting | Value |
|---|---|
| **URL** | `https://a-c-i-d-1.onrender.com/automation/gtm-intel` |
| **Method** | GET |
| **Headers** | `X-Automation-Secret`: your secret |
| **Parse response** | Yes |

4. **Gmail > Send an Email**:

| Setting | Value |
|---|---|
| **Subject** | `Soteria GTM: {{1.data.notification_summary}}` |
| **Body type** | Raw HTML |

```html
<h2>GTM Intelligence Report</h2>
<p><strong>{{1.data.notification_summary}}</strong></p>

<h3>Trending Topics</h3>
<p>{{1.data.trending_summary}}</p>

<h3>Community Opportunities</h3>
<p>{{1.data.community_summary}}</p>

<h3>Competitor Activity</h3>
<p>{{1.data.competitor_summary}}</p>

<h3>Recommended Actions</h3>
<p>{{1.data.actions_summary}}</p>
```

---

## Backend Endpoints Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/automation/improve` | GET | Proactive improvement loop |
| `/automation/digest` | GET | Daily security digest |
| `/automation/status` | GET | Queue + circuit breaker diagnostics |
| `/automation/webhook/render-deploy` | POST | Reactive healing on deploy failure |
| `/automation/webhook/github-push` | POST | Scan files on push |
| `/automation/ml-health` | GET | ML accuracy check + auto-retrain |
| `/automation/ml-retrain` | POST | Force model retrain |
| `/automation/lead-scan` | POST | Scan GitHub for vulnerable repos |
| `/automation/leads` | GET | Lead pipeline summary + top targets |
| `/automation/gtm-intel` | GET | Community, competitor, and trend intelligence |
| `/feedback` | POST | User feedback on scan results |

---

## Operations Budget

| Scenario | Ops per run | Frequency | Ops/month |
|---|---|---|---|
| Proactive improvement loop | 3 | Every 12h | ~180 |
| Daily security digest | 2 | Daily | ~60 |
| Scan-on-push | 3 | ~5 pushes/day | ~450 |
| ML health check | 3 | Daily | ~90 |
| Lead scan | 2 | Daily | ~60 |
| Lead outreach | 3 | Weekly | ~12 |
| GTM intelligence | 2 | Daily | ~60 |
| **Total** | | | **~912** |

Make free tier allows 1,000 ops/month. All scenarios combined use roughly 912 ops/month. To stay within budget, reduce scan-on-push frequency or make lead outreach biweekly. Upgrade to Make Pro ($9/mo, 10,000 ops) when revenue starts flowing.
