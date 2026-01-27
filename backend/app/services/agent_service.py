"""
Agent service for type-safe LLM interactions using Pydantic AI.
Provides a clean foundation for building multi-agent workflows.
"""
import os
from typing import TypeVar, Type
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models import Model
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Ensure API keys are available in environment for Pydantic AI
if settings.openai_api_key:
    os.environ["OPENAI_API_KEY"] = settings.openai_api_key
if settings.anthropic_api_key:
    os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key

# Type variable for generic agent creation
ResultType = TypeVar('ResultType', bound=BaseModel)


class AIService:
    """
    Service for creating and managing Pydantic AI agents.
    Provides a clean foundation for multi-agent architectures.
    """
    
    def __init__(self):
        """Initialize AI service with configured LLM provider."""
        self.model_name = self._get_model_name()
        logger.info(f"Initialized AI Service with model: {self.model_name}")
        
        # Debug: Check API key (show first/last 4 chars only)
        api_key = settings.openai_api_key
        if api_key and len(api_key) > 8:
            masked_key = f"{api_key[:4]}...{api_key[-4:]}"
        else:
            masked_key = "INVALID_OR_TOO_SHORT"
        logger.info(f"OpenAI API Key loaded: {masked_key}")
    
    def _get_model_name(self) -> str:
        """
        Get the model name based on configured provider.
        
        Returns:
            Model name string for Pydantic AI
        """
        if settings.llm_provider == "openai":
            # Pydantic AI format: "openai:model-name"
            return f"openai:{settings.openai_model}"
        elif settings.llm_provider == "anthropic":
            # Pydantic AI format: "anthropic:model-name"  
            return f"anthropic:{settings.anthropic_model}"
        else:
            logger.warning(f"Unknown provider {settings.llm_provider}, defaulting to OpenAI")
            return f"openai:{settings.openai_model}"
    
    def create_agent(
        self,
        system_prompt: str,
        result_type: Type[ResultType],
        deps_type: Type = None,
        retries: int = 2
    ) -> Agent[None, ResultType]:
        """
        Create a new Pydantic AI agent with structured output.
        
        Args:
            system_prompt: System prompt defining agent behavior
            result_type: Pydantic model for structured output validation
            deps_type: Optional dependency type for dependency injection
            retries: Number of retries on validation failure (default: 2)
        
        Returns:
            Configured Pydantic AI Agent
        
        Example:
            ```python
            agent = ai_service.create_agent(
                system_prompt="You are a helpful assistant",
                result_type=MyOutputModel,
                deps_type=MyContextModel
            )
            result = await agent.run(user_prompt, deps=context)
            print(result.data)  # Validated MyOutputModel instance
            ```
        """
        # Create agent with automatic retries on validation errors
        agent = Agent(
            self.model_name,
            result_type=result_type,
            deps_type=deps_type,
            retries=retries,
            system_prompt=system_prompt
        )
        
        logger.info(f"Created agent with result_type={result_type.__name__}")
        return agent
    
    def create_streaming_agent(
        self,
        system_prompt: str,
        deps_type: Type = None
    ) -> Agent[None, str]:
        """
        Create an agent for streaming text responses.
        Useful for chat interfaces where we want real-time output.
        
        Args:
            system_prompt: System prompt defining agent behavior
            deps_type: Optional dependency type for context
        
        Returns:
            Agent configured for text streaming
        
        Example:
            ```python
            agent = ai_service.create_streaming_agent(
                system_prompt="You are a chat assistant"
            )
            async with agent.run_stream(user_message) as result:
                async for chunk in result.stream_text():
                    print(chunk, end='', flush=True)
            ```
        """
        agent = Agent(
            self.model_name,
            deps_type=deps_type,
            system_prompt=system_prompt
        )
        
        logger.info("Created streaming agent")
        return agent
    
    def get_model_settings(self, temperature: float = None) -> dict:
        """
        Get model-specific settings for fine-tuning.
        
        Args:
            temperature: Override default temperature (0.0-2.0)
        
        Returns:
            Dictionary of model settings
        """
        if settings.llm_provider == "openai":
            from pydantic_ai.models.openai import OpenAIModelSettings
            return {
                "temperature": temperature or settings.openai_temperature,
            }
        elif settings.llm_provider == "anthropic":
            from pydantic_ai.models.anthropic import AnthropicModelSettings
            return {
                "temperature": temperature or 0.7,
            }
        return {}


# Global agent service instance
agent_service = AIService()


# ===== Convenience Functions for Common Patterns =====

def create_requirements_agent(
    system_prompt: str,
    result_type: Type[ResultType]
) -> Agent[None, ResultType]:
    """
    Create an agent specialized for requirements discovery.
    Uses optimized settings for structured requirement extraction.
    
    Args:
        system_prompt: Requirements-specific system prompt
        result_type: Pydantic model for output structure
    
    Returns:
        Configured agent for requirements tasks
    """
    return agent_service.create_agent(
        system_prompt=system_prompt,
        result_type=result_type,
        retries=3  # More retries for complex requirements
    )


def create_conversation_agent(
    system_prompt: str,
    result_type: Type[ResultType],
    deps_type: Type = None
) -> Agent:
    """
    Create an agent for conversational interactions.
    Optimized for natural dialogue flow.
    
    Args:
        system_prompt: Conversation-specific system prompt
        result_type: Pydantic model for structured conversation output
        deps_type: Context dependencies for the conversation
    
    Returns:
        Configured agent for conversations
    """
    return agent_service.create_agent(
        system_prompt=system_prompt,
        result_type=result_type,
        deps_type=deps_type,
        retries=2
    )
