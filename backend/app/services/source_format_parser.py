"""
Format-specific pre-processors for different source types.

Each parser normalizes raw content into a clean, structured format
before sending to the AI for scope analysis. This improves accuracy
because the AI receives consistently formatted input regardless of
the original source format.

Supported formats:
- Otter.ai transcripts (speaker labels + timestamps)
- Fireflies.ai transcripts (similar structure, different format)
- Email threads (headers, threading, quoted text)
- Slack conversation exports (JSON or text with usernames + timestamps)
- Raw text (passthrough with minimal cleanup)
"""
import re
import json
from typing import Dict, Any, Optional, List
from app.core.logger import get_logger

logger = get_logger(__name__)


# ===== Otter.ai Transcript Parser =====

def parse_otter_transcript(raw_content: str) -> Dict[str, Any]:
    """
    Parse an Otter.ai transcript into structured format.

    Otter.ai transcripts typically look like:
        Speaker Name  0:00
        Some text here.

        Another Speaker  0:15
        More text here.

    Returns:
        Dictionary with parsed speakers, segments, and cleaned text.
    """
    segments = []
    current_speaker = None
    current_text_lines = []
    speakers_found = set()

    # Pattern: "Speaker Name  H:MM:SS" or "Speaker Name  M:SS"
    speaker_pattern = re.compile(
        r'^(.+?)\s{2,}(\d{1,2}:\d{2}(?::\d{2})?)\s*$'
    )

    for line in raw_content.split('\n'):
        stripped_line = line.strip()

        if not stripped_line:
            continue

        speaker_match = speaker_pattern.match(stripped_line)

        if speaker_match:
            # Save the previous segment before starting a new one
            if current_speaker and current_text_lines:
                segments.append({
                    'speaker': current_speaker,
                    'text': ' '.join(current_text_lines),
                })

            current_speaker = speaker_match.group(1).strip()
            speakers_found.add(current_speaker)
            current_text_lines = []
        else:
            current_text_lines.append(stripped_line)

    # Save the last segment
    if current_speaker and current_text_lines:
        segments.append({
            'speaker': current_speaker,
            'text': ' '.join(current_text_lines),
        })

    # Build clean, readable output for the AI
    cleaned_lines = []
    for segment in segments:
        cleaned_lines.append(f"[{segment['speaker']}]: {segment['text']}")

    cleaned_content = '\n\n'.join(cleaned_lines)

    return {
        'format': 'otter_ai',
        'speakers': sorted(list(speakers_found)),
        'segment_count': len(segments),
        'cleaned_content': cleaned_content,
        'original_length': len(raw_content),
    }


# ===== Fireflies.ai Transcript Parser =====

def parse_fireflies_transcript(raw_content: str) -> Dict[str, Any]:
    """
    Parse a Fireflies.ai transcript into structured format.

    Fireflies transcripts typically look like:
        Speaker Name (00:00:15)
        Some text here.

    Or the alternative format:
        00:00:15 Speaker Name
        Some text here.

    Returns:
        Dictionary with parsed speakers, segments, and cleaned text.
    """
    segments = []
    current_speaker = None
    current_text_lines = []
    speakers_found = set()

    # Pattern 1: "Speaker Name (HH:MM:SS)" or "Speaker Name (MM:SS)"
    pattern_parentheses = re.compile(
        r'^(.+?)\s*\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*$'
    )

    # Pattern 2: "HH:MM:SS Speaker Name"
    pattern_timestamp_first = re.compile(
        r'^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)\s*$'
    )

    for line in raw_content.split('\n'):
        stripped_line = line.strip()

        if not stripped_line:
            continue

        match_parentheses = pattern_parentheses.match(stripped_line)
        match_timestamp_first = pattern_timestamp_first.match(stripped_line)

        if match_parentheses:
            # Save the previous segment
            if current_speaker and current_text_lines:
                segments.append({
                    'speaker': current_speaker,
                    'text': ' '.join(current_text_lines),
                })
            current_speaker = match_parentheses.group(1).strip()
            speakers_found.add(current_speaker)
            current_text_lines = []

        elif match_timestamp_first and not current_text_lines:
            # Only match "timestamp speaker" pattern at the start of a new segment
            if current_speaker and current_text_lines:
                segments.append({
                    'speaker': current_speaker,
                    'text': ' '.join(current_text_lines),
                })
            current_speaker = match_timestamp_first.group(2).strip()
            speakers_found.add(current_speaker)
            current_text_lines = []

        else:
            current_text_lines.append(stripped_line)

    # Save the last segment
    if current_speaker and current_text_lines:
        segments.append({
            'speaker': current_speaker,
            'text': ' '.join(current_text_lines),
        })

    # Build clean output
    cleaned_lines = []
    for segment in segments:
        cleaned_lines.append(f"[{segment['speaker']}]: {segment['text']}")

    cleaned_content = '\n\n'.join(cleaned_lines)

    return {
        'format': 'fireflies_ai',
        'speakers': sorted(list(speakers_found)),
        'segment_count': len(segments),
        'cleaned_content': cleaned_content,
        'original_length': len(raw_content),
    }


