"""
Quick SMTP test — verifies email sending works.

Usage:
    python test_smtp.py                          # uses .env values
    python test_smtp.py your@gmail.com password  # override credentials
"""
import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Load env — try backend/.env first, then root .env
_here = os.path.dirname(os.path.abspath(__file__))
for _env in [os.path.join(_here, ".env"), os.path.join(_here, "..", ".env")]:
    if os.path.isfile(_env):
        load_dotenv(_env, override=True)
        print(f"Loaded env from: {_env}")
        break

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = sys.argv[1] if len(sys.argv) > 1 else os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = sys.argv[2] if len(sys.argv) > 2 else os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)
FROM_NAME = os.getenv("SMTP_FROM_NAME", "MoMetric")

if not SMTP_USERNAME or not SMTP_PASSWORD:
    print("ERROR: SMTP_USERNAME and SMTP_PASSWORD are required.")
    print("Either set them in .env or pass as arguments:")
    print("  python test_smtp.py your@gmail.com your-app-password")
    sys.exit(1)

print(f"=== SMTP TEST ===")
print(f"Host: {SMTP_HOST}:{SMTP_PORT}")
print(f"Username: {SMTP_USERNAME}")
print(f"From: {FROM_NAME} <{FROM_EMAIL}>")
print()

# Step 1: Test connection
print("1. Connecting to SMTP server...")
try:
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
    server.ehlo()
    server.starttls()
    server.ehlo()
    print("   TLS connection OK")
except Exception as exc:
    print(f"   FAILED: {exc}")
    sys.exit(1)

# Step 2: Login
print("2. Authenticating...")
try:
    server.login(SMTP_USERNAME, SMTP_PASSWORD)
    print("   Login OK")
except smtplib.SMTPAuthenticationError as exc:
    print(f"   AUTH FAILED: {exc}")
    print()
    print("   For Gmail, you need an App Password:")
    print("   1. Go to https://myaccount.google.com/security")
    print("   2. Enable 2-Step Verification")
    print("   3. Go to App Passwords → Generate one for 'Mail'")
    print("   4. Use the 16-character password (no spaces)")
    server.quit()
    sys.exit(1)

# Step 3: Send test email
print(f"3. Sending test email to {SMTP_USERNAME}...")
try:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[MoMetric] SMTP Test - Email Working!"
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = SMTP_USERNAME

    html = """
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
            <h2 style="color:#ffffff;margin:0;font-size:20px;">SMTP Test Successful!</h2>
        </div>
        <div style="padding:24px 28px;">
            <p style="margin:0 0 8px;color:#374151;font-size:14px;">
                Your MoMetric email notifications are configured and working correctly.
            </p>
            <p style="margin:0;color:#6B7280;font-size:13px;">
                Notifications will be sent for node changes, source ingestion, and card assignments.
            </p>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">Sent from MoMetric SMTP test script.</p>
        </div>
    </div>
    """
    msg.attach(MIMEText("SMTP Test Successful! Your MoMetric emails are working.", "plain"))
    msg.attach(MIMEText(html, "html"))

    server.sendmail(FROM_EMAIL, [SMTP_USERNAME], msg.as_string())
    server.quit()
    print("   EMAIL SENT SUCCESSFULLY!")
    print()
    print(f"   Check your inbox at: {SMTP_USERNAME}")
except Exception as exc:
    print(f"   FAILED: {exc}")
    server.quit()
    sys.exit(1)
