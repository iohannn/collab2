import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Send, Lock, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const CollabMessaging = ({ collabId, collabStatus }) => {
  const { user, getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API}/messages/${collabId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setIsLocked(data.is_locked);
      }
    } catch (err) {
      /* silent */
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [collabId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${API}/messages/${collabId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Eroare la trimiterea mesajului');
      }
    } catch {
      toast.error('Eroare de conexiune');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden" data-testid="collab-messaging">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">Mesaje colaborare</h3>
        {isLocked && (
          <Badge className="bg-red-100 text-red-700 gap-1">
            <Lock className="w-3 h-3" /> Blocat - dispută activă
          </Badge>
        )}
      </div>

      {/* Off-platform warning */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Comunicarea se face exclusiv prin platformă. Istoricul mesajelor este păstrat pentru protecția ta.</span>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Niciun mesaj încă. Începe conversația!</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`flex ${msg.sender_id === user?.user_id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.sender_id === user?.user_id
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-white border border-border rounded-bl-md'
              }`}
              data-testid={`message-${msg.message_id}`}
            >
              <p className={`text-xs font-medium mb-1 ${msg.sender_id === user?.user_id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {msg.sender_name} · {msg.sender_type === 'brand' ? 'Brand' : 'Creator'}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              <p className={`text-[10px] mt-1 ${msg.sender_id === user?.user_id ? 'text-primary-foreground/50' : 'text-muted-foreground/60'}`}>
                {new Date(msg.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isLocked ? (
        <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Scrie un mesaj..."
            maxLength={2000}
            disabled={sending}
            data-testid="message-input"
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} data-testid="send-message-btn">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <div className="p-4 border-t border-border bg-red-50 text-center text-sm text-red-600">
          <Lock className="w-4 h-4 inline mr-1" />
          Mesajele sunt blocate pe durata disputei
        </div>
      )}
    </div>
  );
};

export default CollabMessaging;
