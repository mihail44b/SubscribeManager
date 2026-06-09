from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.models import User
from app.schemas import (
    UserCreate, UserResponse, UserUpdate, Token, CategoryCreate, CategoryResponse,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse, AnalyticsResponse,
    VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from app import crud
from app.email import send_verification_code_email, send_reset_password_email

router = APIRouter()

# --- Auth Routes ---
@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    db_user = await crud.get_user_by_email(db, user_in.email)
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists.")
    hashed_password = get_password_hash(user_in.password)
    db_user = await crud.create_user(db, user_in, hashed_password)
    # Send verification code instead of welcome email
    code = await crud.create_verification_code(db, db_user.id, "verify_email")
    background_tasks.add_task(send_verification_code_email, db_user.email, code)
    return db_user

@router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.is_verified:
        return {"message": "Already verified."}
    ok = await crud.verify_code(db, user.id, data.code, "verify_email")
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")
    await crud.set_user_verified(db, user)
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/auth/resend-verification")
async def resend_verification(data: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, data.email)
    if not user or user.is_verified:
        return {"message": "OK"}  # Silent — don't leak info
    code = await crud.create_verification_code(db, user.id, "verify_email")
    background_tasks.add_task(send_verification_code_email, user.email, code)
    return {"message": "OK"}

@router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, data.email)
    if user and user.is_verified:
        code = await crud.create_verification_code(db, user.id, "reset_password")
        background_tasks.add_task(send_reset_password_email, user.email, code)
    return {"message": "If this email exists, a reset code has been sent."}

@router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    ok = await crud.verify_code(db, user.id, data.code, "reset_password")
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")
    hashed = get_password_hash(data.new_password)
    await crud.update_user_password(db, user, hashed)
    return {"message": "Password updated successfully."}

@router.post("/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_email(db, form_data.username) # OAuth2 form username maps to email
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox for the verification code.",
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# Endpoint to fetch details of the currently authenticated user
@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/auth/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user_in.currency:
        return await crud.update_user(db, current_user, user_in.currency)
    return current_user


# --- Category Routes ---
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_categories(db, current_user.id)

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.create_category(db, category_in, current_user.id)


# --- Subscription Routes ---
@router.get("/subscriptions", response_model=List[SubscriptionResponse])
async def get_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_subscriptions(db, current_user.id)

@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    sub_in: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify category if provided
    if sub_in.category_id is not None:
        cat = await crud.get_category(db, sub_in.category_id, current_user.id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected category does not exist."
            )
            
    return await crud.create_subscription(db, sub_in, current_user.id)

@router.get("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def get_subscription(
    sub_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sub = await crud.get_subscription(db, sub_id, current_user.id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found."
        )
    return sub

@router.put("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(
    sub_id: int,
    sub_in: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sub = await crud.get_subscription(db, sub_id, current_user.id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found."
        )
        
    if sub_in.category_id is not None:
        cat = await crud.get_category(db, sub_in.category_id, current_user.id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected category does not exist."
            )
            
    return await crud.update_subscription(db, sub, sub_in)

@router.delete("/subscriptions/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    sub_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success = await crud.delete_subscription(db, sub_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found."
        )
    return

@router.post("/subscriptions/{sub_id}/pay", response_model=SubscriptionResponse)
async def pay_subscription(
    sub_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sub = await crud.get_subscription(db, sub_id, current_user.id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found."
        )
    if not sub.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot pay an inactive subscription."
        )
    return await crud.pay_subscription(db, sub)


# --- Analytics Routes ---
@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_analytics(db, current_user.id, current_user.currency)
