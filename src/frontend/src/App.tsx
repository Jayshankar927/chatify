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

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white p-4 max-w-2xl mx-auto">
      <header className="border-b border-slate-700 pb-3 mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-400">Real-Time DevOps Chat</h1>
        <span className="flex items-center text-xs">
          <span className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto space-y-2 pr-2">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-center mt-10 text-sm">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-sm flex justify-between">
              <span>{msg.text}</span>
              <span className="text-xs text-slate-500 ml-2">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
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