import React, { useState, useEffect, useRef } from 'react';
import { useAuth, type User } from '../context/AuthContext';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  timestamp: string;
}

interface ConversationUser extends User {
  last_message?: string;
  last_message_time?: string;
}

export const ChatDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const selectedUserRef = useRef<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = () => {
    if (!token) return;
    fetch(`${apiUrl}/api/users/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadConversations();
  }, [apiUrl, token]);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data);
      const currentSelected = selectedUserRef.current;

      if (
        currentSelected &&
        (msg.sender_id === currentSelected.id || msg.recipient_id === currentSelected.id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      loadConversations();
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, token]);

  useEffect(() => {
    if (!selectedUser) return;

    fetch(`${apiUrl}/api/messages/${selectedUser.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, [selectedUser, apiUrl, token]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedUser || !socketRef.current) return;

    const payload = {
      recipientId: selectedUser.id,
      text: inputMessage
    };

    socketRef.current.send(JSON.stringify(payload));
    setInputMessage('');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-white leading-tight">@{user?.username}</h2>
            <span className="flex items-center text-xs text-slate-400 mt-1">
              <span className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />
              {isConnected ? 'Online' : 'Reconnecting...'}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 transition"
          >
            Logout
          </button>
        </div>

        <div className="p-3">
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0 && (
            <div className="border-b border-slate-800 pb-2 mb-2">
              <span className="px-4 py-1 text-[10px] uppercase font-bold text-slate-500">Search Results</span>
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800 flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs">
                    {u.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          <div className="px-4 py-1 text-[10px] uppercase font-bold text-slate-500">Recent Chats</div>
          {conversations.length === 0 ? (
            <p className="text-slate-500 text-center text-xs mt-4">No recent chats.</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedUser(conv)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-800/50 hover:bg-slate-800 transition ${
                  selectedUser?.id === conv.id ? 'bg-slate-800 border-l-4 border-l-indigo-500' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm">
                  {conv.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-sm font-semibold truncate text-white">@{conv.username}</h3>
                  </div>
                  {conv.last_message && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{conv.last_message}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs">
                {selectedUser.username[0].toUpperCase()}
              </div>
              <h3 className="font-semibold text-white">@{selectedUser.username}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-md rounded-xl px-4 py-2 text-sm shadow-sm ${
                        isMine
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span
                        className={`text-[10px] block text-right mt-1 ${
                          isMine ? 'text-indigo-200' : 'text-slate-500'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Message @${selectedUser.username}...`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!isConnected || !inputMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              💬
            </div>
            <p className="text-sm font-medium">Select a conversation or search a username to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};