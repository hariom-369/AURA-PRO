import { useState } from 'react';
import ChatPanel from './ChatPanel';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="AI shopping assistant"
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg shadow-brand-600/40 transition-transform hover:scale-105 sm:right-6"
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
