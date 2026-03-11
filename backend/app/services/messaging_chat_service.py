"""
Messaging Channel AI Chatbot Service.

Provides an intelligent assistant that can answer questions about:
- Channel message history (group discussions)
- Call transcriptions within the channel
- Summarize conversations
- Search for topics discussed

Uses OpenAI function-calling with channel-scoped tools.
"""
import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import desc, func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    User,
    ChatChannel,
    ChatChannelMember,
    ChatChannelMessage,
    CallTranscription,
)

logger = get_logger(__name__)


# ── Tool definitions for OpenAI function calling ──

MESSAGING_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_channel_info",
            "description": "Get information about the current channel: name, type, member count, creation date.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_messages",
            "description": "Get recent messages from the channel. Returns the latest messages with sender names, content, and timestamps.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent messages to return (default 30, max 100)",
                    },
                    "search_query": {
                        "type": "string",
                        "description": "Optional: search for messages containing this text",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_call_transcriptions",
            "description": "Get call transcriptions for this channel. Returns transcribed text from recorded calls with timestamp and participants.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of transcriptions to return (default 10, max 50)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_messages",
            "description": "Search channel messages by keyword. Returns matching messages with context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keyword to find in messages",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_channel_members",
            "description": "Get all members of the current channel with their usernames.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_discussion",
            "description": "Get the full recent discussion context (messages + transcriptions) for summarization. Returns a large batch of messages for the AI to summarize.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hours_back": {
                        "type": "integer",
                        "description": "How many hours back to look (default 24, max 168 = 1 week)",
                    },
                },
                "required": [],
            },
        },
    },
]


# ── Tool Executor ──

