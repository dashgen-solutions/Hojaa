"""
AI-powered tree builder using Pydantic AI agents.
Builds and expands requirements tree with type-safe outputs.
"""
from typing import List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from pydantic_ai import RunContext
from app.services.agent_service import create_requirements_agent
from app.models.agent_models import (
    TreeStructureOutput,
    SubRequirementsOutput,
    UserContext,
    SubRequirementContext
)
from app.models.database import Node, NodeType, NodeStatus, Question, Message, ChangeType
from app.core.logger import get_logger

logger = get_logger(__name__)


class AITreeBuilder:
    """
    Service for building and managing requirements tree using Pydantic AI agents.
    Provides type-safe tree construction with automatic validation.
    """
    
    def __init__(self):
        """Initialize tree builder with AI agents."""
        # Agent for initial tree building
        self.tree_agent = create_requirements_agent(
            system_prompt=self._get_tree_system_prompt(),
            output_type=TreeStructureOutput,
            deps_type=UserContext,
        )
        
        # Add dynamic system prompt for tree agent
        @self.tree_agent.system_prompt
        def tree_system_prompt(ctx: RunContext[UserContext]) -> str:
            """Generate system prompt based on user type."""
            return (
                f"You are a solution architect analyzing business requirements.\n"
                f"CLIENT TYPE: {ctx.deps.user_type}\n\n"
                f"**NON-TECHNICAL client:** Focus on business capabilities, user-facing features\n"
                f"**TECHNICAL client:** Can include both business AND technical components\n\n"
                f"CRITICAL: Generate the EXACT number of components that the requirements need.\n"
                f"Don't force a specific count - let the actual requirements determine the structure.\n"
            )
        
        # Agent for extracting sub-requirements
        self.sub_req_agent = create_requirements_agent(
            system_prompt=self._get_sub_req_system_prompt(),
            output_type=SubRequirementsOutput,
            deps_type=SubRequirementContext,
        )
        
        # Add dynamic system prompt for sub-requirements
        @self.sub_req_agent.system_prompt
        def sub_req_system_prompt(ctx: RunContext[SubRequirementContext]) -> str:
            """Generate system prompt for sub-requirements based on user type."""
            return (
                f"You are a business consultant documenting detailed requirements.\n"
                f"CLIENT TYPE: {ctx.deps.user_type}\n\n"
                f"**NON-TECHNICAL client:** Extract ONLY business requirements\n"
                f"**TECHNICAL client:** Extract BOTH business AND technical requirements\n\n"
                f"CRITICAL: Extract the EXACT number of requirements that were discussed.\n"
                f"Every requirement you generate must be based on something actually mentioned.\n"
                f"Don't pad the list or artificially limit it - be precise and truthful.\n"
            )
    
    def _get_tree_system_prompt(self) -> str:
        """Base system prompt for tree building."""
        return "You are a solution architect."
    
    def _get_sub_req_system_prompt(self) -> str:
        """Base system prompt for sub-requirements."""
        return "You are a business consultant."
    
    async def build_initial_tree(
        self,
        session_id: UUID,
        user_type: str,
        db: Session
    ) -> Node:
        """
        Build initial tree structure from answered questions using AI agent.
        
        Args:
            session_id: Session ID
            user_type: "technical" or "non_technical"
            db: Database session
        
        Returns:
            Root node of the tree
        """
        try:
            logger.info(f"Building tree for session {session_id} (user_type: {user_type})")
            
            # Get all answered questions
            questions = db.query(Question).filter(
                Question.session_id == session_id,
                Question.is_answered == True
            ).order_by(Question.order_index).all()
            
            if not questions:
                raise ValueError("No answered questions found")
            
            # Format answers for prompt
            answers_text = self._format_answers_for_prompt(questions)
            
            # Create context
            context = UserContext(
                user_type=user_type,
                session_id=str(session_id)
            )
            
            # Generate user prompt
            user_prompt = self._create_tree_building_prompt(answers_text, user_type)
            
            # Run agent with structured output
            result = await self.tree_agent.run(user_prompt, deps=context)
            
            # Log usage
            logger.info(f"Token usage: {result.usage()}")
            
            # Get validated output
            tree_output = result.output
            
            # Import audit_service lazily to avoid circular imports
            from app.services.audit_service import audit_service

            # Create root node
            root_node = Node(
                session_id=session_id,
                question="Main Project",
                answer=tree_output.project_description,
                node_type=NodeType.ROOT,
                status=NodeStatus.ACTIVE,
                depth=0,
                order_index=0,
                can_expand=True,
                is_expanded=True
            )
            db.add(root_node)
            db.flush()  # Get root_node.id

            # Audit trail for root node creation
            audit_service.record_change(
                database=db,
                node_id=root_node.id,
                change_type=ChangeType.CREATED,
                new_value=tree_output.project_description,
                change_reason="Initial tree build",
                session_id=session_id,
            )
            
            # Create feature nodes from validated output
            for idx, feature in enumerate(tree_output.features):
                feature_node = Node(
                    session_id=session_id,
                    parent_id=root_node.id,
                    question=feature.name,
                    answer=feature.description,
                    node_type=NodeType.FEATURE,
                    status=NodeStatus.NEW,
                    depth=1,
                    order_index=idx,
                    can_expand=True,
                    is_expanded=False,
                    node_metadata={
                        "priority": feature.priority,
                        "rationale": feature.rationale
                    }
                )
                db.add(feature_node)
                db.flush()

                # Audit trail for each feature node
                audit_service.record_change(
                    database=db,
                    node_id=feature_node.id,
                    change_type=ChangeType.CREATED,
                    new_value=feature.description,
                    change_reason=f"Feature '{feature.name}' created during initial tree build",
                    session_id=session_id,
                )
            
            db.commit()
            db.refresh(root_node)
            
            logger.info(f"Successfully built tree with {len(tree_output.features)} features")
            return root_node
            
        except Exception as e:
            logger.error(f"Error building tree: {str(e)}")
            db.rollback()
            raise
    
    async def expand_node_from_conversation(
        self,
        conversation_id: UUID,
        parent_node_id: UUID,
        db: Session
    ) -> List[Node]:
        """
        Expand a node by creating child nodes from conversation using AI agent.
        
        Args:
            conversation_id: Conversation ID
            parent_node_id: Parent node to expand
            db: Database session
        
        Returns:
            List of created child nodes
        """
        try:
            from app.models.database import Conversation
            
            logger.info(f"Expanding node {parent_node_id} from conversation {conversation_id}")
            
            # Get conversation and messages
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if not conversation:
                raise ValueError("Conversation not found")
            
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at).all()
            
            # Get parent node
            parent_node = db.query(Node).filter(Node.id == parent_node_id).first()
            if not parent_node:
                raise ValueError("Parent node not found")
            
            # Get session to determine user type
            from app.models.database import Session as DBSession
            session = db.query(DBSession).filter(DBSession.id == parent_node.session_id).first()
            user_type = session.user_type if session else "non_technical"
            
            # Get parent hierarchy for context
            parent_hierarchy = self._get_parent_hierarchy(parent_node, db)
            
            # Format conversation
            conversation_text = self._format_conversation_for_prompt(messages)
            
            # Create context
            context = SubRequirementContext(
                feature_name=parent_node.question,
                parent_hierarchy=parent_hierarchy,
                conversation_history=conversation_text,
                user_type=user_type
            )
            
            # Generate user prompt
            user_prompt = self._create_sub_requirements_prompt(context)
            
            # Run agent with structured output
            result = await self.sub_req_agent.run(user_prompt, deps=context)
            
            # Log usage
            logger.info(f"Token usage: {result.usage()}")
            
            # Get validated output
            sub_req_output = result.output
            
            from app.services.audit_service import audit_service

            # Create child nodes from validated output
            child_nodes = []
            for idx, sub_req in enumerate(sub_req_output.sub_requirements):
                node_type = NodeType.FEATURE if sub_req.type == "feature" else NodeType.DETAIL
                
                child_node = Node(
                    session_id=parent_node.session_id,
                    parent_id=parent_node_id,
                    question=sub_req.question,
                    answer=sub_req.answer,
                    node_type=node_type,
                    status=NodeStatus.NEW,
                    depth=parent_node.depth + 1,
                    order_index=idx,
                    can_expand=True,
                    is_expanded=False,
                    node_metadata={"priority": sub_req.priority}
                )
                db.add(child_node)
                db.flush()
                child_nodes.append(child_node)

                # Audit trail for each child node
                audit_service.record_change(
                    database=db,
                    node_id=child_node.id,
                    change_type=ChangeType.CREATED,
                    new_value=sub_req.answer,
                    change_reason=f"Sub-requirement '{sub_req.question}' extracted from conversation",
                    session_id=parent_node.session_id,
                )
            
            # Update parent node
            parent_node.is_expanded = True
            
            db.commit()
            
            for node in child_nodes:
                db.refresh(node)
            
            logger.info(f"Successfully created {len(child_nodes)} child nodes")
            return child_nodes
            
        except Exception as e:
            logger.error(f"Error expanding node: {str(e)}")
            db.rollback()
            raise
    
    def _format_answers_for_prompt(self, questions: List[Question]) -> str:
        """Format question-answer pairs for prompt."""
        formatted = []
        for q in questions:
            formatted.append(f"Q: {q.question_text}")
            formatted.append(f"A: {q.answer_text}")
            formatted.append("")
        return "\n".join(formatted)
    
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
    
    def _format_conversation_for_prompt(self, messages: List[Message]) -> str:
        """Format conversation messages for prompt."""
        formatted = []
        for msg in messages:
            role = msg.role.value.upper()
            formatted.append(f"{role}: {msg.content}")
        return "\n".join(formatted)
    
    def _create_tree_building_prompt(self, answers_text: str, user_type: str) -> str:
        """Create prompt for tree building."""
        return f"""Analyze these business requirements and identify the main solution components.

Based on the user's answers, identify what capabilities/components are needed to solve their problem.

IMPORTANT: Decide the EXACT number of components based on what the requirements actually need.
- If the project is simple and only needs 2-3 components, return 2-3
- If it's complex and needs 8-10 components, return 8-10
- Focus on distinct, meaningful components - don't force artificial splits or combine unrelated things

For each component:
- Give it a clear, business-focused name
- Describe what business value it provides
- Explain why it matters based on their answers
- Assign priority based on business impact

User's answers to discovery questions:
{answers_text}
"""
    
    def _create_sub_requirements_prompt(self, context: SubRequirementContext) -> str:
        """Create prompt for extracting sub-requirements."""
        return f"""Extract ALL specific sub-requirements from this conversation.

Component discussed: {context.feature_name}

{context.parent_hierarchy}

Complete conversation:
{context.conversation_history}

IMPORTANT: Decide the EXACT number of sub-requirements based on what was ACTUALLY discussed.
- If the conversation only revealed 2 clear requirements, return 2
- If it revealed 12 distinct requirements, return all 12
- Each sub-requirement should represent something ACTUALLY mentioned or implied in the conversation
- Don't artificially split requirements to reach a number
- Don't combine unrelated requirements to stay under a limit

Based on what you learned, extract specific sub-requirements that describe:
- User workflows and interactions
- Business rules and logic
- Data needs and information flows
- Pain points to address
{f"- Technical implementation (if technical client)" if context.user_type == "technical" else ""}

Each sub-requirement should be clear, specific, and based on the actual conversation.
Categorize each as either "feature" (needs further exploration) or "detail" (well-defined).
"""


# Global tree builder instance
tree_builder = AITreeBuilder()
