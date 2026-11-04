import json
import os
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

TOKEN = os.environ["PROJECTS_TOKEN"]
QUERY = '''
query($cursor: String) {
  user(login: "redp4rrot") {
    projectV2(number: 3) {
      items(first: 100, after: $cursor) {
        nodes {
          isArchived
          content {
            ... on Issue { title url }
            ... on PullRequest { title url }
            ... on DraftIssue { title }
          }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
              ... on ProjectV2ItemFieldMultiSelectValue { value field { ... on ProjectV2FieldCommon { name } } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
'''

tasks = []
cursor = None
while True:
    body = json.dumps({"query": QUERY, "variables": {"cursor": cursor}}).encode()
    request = urllib.request.Request(
        "https://api.github.com/graphql",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read())
    if result.get("errors"):
        raise RuntimeError("; ".join(error["message"] for error in result["errors"]))
    project = result["data"]["user"]["projectV2"]
    if project is None:
        raise RuntimeError("Could not find Project #3 for redp4rrot")
    for item in project["items"]["nodes"]:
        if item["isArchived"]:
            continue
        content = item.get("content") or {}
        if not content.get("title"):
            continue
        fields = {}
        for value in item["fieldValues"]["nodes"]:
            field = (value.get("field") or {}).get("name")
            if not field:
                continue
            if value.get("date") is not None:
                fields[field] = value["date"]
            elif value.get("value") is not None:
                fields[field] = value["value"]
            elif value.get("name") is not None:
                fields[field] = value["name"]
        task_date = fields.get("Date")
        if not task_date:
            continue
        raw_slot = fields.get("Slot", "")
        slots = [part.strip() for part in raw_slot.split(",") if part.strip()]
        tasks.append({
            "date": task_date,
            "title": content["title"],
            "url": content.get("url", ""),
            "slots": slots,
            "status": fields.get("Status", "No status"),
        })
    page = project["items"]["pageInfo"]
    if not page["hasNextPage"]:
        break
    cursor = page["endCursor"]

slot_order = {"morning": 0, "post lunch": 1, "post evening tea": 2, "late night": 3}
tasks.sort(key=lambda task: min((slot_order.get(slot.lower(), 99) for slot in task["slots"]), default=100))
os.makedirs("data", exist_ok=True)
with open("data/today-tasks.json", "w", encoding="utf-8") as output:
    json.dump({"updated_at": datetime.now(timezone.utc).isoformat(), "tasks": tasks}, output, ensure_ascii=False, indent=2)
print(f"Published {len(tasks)} dated project tasks")
