"""
Shared dependencies for API routes.
"""
from typing import Tuple
from fastapi import Depends, HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def validate_file_upload(file: UploadFile) -> Tuple[UploadFile, bytes]:
    """
    Validate uploaded file size and type, and return file content.
    
    Args:
        file: Uploaded file
    
    Returns:
        Tuple of (validated file, file content as bytes)
    
    Raises:
        HTTPException: If file is invalid
    """
    # Check file extension
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename"
        )
    
    if not any(file.filename.lower().endswith(ext) for ext in settings.allowed_file_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(settings.allowed_file_types)}"
        )
    
    # Read file content to check size
    try:
        content = await file.read()
        file_size = len(content)
    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )
    
    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB"
        )
    
    logger.info(f"File validated: {file.filename}, size: {file_size} bytes")
    return file, content
