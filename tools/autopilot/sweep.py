#!/usr/bin/env python3
"""PR autopilot sweep. No AI: plain rules from merge-policy.json.

Reads every open PR, decides one action per PR, optionally performs the safe
ones, and rewrites one issue ("DO: needs Lisa") listing what needs a person.

Safe by default: mode "dry-run" only reports. Set mode "apply" in the policy
(or run the workflow with apply=true) to act. Never deletes an unmerged
branch, never squashes or rebases, never edits merge-policy.json.
"""
import datetime as dt
import json
import os
import subprocess
import sys

POLICY_FILE = "merge-policy.json"
KILL_FILE = "autopilot-off"
ISSUE_TITLE = "DO: needs Lisa"
ISSUE_LABEL = "do-lisa"
RED = {"FAILURE", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "ACTION_REQUIRED", "ERROR"}


def parse_date(s):
    return dt.date.fromisoformat(s)


def check_state(pr):
    """Return (state, privacy_red) where state is green, red or pending."""
    rollup = pr.get("statusCheckRollup") or []
    if not rollup:
        return "pending", False
    red = pending = privacy_red = False
    for c in rollup:
        name = (c.get("name") or c.get("context") or "").lower()
        concl = (c.get("conclusion") or c.get("state") or "").upper()
        status = (c.get("status") or "").upper()
        if concl in RED:
            red = True
            if "privacy" in name:
                privacy_red = True
        elif status and status != "COMPLETED":
            pending = True
        elif concl in ("PENDING", "EXPECTED", ""):
            pending = True
    if red:
        return "red", privacy_red
    return ("pending" if pending else "green"), False


def touches(files, prefixes):
    return [f for f in files if any(f == p or f.startswith(p) for p in prefixes)]


def classify(pr, policy, open_heads, today):
    """Return (action, reason). Actions: SKIP, WAIT, RETARGET, UPDATE, ARM, MERGE, DO."""
    if pr.get("isDraft"):
        return "SKIP", "draft"
    if today > parse_date(policy["expires_on"]):
        return "DO", "approval lapsed: renew merge-policy.json"
    author = (pr.get("author") or {}).get("login", "")
    if author in policy["dependabot_authors"]:
        return "DO", "dependabot: merge or close? (not automatic)"
    files = [f["path"] for f in pr.get("files") or []]
    if len(files) >= 100:
        return "DO", "100+ files: cannot check paths"
    hit = touches(files, policy["sensitive_paths"])
    if hit:
        return "DO", "sensitive path: " + hit[0]
    if policy["scope"] == "docs-only" and any(not touches([f], policy["docs_paths"]) for f in files):
        return "DO", "outside the docs-only scope"
    base = pr["baseRefName"]
    if base != policy["default_branch"]:
        if base in open_heads:
            return "WAIT", "stacked on #%s: parent not merged yet" % open_heads[base]
        return "RETARGET", "parent merged: retarget to " + policy["default_branch"]
    if pr.get("mergeable") == "CONFLICTING":
        return "DO", "merge conflict: a bot or the Master must fix it"
    state, privacy_red = check_state(pr)
    if privacy_red:
        return "DO", "privacy guard failed"
    if state == "red":
        return "DO", "a check is red"
    if state == "pending":
        return "ARM", "checks running: arm auto-merge"
    ms = pr.get("mergeStateStatus")
    if ms == "CLEAN":
        return "MERGE", "green and clean"
    if ms == "BEHIND":
        return "UPDATE", "behind main: update branch"
    if ms == "BLOCKED":
        return "DO", "blocked by a rule or review"
    return "WAIT", "state " + str(ms)


def order(prs):
    """Parents before children: sort by stack depth."""
    heads = {p["headRefName"]: p for p in prs}

    def depth(p, seen=()):
        b = p["baseRefName"]
        if b in heads and b not in seen:
            return 1 + depth(heads[b], seen + (b,))
        return 0

    return sorted(prs, key=lambda p: (depth(p), p["number"]))


def gh(*args, check=True):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError("gh %s failed: %s" % (" ".join(args[:3]), r.stderr.strip()))
    return r.stdout


def act(action, pr, policy):
    n = str(pr["number"])
    if action == "RETARGET":
        gh("pr", "edit", n, "--base", policy["default_branch"])
    elif action == "UPDATE":
        gh("pr", "update-branch", n)
    elif action == "ARM":
        args = ["pr", "merge", n, "--auto", "--merge"]
        if policy.get("delete_head_after_merge"):
            args.append("--delete-branch")
        gh(*args)
    elif action == "MERGE":
        args = ["pr", "merge", n, "--merge"]
        if policy.get("delete_head_after_merge"):
            args.append("--delete-branch")
        gh(*args)


