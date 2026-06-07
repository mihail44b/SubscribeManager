import asyncio
from datetime import date, timedelta
from typing import Dict, List, Tuple
from sqlalchemy import select

# Allow running this script from the project root
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models import Subscription, User
from app.email import send_expiration_notification

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
            success = await send_expiration_notification(email, subs)
            if success:
                sent_count += 1

        print(f"Cron job finished. Processed {len(user_notifications)} users. Emails sent: {sent_count}")

if __name__ == "__main__":
    asyncio.run(main())
