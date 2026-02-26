"""
 Token Counting Utility for Privacy AI Assistant
This module handles:
- Token estimation for different models
- Context window management
- Message truncation strategies
- Token-aware conversation building
Architecture:
- TokenCounter: Main token counting class
- ContextBuilder: Builds context within token limits
- Multiple estimation strategies (tiktoken, approximation)
"""
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
logger = logging.getLogger(__name__)
class TokenEstimationMethod(Enum):
    """Available token estimation methods."""
    TIKTOKEN = "tiktoken"
    APPROXIMATION = "approximation"
    WORD_BASED = "word_based"
@dataclass
class TokenInfo:
    """Token information for a piece of text."""
    count: int
    method: TokenEstimationMethod
    text_length: int
    word_count: int
@dataclass
class ContextWindow:
    """Context window with token information."""
    messages: List[Dict[str, Any]]
    total_tokens: int
    max_tokens: int
    truncated_count: int
    token_utilization: float
class TokenCounter:
    """Main token counting utility."""
    MODEL_LIMITS = {
        "gemma3n:latest": 8192,
        "gemma3n:7b": 8192,
        "gemma3n:2b": 4096,
        "llama3.1:8b": 8192,
        "llama3.1:7b": 8192,
        "mistral:7b": 8192,
        "phi3:medium": 4096,
        "phi3:mini": 4096,
        "tinyllama:1.1b": 2048,
        "default": 4096
    }
    WORD_TO_TOKEN_RATIO = 1.3
    CHAR_TO_TOKEN_RATIO = 0.25
    def __init__(self, model_name: str = "default"):
        self.model_name = model_name
        self.max_tokens = self.MODEL_LIMITS.get(model_name, self.MODEL_LIMITS["default"])
        self.estimation_method = self._detect_best_method()
        logger.info(f" TokenCounter initialized for {model_name} (max: {self.max_tokens} tokens)")
        logger.info(f" Using estimation method: {self.estimation_method.value}")
    def _detect_best_method(self) -> TokenEstimationMethod:
        """Detect the best available token estimation method."""
        try:
            import tiktoken
            logger.info("✅ tiktoken available, using precise token counting")
            return TokenEstimationMethod.TIKTOKEN
        except ImportError:
            logger.info("⚠️ tiktoken not available, using approximation method")
            return TokenEstimationMethod.APPROXIMATION
    def count_tokens(self, text: str) -> TokenInfo:
        """Count tokens in text using the best available method."""
        if not text:
            return TokenInfo(0, self.estimation_method, 0, 0)
        word_count = len(text.split())
        text_length = len(text)
        if self.estimation_method == TokenEstimationMethod.TIKTOKEN:
            token_count = self._count_tokens_tiktoken(text)
        else:
            token_count = self._count_tokens_approximation(text)
        return TokenInfo(
            count=token_count,
            method=self.estimation_method,
            text_length=text_length,
            word_count=word_count
        )
    def _count_tokens_tiktoken(self, text: str) -> int:
        """Count tokens using tiktoken (precise method)."""
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except Exception as e:
            logger.warning(f"tiktoken failed, falling back to approximation: {e}")
            return self._count_tokens_approximation(text)
    def _count_tokens_approximation(self, text: str) -> int:
        """Count tokens using approximation method."""
        cleaned_text = re.sub(r'\s+', ' ', text.strip())
        words = cleaned_text.split()
        word_based_estimate = int(len(words) * self.WORD_TO_TOKEN_RATIO)
        char_based_estimate = int(len(cleaned_text) * self.CHAR_TO_TOKEN_RATIO)
        return max(word_based_estimate, char_based_estimate)
    def estimate_message_tokens(self, message: Dict[str, Any]) -> int:
        """Estimate tokens for a complete message including metadata."""
        content = message.get('content', '')
        role = message.get('role', '')
        content_tokens = self.count_tokens(content).count
        role_overhead = 4
        return content_tokens + role_overhead
