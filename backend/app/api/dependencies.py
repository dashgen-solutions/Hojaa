"""
Shared dependencies for API routes.
"""
from fastapi import Depends, HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def validate_file_upload(file: UploadFile) -> UploadFile:
    """
    Validate uploaded file size and type.
    
    Args:
        file: Uploaded file
    
    Returns:
        Validated file
    
    Raises:
        HTTPException: If file is invalid
    """
    # Check file extension
    if not any(file.filename.lower().endswith(ext) for ext in settings.allowed_file_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(settings.allowed_file_types)}"
        )
    
    # Read file content to check size
    content = await file.read()
    file_size = len(content)
    
    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB"
        )
    
    # Reset file pointer
    await file.seek(0)
    
    logger.info(f"File validated: {file.filename}, size: {file_size} bytes")
    return file
