"""Quick Mailchimp diagnostic — run with: python test_mailchimp.py"""
import mailchimp_marketing as mc

API_KEY = "3c43494615613635d87d04e6c16b179c-us9"
SERVER = "us9"
AUDIENCE_ID = "d360140446"
FROM_EMAIL = "huzaifa@tekinvo.com"
FROM_NAME = "MoMetric"

client = mc.Client()
client.set_config({"api_key": API_KEY, "server": SERVER})

print("=== PING ===")
print(client.ping.get())

print("\n=== AUDIENCE MEMBERS ===")
members = client.lists.get_list_members_info(AUDIENCE_ID, count=20)
for m in members.get("members", []):
    print(f"  {m['email_address']} — status: {m['status']}")
print(f"Total: {members.get('total_items')}")

print("\n=== RECENT CAMPAIGNS ===")
campaigns = client.campaigns.list(count=5, sort_field="create_time", sort_dir="DESC")
for c in campaigns.get("campaigns", []):
    subj = c.get("settings", {}).get("subject_line", "(no subject)")
    print(f"  {c['id']} — {subj[:60]} — status: {c['status']}")
print(f"Total campaigns: {campaigns.get('total_items')}")

# Try to create a test campaign to see what error we get
print("\n=== TEST CAMPAIGN CREATION ===")
test_email = "huzaifa@tekinvo.com"
try:
    campaign = client.campaigns.create({
        "type": "regular",
        "recipients": {
            "list_id": AUDIENCE_ID,
            "segment_opts": {
                "match": "any",
                "conditions": [
                    {
                        "condition_type": "EmailAddress",
                        "field": "EMAIL",
                        "op": "is",
                        "value": test_email,
                    }
                ],
            },
        },
        "settings": {
            "subject_line": "[MoMetric TEST] Assignment notification test",
            "from_name": FROM_NAME,
            "reply_to": FROM_EMAIL,
            "title": "MoMetric Test Campaign",
        },
    })
    campaign_id = campaign["id"]
    print(f"Campaign created: {campaign_id}")
    
    # Set content
    client.campaigns.set_content(campaign_id, {
        "html": "<html><body><h1>Test</h1><p>This is a test notification from MoMetric.</p></body></html>",
    })
    print("Content set OK")
    
    # Try to send
    client.campaigns.send(campaign_id)
    print(f"Campaign SENT successfully to {test_email}")
except Exception as exc:
    print(f"FAILED: {type(exc).__name__}: {exc}")
    # If the exception object has a body/text attribute, print it
    if hasattr(exc, 'body'):
        print(f"  Body: {exc.body}")
    if hasattr(exc, 'text'):
        print(f"  Text: {exc.text}")
    if hasattr(exc, 'status'):
        print(f"  Status: {exc.status}")