# ===== Email Thread Parser =====

def parse_email_thread(raw_content: str) -> Dict[str, Any]:
    """
    Parse an email thread into structured format.

    Handles common email formats:
        From: sender@example.com
        To: recipient@example.com
        Subject: Re: Project discussion
        Date: Mon, 15 Jan 2026 10:30:00

        Email body text here...

        > Quoted reply text
        >> Deeper quoted text

    Returns:
        Dictionary with parsed emails, participants, and cleaned text.
    """
    emails = []
    participants = set()

    # Split on common email separators
    email_separator_pattern = re.compile(
        r'(?:^|\n)(?:-{3,}|_{3,}|={3,}|'
        r'(?:From|On .+? wrote):)',
        re.MULTILINE,
    )

    # Try to split into individual emails
    raw_emails = email_separator_pattern.split(raw_content)

    # If splitting didn't work well, treat as a single email
    if len(raw_emails) <= 1:
        raw_emails = [raw_content]

    for raw_email in raw_emails:
        if not raw_email.strip():
            continue

        email_data = _extract_email_headers(raw_email)
        if email_data.get('from'):
            participants.add(email_data['from'])
        if email_data.get('to'):
            for recipient in email_data['to'].split(','):
                participants.add(recipient.strip())

        emails.append(email_data)

    # Build clean output — most recent email first
    cleaned_lines = []
    for email_index, email_data in enumerate(emails):
        header_parts = []
        if email_data.get('from'):
            header_parts.append(f"From: {email_data['from']}")
        if email_data.get('date'):
            header_parts.append(f"Date: {email_data['date']}")
        if email_data.get('subject'):
            header_parts.append(f"Subject: {email_data['subject']}")

        if header_parts:
            cleaned_lines.append(' | '.join(header_parts))

        cleaned_lines.append(email_data.get('body', raw_email.strip()))
        cleaned_lines.append('')  # blank line between emails

    cleaned_content = '\n'.join(cleaned_lines)

    return {
        'format': 'email_thread',
        'email_count': len(emails),
        'participants': sorted(list(participants)),
        'cleaned_content': cleaned_content,
        'original_length': len(raw_content),
    }


def _extract_email_headers(raw_email_text: str) -> Dict[str, str]:
    """Extract common email headers from a raw email block."""
    result = {'body': ''}
    lines = raw_email_text.strip().split('\n')

    body_start_index = 0
    for line_index, line in enumerate(lines):
        stripped = line.strip()

        from_match = re.match(r'^From:\s*(.+)', stripped, re.IGNORECASE)
        to_match = re.match(r'^To:\s*(.+)', stripped, re.IGNORECASE)
        subject_match = re.match(r'^Subject:\s*(.+)', stripped, re.IGNORECASE)
        date_match = re.match(r'^Date:\s*(.+)', stripped, re.IGNORECASE)

        if from_match:
            result['from'] = from_match.group(1).strip()
            body_start_index = line_index + 1
        elif to_match:
            result['to'] = to_match.group(1).strip()
            body_start_index = line_index + 1
        elif subject_match:
            result['subject'] = subject_match.group(1).strip()
            body_start_index = line_index + 1
        elif date_match:
            result['date'] = date_match.group(1).strip()
            body_start_index = line_index + 1
        elif stripped == '':
            # Empty line after headers indicates body start
            if any(key in result for key in ('from', 'to', 'subject')):
                body_start_index = line_index + 1
                break
        else:
            # Non-header line found — body has started
            break

    # Remove quoted reply markers (">") for cleaner AI input
    body_lines = lines[body_start_index:]
    cleaned_body_lines = []
    for body_line in body_lines:
        # Strip leading ">" markers but preserve the text
        clean_line = re.sub(r'^[>\s]+', '', body_line)
        cleaned_body_lines.append(clean_line)

    result['body'] = '\n'.join(cleaned_body_lines).strip()
    return result


# ===== Slack Conversation Parser =====

def parse_slack_export(raw_content: str) -> Dict[str, Any]:
    """
    Parse a Slack conversation export into structured format.

    Handles two formats:

    1. JSON export (from Slack's export feature):
       [{"user": "U123", "text": "hello", "ts": "1234567890.123456"}, ...]

    2. Text copy-paste format:
       username  10:30 AM
       Message text here

       another_user  10:32 AM
       Reply text here

    Returns:
        Dictionary with parsed messages, participants, and cleaned text.
    """
    # First, try JSON format
    parsed_json = _try_parse_slack_json(raw_content)
    if parsed_json:
        return parsed_json

    # Fall back to text format parsing
    return _parse_slack_text(raw_content)


