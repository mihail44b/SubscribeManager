import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Tuple
import anyio

from app.config import settings

def send_email_sync(to_email: str, subject: str, body: str) -> bool:
    """
    Synchronous function to send email via SMTP.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[Warning] SMTP not configured. Skipping email to {to_email}.")
        print(f"Subject: {subject}")
        print(f"Body:\n{body}")
        return False

    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_FROM
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Email successfully sent to {to_email} with subject: '{subject}'")
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        return False

async def send_email_async(to_email: str, subject: str, body: str) -> bool:
    """
    Asynchronous wrapper for email sending to prevent event loop blocking.
    """
    return await anyio.to_thread.run_sync(send_email_sync, to_email, subject, body)

async def send_welcome_email(to_email: str):
    """
    Sends a welcome email to the newly registered user.
    """
    subject = "Welcome to SubSpace!"
    body = (
        "Hello!\n\n"
        "Thank you for registering at SubSpace — your personal Subscription & Payment Manager.\n\n"
        "With SubSpace you can:\n"
        "- Track your Netflix, AWS, Mobile, and other subscriptions.\n"
        "- Get expense forecasts for the next 30, 90, and 365 days.\n"
        "- Receive timely email notifications 24 hours before your payments are due.\n\n"
    )
    await send_email_async(to_email, subject, body)

async def send_expiration_notification(to_email: str, subs: List[Tuple[str, str, str]]):
    """
    Sends an expiration reminder email listing subscriptions due tomorrow.
    """
    subject = "Subscription Payment Reminder!"
    body = "Hello!\n\nThis is a reminder that the following subscriptions are due for payment tomorrow:\n\n"
    for title, amount, currency in subs:
        body += f"- {title}: {amount} {currency}\n"
    body += "\nPlease visit the web panel to manage your subscriptions and record payments."
    await send_email_async(to_email, subject, body)
    return await send_email_async(to_email, subject, body)