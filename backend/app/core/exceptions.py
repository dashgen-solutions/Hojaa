"""
Custom exceptions for clean error handling across the application.
"""
from fastapi import HTTPException, status


class HojaaException(Exception):
    """
    Base exception for all Hojaa errors.
    Provides structured error information with optional details.
    """
    
    def __init__(self, message: str, details: dict = None):
        """
        Initialize exception with message and optional details.
        
        Args:
            message: Human-readable error message
            details: Optional dictionary with additional error context
        """
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ResourceNotFoundException(HojaaException):
    """Raised when a requested resource is not found."""
    pass


class DocumentProcessingException(HojaaException):
    """Raised when document processing fails."""
    pass


class AIGenerationException(HojaaException):
    """Raised when AI generation fails."""
    pass


class ValidationException(HojaaException):
    """Raised when validation fails."""
    pass


class UnauthorizedException(HojaaException):
    """Raised when authentication fails."""
    pass


class ConversationException(HojaaException):
    """Raised when conversation operations fail."""
    pass


class TreeBuildingException(HojaaException):
    """Raised when tree building operations fail."""
    pass


# HTTP Exception helpers for clean error responses

def resource_not_found_error(resource_type: str, resource_id: str = None) -> HTTPException:
    """
    Create HTTPException for resource not found.
    
    Args:
        resource_type: Type of resource (e.g., "Session", "Node", "Conversation")
        resource_id: Optional ID of the resource
    
    Returns:
        HTTPException with 404 status
    """
    detail_message = f"{resource_type} not found"
    if resource_id:
        detail_message += f" (ID: {resource_id})"
    
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=detail_message
    )


def ai_generation_error(stage: str, error_message: str) -> HTTPException:
    """
    Create HTTPException for AI generation failure.
    
    Args:
        stage: Stage where generation failed (e.g., "question generation", "tree building")
        error_message: Specific error message
    
    Returns:
        HTTPException with 500 status
    """
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"AI generation failed at {stage}: {error_message}"
    )


def validation_error(field: str, reason: str) -> HTTPException:
    """
    Create HTTPException for validation failure.
    
    Args:
        field: Field that failed validation
        reason: Reason for validation failure
    
    Returns:
        HTTPException with 422 status
    """
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Validation failed for '{field}': {reason}"
    )


def unauthorized_error(reason: str = "Invalid credentials") -> HTTPException:
    """
    Create HTTPException for authentication failure.
    
    Args:
        reason: Reason for authentication failure
    
    Returns:
        HTTPException with 401 status
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=reason,
        headers={"WWW-Authenticate": "Bearer"}
    )


def document_processing_error(filename: str, error_message: str) -> HTTPException:
    """
    Create HTTPException for document processing failure.
    
    Args:
        filename: Name of the document that failed
        error_message: Specific error message
    
    Returns:
        HTTPException with 400 status
    """
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Failed to process document '{filename}': {error_message}"
    )


def conversation_error(conversation_id: str, error_message: str) -> HTTPException:
    """
    Create HTTPException for conversation operation failure.
    
    Args:
        conversation_id: ID of the conversation
        error_message: Specific error message
    
    Returns:
        HTTPException with 400 status
    """
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Conversation operation failed (ID: {conversation_id}): {error_message}"
    )