def _try_parse_slack_json(raw_content: str) -> Optional[Dict[str, Any]]:
    """Attempt to parse Slack JSON export format."""
    try:
        data = json.loads(raw_content)

        if not isinstance(data, list):
            return None

        messages = []
        participants = set()

        for message in data:
            if not isinstance(message, dict):
                continue

            username = message.get('user', message.get('username', 'Unknown'))
            text = message.get('text', '')
            participants.add(username)
            messages.append({
                'user': username,
                'text': text,
            })

        cleaned_lines = []
        for msg in messages:
            cleaned_lines.append(f"[{msg['user']}]: {msg['text']}")

        return {
            'format': 'slack_json',
            'message_count': len(messages),
            'participants': sorted(list(participants)),
            'cleaned_content': '\n\n'.join(cleaned_lines),
            'original_length': len(raw_content),
        }

    except (json.JSONDecodeError, TypeError):
        return None


def _parse_slack_text(raw_content: str) -> Dict[str, Any]:
    """Parse Slack copy-paste text format."""
    messages = []
    current_user = None
    current_text_lines = []
    participants = set()

    # Pattern: "username  10:30 AM" or "username  2:30 PM" or "username  14:30"
    slack_header_pattern = re.compile(
        r'^(\S+)\s{2,}(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$',
        re.IGNORECASE,
    )

    for line in raw_content.split('\n'):
        stripped_line = line.strip()

        if not stripped_line:
            continue

        header_match = slack_header_pattern.match(stripped_line)

        if header_match:
            # Save the previous message
            if current_user and current_text_lines:
                messages.append({
                    'user': current_user,
                    'text': ' '.join(current_text_lines),
                })
            current_user = header_match.group(1)
            participants.add(current_user)
            current_text_lines = []
        else:
            current_text_lines.append(stripped_line)

    # Save the last message
    if current_user and current_text_lines:
        messages.append({
            'user': current_user,
            'text': ' '.join(current_text_lines),
        })

    cleaned_lines = []
    for msg in messages:
        cleaned_lines.append(f"[{msg['user']}]: {msg['text']}")

    return {
        'format': 'slack_text',
        'message_count': len(messages),
        'participants': sorted(list(participants)),
        'cleaned_content': '\n\n'.join(cleaned_lines),
        'original_length': len(raw_content),
    }


# ===== VTT / SRT Subtitle Parser (INT-1.3) =====

# WebVTT timestamps: 00:01:23.456 --> 00:01:30.789
_VTT_CUE_RE = re.compile(
    r'(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})'
)
# SRT numeric sequence line
_SRT_SEQ_RE = re.compile(r'^\d+\s*$')


def _ts_to_seconds(ts: str) -> float:
    """Convert HH:MM:SS.mmm or HH:MM:SS,mmm to seconds."""
    ts = ts.replace(',', '.')
    parts = ts.split(':')
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


def parse_vtt_srt(raw_content: str) -> Dict[str, Any]:
    """
    Parse WebVTT (.vtt) or SubRip (.srt) subtitle files into
    structured transcript segments.

    Handles:
    - WEBVTT header / metadata
    - Cue timing lines  (HH:MM:SS.mmm --> HH:MM:SS.mmm)
    - SRT sequence numbers
    - Speaker labels embedded as ``<v Speaker>`` (VTT) or ``Speaker:`` prefix

    Returns a dict with cleaned_content, segments list, and speakers set.
    """
    lines = raw_content.split('\n')
    segments: List[Dict[str, Any]] = []
    speakers_found: set = set()

    current_start: Optional[str] = None
    current_end: Optional[str] = None
    current_text_lines: List[str] = []

    def _flush():
        nonlocal current_start, current_end, current_text_lines
        if current_text_lines:
            text = ' '.join(current_text_lines).strip()
            # Detect speaker label:  <v Speaker Name>text  or  Speaker: text
            speaker = None
            voice_match = re.match(r'<v\s+([^>]+)>(.*)', text)
            if voice_match:
                speaker = voice_match.group(1).strip()
                text = voice_match.group(2).strip()
            else:
                colon_match = re.match(r'^([A-Za-z][A-Za-z .\'()-]{0,40}):\s+(.+)', text)
                if colon_match:
                    speaker = colon_match.group(1).strip()
                    text = colon_match.group(2).strip()
            if speaker:
                speakers_found.add(speaker)
            segments.append({
                'start': current_start or '00:00:00.000',
                'end': current_end or '00:00:00.000',
                'speaker': speaker,
                'text': text,
            })
        current_start = None
        current_end = None
        current_text_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip WEBVTT header, NOTE blocks, SRT sequence numbers
        if stripped.upper().startswith('WEBVTT') or stripped.startswith('NOTE'):
            continue
        if _SRT_SEQ_RE.match(stripped):
            continue

        cue_match = _VTT_CUE_RE.match(stripped)
        if cue_match:
            _flush()
            current_start = cue_match.group(1)
            current_end = cue_match.group(2)
            continue

        if stripped:
            # Strip HTML-style cue tags like <b>, <i>, <c.color>
            cleaned = re.sub(r'<[^>]+>', '', stripped)
            current_text_lines.append(cleaned)
        elif current_text_lines:
            _flush()

    _flush()

    # Build cleaned transcript
    transcript_lines = []
    for seg in segments:
        prefix = f"[{seg['start']}] "
        if seg['speaker']:
            prefix += f"{seg['speaker']}: "
        transcript_lines.append(prefix + seg['text'])

    cleaned = '\n'.join(transcript_lines)

    return {
        'format': 'vtt_srt',
        'cleaned_content': cleaned,
        'original_length': len(raw_content),
        'segments': segments,
        'segment_count': len(segments),
        'speakers': sorted(speakers_found),
        'speaker_count': len(speakers_found),
        'duration_seconds': (
            _ts_to_seconds(segments[-1]['end']) if segments else 0.0
        ),
    }


