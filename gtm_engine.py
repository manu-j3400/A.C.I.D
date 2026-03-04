"""
Soteria Go-To-Market Engine
============================
Automated marketing intelligence that runs daily to find opportunities,
monitor competitors, discover communities, and recommend actions.

Modules:
  1. Community Discovery — finds where your audience hangs out
  2. Competitor Monitor — tracks what rivals are doing
  3. Trend Radar — surfaces trending security topics
  4. Opportunity Scorer — ranks and recommends actions
"""
import os
import json
import sqlite3
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

ROOT = Path(__file__).resolve().parent
GTM_DB_PATH = ROOT / "middleware" / "gtm.db"


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ══════════════════════════════════════════════════════════════════════════════

def init_gtm_db():
    conn = sqlite3.connect(str(GTM_DB_PATH))
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT,
        name TEXT,
        url TEXT UNIQUE,
        relevance_score REAL,
        audience_size INTEGER,
        description TEXT,
        category TEXT,
        discovered_at TEXT NOT NULL,
        last_checked TEXT,
        status TEXT DEFAULT 'new'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        url TEXT,
        github_url TEXT,
        stars INTEGER DEFAULT 0,
        last_release TEXT,
        pricing_tier TEXT,
        key_features TEXT,
        weaknesses TEXT,
        last_checked TEXT NOT NULL
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS trends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT,
        source TEXT,
        url TEXT,
        engagement_score INTEGER,
        category TEXT,
        discovered_at TEXT NOT NULL,
        actionable INTEGER DEFAULT 0,
        action_taken TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS gtm_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT,
        priority TEXT,
        description TEXT,
        target_community TEXT,
        target_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        completed_at TEXT
    )''')
    conn.commit()
    conn.close()


init_gtm_db()


# ══════════════════════════════════════════════════════════════════════════════
# COMMUNITY DISCOVERY
# ══════════════════════════════════════════════════════════════════════════════

COMMUNITY_SOURCES = {
    "github": {
        "searches": [
            "code security scanner",
            "vulnerability detection tool",
            "static analysis security",
            "malware detection python",
            "SAST tool",
            "code audit tool",
        ],
        "type": "repos"
    },
    "reddit": {
        "subreddits": [
            {"name": "netsec", "url": "https://www.reddit.com/r/netsec/", "category": "security"},
            {"name": "cybersecurity", "url": "https://www.reddit.com/r/cybersecurity/", "category": "security"},
            {"name": "AskNetsec", "url": "https://www.reddit.com/r/AskNetsec/", "category": "security"},
            {"name": "Python", "url": "https://www.reddit.com/r/Python/", "category": "development"},
            {"name": "javascript", "url": "https://www.reddit.com/r/javascript/", "category": "development"},
            {"name": "webdev", "url": "https://www.reddit.com/r/webdev/", "category": "development"},
            {"name": "devops", "url": "https://www.reddit.com/r/devops/", "category": "devops"},
            {"name": "SideProject", "url": "https://www.reddit.com/r/SideProject/", "category": "startup"},
            {"name": "startups", "url": "https://www.reddit.com/r/startups/", "category": "startup"},
            {"name": "opensource", "url": "https://www.reddit.com/r/opensource/", "category": "development"},
            {"name": "devsecops", "url": "https://www.reddit.com/r/devsecops/", "category": "security"},
            {"name": "AppSec", "url": "https://www.reddit.com/r/AppSec/", "category": "security"},
        ]
    },
    "hackernews": {
        "keywords": ["security scanner", "SAST", "code vulnerability", "supply chain attack",
                      "dependency confusion", "malware detection"],
        "url": "https://hn.algolia.com/api/v1/search",
        "category": "tech"
    },
    "devto": {
        "tags": ["security", "cybersecurity", "python", "webdev", "opensource", "devops"],
        "url": "https://dev.to/api/articles",
        "category": "content"
    },
    "producthunt": {
        "url": "https://www.producthunt.com/topics/developer-tools",
        "category": "launch_platform"
    }
}

COMPETITORS = [
    # ── Giants (monitor for market shifts) ──
    {
        "name": "Snyk",
        "url": "https://snyk.io",
        "github_url": "https://github.com/snyk/cli",
        "tier": "giant",
        "pricing_tier": "Free tier + paid ($25+/dev/mo)",
        "key_features": "SCA, container scanning, IaC, SAST",
        "weaknesses": "Expensive at scale, complex setup, enterprise-focused sales cycle"
    },
    {
        "name": "SonarQube",
        "url": "https://www.sonarsource.com",
        "github_url": "https://github.com/SonarSource/sonarqube",
        "tier": "giant",
        "pricing_tier": "Community (free) + paid",
        "key_features": "Code quality, SAST, multi-language",
        "weaknesses": "Heavy infrastructure, Java-based, slow scans, ugly UI"
    },
    {
        "name": "Semgrep",
        "url": "https://semgrep.dev",
        "github_url": "https://github.com/semgrep/semgrep",
        "tier": "giant",
        "pricing_tier": "Free OSS + paid cloud ($40/dev/mo)",
        "key_features": "Pattern matching, custom rules, fast",
        "weaknesses": "Rule writing learning curve, limited ML, no real-time scanning"
    },
    {
        "name": "CodeQL",
        "url": "https://codeql.github.com",
        "github_url": "https://github.com/github/codeql",
        "tier": "giant",
        "pricing_tier": "Free for public repos, GitHub Advanced Security for private",
        "key_features": "Deep semantic analysis, GitHub native",
        "weaknesses": "Slow on large codebases, query language complex, GitHub lock-in"
    },
    # ── Direct competitors (same weight class, fight these first) ──
    {
        "name": "Bandit",
        "url": "https://bandit.readthedocs.io",
        "github_url": "https://github.com/PyCQA/bandit",
        "tier": "small",
        "pricing_tier": "Free (OSS)",
        "key_features": "Python-specific, fast, lightweight, CI-friendly",
        "weaknesses": "Python only, no ML, high false positive rate, no UI"
    },
    {
        "name": "Bearer",
        "url": "https://www.bearer.com",
        "github_url": "https://github.com/Bearer/bearer",
        "tier": "small",
        "pricing_tier": "Free OSS + cloud",
        "key_features": "Data flow analysis, SAST, privacy-focused scanning",
        "weaknesses": "Narrow focus on data leaks, smaller rule set, newer product"
    },
    {
        "name": "Grype",
        "url": "https://github.com/anchore/grype",
        "github_url": "https://github.com/anchore/grype",
        "tier": "small",
        "pricing_tier": "Free (OSS)",
        "key_features": "Container/SCA vulnerability scanner, fast, Go-based",
        "weaknesses": "SCA only (no SAST), no code analysis, no ML"
    },
    {
        "name": "Trivy",
        "url": "https://trivy.dev",
        "github_url": "https://github.com/aquasecurity/trivy",
        "tier": "small",
        "pricing_tier": "Free (OSS by Aqua Security)",
        "key_features": "Container, filesystem, git repo scanning, fast",
        "weaknesses": "Primarily SCA/config, limited SAST, no ML-based detection"
    },
    {
        "name": "Horusec",
        "url": "https://horusec.io",
        "github_url": "https://github.com/ZupIT/horusec",
        "tier": "small",
        "pricing_tier": "Free (OSS)",
        "key_features": "Multi-language SAST, orchestrates other tools, dashboard",
        "weaknesses": "Complex setup, depends on other scanners, slower, less active maintenance"
    },
    {
        "name": "Insider",
        "url": "https://github.com/insidersec/insider",
        "github_url": "https://github.com/insidersec/insider",
        "tier": "small",
        "pricing_tier": "Free (OSS)",
        "key_features": "SAST for mobile/web apps, OWASP-focused",
        "weaknesses": "Limited language support, smaller community, less frequent updates"
    },
    {
        "name": "Njsscan",
        "url": "https://github.com/ajinabraham/njsscan",
        "github_url": "https://github.com/ajinabraham/njsscan",
        "tier": "small",
        "pricing_tier": "Free (OSS)",
        "key_features": "Node.js SAST, semantic grep, pattern matching",
        "weaknesses": "JS/Node only, no ML, small team, limited patterns"
    },
    {
        "name": "Whispers",
        "url": "https://github.com/Skyscanner/whispers",
        "github_url": "https://github.com/Skyscanner/whispers",
        "tier": "small",
        "pricing_tier": "Free (OSS by Skyscanner)",
        "key_features": "Secret detection in code and config files",
        "weaknesses": "Secrets only (no vuln detection), narrow scope, no UI"
    },
    {
        "name": "GuardDog",
        "url": "https://github.com/DataDog/guarddog",
        "github_url": "https://github.com/DataDog/guarddog",
        "tier": "small",
        "pricing_tier": "Free (OSS by DataDog)",
        "key_features": "PyPI/npm malicious package detection, supply chain focus",
        "weaknesses": "Package scanning only, no source code SAST, narrow scope"
    },
    {
        "name": "Socket.dev",
        "url": "https://socket.dev",
        "github_url": "https://github.com/SocketDev/socket",
        "tier": "mid",
        "pricing_tier": "Free tier + paid",
        "key_features": "Supply chain security, dependency analysis, npm/PyPI focus",
        "weaknesses": "Dependencies only (no source SAST), JS/Python ecosystem focus"
    },
    {
        "name": "Aikido Security",
        "url": "https://www.aikido.dev",
        "github_url": "",
        "tier": "mid",
        "pricing_tier": "Free tier + paid ($17/dev/mo)",
        "key_features": "All-in-one AppSec, SAST+SCA+DAST+secrets+IaC",
        "weaknesses": "Newer company, aggregates other tools, less deep per-area"
    },
    {
        "name": "Qwiet AI (ShiftLeft)",
        "url": "https://qwiet.ai",
        "github_url": "https://github.com/ShiftLeftSecurity/sast-scan",
        "tier": "mid",
        "pricing_tier": "Free community + enterprise",
        "key_features": "AI-powered SAST, code property graphs, fast",
        "weaknesses": "Enterprise-focused, complex onboarding, limited free tier"
    },
]


def discover_communities() -> list[dict]:
    """Find and score relevant communities."""
    conn = sqlite3.connect(str(GTM_DB_PATH))
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    new_communities = []

    for sub in COMMUNITY_SOURCES["reddit"]["subreddits"]:
        c.execute("SELECT id FROM communities WHERE url = ?", (sub["url"],))
        if not c.fetchone():
            relevance = 0.9 if sub["category"] == "security" else 0.7 if sub["category"] == "development" else 0.5
            c.execute(
                "INSERT INTO communities (platform, name, url, relevance_score, "
                "category, description, discovered_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("reddit", sub["name"], sub["url"], relevance, sub["category"],
                 f"r/{sub['name']} — {sub['category']} community", now, "new")
            )
            new_communities.append({"platform": "reddit", "name": sub["name"],
                                     "category": sub["category"], "relevance": relevance})

    hn_communities = [
        {"name": "Hacker News", "url": "https://news.ycombinator.com",
         "category": "tech", "relevance": 0.85},
        {"name": "Show HN", "url": "https://news.ycombinator.com/show",
         "category": "launch_platform", "relevance": 0.95},
    ]
    for hn in hn_communities:
        c.execute("SELECT id FROM communities WHERE url = ?", (hn["url"],))
        if not c.fetchone():
            c.execute(
                "INSERT INTO communities (platform, name, url, relevance_score, "
                "category, description, discovered_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("hackernews", hn["name"], hn["url"], hn["relevance"], hn["category"],
                 f"{hn['name']} — top tech community", now, "new")
            )
            new_communities.append({"platform": "hackernews", "name": hn["name"],
                                     "category": hn["category"], "relevance": hn["relevance"]})

    devto_tags = ["security", "cybersecurity", "python", "webdev", "opensource"]
    for tag in devto_tags:
        url = f"https://dev.to/t/{tag}"
        c.execute("SELECT id FROM communities WHERE url = ?", (url,))
        if not c.fetchone():
            relevance = 0.8 if tag in ("security", "cybersecurity") else 0.6
            c.execute(
                "INSERT INTO communities (platform, name, url, relevance_score, "
                "category, description, discovered_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("devto", f"#{tag}", url, relevance, "content",
                 f"dev.to #{tag} — developer content platform", now, "new")
            )
            new_communities.append({"platform": "devto", "name": f"#{tag}",
                                     "category": "content", "relevance": relevance})

    other_platforms = [
        {"platform": "producthunt", "name": "Product Hunt",
         "url": "https://www.producthunt.com", "category": "launch_platform", "relevance": 0.9},
        {"platform": "discord", "name": "Python Discord",
         "url": "https://discord.gg/python", "category": "development", "relevance": 0.7},
        {"platform": "discord", "name": "OWASP Slack",
         "url": "https://owasp.org/slack/invite", "category": "security", "relevance": 0.85},
        {"platform": "github", "name": "GitHub Discussions (Security)",
         "url": "https://github.com/topics/security", "category": "security", "relevance": 0.8},
        {"platform": "stackoverflow", "name": "StackOverflow [security]",
         "url": "https://stackoverflow.com/questions/tagged/security", "category": "security", "relevance": 0.75},
    ]
    for p in other_platforms:
        c.execute("SELECT id FROM communities WHERE url = ?", (p["url"],))
        if not c.fetchone():
            c.execute(
                "INSERT INTO communities (platform, name, url, relevance_score, "
                "category, description, discovered_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (p["platform"], p["name"], p["url"], p["relevance"], p["category"],
                 f"{p['name']} — {p['category']} community", now, "new")
            )
            new_communities.append(p)

    conn.commit()
    conn.close()
    return new_communities


# ══════════════════════════════════════════════════════════════════════════════
# COMPETITOR MONITORING
# ══════════════════════════════════════════════════════════════════════════════

def monitor_competitors() -> list[dict]:
    """Check competitor GitHub repos for stars, recent activity."""
    conn = sqlite3.connect(str(GTM_DB_PATH))
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    results = []

    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "Soteria-GTM/1.0"}
    if token:
        headers["Authorization"] = f"token {token}"

    for comp in COMPETITORS:
        stars = 0
        last_release = "unknown"

        if comp.get("github_url"):
            parts = comp["github_url"].rstrip("/").split("/")
            if len(parts) >= 2:
                owner, repo = parts[-2], parts[-1]
                try:
                    api_url = f"https://api.github.com/repos/{owner}/{repo}"
                    req = urllib.request.Request(api_url, headers=headers)
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read().decode())
                        stars = data.get("stargazers_count", 0)
                        last_release = data.get("pushed_at", "unknown")[:10]
                except Exception:
                    pass

        c.execute("SELECT id FROM competitors WHERE name = ?", (comp["name"],))
        if c.fetchone():
            c.execute(
                "UPDATE competitors SET stars = ?, last_release = ?, last_checked = ? WHERE name = ?",
                (stars, last_release, now, comp["name"])
            )
        else:
            c.execute(
                "INSERT INTO competitors (name, url, github_url, stars, last_release, "
                "pricing_tier, key_features, weaknesses, last_checked) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (comp["name"], comp["url"], comp.get("github_url", ""), stars,
                 last_release, comp["pricing_tier"], comp["key_features"],
                 comp["weaknesses"], now)
            )

        results.append({
            "name": comp["name"],
            "tier": comp.get("tier", "unknown"),
            "stars": stars,
            "last_release": last_release,
            "pricing": comp["pricing_tier"],
            "key_features": comp["key_features"],
            "weaknesses": comp["weaknesses"]
        })

    conn.commit()
    conn.close()
    return results


# ══════════════════════════════════════════════════════════════════════════════
# TREND RADAR
# ══════════════════════════════════════════════════════════════════════════════

def scan_trends() -> list[dict]:
    """Check Hacker News for trending security topics."""
    conn = sqlite3.connect(str(GTM_DB_PATH))
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    trends = []

    keywords = ["security vulnerability", "supply chain attack", "CVE", "code scanner",
                "SAST", "malware", "ransomware", "zero day", "dependency confusion",
                "npm malware", "PyPI malware"]

    for kw in keywords[:5]:
        try:
            encoded = urllib.parse.quote(kw)
            url = f"https://hn.algolia.com/api/v1/search_by_date?query={encoded}&tags=story&hitsPerPage=3"
            req = urllib.request.Request(url, headers={"User-Agent": "Soteria-GTM/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                for hit in data.get("hits", []):
                    title = hit.get("title", "")
                    story_url = hit.get("url", "") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
                    points = hit.get("points", 0) or 0

                    c.execute("SELECT id FROM trends WHERE url = ?", (story_url,))
                    if c.fetchone():
                        continue

                    is_actionable = points > 50 or any(
                        w in title.lower() for w in ["vulnerability", "scanner", "security tool", "cve", "malware"]
                    )

                    c.execute(
                        "INSERT INTO trends (topic, source, url, engagement_score, "
                        "category, discovered_at, actionable) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (title[:200], "hackernews", story_url, points,
                         kw, now, 1 if is_actionable else 0)
                    )
                    trends.append({
                        "title": title[:120],
                        "source": "HN",
                        "points": points,
                        "url": story_url,
                        "actionable": is_actionable,
                        "keyword": kw
                    })
        except Exception:
            continue

    conn.commit()
    conn.close()
    return trends


# ══════════════════════════════════════════════════════════════════════════════
# OPPORTUNITY SCORER & ACTION GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_actions(communities: list, competitors: list, trends: list) -> list[dict]:
    """Generate ranked GTM actions based on intelligence gathered."""
    conn = sqlite3.connect(str(GTM_DB_PATH))
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    actions = []

    actionable_trends = [t for t in trends if t.get("actionable")]
    for trend in actionable_trends[:3]:
        action = {
            "action_type": "content_response",
            "priority": "P0" if trend.get("points", 0) > 100 else "P1",
            "description": (
                f"Write a comment/post responding to: '{trend['title'][:80]}' — "
                f"position Soteria as a solution. {trend['points']} points on HN."
            ),
            "target_community": trend.get("source", "HN"),
            "target_url": trend.get("url", ""),
        }
        c.execute(
            "INSERT INTO gtm_actions (action_type, priority, description, "
            "target_community, target_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (action["action_type"], action["priority"], action["description"],
             action["target_community"], action["target_url"], "pending", now)
        )
        actions.append(action)

    weak_competitors = [comp for comp in competitors if "slow" in comp.get("weaknesses", "").lower()
                        or "expensive" in comp.get("weaknesses", "").lower()]
    for comp in weak_competitors[:2]:
        action = {
            "action_type": "competitive_positioning",
            "priority": "P1",
            "description": (
                f"Create comparison page: Soteria vs {comp['name']}. "
                f"Highlight: {comp['weaknesses']}"
            ),
            "target_community": "website",
            "target_url": comp.get("url", ""),
        }
        c.execute(
            "INSERT INTO gtm_actions (action_type, priority, description, "
            "target_community, target_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (action["action_type"], action["priority"], action["description"],
             action["target_community"], action["target_url"], "pending", now)
        )
        actions.append(action)

    conn.row_factory = sqlite3.Row
    c2 = conn.cursor()
    c2.execute(
        "SELECT platform, name, url, category FROM communities "
        "WHERE status = 'new' AND relevance_score >= 0.8 ORDER BY relevance_score DESC LIMIT 3"
    )
    high_value_communities = [dict(row) for row in c2.fetchall()]

    for comm in high_value_communities:
        action = {
            "action_type": "community_engagement",
            "priority": "P1",
            "description": (
                f"Join and engage in {comm['name']} ({comm['platform']}). "
                f"Share value-first content about code security."
            ),
            "target_community": comm["name"],
            "target_url": comm["url"],
        }
        c.execute(
            "INSERT INTO gtm_actions (action_type, priority, description, "
            "target_community, target_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (action["action_type"], action["priority"], action["description"],
             action["target_community"], action["target_url"], "pending", now)
        )
        actions.append(action)

    launch_action = {
        "action_type": "launch_prep",
        "priority": "P0",
        "description": (
            "Prepare Product Hunt launch: create maker profile, prepare assets, "
            "draft launch copy, schedule for Tuesday 12:01 AM PST."
        ),
        "target_community": "Product Hunt",
        "target_url": "https://www.producthunt.com",
    }
    c.execute("SELECT id FROM gtm_actions WHERE action_type = 'launch_prep' AND status = 'pending'")
    if not c.fetchone():
        c.execute(
            "INSERT INTO gtm_actions (action_type, priority, description, "
            "target_community, target_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (launch_action["action_type"], launch_action["priority"],
             launch_action["description"], launch_action["target_community"],
             launch_action["target_url"], "pending", now)
        )
        actions.append(launch_action)

    conn.commit()
    conn.close()
    return actions


# ══════════════════════════════════════════════════════════════════════════════
# MAIN INTELLIGENCE REPORT
# ══════════════════════════════════════════════════════════════════════════════

def run_gtm_intel() -> dict:
    """Run the full GTM intelligence pipeline and return a report."""
    communities = discover_communities()
    competitors = monitor_competitors()
    trends = scan_trends()
    actions = generate_actions(communities, competitors, trends)

    p0_actions = [a for a in actions if a.get("priority") == "P0"]
    actionable_trends = [t for t in trends if t.get("actionable")]
    total_stars = sum(c.get("stars", 0) for c in competitors)

    community_summary = (
        f"{len(communities)} new communities discovered across "
        f"{len(set(c.get('platform', '') for c in communities))} platforms"
        if communities else "No new communities (all already tracked)"
    )

    giants = [c for c in competitors if c.get("tier") == "giant"]
    mids = [c for c in competitors if c.get("tier") == "mid"]
    smalls = [c for c in competitors if c.get("tier") == "small"]

    giant_names = ", ".join(f"{c['name']} ({c['stars']:,}★)" for c in giants if c.get("stars"))
    mid_names = ", ".join(f"{c['name']} ({c['stars']:,}★)" for c in mids if c.get("stars"))
    small_names = ", ".join(f"{c['name']} ({c['stars']:,}★)" for c in smalls if c.get("stars"))

    competitor_summary = (
        f"Tracking {len(competitors)} competitors ({len(giants)} giants, "
        f"{len(mids)} mid-tier, {len(smalls)} direct rivals) — "
        f"{total_stars:,} GitHub stars combined. "
        f"Giants: {giant_names or 'N/A'}. "
        f"Mid-tier: {mid_names or 'N/A'}. "
        f"Direct rivals: {small_names or 'N/A'}."
    )

    trending_summary = (
        f"{len(trends)} trending topics found, {len(actionable_trends)} actionable"
        if trends else "No new trends detected"
    )

    actions_summary = (
        f"{len(actions)} actions generated — {len(p0_actions)} are P0 (urgent)"
        if actions else "No new actions"
    )

    return {
        "status": "gtm_report_ready",
        "notification_summary": (
            f"GTM: {len(p0_actions)} urgent actions | "
            f"{len(actionable_trends)} hot trends | "
            f"{len(communities)} new communities | "
            f"{len(competitors)} competitors tracked"
        ),
        "community_summary": community_summary,
        "competitor_summary": competitor_summary,
        "trending_summary": trending_summary,
        "actions_summary": actions_summary,
        "communities": communities[:10],
        "competitors": competitors,
        "trends": trends[:15],
        "actions": actions,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