def chrome_task(do_items):
    lines = [
        "TASK: Merge these PRs on GitHub in this exact order. Signed-in GitHub account: ljoyrose.",
        "Stop and report if any step shows a conflict, a red X, or a button not described here.",
        "Never use Squash and merge or Rebase and merge, always Create a merge commit. Do NOT click Delete branch.",
        "If the Merge click is refused, do not stop: leave the page open ready to press, one window per PR, and tell Lisa.",
        "",
    ]
    for i, (pr, _) in enumerate(do_items, 1):
        gate = " Do NOT start this step until the previous step shows Merged." if i > 1 and pr["baseRefName"] != "main" else ""
        lines.append("%d. Open %s . Confirm all checks are green. Press Merge pull request, then Create a merge commit, then Confirm.%s" % (i, pr["url"], gate))
    lines.append("%d. Report one line per PR: DONE / READY for Lisa to press / STOPPED + why." % (len(do_items) + 1))
    return "\n".join(lines)


def build_body(rows, policy, today, applied, mode, now):
    do = [(p, r) for (p, a, r) in rows if a == "DO"]
    auto = [(p, a, r) for (p, a, r) in rows if a in ("MERGE", "ARM", "UPDATE", "RETARGET")]
    wait = [(p, r) for (p, a, r) in rows if a == "WAIT"]
    ages = [(now - dt.datetime.fromisoformat(p["createdAt"].replace("Z", "+00:00"))).days for (p, _, _) in rows]
    exp = parse_date(policy["expires_on"])
    left = (exp - today).days
    out = ["_Rewritten by the PR autopilot sweep. Mode: **%s**. Last run: %s UTC._" % (mode, now.strftime("%Y-%m-%d %H:%M")), ""]
    if left < 0:
        out += ["**Standing approval has lapsed. Everything below needs your yes until you renew `merge-policy.json`.**", ""]
    elif left <= policy["renew_warning_days"]:
        out += ["**Renew standing approval (expires %s, %d days). Same wording?**" % (exp, left), ""]
    out += ["## Needs you (%d)" % len(do)]
    out += ["- #%d %s : %s" % (p["number"], p["title"], r) for p, r in do] or ["- nothing"]
    out += ["", "## Done or queued by the autopilot (%d)" % len(auto)]
    out += ["- #%d %s : %s%s" % (p["number"], a, r, "" if applied else " (dry-run, not done)") for p, a, r in auto] or ["- nothing"]
    out += ["", "## Waiting on a parent PR (%d)" % len(wait)]
    out += ["- #%d : %s" % (p["number"], r) for p, r in wait] or ["- nothing"]
    out += ["", "## KPIs", "- open PRs: %d" % len(rows), "- oldest PR: %d days" % (max(ages) if ages else 0),
            "- waiting on Lisa: %d" % len(do), "- queued by autopilot: %d" % len(auto)]
    mergeable = [(p, r) for p, r in do if "sensitive" in r or "dependabot" in r or "docs-only" in r]
    if mergeable:
        out += ["", "## If you say OK to the sensitive / outside-scope items, paste this to Chrome", "```", chrome_task(order_pairs(mergeable)), "```"]
    return "\n".join(out)


def order_pairs(pairs):
    by = {p["number"]: r for p, r in pairs}
    return [(p, by[p["number"]]) for p in order([p for p, _ in pairs])]


def upsert_issue(body):
    gh("label", "create", ISSUE_LABEL, "--force", "--color", "D93F0B", check=False)
    found = json.loads(gh("issue", "list", "--label", ISSUE_LABEL, "--state", "open", "--json", "number") or "[]")
    path = "autopilot-body.md"
    with open(path, "w") as f:
        f.write(body)
    if found:
        gh("issue", "edit", str(found[0]["number"]), "--body-file", path)
    else:
        gh("issue", "create", "--title", ISSUE_TITLE, "--label", ISSUE_LABEL, "--body-file", path)


def main():
    if os.path.exists(KILL_FILE):
        print("autopilot-off present: doing nothing")
        return 0
    with open(POLICY_FILE) as f:
        policy = json.load(f)
    mode = "apply" if (policy["mode"] == "apply" or os.environ.get("APPLY") == "true") else "dry-run"
    prs = json.loads(gh("pr", "list", "--state", "open", "--limit", "200", "--json",
                        "number,title,url,isDraft,baseRefName,headRefName,mergeable,mergeStateStatus,"
                        "statusCheckRollup,files,createdAt,author"))
    open_heads = {p["headRefName"]: p["number"] for p in prs}
    now = dt.datetime.now(dt.timezone.utc)
    today = now.date()
    rows = []
    for pr in order(prs):
        action, reason = classify(pr, policy, open_heads, today)
        rows.append((pr, action, reason))
        print("#%s %s: %s" % (pr["number"], action, reason))
        if mode == "apply" and action in ("RETARGET", "UPDATE", "ARM", "MERGE"):
            try:
                act(action, pr, policy)
            except RuntimeError as e:
                print("  failed:", e)
    upsert_issue(build_body(rows, policy, today, mode == "apply", mode, now))
    return 0


if __name__ == "__main__":
    sys.exit(main())
