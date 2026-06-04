from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select, text, update, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import User, Category, Subscription, PaymentHistory
from app.schemas import UserCreate, SubscriptionCreate, SubscriptionUpdate, CategoryCreate

# User CRUD
async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user_in: UserCreate, hashed_password: str) -> User:
    db_user = User(
        email=user_in.email,
        password_hash=hashed_password,
        currency=user_in.currency.upper(),
        telegram_id=user_in.telegram_id
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# Category CRUD
async def get_categories(db: AsyncSession, user_id: int) -> List[Category]:
    # Select categories where user_id IS NULL (system default) OR user_id matches current user
    result = await db.execute(
        select(Category).where(
            or_(
                Category.user_id.is_(None),
                Category.user_id == user_id
            )
        ).order_by(Category.name)
    )
    return list(result.scalars().all())

async def get_category(db: AsyncSession, category_id: int, user_id: int) -> Optional[Category]:
    result = await db.execute(
        select(Category).where(
            and_(
                Category.id == category_id,
                or_(
                    Category.user_id.is_(None),
                    Category.user_id == user_id
                )
            )
        )
    )
    return result.scalars().first()

async def create_category(db: AsyncSession, category_in: CategoryCreate, user_id: int) -> Category:
    db_category = Category(
        name=category_in.name,
        user_id=user_id
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

# Subscription CRUD
async def get_subscriptions(db: AsyncSession, user_id: int) -> List[Subscription]:
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user_id)
        .options(selectinload(Subscription.category))
        .order_by(Subscription.next_payment_date)
    )
    return list(result.scalars().all())

async def get_subscription(db: AsyncSession, sub_id: int, user_id: int) -> Optional[Subscription]:
    result = await db.execute(
        select(Subscription)
        .where(and_(Subscription.id == sub_id, Subscription.user_id == user_id))
        .options(selectinload(Subscription.category))
    )
    return result.scalars().first()

async def create_subscription(db: AsyncSession, sub_in: SubscriptionCreate, user_id: int) -> Subscription:
    db_sub = Subscription(
        user_id=user_id,
        category_id=sub_in.category_id,
        title=sub_in.title,
        amount=sub_in.amount,
        currency=sub_in.currency.upper(),
        billing_period=sub_in.billing_period,
        next_payment_date=sub_in.next_payment_date
    )
    db.add(db_sub)
    await db.commit()
    await db.refresh(db_sub)
    # Reload with category details
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == db_sub.id)
        .options(selectinload(Subscription.category))
    )
    return result.scalars().first()

async def update_subscription(
    db: AsyncSession, db_sub: Subscription, sub_in: SubscriptionUpdate
) -> Subscription:
    update_data = sub_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "currency" and value is not None:
            value = value.upper()
        setattr(db_sub, field, value)
    
    db.add(db_sub)
    await db.commit()
    await db.refresh(db_sub)
    
    # Reload with category details
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == db_sub.id)
        .options(selectinload(Subscription.category))
    )
    return result.scalars().first()

async def delete_subscription(db: AsyncSession, sub_id: int, user_id: int) -> bool:
    result = await db.execute(
        delete(Subscription).where(
            and_(Subscription.id == sub_id, Subscription.user_id == user_id)
        )
    )
    await db.commit()
    return result.rowcount > 0

# Pay Subscription & Shift Date
async def pay_subscription(db: AsyncSession, db_sub: Subscription) -> Subscription:
    # 1. Log payment history
    history = PaymentHistory(
        subscription_id=db_sub.id,
        payment_date=db_sub.next_payment_date,
        amount_paid=db_sub.amount
    )
    db.add(history)
    
    # 2. Shift next_payment_date forward in PostgreSQL
    interval_str = "1 month" if db_sub.billing_period == "month" else "1 year"
    await db.execute(
        text(
            f"UPDATE subscriptions SET next_payment_date = next_payment_date + INTERVAL '{interval_str}' WHERE id = :id"
        ),
        {"id": db_sub.id}
    )
    await db.commit()
    
    # 3. Reload and return updated subscription
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == db_sub.id)
        .options(selectinload(Subscription.category))
    )
    return result.scalars().first()

# Analytics: Current Month Spend & Forecast
async def get_analytics(db: AsyncSession, user_id: int, user_currency: str) -> dict:
    # 1. Spend by category in current month
    # Note: We group by category name, joining categories.
    # We aggregate actual payments from payment_history.
    spend_query = text("""
        SELECT 
            COALESCE(c.name, 'Uncategorized') AS category_name,
            COALESCE(SUM(ph.amount_paid), 0) AS total_amount
        FROM payment_history ph
        JOIN subscriptions s ON ph.subscription_id = s.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.user_id = :user_id
          AND ph.payment_date >= date_trunc('month', CURRENT_DATE)
          AND ph.payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY c.name
    """)
    
    spend_result = await db.execute(spend_query, {"user_id": user_id})
    current_month_spend = [
        {"category_name": row[0], "amount": Decimal(str(row[1]))}
        for row in spend_result.fetchall()
    ]
    
    # 2. Spend forecast for 30, 90, 365 days
    # Recursive CTE generates dates up to 365 days into the future.
    # Note: If next_payment_date is in the past (overdue), we treat it as due in the 30-day forecast.
    forecast_query = text("""
        WITH RECURSIVE future_payments AS (
            -- Base case: the next payment date itself (if active)
            SELECT 
                id, 
                user_id,
                amount,
                billing_period,
                next_payment_date AS payment_date
            FROM subscriptions
            WHERE is_active = TRUE AND user_id = :user_id
            
            UNION ALL
            
            -- Recursive step: generate subsequent payments
            SELECT 
                id,
                user_id,
                amount,
                billing_period,
                (payment_date + (CASE WHEN billing_period = 'month' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END))::date
            FROM future_payments
            WHERE (payment_date + (CASE WHEN billing_period = 'month' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END))::date <= CURRENT_DATE + 365
        )
        SELECT 
            COALESCE(SUM(CASE WHEN payment_date <= CURRENT_DATE + 30 THEN amount ELSE 0 END), 0) AS forecast_30,
            COALESCE(SUM(CASE WHEN payment_date <= CURRENT_DATE + 90 THEN amount ELSE 0 END), 0) AS forecast_90,
            COALESCE(SUM(CASE WHEN payment_date <= CURRENT_DATE + 365 THEN amount ELSE 0 END), 0) AS forecast_365
        FROM future_payments
    """)
    
    forecast_result = await db.execute(forecast_query, {"user_id": user_id})
    row = forecast_result.fetchone()
    if row:
        forecast = {
            "forecast_30": Decimal(str(row[0])),
            "forecast_90": Decimal(str(row[1])),
            "forecast_365": Decimal(str(row[2]))
        }
    else:
        forecast = {
            "forecast_30": Decimal("0.00"),
            "forecast_90": Decimal("0.00"),
            "forecast_365": Decimal("0.00")
        }
        
    return {
        "current_month_spend": current_month_spend,
        "forecast": forecast,
        "currency": user_currency
    }
