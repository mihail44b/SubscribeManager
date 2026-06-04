import asyncio
import smtplib
from datetime import date, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Tuple
from sqlalchemy import select

# Allow running this script from the project root
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import Subscription, User

def send_notification_email(email: str, subs: List[Tuple[str, str, str]]) -> bool:
    """
    Sends an email notification to the user listing their subscriptions due tomorrow.
    Each sub in `subs` is a tuple of (title, amount, currency).
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[Warning] SMTP not configured. Skipping email to {email}.")
        print(f"Sub list for {email}: {subs}")
        return False

    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_FROM
    msg['To'] = email
    msg['Subject'] = "Subscription Payment Reminder!"

    # Create detailed body text
    body = "Hello!\n\nThis is a reminder that the following subscriptions are due for payment tomorrow:\n\n"
    for title, amount, currency in subs:
        body += f"- {title}: {amount} {currency}\n"
    body += "\nPlease visit the web panel to manage your subscriptions and record payments.\n\nBest regards,\nSubscription Manager"

    msg.attach(MIMEText(body, 'plain'))

    try:
        # Connect to server and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Notification email sent to {email} containing {len(subs)} subscription(s).")
        return True
    except Exception as e:
        print(f"Error sending email to {email}: {e}")
        return False

async def main():
    print("Starting subscription notification cron job...")
    tomorrow = date.today() + timedelta(days=1)
    print(f"Looking for active subscriptions due on: {tomorrow}")

    async with AsyncSessionLocal() as session:
        # Fetch active subscriptions due tomorrow with their corresponding users
        stmt = (
            select(Subscription, User)
            .join(User, Subscription.user_id == User.id)
            .where(
                Subscription.is_active == True,
                Subscription.next_payment_date == tomorrow
            )
        )
        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            print("No subscriptions due tomorrow found. Exiting.")
            return

        # Group subscriptions by user email
        user_notifications: Dict[str, List[Tuple[str, str, str]]] = {}
        for sub, user in rows:
            if user.email not in user_notifications:
                user_notifications[user.email] = []
            user_notifications[user.email].append((sub.title, str(sub.amount), sub.currency))

        # Send notifications
        sent_count = 0
        for email, subs in user_notifications.items():
            success = send_notification_email(email, subs)
            if success:
                sent_count += 1

        print(f"Cron job finished. Processed {len(user_notifications)} users. Emails sent: {sent_count}")

if __name__ == "__main__":
    asyncio.run(main())