class MessagingChatTools:
    """Executes tool calls against the database for a specific channel."""

    def __init__(self, db: DBSession, channel_id: UUID, user_id: UUID):
        self.db = db
        self.channel_id = channel_id
        self.user_id = user_id

    def get_channel_info(self) -> Dict[str, Any]:
        channel = self.db.query(ChatChannel).filter(ChatChannel.id == self.channel_id).first()
        if not channel:
            return {"error": "Channel not found"}

        member_count = self.db.query(ChatChannelMember).filter(
            ChatChannelMember.channel_id == self.channel_id
        ).count()

        message_count = self.db.query(ChatChannelMessage).filter(
            ChatChannelMessage.channel_id == self.channel_id,
            ChatChannelMessage.message_type.is_(None),  # only regular messages
        ).count()

        transcription_count = self.db.query(CallTranscription).filter(
            CallTranscription.channel_id == self.channel_id,
            CallTranscription.status == "completed",
        ).count()

        return {
            "name": channel.name or "Direct Message",
            "is_direct": channel.is_direct,
            "topic": channel.topic,
            "description": channel.description,
            "member_count": member_count,
            "message_count": message_count,
            "transcription_count": transcription_count,
            "created_at": channel.created_at.isoformat() if channel.created_at else None,
        }

    def get_recent_messages(self, limit: int = 30, search_query: str = None) -> List[Dict]:
        limit = min(limit or 30, 100)
        q = self.db.query(ChatChannelMessage).filter(
            ChatChannelMessage.channel_id == self.channel_id,
            ChatChannelMessage.message_type.is_(None),  # only regular messages
        )
        if search_query:
            q = q.filter(
                func.lower(ChatChannelMessage.content).contains(search_query.lower())
            )
        msgs = q.order_by(desc(ChatChannelMessage.created_at)).limit(limit).all()
        msgs.reverse()  # oldest first

        result = []
        for m in msgs:
            sender = self.db.query(User).filter(User.id == m.sender_id).first() if m.sender_id else None
            result.append({
                "sender": sender.username if sender else "Unknown",
                "content": m.content[:500],  # Truncate long messages
                "timestamp": m.created_at.strftime("%b %d, %H:%M") if m.created_at else "",
            })
        return result

    def get_call_transcriptions(self, limit: int = 10) -> List[Dict]:
        limit = min(limit or 10, 50)
        txs = (
            self.db.query(CallTranscription)
            .filter(
                CallTranscription.channel_id == self.channel_id,
                CallTranscription.status == "completed",
            )
            .order_by(desc(CallTranscription.created_at))
            .limit(limit)
            .all()
        )
        result = []
        for t in txs:
            initiator = self.db.query(User).filter(User.id == t.call_initiator_id).first() if t.call_initiator_id else None
            result.append({
                "call_type": t.call_type,
                "initiator": initiator.username if initiator else "Unknown",
                "duration_seconds": t.duration_seconds,
                "transcription_text": t.transcription_text[:2000] if t.transcription_text else "",
                "participants": t.participants,
                "timestamp": t.created_at.strftime("%b %d, %H:%M") if t.created_at else "",
            })
        return result

    def search_messages(self, query: str) -> List[Dict]:
        msgs = (
            self.db.query(ChatChannelMessage)
            .filter(
                ChatChannelMessage.channel_id == self.channel_id,
                ChatChannelMessage.message_type.is_(None),
                func.lower(ChatChannelMessage.content).contains(query.lower()),
            )
            .order_by(desc(ChatChannelMessage.created_at))
            .limit(20)
            .all()
        )
        result = []
        for m in msgs:
            sender = self.db.query(User).filter(User.id == m.sender_id).first() if m.sender_id else None
            result.append({
                "sender": sender.username if sender else "Unknown",
                "content": m.content[:500],
                "timestamp": m.created_at.strftime("%b %d, %H:%M") if m.created_at else "",
            })
        return result

    def get_channel_members(self) -> List[Dict]:
        members = (
            self.db.query(ChatChannelMember)
            .filter(ChatChannelMember.channel_id == self.channel_id)
            .options(joinedload(ChatChannelMember.user))
            .all()
        )
        return [
            {
                "username": m.user.username if m.user else "Unknown",
                "email": m.user.email if m.user else "",
                "joined_at": m.joined_at.strftime("%b %d") if m.joined_at else "",
            }
            for m in members
        ]

    def summarize_discussion(self, hours_back: int = 24) -> Dict[str, Any]:
        hours_back = min(hours_back or 24, 168)
        from datetime import timedelta
        since = datetime.utcnow() - timedelta(hours=hours_back)

        # Get messages
        msgs = (
            self.db.query(ChatChannelMessage)
            .filter(
                ChatChannelMessage.channel_id == self.channel_id,
                ChatChannelMessage.message_type.is_(None),
                ChatChannelMessage.created_at >= since,
            )
            .order_by(ChatChannelMessage.created_at)
            .limit(200)
            .all()
        )

        messages_text = []
        for m in msgs:
            sender = self.db.query(User).filter(User.id == m.sender_id).first() if m.sender_id else None
            time_str = m.created_at.strftime("%H:%M") if m.created_at else ""
            messages_text.append(f"[{time_str}] {sender.username if sender else 'Unknown'}: {m.content[:300]}")

        # Get transcriptions
        txs = (
            self.db.query(CallTranscription)
            .filter(
                CallTranscription.channel_id == self.channel_id,
                CallTranscription.status == "completed",
                CallTranscription.created_at >= since,
            )
            .order_by(CallTranscription.created_at)
            .limit(10)
            .all()
        )

        transcriptions_text = []
        for t in txs:
            time_str = t.created_at.strftime("%b %d, %H:%M") if t.created_at else ""
            transcriptions_text.append(
                f"[Call at {time_str}, {t.call_type}, {t.duration_seconds or 0}s]: {t.transcription_text[:1500] if t.transcription_text else '(no text)'}"
            )

        return {
            "period": f"Last {hours_back} hours",
            "message_count": len(msgs),
            "transcription_count": len(txs),
            "messages": messages_text,
            "transcriptions": transcriptions_text,
        }

    def execute_tool(self, tool_name: str, args: Dict) -> str:
        fn_map = {
            "get_channel_info": lambda: self.get_channel_info(),
            "get_recent_messages": lambda: self.get_recent_messages(
                args.get("limit", 30), args.get("search_query")
            ),
            "get_call_transcriptions": lambda: self.get_call_transcriptions(args.get("limit", 10)),
            "search_messages": lambda: self.search_messages(args["query"]),
            "get_channel_members": lambda: self.get_channel_members(),
            "summarize_discussion": lambda: self.summarize_discussion(args.get("hours_back", 24)),
        }

        fn = fn_map.get(tool_name)
        if not fn:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        try:
            result = fn()
            return json.dumps(result, default=str)
        except Exception as e:
            logger.error(f"Messaging tool {tool_name} failed: {e}")
            return json.dumps({"error": str(e)})


