"""
Audio utility functions for processing and validating audio files.
Provides helper functions for audio format conversion and validation.
"""
from typing import Optional, Tuple
from pathlib import Path


# Supported audio formats for Whisper API
SUPPORTED_AUDIO_FORMATS = {
    '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a',
    '.wav', '.webm', '.ogg', '.flac'
}

# Maximum file size for Whisper API (25MB)
MAX_AUDIO_FILE_SIZE_MB = 25
MAX_AUDIO_FILE_SIZE_BYTES = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024


def get_audio_format(filename: str) -> Optional[str]:
    """
    Get audio format from filename.
    
    Args:
        filename: Audio filename
    
    Returns:
        File extension (lowercase) or None if not recognized
    """
    ext = Path(filename).suffix.lower()
    return ext if ext in SUPPORTED_AUDIO_FORMATS else None


def is_supported_audio_format(filename: str) -> bool:
    """
    Check if audio file format is supported by Whisper API.
    
    Args:
        filename: Audio filename
    
    Returns:
        True if format is supported
    """
    return get_audio_format(filename) is not None


def validate_audio_file_size(file_size_bytes: int) -> Tuple[bool, Optional[str]]:
    """
    Validate audio file size.
    
    Args:
        file_size_bytes: File size in bytes
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if file_size_bytes == 0:
        return False, "Audio file is empty"
    
    if file_size_bytes > MAX_AUDIO_FILE_SIZE_BYTES:
        size_mb = file_size_bytes / (1024 * 1024)
        return False, f"Audio file too large ({size_mb:.2f}MB). Maximum size: {MAX_AUDIO_FILE_SIZE_MB}MB"
    
    return True, None


