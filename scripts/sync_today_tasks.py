#!/usr/bin/env python3
"""Sync today's items from the private GitHub Projects v2 Scrum board."""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

OWNER = "redp4rrot"
PROJECT_NUMBER = 3
TZ = ZoneInfo("Asia/Kolkata")
TOKEN = os.environ.get("PROJECTS_TOKEN")
OUT = Path("data/today-tasks.json")

QUERY = """
query($cursor: String) {
  user(login: "redp4rrot") {
    projectV2(number: 3) {
      title
      items(first: 100, after: $cursor) {
        nodes {
          isArchived
          content {
            ... on Issue { title url state number }
            ... on PullRequest { title url state number }
            ... on DraftIssue { title body }
          }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldDateValue { date field { name } }
              ... on ProjectV2ItemFieldSingleSelectValue { name field { name } }
              ... on ProjectV2ItemFieldTextValue { text field { name } }
              ... on ProjectV2ItemFieldMultiSelectValue { value field { name } }
              ... on ProjectV2ItemFieldLabelValue { labels(first: 20) { nodes { name } } field { name } }
              ... on ProjectV2ItemFieldIterationValue { title field { name } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""

def graphql(cursor=None):
    payload = json.dumps({"query": QUERY, "variables": {"cursor": cursor}}).encode()
    request = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
            "User-Agent": "arsenal-today-plan-sync",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get("errors"):
        raise RuntimeError("; ".join(error.get("message", "GraphQL error") for error in result["errors"]))
    return result["data"]["user"]["projectV2"]

def values_for(item):
    result = {}
    for value in item.get("fieldValues", {}).get("nodes", []):
        field = value.get("field") or {}
        name = field.get("name")
        if not name:
            continue
        if "date" in value:
            result[name] = value["date"]
        elif "text" in value:
            result[name] = value["text"]
        elif "value" in value:
            result[name] = value["value"]
        elif "name" in value:
            result[name] = value["name"]
        elif "labels" in value:
            result[name] = [label["name"] for label in value["labels"]["nodes"]]
        elif "title" in value:
            result[name] = value["title"]
    return result

def as_slots(value):
    if value is None or value == "":
        return []
    values = value if isinstance(value, list) else str(value).replace(";", ",").split(",")
    return [str(part).strip() for part in values if str(part).strip()]

def main():
    if not TOKEN:
        raise RuntimeError("Missing PROJECTS_TOKEN secret. Add a token with read:project access.")
    now = datetime.now(TZ)
    today = now.date().isoformat()
    project_title = "CSE-2026/2027"
    tasks = []
    cursor = None

    while True:
        project = graphql(cursor)
        project_title = project.get("title") or project_title
        connection = project["items"]
        for item in connection["nodes"]:
            if item.get("isArchived"):
                continue
            content = item.get("content") or {}
            fields = values_for(item)
            if str(fields.get("Date", ""))[:10] != today:
                continue
            title = content.get("title")
            if not title:
                continue
            status = fields.get("Status") or content.get("state") or "Open"
            tasks.append({
                "title": title,
                "url": content.get("url", ""),
                "number": content.get("number"),
                "status": str(status),
                "slots": as_slots(fields.get("Slot")),
            })
        page = connection["pageInfo"]
        if not page["hasNextPage"]:
            break
        cursor = page["endCursor"]

    payload = {
        "date": today,
        "generated_at": now.isoformat(timespec="seconds"),
        "timezone": "Asia/Kolkata",
        "project": project_title,
        "tasks": tasks,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(tasks)} tasks for {today} from {project_title}.")

if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError, KeyError, TypeError) as error:
        print(f"Task sync failed: {error}", file=sys.stderr)
        sys.exit(1)
