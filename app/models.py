from sqlalchemy import Column, Integer, BigInteger, String, Numeric, Date, Boolean, ForeignKey, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    telegram_id = Column(BigInteger, unique=True, nullable=True)
    currency = Column(String(3), default="USD", nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Relationships
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    verification_codes = relationship("VerificationCode", back_populates="user", cascade="all, delete-orphan")

class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(6), nullable=False)
    purpose = Column(String(20), nullable=False)  # "verify_email" | "reset_password"
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="verification_codes")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(100), nullable=False)

    # Relationships
    user = relationship("User", back_populates="categories")
    subscriptions = relationship("Subscription", back_populates="category")

class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("billing_period IN ('month', 'year')", name="check_billing_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    billing_period = Column(String(10), nullable=False)
    next_payment_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", back_populates="subscriptions")
    category = relationship("Category", back_populates="subscriptions")
    payments = relationship("PaymentHistory", back_populates="subscription", cascade="all, delete-orphan")

class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(BigInteger, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    payment_date = Column(Date, nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False)

    # Relationships
    subscription = relationship("Subscription", back_populates="payments")
