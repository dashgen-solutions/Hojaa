"""
AI-powered conversation flow using Pydantic AI agents.
Manages feature exploration with context-aware, type-safe conversations.
"""
from typing import Dict, Any, List
from uuid import UUID
from sqlalchemy.orm import Session
from pydantic_ai import RunContext
from app.services.agent_service import create_conversation_agent
from app.models.agent_models import (
    ConversationStartOutput,
    ConversationNextOutput,
    FeatureContext,
    ConversationContext
)
from app.models.database import Conversation, Message, MessageRole, Node, Question
from app.core.logger import get_logger

logger = get_logger(__name__)


class AIConversationFlow:
    """
    Service for managing feature exploration conversations using Pydantic AI agents.
    Provides context-aware, structured conversation management.
    """
    
    def __init__(self):
        """Initialize conversation flow with AI agents."""
        # Agent for starting conversations
        self.start_agent = create_conversation_agent(
            system_prompt=self._get_start_system_prompt(),
            result_type=ConversationStartOutput,
            deps_type=FeatureContext
        )
        
        # Add dynamic system prompt for start agent
        @self.start_agent.system_prompt
        def start_system_prompt(ctx: RunContext[FeatureContext]) -> str:
            """Generate system prompt for starting conversation."""
            is_technical = ctx.deps.user_type == "technical"
            return (
                f"You are a business consultant exploring a component with a "
                f"{'TECHNICAL' if is_technical else 'NON-TECHNICAL'} client.\n\n"
                f"{'They understand technical concepts, so you can include technical questions.' if is_technical else 'Keep questions business-focused and avoid technical jargon.'}\n\n"
                f"Your task is to ask the FIRST question to deeply understand this component's requirements."
            )
        
        # Agent for continuing conversations
        self.continue_agent = create_conversation_agent(
            system_prompt=self._get_continue_system_prompt(),
            result_type=ConversationNextOutput,
            deps_type=ConversationContext
        )
        
        # Add dynamic system prompt for continue agent
        @self.continue_agent.system_prompt
        def continue_system_prompt(ctx: RunContext[ConversationContext]) -> str:
            """Generate system prompt for continuing conversation."""
            is_technical = ctx.deps.user_type == "technical"
            return (
                f"You are a business consultant continuing a conversation with a "
                f"{'TECHNICAL' if is_technical else 'NON-TECHNICAL'} client.\n\n"
                f"{'They understand technical concepts.' if is_technical else 'Keep it business-focused.'}\n\n"
                f"Decide what to ask NEXT, or if you have enough to define sub-requirements."
            )
    
    def _get_start_system_prompt(self) -> str:
        """Base system prompt for starting conversations."""
        return "You are a business consultant."
    
    def _get_continue_system_prompt(self) -> str:
        """Base system prompt for continuing conversations."""
        return "You are a business consultant."
    
    async def start_feature_conversation(
        self,
        session_id: UUID,
        node_id: UUID,
        db: Session
    ) -> Dict[str, Any]:
        """
        Start a new conversation for exploring a feature using AI agent.
        
        Args:
            session_id: Session ID
            node_id: Node ID of the feature to explore
            db: Database session
        
        Returns:
            Dictionary with conversation_id, first_question, and suggestions
        """
        try:
            logger.info(f"Starting conversation for node {node_id}")
            
            # Get the node
            node = db.query(Node).filter(Node.id == node_id).first()
            if not node:
                raise ValueError("Node not found")
            
            # Get session to determine user type
            from app.models.database import Session as DBSession
            session = db.query(DBSession).filter(DBSession.id == session_id).first()
            if not session:
                raise ValueError("Session not found")
            
            user_type = session.user_type
            
            # Get parent hierarchy
            parent_hierarchy = self._get_parent_hierarchy(node, db)
            
            # Get initial context from questions
            questions = db.query(Question).filter(
                Question.session_id == session_id,
                Question.is_answered == True
            ).all()
            
            initial_context = self._build_initial_context(questions)
            
            # Create conversation
            conversation = Conversation(
                session_id=session_id,
                node_id=node_id,
                status="active",
                extracted_info={}
            )
            db.add(conversation)
            db.flush()
            
            # Create context for agent
            context = FeatureContext(
                feature_name=node.question,
                feature_description=node.answer or "",
                parent_hierarchy=parent_hierarchy,
                initial_context=initial_context,
                user_type=user_type
            )
            
            # Generate user prompt
            user_prompt = self._create_start_prompt(context)
            
            # Run agent with structured output
            result = await self.start_agent.run(user_prompt, deps=context)
            
            # Log usage
            logger.info(f"Token usage: {result.usage()}")
            
            # Get validated output
            output = result.data
            
            # Save system message
            system_msg = Message(
                conversation_id=conversation.id,
                role=MessageRole.SYSTEM,
                content=f"Now exploring: {node.question}",
                message_metadata={}
            )
            db.add(system_msg)
            
            # Save first AI question
            ai_msg = Message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=output.question,
                message_metadata={
                    "suggestions": output.suggestions,
                    "reasoning": output.reasoning
                }
            )
            db.add(ai_msg)
            
            db.commit()
            
            logger.info(f"Started conversation {conversation.id}")
            
            return {
                "conversation_id": str(conversation.id),
                "node_id": str(node_id),
                "context": node.question,
                "first_question": output.question,
                "suggestions": output.suggestions
            }
            
        except Exception as e:
            logger.error(f"Error starting conversation: {str(e)}")
            db.rollback()
            raise
    
    async def process_user_message(
        self,
        conversation_id: UUID,
        user_message: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Process user message and generate next question using AI agent.
        
        Args:
            conversation_id: Conversation ID
            user_message: User's message
            db: Database session
        
        Returns:
            Dictionary with AI response, suggestions, and completion status
        """
        try:
            logger.info(f"Processing message for conversation {conversation_id}")
            
            # Get conversation
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if not conversation:
                raise ValueError("Conversation not found")
            
            # Get node
            node = db.query(Node).filter(Node.id == conversation.node_id).first()
            
            # Get session to determine user type
            from app.models.database import Session as DBSession
            session = db.query(DBSession).filter(DBSession.id == conversation.session_id).first()
            user_type = session.user_type if session else "non_technical"
            
            # Get parent hierarchy
            parent_hierarchy = self._get_parent_hierarchy(node, db)
            
            # Save user message
            user_msg = Message(
                conversation_id=conversation_id,
                role=MessageRole.USER,
                content=user_message,
                message_metadata={}
            )
            db.add(user_msg)
            db.flush()
            
            # Get conversation history
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at).all()
            
            conversation_history = self._format_conversation_history(messages)
            
            # Create context for agent
            context = ConversationContext(
                feature_name=node.question,
                parent_hierarchy=parent_hierarchy,
                conversation_history=conversation_history,
                extracted_info=conversation.extracted_info or {},
                user_type=user_type
            )
            
            # Generate user prompt
            user_prompt = self._create_continue_prompt(context)
            
            # Run agent with structured output
            result = await self.continue_agent.run(user_prompt, deps=context)
            
            # Log usage
            logger.info(f"Token usage: {result.usage()}")
            
            # Get validated output
            output = result.data
            
            # Update conversation with extracted info
            extracted_info_dict = output.extracted_info.model_dump(exclude_none=True)
            if extracted_info_dict:
                current_info = conversation.extracted_info or {}
                current_info.update(extracted_info_dict)
                conversation.extracted_info = current_info
            
            # Save AI response
            ai_msg = Message(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=output.question,
                message_metadata={
                    "suggestions": output.suggestions,
                    "is_complete": output.is_complete,
                    "extracted_info": extracted_info_dict,
                    "reasoning": output.reasoning
                }
            )
            db.add(ai_msg)
            
            # Mark conversation as completed if done
            if output.is_complete:
                conversation.status = "completed"
            
            db.commit()
            
            logger.info(f"Processed message, is_complete={output.is_complete}")
            
            return {
                "message": output.question,
                "suggestions": output.suggestions,
                "is_complete": output.is_complete,
                "extracted_info": conversation.extracted_info or {}
            }
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            db.rollback()
            raise
    
    def _get_parent_hierarchy(self, node: Node, db: Session) -> str:
        """Get full parent hierarchy for context."""
        hierarchy = []
        current_node = node
        
        while current_node:
            hierarchy.append({
                "level": current_node.depth,
                "name": current_node.question,
                "description": current_node.answer or ""
            })
            
            if current_node.parent_id:
                current_node = db.query(Node).filter(Node.id == current_node.parent_id).first()
            else:
                break
        
        hierarchy.reverse()
        
        if len(hierarchy) <= 1:
            return "This is a top-level feature with no parent context."
        
        hierarchy_parts = []
        hierarchy_parts.append("HIERARCHICAL CONTEXT (from root to current feature):")
        hierarchy_parts.append("")
        
        for i, h in enumerate(hierarchy):
            indent = "  " * i
            if i == len(hierarchy) - 1:
                hierarchy_parts.append(f"{indent}→ CURRENT: {h['name']}")
                if h['description']:
                    hierarchy_parts.append(f"{indent}  Description: {h['description']}")
            else:
                hierarchy_parts.append(f"{indent}└─ {h['name']}")
                if h['description']:
                    hierarchy_parts.append(f"{indent}   ({h['description']})")
        
        return "\n".join(hierarchy_parts)
    
    def _build_initial_context(self, questions: List[Question]) -> str:
        """Build initial context from answered questions."""
        context_parts = []
        for q in questions[:5]:
            if q.answer_text:
                context_parts.append(f"- {q.question_text}: {q.answer_text}")
        
        return "\n".join(context_parts) if context_parts else "No initial context available"
    
    def _format_conversation_history(self, messages: List[Message]) -> str:
        """Format conversation messages."""
        history = []
        for msg in messages:
            if msg.role == MessageRole.SYSTEM:
                continue
            role = "User" if msg.role == MessageRole.USER else "Assistant"
            history.append(f"{role}: {msg.content}")
        
        return "\n".join(history)
    
    def _create_start_prompt(self, context: FeatureContext) -> str:
        """Create prompt for starting conversation."""
        return f"""You are exploring this component with your client:

Component: {context.feature_name}
Description: {context.feature_description}

{context.parent_hierarchy}

Business context you already know:
{context.initial_context}

Ask the FIRST question to deeply understand this component's requirements.

Good questions:
- "Walk me through how users would interact with this on a typical day?"
- "What's the biggest frustration users have with this area right now?"
- "What would make this truly valuable for your users?"

Also provide 3-5 realistic answer suggestions based on their business context.
"""
    
    def _create_continue_prompt(self, context: ConversationContext) -> str:
        """Create prompt for continuing conversation."""
        return f"""Continue your conversation about this component:

Component: {context.feature_name}

{context.parent_hierarchy}

Conversation so far:
{context.conversation_history}

What you've learned:
{context.extracted_info}

Evaluate the conversation:
1. Do you understand the business need and user workflow?
2. Are there ambiguities or gaps?
3. Do you know enough to break this into sub-requirements?
4. Does this fit well with the hierarchy?

If you need more information:
- Ask ONE focused question
- Stay conversational
- Provide 3-5 realistic suggestions

If you have enough information:
- Set is_complete to true
- Summarize the key requirements discovered
"""


# Global conversation flow instance
conversation_flow = AIConversationFlow()
