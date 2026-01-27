"""
Audio transcription API routes using Whisper AI.
Provides endpoints for converting audio to text.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from app.models.schemas import TranscriptionResponse
from app.services.transcription_service import transcription_service
from app.services.transcription_utils import (
    is_supported_audio_format,
    validate_audio_file_size
)
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/transcription", tags=["transcription"])


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Transcribe audio file to text using Whisper AI.
    
    Supports various audio formats: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac
    Maximum file size: 25MB
    
    Args:
        audio_file: Audio file to transcribe
        language: Optional language code (e.g., 'en', 'es', 'fr'). If not provided, Whisper will auto-detect.
    
    Returns:
        TranscriptionResponse with transcribed text and metadata
    """
    try:
        logger.info(f"Transcription request received for file: {audio_file.filename}")
        
        # Validate file format
        if not audio_file.filename or not is_supported_audio_format(audio_file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac"
            )
        
        # Read file to validate size
        content = await audio_file.read()
        file_size = len(content)
        
        # Validate file size
        is_valid, error_msg = validate_audio_file_size(file_size)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Create a file-like object from the content
        import io
        audio_file_obj = io.BytesIO(content)
        audio_file_obj.name = audio_file.filename
        
        # Transcribe audio
        result = await transcription_service.transcribe_audio(
            audio_file=audio_file_obj,
            filename=audio_file.filename,
            language=language
        )
        
        logger.info(f"Transcription successful. Text length: {len(result['text'])} characters")
        
        return TranscriptionResponse(
            text=result["text"],
            language=result.get("language", "unknown"),
            success=True
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