class ContextBuilder:
    """Builds conversation context within token limits."""
    def __init__(self, token_counter: TokenCounter, reserve_tokens: int = 512):
        self.token_counter = token_counter
        self.reserve_tokens = reserve_tokens
        self.effective_limit = token_counter.max_tokens - reserve_tokens
        logger.info(f"️ ContextBuilder initialized (effective limit: {self.effective_limit} tokens)")
    def build_context(
        self, 
        messages: List[Dict[str, Any]], 
        system_prompt: Optional[str] = None,
        preserve_recent: int = 2
    ) -> ContextWindow:
        """
        Build context window from messages within token limits.
        Args:
            messages: List of conversation messages
            system_prompt: Optional system prompt to include
            preserve_recent: Number of recent messages to always preserve
        Returns:
            ContextWindow with optimized message selection
        """
        context_messages = []
        total_tokens = 0
        truncated_count = 0
        if system_prompt:
            system_tokens = self.token_counter.count_tokens(system_prompt).count
            if system_tokens < self.effective_limit:
                context_messages.append({
                    "role": "system",
                    "content": system_prompt
                })
                total_tokens += system_tokens
                logger.debug(f"Added system prompt ({system_tokens} tokens)")
        recent_messages = messages[-preserve_recent:] if len(messages) > preserve_recent else messages
        older_messages = messages[:-preserve_recent] if len(messages) > preserve_recent else []
        recent_tokens = 0
        for message in recent_messages:
            message_tokens = self.token_counter.estimate_message_tokens(message)
            recent_tokens += message_tokens
        if total_tokens + recent_tokens > self.effective_limit:
            logger.warning(f"Recent messages ({recent_tokens} tokens) exceed limit, truncating content")
            for message in recent_messages:
                message_tokens = self.token_counter.estimate_message_tokens(message)
                if total_tokens + message_tokens <= self.effective_limit:
                    context_messages.append(message)
                    total_tokens += message_tokens
                else:
                    available_tokens = self.effective_limit - total_tokens - 50
                    if available_tokens > 100:
                        truncated_content = self._truncate_content(message['content'], available_tokens)
                        truncated_message = {**message, 'content': truncated_content}
                        context_messages.append(truncated_message)
                        total_tokens += self.token_counter.estimate_message_tokens(truncated_message)
                    break
        else:
            for message in recent_messages:
                context_messages.append(message)
                total_tokens += self.token_counter.estimate_message_tokens(message)
        for message in reversed(older_messages):
            message_tokens = self.token_counter.estimate_message_tokens(message)
            if total_tokens + message_tokens <= self.effective_limit:
                insert_index = 1 if system_prompt else 0
                context_messages.insert(insert_index, message)
                total_tokens += message_tokens
            else:
                truncated_count += 1
        utilization = (total_tokens / self.token_counter.max_tokens) * 100
        logger.info(f" Built context: {len(context_messages)} messages, {total_tokens} tokens ({utilization:.1f}% utilization)")
        if truncated_count > 0:
            logger.info(f"✂️ Truncated {truncated_count} older messages")
        return ContextWindow(
            messages=context_messages,
            total_tokens=total_tokens,
            max_tokens=self.token_counter.max_tokens,
            truncated_count=truncated_count,
            token_utilization=utilization
        )
    def _truncate_content(self, content: str, max_tokens: int) -> str:
        """Truncate content to fit within token limit."""
        if not content:
            return content
        current_tokens = self.token_counter.count_tokens(content).count
        if current_tokens <= max_tokens:
            return content
        ratio = max_tokens / current_tokens
        target_length = int(len(content) * ratio * 0.9)
        if target_length < 50:
            return content[:50] + "..."
        truncated = content[:target_length].rsplit(' ', 1)[0]
        return truncated + "..."
def create_token_counter(model_name: str = "default") -> TokenCounter:
    """Create a token counter for the specified model."""
    return TokenCounter(model_name)
def create_context_builder(model_name: str = "default", reserve_tokens: int = 512) -> ContextBuilder:
    """Create a context builder for the specified model."""
    token_counter = create_token_counter(model_name)
    return ContextBuilder(token_counter, reserve_tokens)
def estimate_tokens(text: str, model_name: str = "default") -> int:
    """Quick utility to estimate tokens in text."""
    counter = create_token_counter(model_name)
    return counter.count_tokens(text).count
def build_conversation_context(
    messages: List[Dict[str, Any]], 
    model_name: str = "default",
    system_prompt: Optional[str] = None
) -> ContextWindow:
    """Build conversation context for the specified model."""
    builder = create_context_builder(model_name)
    return builder.build_context(messages, system_prompt)
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(" Token Counter Test")
    print("=" * 50)
    counter = create_token_counter("gemma3n:latest")
    test_text = "Hello, how are you today? I'm doing well, thank you for asking!"
    token_info = counter.count_tokens(test_text)
    print(f"Text: {test_text}")
    print(f"Tokens: {token_info.count}")
    print(f"Method: {token_info.method.value}")
    print(f"Words: {token_info.word_count}")
    messages = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you! How can I help you today?"},
        {"role": "user", "content": "Can you explain quantum computing?"},
        {"role": "assistant", "content": "Quantum computing is a fascinating field that leverages quantum mechanical phenomena..."},
    ]
    context = build_conversation_context(messages, "gemma3n:latest")
    print(f"\nContext: {len(context.messages)} messages, {context.total_tokens} tokens")
    print(f"Utilization: {context.token_utilization:.1f}%")
