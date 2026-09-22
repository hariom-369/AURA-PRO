import { useState } from 'react';
import { useChat } from '../../hooks/useChat';

export default function ChatPanel({ onClose }) {
  const { messages, loading, error, sendMessage } = useChat();
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex max-h-[32rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:right-6">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">AURA AI Assistant</span>
        {onClose && (
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label="Close chat">
            ✕
          </button>
        )}
      </div>

      <div className="flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Ask about products, prices, comparisons, or your orders.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-brand-600 px-3 py-2 text-sm text-white'
                : 'max-w-[85%] self-start whitespace-pre-wrap rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
            }
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="max-w-[85%] self-start rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Thinking...
          </div>
        )}
        {error && <div className="text-sm text-rose-500">{error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
