"""
Authentication API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import uuid4

from app.db.session import get_db
from app.models.database import User
from app.models.schemas import UserRegister, UserLogin, UserResponse, Token
from app.core.auth import create_access_token, get_current_active_user
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Register a new user.
    
    Args:
        user_data: User registration data (email, username, password)
        db: Database session
        
    Returns:
        Created user information
        
    Raises:
        HTTPException: If email or username already exists
    """
    try:
        logger.info(f"Attempting to register user with email: {user_data.email}")
        
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
        ).first()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Create new user (password truncation handled in hash_password method)
        new_user = User(
            id=uuid4(),
            email=user_data.email,
            username=user_data.username,
            hashed_password=User.hash_password(user_data.password),
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"Successfully registered user: {new_user.id}")
        return new_user
        
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error during registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already exists"
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during user registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration"
        )


@router.post("/login", response_model=Token)
async def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token.
    
    Args:
        login_data: User login credentials (email, password)
        db: Database session
        
    Returns:
        JWT access token
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        logger.info(f"Login attempt for email: {login_data.email}")
        
        # Find user by email
        user = db.query(User).filter(User.email == login_data.email).first()
        
        if not user:
            logger.warning(f"Login failed: User not found for email {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify password
        if not user.verify_password(login_data.password):
            logger.warning(f"Login failed: Invalid password for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            logger.warning(f"Login failed: Inactive user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account is inactive"
            )
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        logger.info(f"Successfully logged in user: {user.id}")
        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current authenticated user information.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        Current user information
    """
    logger.info(f"Fetching user info for user: {current_user.id}")
    return current_user


@router.post("/logout")
async def logout_user(
    current_user: User = Depends(get_current_active_user)
):
    """
    Logout endpoint (mainly for frontend to clear tokens).
    JWT tokens are stateless, so this is primarily for logging purposes.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    logger.info(f"User logged out: {current_user.id}")
    return {"message": "Successfully logged out"}