# ── System prompt ──

MESSAGING_SYSTEM_PROMPT = """You are the **Channel Assistant** for Hojaa, a team communication platform.

You are scoped to a **specific chat channel**. You can access the channel's message history, call transcriptions, and member list.

## Your Capabilities
1. **Answer questions** about discussions that happened in the channel
2. **Summarize conversations** — recent chats and call transcriptions
3. **Search messages** for specific topics or keywords
4. **Provide context** from call transcriptions — what was discussed during calls
5. **Analyze discussions** — identify key decisions, action items, topics covered

## Guidelines
- Always use tools to get current data before answering — never guess at channel-specific information
- When asked about "what was discussed" or "what happened", use summarize_discussion or get_recent_messages
- When asked about calls, use get_call_transcriptions to get transcription text
- Be concise but thorough — use bullet points and structured formatting
- If the user asks about something not discussed in the channel, say so
- Include relevant quotes from messages or transcriptions when helpful

## Formatting
- Use markdown formatting for readability
- Use **bold** for emphasis, bullet lists for multiple items
- Quote specific messages using > blockquote when referencing what someone said
- Keep responses focused and actionable
"""


# ── Main orchestration ──

async def process_messaging_chat(
    db: DBSession,
    channel_id: UUID,
    user_id: UUID,
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Process a user message in the messaging channel chatbot.

    Uses OpenAI function calling to query channel messages and transcriptions.

    Returns:
        {
            "response": str,
            "tool_calls": list,
        }
    """
    import openai

    # ── Enforce AI usage limit for free-tier users ──
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            from app.services.ai_usage_limit_service import enforce_ai_limit
            enforce_ai_limit(db, user)

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    # Build messages array
    messages = [{"role": "system", "content": MESSAGING_SYSTEM_PROMPT}]

    if chat_history:
        for msg in chat_history[-20:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    tools_executor = MessagingChatTools(db, channel_id, user_id)
    all_tool_calls = []

    model = settings.openai_model or "gpt-4o-mini"
    if "gpt-4o" in (settings.task_model_conversation or settings.openai_model or ""):
        model = "gpt-4o"
    elif settings.openai_model:
        model = settings.openai_model

    max_iterations = 5
    for iteration in range(max_iterations):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=MESSAGING_TOOLS,
                    tool_choice="auto",
                    temperature=0.3,
                    max_tokens=2000,
                ),
                timeout=settings.ai_timeout_seconds,
            )
        except asyncio.TimeoutError:
            return {
                "response": "I'm sorry, the request timed out. Please try again.",
                "tool_calls": all_tool_calls,
            }
        except Exception as e:
            logger.error(f"OpenAI API error in messaging chat: {e}")
            return {
                "response": f"I encountered an error: {str(e)}. Please try again.",
                "tool_calls": all_tool_calls,
            }

        choice = response.choices[0]
        msg = choice.message

        # Log usage
        try:
            usage = response.usage
            if usage:
                from app.services.ai_usage_service import log_usage
                log_usage(
                    db=db,
                    task="messaging_chat",
                    model=model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    user_id=user_id,
                )
        except Exception as log_err:
            logger.warning(f"Failed to log messaging-chat usage: {log_err}")

        if msg.tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                logger.info(f"Messaging chat tool call: {fn_name}({fn_args})")
                result = tools_executor.execute_tool(fn_name, fn_args)
                all_tool_calls.append({"name": fn_name, "args": fn_args, "result_preview": result[:200]})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
        else:
            return {
                "response": msg.content or "I couldn't generate a response. Please try again.",
                "tool_calls": all_tool_calls,
            }

    return {
        "response": "I've gathered the information but hit the processing limit. Please ask a more specific question.",
        "tool_calls": all_tool_calls,
    }
