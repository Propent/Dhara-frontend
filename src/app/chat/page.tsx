"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Plus, 
  MessageSquare, 
  Search, 
  PanelLeft, 
  Settings, 
  LogOut, 
  MoreVertical, 
  Share, 
  Trash2, 
  Star,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Brain,
  ExternalLink,
  Shield,
  Square
} from "lucide-react";

export default function ChatPage() {
  const { user, logout, fetchSessions, sessions } = useAuth();
  const router = useRouter();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'recent' | 'starred'>('recent');
  const [showThoughtProcess, setShowThoughtProcess] = useState(false);
  const [thoughtSteps, setThoughtSteps] = useState<string[]>([]);
  const [isGreeting, setIsGreeting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const GREETINGS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy", "hi there", "hello there"];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // Fetch sessions on mount and when user changes
  useEffect(() => {
    console.log('useEffect running, user:', !!user, 'token:', !!localStorage.getItem('access_token'));
    if (user && localStorage.getItem('access_token')) {
      fetchSessions();
    }
  }, [user, fetchSessions]);

  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Don't auto-select if we want to stay on welcome screen
    }
  }, [sessions, currentSessionId]);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setCurrentSources([]);
    inputRef.current?.focus();
  };

  const loadSession = async (sessionId: string) => {
    try {
      setCurrentSessionId(sessionId);
      const res = await api.get(`/sessions/${sessionId}/history`);
      setMessages(res.data.messages || []);
      setCurrentSources([]);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/sessions/${sessionId}`);
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      fetchSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const toggleStar = async (e: React.MouseEvent, sessionId: string, isStarred: boolean) => {
    e.stopPropagation();
    try {
      await api.patch(`/sessions/${sessionId}`, { is_starred: !isStarred });
      fetchSessions();
    } catch (err) {
      console.error('Failed to star session:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const trimmedInput = input.trim();
    const isGreetingMsg = GREETINGS.includes(trimmedInput.toLowerCase());
    
    setIsGreeting(isGreetingMsg);
    setThoughtSteps([]);
    setShowThoughtProcess(false);
    
    const userMsg = { role: 'user', content: trimmedInput, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = trimmedInput;
    setInput('');
    setIsThinking(true);

    try {
      let activeId = currentSessionId;
      if (!activeId) {
        const res = await api.post('/sessions', { title: currentInput.slice(0, 50), is_incognito: false });
        activeId = res.data.session_id;
        setCurrentSessionId(activeId);
      }

      const token = localStorage.getItem('access_token') || 'mock';
      console.log('Sending request to chat/stream...');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: currentInput, session_id: activeId })
      });

      if (!response.body) throw new Error('No response body');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: any = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { thought_process: [] }
      };

      setMessages(prev => [...prev, assistantMsg]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // CRITICAL: Robustly extract JSON even if prefix is malformed or missing
          let jsonStr = trimmedLine;
          const startIdx = jsonStr.indexOf("{");
          if (startIdx !== -1) {
            jsonStr = jsonStr.substring(startIdx);
          } else {
            continue;
          }
          
          if (jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);
            
            if (data.type === 'content' && data.content) {
              console.log('Got content:', data.content.slice(0, 50));
              setIsThinking(false);
              assistantMsg.content += data.content;
            } else if (data.type === 'metadata' && data.sources) {
              console.log('Got metadata, sources:', data.sources.length);
              assistantMsg.metadata.sources = data.sources;
              setCurrentSources(data.sources);
            } else if (data.type === 'thought_process') {
              console.log('Got thought_process:', data.steps);
              const steps = data.steps || [];
              setThoughtSteps(steps);
              assistantMsg.metadata.thought_process = steps;
            } else if (data.type === 'final') {
              console.log('Got final');
              setIsThinking(false);
              if (!assistantMsg.content || assistantMsg.content.trim() === '') {
                assistantMsg.content = "I apologize, but I couldn't process your query at the moment. Please try again or rephrase your question about DCPR/UDCPR regulations.";
              }
              assistantMsg.metadata = { ...assistantMsg.metadata, ...data };
              fetchSessions();
            } else if (data.type === 'error') {
              console.error('Stream error:', data.content);
              setIsThinking(false);
            }

            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = { ...assistantMsg };
              return newMsgs;
            });
          } catch (e) {
            console.warn('Error parsing stream chunk', e, trimmedLine);
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setIsThinking(false);
      const fallbackMessage = "I apologize, but I couldn't process your query at the moment. Please try again or rephrase your question about DCPR/UDCPR regulations.";
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackMessage }]);
    } finally {
      setIsThinking(false);
      fetchSessions();
    }
  };

  if (!user) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#d97757]" /></div>;

  return (
    <div className="flex h-screen bg-[#fcfcfb] text-[#343433] font-sans overflow-hidden">
      {/* Sidebar - Minimalist Claude Style */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} bg-[#f5f5f2] border-r border-[#e5e5e0] transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="p-5 flex items-center justify-between">
          <button onClick={startNewChat} className="flex items-center gap-2 font-semibold text-sm hover:opacity-70 transition-opacity">
            <div className="w-7 h-7 bg-[#d97757] rounded-md flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            New Chat
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-[#ebebe6] rounded-md text-[#8e8e8a]">
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
          {/* Starred Section */}
          {sessions.some(s => s.is_starred) && (
            <div className="mb-4">
              <div className="px-3 py-2 text-[11px] font-semibold text-[#8e8e8a] uppercase tracking-wider">
                Starred
              </div>
              {sessions.filter(s => s.is_starred).map((session) => (
                <div 
                  key={session.session_id} 
                  onClick={() => loadSession(session.session_id)}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer mb-1 transition-colors ${currentSessionId === session.session_id ? 'bg-[#ebebe6] text-[#1a1a1a]' : 'hover:bg-[#f0f0ed] text-[#676764]'}`}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <span className="text-[13px] font-medium truncate pr-10">{session.title}</span>
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        api.patch(`/sessions/${session.session_id}`, { is_starred: false })
                          .then(() => setTimeout(() => fetchSessions(), 100))
                          .catch(err => console.error('Star failed:', err));
                      }} 
                      className="p-1 hover:text-[#d97757]"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#d97757] text-[#d97757]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Section */}
          {sessions.some(s => !s.is_starred) && (
            <div>
              <div className="px-3 py-2 text-[11px] font-semibold text-[#8e8e8a] uppercase tracking-wider">
                Recent
              </div>
              {sessions.filter(s => !s.is_starred).map((session) => (
                <div 
                  key={session.session_id} 
                  onClick={() => loadSession(session.session_id)}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer mb-1 transition-colors ${currentSessionId === session.session_id ? 'bg-[#ebebe6] text-[#1a1a1a]' : 'hover:bg-[#f0f0ed] text-[#676764]'}`}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <span className="text-[13px] font-medium truncate pr-10">{session.title}</span>
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        api.patch(`/sessions/${session.session_id}`, { is_starred: true })
                          .then(() => setTimeout(() => fetchSessions(), 100))
                          .catch(err => console.error('Star failed:', err));
                      }} 
                      className="p-1 hover:text-[#d97757]"
                    >
                      <Star className={`w-3.5 h-3.5 ${session.is_starred ? 'fill-[#d97757] text-[#d97757]' : ''}`} />
                    </button>
                    <button onClick={(e) => deleteSession(e, session.session_id)} className="p-1 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#e5e5e0] bg-[#f5f5f2]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user.full_name?.[0] || user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight">{user.full_name || 'User'}</p>
              <p className="text-[11px] text-[#8e8e8a] truncate leading-tight">{user.email}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[#676764] hover:bg-[#ebebe6] rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white">
        <header className={`h-14 flex items-center justify-between px-6 transition-all ${isSidebarOpen ? '' : 'ml-4'}`}>
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 hover:bg-[#f5f5f2] rounded-md text-[#8e8e8a]">
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="font-semibold text-sm tracking-tight text-[#1a1a1a]">
              Dhara
            </h1>
            {currentSessionId && sessions.find(s => s.session_id === currentSessionId)?.is_incognito && (
              <span className="flex items-center gap-1 text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold tracking-wider">
                <Shield className="w-2.5 h-2.5" /> INCOGNITO
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {currentSources.length > 0 && (
              <button 
                onClick={() => setShowSourcesPanel(!showSourcesPanel)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showSourcesPanel ? 'bg-[#ebebe6] text-[#343433]' : 'text-[#8e8e8a] hover:text-[#343433]'}`}
              >
                Sources <span className="bg-[#d97757] text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px]">{currentSources.length}</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto py-8 custom-scrollbar">
          <div className="max-w-3xl mx-auto px-6">
            {messages.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#f5f5f2] rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-[#e5e5e0]">
                  <Brain className="w-8 h-8 text-[#d97757]" />
                </div>
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-2 tracking-tight">How can Dhara help you today?</h2>
                <p className="text-[#8e8e8a] text-sm max-w-sm leading-relaxed mb-8">
                  Ask about DCPR 2034, building regulations, FSI lookups, or property feasibility in Pune.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    "FSI for 1000 sqm plot on 12m road",
                    "Side margins for 24m high building",
                    "Parking for residential 2BHK flat",
                    "Scheme 33(7B) redevelopment rules"
                  ].map((q, i) => (
                    <button 
                      key={i} 
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="px-4 py-3 bg-white border border-[#e5e5e0] hover:border-[#d97757] hover:bg-[#fcfcfb] rounded-xl text-left text-xs font-medium text-[#676764] transition-all shadow-sm group"
                    >
                      <div className="flex items-center justify-between">
                        {q}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#d97757]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-10 pb-12">
                {messages.filter(m => m.role !== 'assistant' || m.content).map((msg, idx) => (
                  <div key={idx} className="flex gap-5 group">
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${msg.role === 'user' ? 'bg-[#ebebe6] text-[#676764]' : 'bg-[#d97757] text-white'}`}>
                      {msg.role === 'user' ? (user.full_name?.[0] || 'U') : <Brain className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      {msg.role === 'assistant' && msg.content && msg.metadata?.thought_process && msg.metadata.thought_process.length > 0 && (
                        <div className="mb-4">
                          <button 
                            onClick={() => setExpandedThoughts(prev => ({ ...prev, [msg.timestamp]: !prev[msg.timestamp] }))}
                            className="flex items-center gap-1.5 text-[11px] font-bold italic text-[#8e8e8a] hover:text-[#d97757] transition-colors"
                          >
                            {expandedThoughts[msg.timestamp] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            Show thinking
                          </button>
                          {expandedThoughts[msg.timestamp] && (
                            <div className="mt-2 pl-3 border-l-2 border-[#f0f0ed] space-y-1">
                              {msg.metadata.thought_process.map((step: string, i: number) => (
                                <p key={i} className="text-[11px] text-[#8e8e8a] font-medium leading-relaxed">• {step}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[15px] leading-relaxed text-[#343433] font-medium">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            table: ({children}) => (
                              <div className="overflow-x-auto my-4 border border-[#e5e5e0] rounded-lg">
                                <table className="min-w-full divide-y divide-[#e5e5e0]">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({children}) => (
                              <thead className="bg-[#f5f5f2]">{children}</thead>
                            ),
                            th: ({children}) => (
                              <th className="px-4 py-3 text-left text-xs font-bold text-[#676764] uppercase tracking-wider">{children}</th>
                            ),
                            td: ({children}) => (
                              <td className="px-4 py-3 text-sm text-[#343433]">{children}</td>
                            ),
                            tr: ({children}) => (
                              <tr className="border-b border-[#e5e5e0]">{children}</tr>
                            ),
                            h1: ({children}) => <h1 className="text-2xl font-bold text-[#1a1a1a] mt-6 mb-4">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-bold text-[#1a1a1a] mt-5 mb-3">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-semibold text-[#1a1a1a] mt-4 mb-2">{children}</h3>,
                            h4: ({children}) => <h4 className="text-base font-semibold text-[#1a1a1a] mt-3 mb-2">{children}</h4>,
                            p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                            li: ({children}) => <li className="text-[15px]">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold text-[#1a1a1a]">{children}</strong>,
                            em: ({children}) => <em className="italic">{children}</em>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-[#d97757] pl-4 py-2 my-4 bg-[#f5f5f2] rounded-r-lg text-[#676764]">{children}</blockquote>,
                            code: ({children, className}) => {
                              const isInline = !className;
                              if (isInline) return <code className="bg-[#f5f5f2] px-1.5 py-0.5 rounded text-[#d97757] text-sm font-mono">{children}</code>;
                              return <code className={className}>{children}</code>;
                            },
                            pre: ({children}) => <pre className="bg-[#1a1a1a] text-[#f5f5f2] p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">{children}</pre>,
                            a: ({href, children}) => <a href={href} className="text-[#d97757] hover:underline">{children}</a>,
                            hr: () => <hr className="border-[#e5e5e0] my-6" />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      
                      {msg.role === 'assistant' && msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                        <button 
                          onClick={() => setShowSourcesPanel(true)}
                          className="mt-4 flex items-center gap-1.5 px-2 py-1 bg-[#f5f5f2] border border-[#e5e5e0] rounded-md text-[10px] font-medium text-[#8e8e8a] hover:border-[#d97757] hover:text-[#343433] transition-all"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Reference Sources ({msg.metadata.sources.length})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isThinking && (
                  <div className="flex gap-5">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#d97757] text-white shadow-sm">
                      <Brain className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="text-[11px] text-[#8e8e8a] italic">Generating response...</div>
                      {thoughtSteps.length > 0 && (
                        <div className="mt-3 pl-3 border-l-2 border-[#f0f0ed] space-y-1">
                          {thoughtSteps.map((step, i) => (
                            <p key={i} className="text-[11px] text-[#8e8e8a] font-medium italic">{step}</p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-[#8e8e8a] italic">Thinking</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-[#d97757] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-[#d97757] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-[#d97757] rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Claude Style Floating */}
        <div className="p-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative bg-[#f5f5f2] rounded-2xl border-2 border-[#ebebe6] focus-within:border-[#d97757] transition-all shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="How can I help you?"
                className="w-full bg-transparent p-4 pr-14 min-h-[60px] max-h-48 resize-none text-[15px] focus:outline-none placeholder-[#8e8e8a] font-medium"
                rows={1}
              />
              <div className="absolute right-3 bottom-3">
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${input.trim() ? 'bg-[#d97757] text-white shadow-md hover:opacity-90' : 'bg-[#ebebe6] text-[#8e8e8a]'}`}
                >
                  <ChevronUp className="w-5 h-5 stroke-[2.5px]" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-center font-bold text-[#8e8e8a] tracking-wider uppercase">
              Pune UDCPR 2024 &bull; DCPR 2034 &bull; AI Powered
            </p>
          </div>
        </div>

        {/* Sources Sidebar */}
        {showSourcesPanel && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-[#f0f0ed] shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-[#f0f0ed] flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-tight uppercase">Sources</h3>
              <button onClick={() => setShowSourcesPanel(false)} className="p-1 hover:bg-[#f5f5f2] rounded-md text-[#8e8e8a]">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {currentSources.length > 0 ? currentSources.map((source, i) => (
                <div key={i} className="space-y-2 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#d97757] uppercase tracking-widest">Doc {i+1}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#1a1a1a] leading-tight group-hover:text-[#d97757] transition-colors">{source.source}</h4>
                  <p className="text-[12px] text-[#676764] leading-relaxed line-clamp-4 font-medium italic">"{source.text}"</p>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(source.text || ''); }}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#8e8e8a] hover:text-[#343433]"
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> COPY TEXT
                  </button>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <Shield className="w-8 h-8 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest">No Sources Loaded</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
