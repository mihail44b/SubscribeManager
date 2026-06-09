import asyncio
from datetime import date, timedelta
from typing import Dict, List, Tuple
from sqlalchemy import select

import sys
import os
# Добавляем корневую директорию, чтобы импорты app.* работали
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models import Subscription, User
from app.email import send_expiration_notification

async def main():
    print("Starting subscription notification cron job...")
    # Ищем подписки, оплата по которым завтра
    target_date = date.today() + timedelta(days=1)
    print(f"Looking for active subscriptions due on: {target_date}")

    async with AsyncSessionLocal() as session:
        # Делаем join с User, чтобы получить доступ к user.currency и user.email
        stmt = (
            select(Subscription, User)
            .join(User, Subscription.user_id == User.id)
            .where(
                Subscription.is_active == True,
                Subscription.next_payment_date == target_date,
                User.is_verified == True  # Шлем только тем, кто подтвердил почту
            )
        )
        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            print("No active subscriptions due tomorrow found. Exiting.")
            return

        # Группируем подписки по Email
        user_notifications: Dict[str, List[Tuple[str, str, str]]] = {}
        for sub, user in rows:
            if user.email not in user_notifications:
                user_notifications[user.email] = []
            
            # Валюту берем из объекта user, а не sub
            user_notifications[user.email].append((sub.title, str(sub.amount), user.currency))

        # Отправка уведомлений
        sent_count = 0
        for email, subs in user_notifications.items():
            success = await send_expiration_notification(email, subs)
            if success:
                sent_count += 1

        print(f"Cron job finished. Processed {len(user_notifications)} users. Emails sent: {sent_count}")

if __name__ == "__main__":
    asyncio.run(main())