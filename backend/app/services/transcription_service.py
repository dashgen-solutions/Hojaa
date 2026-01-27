"""
Whisper AI transcription service for converting audio to text.
Handles audio file processing and transcription using OpenAI Whisper.
"""
import os
import tempfile
from typing import Optional, BinaryIO
from pathlib import Path
from openai import OpenAI
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class TranscriptionService:
    """
    Service for transcribing audio files to text using OpenAI Whisper API.
    Provides clean interface for audio transcription with error handling.
    """
    
    def __init__(self):
        """Initialize transcription service with OpenAI client."""
        if not settings.openai_api_key:
            logger.warning("OpenAI API key not found. Whisper transcription will not work.")
            self.client = None
        else:
            self.client = OpenAI(api_key=settings.openai_api_key)
            logger.info("Transcription service initialized with OpenAI Whisper")
    
    async def transcribe_audio(
        self,
        audio_file: BinaryIO,
        filename: Optional[str] = None,
        language: Optional[str] = None,
        model: str = "whisper-1"
    ) -> dict:
        """
        Transcribe audio file to text using OpenAI Whisper API.
        
        Args:
            audio_file: Binary file-like object containing audio data
            filename: Optional filename for logging/debugging
            language: Optional language code (e.g., 'en', 'es', 'fr')
            model: Whisper model to use (default: 'whisper-1')
        
        Returns:
            Dictionary with:
                - text: Transcribed text
                - language: Detected language (if not specified)
                - duration: Audio duration in seconds (if available)
        
        Raises:
            ValueError: If audio file is invalid or API key is missing
            Exception: If transcription fails
        """
        try:
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            
            logger.info(f"Starting transcription for file: {filename or 'unknown'}")
            
            # Reset file pointer to beginning
            audio_file.seek(0)
            
            # Get file size for logging
            audio_file.seek(0, os.SEEK_END)
            file_size = audio_file.tell()
            audio_file.seek(0)
            
            logger.info(f"Audio file size: {file_size} bytes")
            
            # Prepare file for OpenAI API
            # OpenAI Whisper API expects a file-like object with a name attribute
            # We'll use a temporary file since OpenAI needs a file with a name
            temp_file = None
            try:
                # Create temporary file with proper extension
                file_ext = Path(filename).suffix if filename else '.webm'
                if not file_ext or file_ext not in ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg', '.flac']:
                    file_ext = '.webm'  # Default to webm
                
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=file_ext
                )
                temp_file.write(audio_file.read())
                temp_file.seek(0)
                audio_file.seek(0)  # Reset original file pointer
                
                # Call OpenAI Whisper API
                if not self.client:
                    raise ValueError("OpenAI API key not configured")
                
                # OpenAI API needs the file opened in binary mode
                with open(temp_file.name, 'rb') as file_to_transcribe:
                    transcript = self.client.audio.transcriptions.create(
                        model=model,
                        file=file_to_transcribe,
                        language=language,
                        response_format="verbose_json"  # Get additional metadata
                    )
                
                # Extract transcription data
                # The verbose_json format returns a dict-like object
                if isinstance(transcript, dict):
                    transcribed_text = transcript.get('text', '')
                    detected_language = transcript.get('language', language or 'unknown')
                else:
                    transcribed_text = getattr(transcript, 'text', '')
                    detected_language = getattr(transcript, 'language', language or 'unknown')
                
                logger.info(f"Transcription successful. Language: {detected_language}, Length: {len(transcribed_text)} chars")
                
                return {
                    "text": transcribed_text,
                    "language": detected_language,
                    "success": True
                }
                
            finally:
                # Clean up temporary file if created
                if temp_file:
                    try:
                        os.unlink(temp_file.name)
                    except Exception as e:
                        logger.warning(f"Failed to delete temp file: {e}")
        
        except Exception as e:
            error_str = str(e)
            if "Invalid" in error_str or "invalid" in error_str.lower():
                logger.error(f"Invalid audio file: {error_str}")
                raise ValueError(f"Invalid audio file: {error_str}")
            elif "authentication" in error_str.lower() or "api key" in error_str.lower():
                logger.error(f"OpenAI authentication error: {error_str}")
                raise ValueError(f"OpenAI API authentication failed: {error_str}")
            else:
                logger.error(f"Unexpected error during transcription: {str(e)}")
                raise Exception(f"Transcription failed: {str(e)}")
    


# Global transcription service instance
transcription_service = TranscriptionService()
