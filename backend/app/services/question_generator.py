"""
AI-powered question generator using Pydantic AI agents.
Generates initial discovery questions with type-safe, validated outputs.
"""
from typing import List
from sqlalchemy.orm import Session
from pydantic_ai import RunContext
from app.services.agent_service import create_requirements_agent, cached_agent_run
from app.models.agent_models import (
    QuestionGenerationOutput,
    DocumentContext
)
from app.models.database import Question, Session as DBSession
from app.core.logger import get_logger

logger = get_logger(__name__)


class AIQuestionGenerator:
    """
    Service for generating discovery questions using Pydantic AI agents.
    Provides type-safe question generation with automatic validation.
    """
    
    def __init__(self):
        """Initialize the question generator with AI agent."""
        # Create agent with dynamic system prompt based on user type
        self.agent = create_requirements_agent(
            system_prompt=self._get_base_system_prompt(),
            output_type=QuestionGenerationOutput,
            deps_type=DocumentContext
        )
        
        # Add dynamic system prompt handler
        @self.agent.system_prompt
        def dynamic_system_prompt(ctx: RunContext[DocumentContext]) -> str:
            """Generate system prompt based on user type."""
            user_type_description = (
                "TECHNICAL (developer/architect)" 
                if ctx.deps.user_type == "technical" 
                else "NON-TECHNICAL (business person)"
            )
            
            return (
                f"You are a professional requirements gatherer conducting an initial discovery session.\n"
                f"The client is {user_type_description}.\n"
                f"Adjust your questions accordingly.\n\n"
                f"**If client is NON-TECHNICAL:**\n"
                f"- Ask ONLY business-focused questions\n"
                f"- NO technical questions (databases, APIs, architecture, etc.)\n"
                f"- Focus on: problems, users, workflows, business value\n\n"
                f"**If client is TECHNICAL:**\n"
                f"- Ask BOTH business questions AND technical questions\n"
                f"- Mix: business needs + tech stack + architecture + integrations\n"
                f"- Can use technical terminology\n"
            )
    
    def _get_base_system_prompt(self) -> str:
        """Get the base system prompt (will be overridden by dynamic prompt)."""
        return "You are a professional requirements gatherer."
    
    async def generate_questions_from_document(
        self,
        document_text: str,
        session_id: str,
        user_type: str,
        db: Session
    ) -> List[Question]:
        """
        Generate 10 initial questions using AI agent.
        
        Args:
            document_text: The extracted document text
            session_id: Database session ID
            user_type: "technical" or "non_technical"
            db: Database session
        
        Returns:
            List of created Question objects
        """
        try:
            logger.info(f"Generating questions for session {session_id} (user_type: {user_type})")
            
            # Create context for the agent
            context = DocumentContext(
                document_text=document_text,
                user_type=user_type
            )
            
            # Generate user prompt
            user_prompt = self._create_user_prompt(document_text, user_type)
            
            # Run agent with structured output (RISK-2.3C: logged)
            result = await cached_agent_run(
                self.agent, user_prompt, deps=context,
                task="question_gen", session_id=str(session_id),
            )
            
            # Log usage stats
            logger.info(f"Token usage: {result.usage()}")
            
            # Get validated output
            questions_output = result.output
            
            # Log the generated questions for debugging
            logger.info(f"AI generated {len(questions_output.questions)} questions:")
            for i, q in enumerate(questions_output.questions):
                logger.info(f"  Q{i+1}: {q.question[:80]}...")
            
            # Validate we got exactly 10 questions
            if len(questions_output.questions) != 10:
                logger.warning(
                    f"Expected 10 questions but got {len(questions_output.questions)}, using fallback"
                )
                return await self._create_fallback_questions(session_id, user_type, db)
            
            # Create Question objects in database
            db_questions = []
            for idx, question_data in enumerate(questions_output.questions):
                question = Question(
                    session_id=session_id,
                    question_text=question_data.question,
                    category=question_data.category,
                    order_index=idx,
                    is_answered=False,
                    question_metadata={"why_important": question_data.why_important}
                )
                db.add(question)
                db_questions.append(question)
            
            db.commit()
            
            # Refresh to get IDs
            for question in db_questions:
                db.refresh(question)
            
            logger.info(f"Successfully generated {len(db_questions)} questions")
            return db_questions
            
        except Exception as e:
            import traceback
            logger.error(f"Error generating questions: {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            db.rollback()
            # Fall back to default questions
            return await self._create_fallback_questions(session_id, user_type, db)
    
    def _create_user_prompt(self, document_text: str, user_type: str) -> str:
        """Create the user prompt for question generation."""
        user_type_description = (
            "TECHNICAL (developer/architect)" 
            if user_type == "technical" 
            else "NON-TECHNICAL (business person)"
        )
        
        return f"""You are a professional requirements gatherer conducting an initial discovery session.
The client is {user_type_description}.
Adjust your questions accordingly.

**If client is NON-TECHNICAL:**
- Ask ONLY business-focused questions
- NO technical questions (databases, APIs, architecture, etc.)
- Focus on: problems, users, workflows, business value

**If client is TECHNICAL:**
- Ask BOTH business questions AND technical questions
- Mix: business needs + tech stack + architecture + integrations
- Can use technical terminology

CRITICAL INSTRUCTIONS:
- You MUST read and understand the document below
- Generate questions that are SPECIFIC to what's described in the document
- Reference specific features, user types, or concepts mentioned in the document
- Do NOT ask generic business questions - ask about THIS specific project

For example, if the document mentions "AI Butler" and "user profiles", ask about:
- "What specific interactions should the AI Butler handle for each user profile?"
- "How should the recommendation engine prioritize suggestions for different user types?"

NOT generic questions like:
- "What problem are you trying to solve?" (too generic)
- "Who are your users?" (too generic)

Your task is to generate exactly 10 DOCUMENT-SPECIFIC questions that clarify:
1. Specific features or components mentioned in the document (3-4 questions)
2. User types, roles, or personas described (2-3 questions)  
3. Interactions, workflows, or processes outlined (2-3 questions)
4. Success criteria or expected outcomes for THIS project (1-2 questions)

Requirements for questions:
- MUST reference specific elements from the document
- Ask ONE thing per question (focused)
- Be conversational and natural
- Avoid yes/no questions - ask "what", "how", "who", "why"
- Follow the technical/non-technical guidelines above

=== CLIENT'S DOCUMENT ===
{document_text}
=== END DOCUMENT ===

Generate 10 questions that are SPECIFIC to the above document content and appropriate for a {user_type_description} client.
"""
    
    async def _create_fallback_questions(
        self,
        session_id: str,
        user_type: str,
        db: Session
    ) -> List[Question]:
        """Create fallback questions if AI fails."""
        logger.info("Using fallback questions")
        
        # Default fallback questions
        default_questions = self._get_default_questions(user_type)
        
        db_questions = []
        for idx, q_data in enumerate(default_questions):
            question = Question(
                session_id=session_id,
                question_text=q_data["question"],
                category=q_data["category"],
                order_index=idx,
                is_answered=False,
                question_metadata={"why_important": q_data["why_important"]}
            )
            db.add(question)
            db_questions.append(question)
        
        db.commit()
        
        for question in db_questions:
            db.refresh(question)
        
        return db_questions
    
    def _get_default_questions(self, user_type: str) -> List[dict]:
        """
        Get default fallback questions.
        
        Args:
            user_type: "technical" or "non_technical"
        
        Returns:
            List of default questions
        """
        # Base business questions (for all users)
        base_questions = [
            {
                "question": "What specific problem or frustration are you trying to solve?",
                "category": "problem_discovery",
                "why_important": "Understanding the root problem ensures we solve the right thing"
            },
            {
                "question": "Who currently deals with this problem on a daily basis?",
                "category": "user_understanding",
                "why_important": "Knowing the actual users helps design the right solution"
            },
            {
                "question": "How are these people handling this situation today?",
                "category": "problem_discovery",
                "why_important": "Understanding current workarounds reveals pain points"
            },
            {
                "question": "What type of business or organization is this for?",
                "category": "business_context",
                "why_important": "Business context shapes requirements and priorities"
            },
            {
                "question": "What would happen if this problem continues unsolved?",
                "category": "business_context",
                "why_important": "Understanding impact helps prioritize urgency"
            },
            {
                "question": "Can you describe a typical user and their role?",
                "category": "user_understanding",
                "why_important": "Specific user personas guide design decisions"
            },
            {
                "question": "What would make this user's day significantly easier?",
                "category": "user_understanding",
                "why_important": "Identifies the core value proposition"
            },
            {
                "question": "How will you know if this solution is successful?",
                "category": "success_criteria",
                "why_important": "Defines measurable goals and outcomes"
            },
            {
                "question": "What is the single most critical thing this must do?",
                "category": "scope_context",
                "why_important": "Identifies the MVP and core requirement"
            },
            {
                "question": "Are there any existing systems this needs to connect with?",
                "category": "scope_context",
                "why_important": "Reveals integration needs early"
            }
        ]
        
        # Technical questions (only for technical users)
        technical_questions = [
            {
                "question": "What is your current or preferred technology stack?",
                "category": "technical",
                "why_important": "Guides technical architecture decisions"
            },
            {
                "question": "What are your performance and scalability requirements?",
                "category": "technical",
                "why_important": "Guides optimization and infrastructure planning"
            },
            {
                "question": "Any specific API or integration requirements?",
                "category": "technical",
                "why_important": "Defines integration architecture"
            }
        ]
        
        if user_type == "technical":
            # Mix: 7 business questions + 3 technical questions
            return base_questions[:7] + technical_questions[:3]
        else:
            # Only business questions (10)
            return base_questions


# Global question generator instance
question_generator = AIQuestionGenerator()
