import { useCallback, useState } from 'react';
import { sendChatMessage } from '../services/aiService';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(
    async (text) => {
      if (!text || !text.trim()) return;
      const userMessage = { role: 'user', content: text.trim() };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setLoading(true);
      setError(null);
      try {
        const result = await sendChatMessage(nextMessages);
        setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      } catch (err) {
        setError(err.response?.data?.message || 'The assistant is unavailable right now.');
      } finally {
        setLoading(false);
      }
    },
    [messages]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, sendMessage, reset };
}