# ===== Raw Text Parser (Passthrough with cleanup + INT-1.4 timestamp detection) =====

# Common timestamp patterns found in plain-text meeting notes / logs
_PLAIN_TS_PATTERNS = [
    # ISO-ish:  2024-06-15T14:30:00  or  2024-06-15 14:30
    (re.compile(r'(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)'), r'[\1 \2]'),
    # HH:MM:SS  surrounded by whitespace / start-of-line
    (re.compile(r'(?:^|(?<=\s))(\d{1,2}:\d{2}:\d{2})(?=\s|$)'), r'[\1]'),
    # MM:SS  only when preceded by a dash or at start of line (avoid false positives)
    (re.compile(r'(?:^|\s-\s*)(\d{1,2}:\d{2})(?=\s)'), r' [\1]'),
]


def parse_raw_text(raw_content: str) -> Dict[str, Any]:
    """
    Minimal cleanup for raw text / generic meeting notes.

    - Removes excessive blank lines
    - Trims trailing whitespace
    - Normalizes detected timestamps into [HH:MM:SS] bracket format
    - Preserves the original structure
    """
    lines = raw_content.split('\n')
    cleaned_lines = []
    previous_was_blank = False
    timestamps_found = 0

    for line in lines:
        stripped = line.rstrip()
        is_blank = len(stripped) == 0

        # Collapse multiple blank lines into one
        if is_blank and previous_was_blank:
            continue

        # Normalize timestamps
        for pattern, replacement in _PLAIN_TS_PATTERNS:
            new_stripped, n = pattern.subn(replacement, stripped)
            if n:
                timestamps_found += n
                stripped = new_stripped

        cleaned_lines.append(stripped)
        previous_was_blank = is_blank

    cleaned_content = '\n'.join(cleaned_lines).strip()

    return {
        'format': 'raw_text',
        'cleaned_content': cleaned_content,
        'original_length': len(raw_content),
        'timestamps_detected': timestamps_found,
    }


# ===== Main Dispatcher =====

# Maps source_format values to their parser functions
FORMAT_PARSERS = {
    'otter': parse_otter_transcript,
    'fireflies': parse_fireflies_transcript,
    'email': parse_email_thread,
    'slack': parse_slack_export,
    'vtt': parse_vtt_srt,
    'srt': parse_vtt_srt,
    'raw': parse_raw_text,
}


def preprocess_source_content(
    raw_content: str,
    source_format: str = 'raw',
) -> Dict[str, Any]:
    """
    Pre-process raw source content using the appropriate format parser.

    Args:
        raw_content: The original text content
        source_format: One of 'otter', 'fireflies', 'email', 'slack', 'raw'

    Returns:
        Dictionary with 'cleaned_content' (always present) plus
        format-specific metadata (speakers, participants, etc.)
    """
    parser_function = FORMAT_PARSERS.get(source_format, parse_raw_text)

    try:
        result = parser_function(raw_content)
        logger.info(
            f"Pre-processed source (format={source_format}): "
            f"{result.get('original_length', 0)} chars → "
            f"{len(result.get('cleaned_content', ''))} chars cleaned"
        )
        return result

    except Exception as error:
        logger.warning(
            f"Format parser '{source_format}' failed, falling back to raw: {error}"
        )
        return parse_raw_text(raw_content)
