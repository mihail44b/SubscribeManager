from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Create database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # Adjust connection pool for low RAM setup
    pool_size=5,
    max_overflow=10
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession
)

Base = declarative_base()

# Dependency to get session in routers
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Helper to create tables and pre-populate default categories
async def init_db() -> None:
    async with engine.begin() as conn:
        # Import models inside to avoid circular imports
        from app.models import Base as ModelBase
        await conn.run_sync(ModelBase.metadata.create_all)
        
    # Pre-populate default categories if they do not exist
    async with AsyncSessionLocal() as session:
        from app.models import Category
        from sqlalchemy import select
        try:
            result = await session.execute(select(Category).where(Category.user_id.is_(None)))
            existing = {c.name for c in result.scalars().all()}
            defaults = ["Streaming", "Utilities", "Mobile", "Software", "Services"]
            for d in defaults:
                if d not in existing:
                    session.add(Category(name=d, user_id=None))
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Error seeding default categories: {e}")

