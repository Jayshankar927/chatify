import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const socketRef = useRef<WebSocket | null>(null);

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetch(`${apiUrl}/api/messages`)
      .then((res) => res.json())
      .then((data: ChatMessage[]) => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch((err) => console.error('Failed to fetch messages:', err));

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data: ChatMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch {
        const fallbackMsg: ChatMessage = {
          id: Date.now().toString(),
          text: event.data,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    };

    return () => {
      ws.close();
    };
  }, [apiUrl, wsUrl]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    const payload = {
      text: input
    };

    socketRef.current.send(JSON.stringify(payload));
    setInput('');
  };

  //Toogle theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex flex-col h-screen w-screen p-4 sm:p-6 overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <header
        className={`border-b pb-3 mb-4 flex items-center justify-between ${
          isDark ? 'border-slate-700' : 'border-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <h1
            className={`text-xl font-bold ${
              isDark ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          >
            Real-Time DevOps Chat
          </h1>
          <button
            onClick={toggleTheme}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <span className="flex items-center text-xs">
          <span
            className={`h-2 w-2 rounded-full mr-2 ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto space-y-2 pr-2">
        {messages.length === 0 ? (
          <p
            className={`text-center mt-10 text-sm ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg border text-sm flex justify-between ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-800 shadow-sm'
              }`}
            >
              <span>{msg.text}</span>
              <span
                className={`text-xs ml-2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          ))
        )}
      </main>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className={`flex-1 rounded-lg px-4 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={!isConnected}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}