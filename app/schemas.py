from datetime import date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    currency: str = Field(default="USD", max_length=3)
    telegram_id: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    telegram_id: Optional[int]
    currency: str

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    currency: Optional[str] = Field(None, min_length=3, max_length=3)

# Verification & password reset schemas
class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# Category schemas
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class CategoryResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str

    class Config:
        from_attributes = True

# Subscription schemas
class SubscriptionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, le=9999999.99, description="Max amount is 9,999,999.99")
    billing_period: str = Field(..., pattern="^(month|year)$")
    next_payment_date: date
    category_id: Optional[int] = None

class SubscriptionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[Decimal] = Field(None, gt=0, le=9999999.99)
    billing_period: Optional[str] = Field(None, pattern="^(month|year)$")
    next_payment_date: Optional[date] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None

class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    category_id: Optional[int]
    title: str
    amount: Decimal
    billing_period: str
    next_payment_date: date
    is_active: bool
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True

# Payment History schemas
class PaymentHistoryResponse(BaseModel):
    id: int
    subscription_id: int
    payment_date: date
    amount_paid: Decimal

    class Config:
        from_attributes = True

# Analytics schemas
class CategorySpend(BaseModel):
    category_name: str
    amount: Decimal

class SpendForecast(BaseModel):
    forecast_30: Decimal
    forecast_90: Decimal
    forecast_365: Decimal

class AnalyticsResponse(BaseModel):
    current_month_spend: List[CategorySpend]
    forecast: SpendForecast
    currency: str
