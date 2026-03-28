'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Send, User, Loader2, 
  PanelLeftOpen, PanelLeftClose, Sparkles,
  Search, History, Trash2, LogOut,
  MapPin, FileText, ChevronRight, MessageSquare,
  Settings, Bell, Copy, Share2, Check, Paperclip, 
  MoreHorizontal, Maximize2, Star, Edit3, X, ThumbsDown,
  Mic, ThumbsUp, Clock, Upload
} from 'lucide-react';
import api from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [dislikedMessages, setDislikedMessages] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showStarred, setShowStarred] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleThought = (id: string) => {
    setExpandedThoughts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatFullDateTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.start();
      setIsRecording(true);
      
      mediaRecorder.ondataavailable = (e) => {
        const audioBlob = new Blob([e.data], { type: 'audio/webm' });
        // Would upload to backend for transcription
        console.log('Audio captured:', audioBlob.size);
      };
    } catch (err) {
      console.error('Voice recording error:', err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUploadAndQuery = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', input || `Analyze this document: ${file.name}`);
    
    try {
      const res = await api.post('/rag/upload-query', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Handle response
    } catch (err) {
      console.error('File upload error:', err);
    }
  };

  const handleLike = (messageId: string) => {
    setLikedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
        newSet.delete(messageId); // Remove from disliked if exists
        setDislikedMessages(prev => {
          const d = new Set(prev);
          d.delete(messageId);
          return d;
        });
      }
      return newSet;
    });
  };

  const handleDislike = (messageId: string) => {
    setDislikedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
        newSet.delete(messageId); // Remove from liked if exists
        setLikedMessages(prev => {
          const d = new Set(prev);
          d.delete(messageId);
          return d;
        });
      }
      return newSet;
    });
  };

  const startEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  const saveEditMessage = () => {
    if (editingMessageId && editContent.trim()) {
      setMessages(prev => prev.map(m => 
        m.id === editingMessageId ? { ...m, content: editContent } : m
      ));
      // TODO: Update in backend
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const uRes = await api.get('/auth/me', { params: { token: token || 'mock' } });
        setUser(uRes.data);
        fetchSessions();
      } catch (err) {
        // Mock user for bypass
        setUser({ username: 'Rahul', role: 'admin' });
        fetchSessions();
      }
    };
    init();
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/sessions');
      setSessions(res.data);
    } catch (err) {}
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsThinking(true);
    try {
      const res = await api.get(`/sessions/${sessionId}/history`);
      const msgs = Array.isArray(res.data) ? res.data : (res.data?.messages || []);
      setMessages(msgs);
    } catch (err) {
    } finally {
      setIsThinking(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/auth');
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/sessions/${id}`);
      fetchSessions();
      if (currentSessionId === id) startNewChat();
    } catch (err) {}
  };

  const toggleStar = async (e: React.MouseEvent, id: string, currentStarred: boolean) => {
    e.stopPropagation();
    try {
      await api.put(`/sessions/${id}`, { is_starred: !currentStarred });
      fetchSessions();
    } catch (err) {}
  };

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitle(currentTitle || '');
  };

  const saveRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await api.put(`/sessions/${id}`, { title: editTitle.trim() });
      fetchSessions();
    } catch (err) {}
    setEditingSessionId(null);
  };

  const stripMarkdown = (text: string): string => {
    let result = text;

    // Convert markdown tables to readable format
    const tableRegex = /\|([^\n]+)\|\n\|[-|\s]+\|\n((?:\|[^\n]+\|\n?)+)/g;
    result = result.replace(tableRegex, (match, headerLine, bodyLines) => {
      const headers = headerLine.split('|').filter(Boolean).map((h: string) => h.trim());
      const maxWidths = headers.map((h: string) => h.length);
      
      const rows = bodyLines.trim().split('\n').map((row: string) => 
        row.split('|').filter(Boolean).map((c: string) => c.trim())
      );
      
      rows.forEach((row: string[]) => {
        row.forEach((cell: string, i: number) => {
          maxWidths[i] = Math.max(maxWidths[i], cell.length);
        });
      });
      
      let output = '\n';
      output += headers.map((h: string, i: number) => h.padEnd(maxWidths[i])).join('  ') + '\n';
      output += maxWidths.map((w: number) => '-'.repeat(w)).join('  ') + '\n';
      output += rows.map((row: string[]) => 
        row.map((cell: string, i: number) => cell.padEnd(maxWidths[i])).join('  ')
      ).join('\n');
      
      return output;
    });
    
    return result
      .replace(/#{1,6}\s/g, '')           // Headers
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Bold/Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
      .replace(/\|/g, ' ')                    // Table pipes
      .replace(/[-=]+\n/g, '\n')               // Table dividers
      .replace(/\n{3,}/g, '\n\n')            // Multiple newlines
      .replace(/```[\s\S]*?```/g, '')         // Code blocks
      .replace(/`([^`]+)`/g, '$1')            // Inline code
      .trim();
  };

  const copyToClipboard = (text: string, id: string, shouldStripMarkdown: boolean = true) => {
    const textToCopy = shouldStripMarkdown ? stripMarkdown(text) : text;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resendMessage = (content: string) => {
    setInput(content);
  };

  const shareContent = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dhara PMC', text: text, url: window.location.href });
      } catch (err) {}
    } else {
      copyToClipboard(text, 'share');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsThinking(true);

    try {
      let activeId = currentSessionId;
      if (!activeId) {
        // Create session with initial title from query - send as body
        const res = await api.post('/sessions', { title: currentInput.slice(0, 50), is_incognito: false });
        activeId = res.data.session_id;
        setCurrentSessionId(activeId);
      }

      const token = localStorage.getItem('access_token') || 'mock';

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4200'}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: currentInput, session_id: activeId })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: any = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { thought_process: [] }
      };

      setMessages(prev => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            console.log('Stream data:', data.type, data);
            
            if (data.type === 'metadata') {
              assistantMsg.metadata = { ...assistantMsg.metadata, ...data };
            } else if (data.type === 'content') {
              assistantMsg.content += data.content;
            } else if (data.type === 'final') {
              assistantMsg.metadata = { ...assistantMsg.metadata, ...data };
              // Refresh sessions after chat completes to get updated title
              fetchSessions();
            } else if (data.type === 'thought_process') {
              assistantMsg.metadata.thought_process = data.steps || [];
              // Auto-expand thinking for user to see
              setExpandedThoughts(prev => ({ ...prev, [messages.length]: true }));
            } else if (data.type === 'sources' || data.type === 'metadata') {
              // Store sources for the panel
              if (data.sources) {
                setCurrentSources(data.sources);
              }
            }

            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = { ...assistantMsg };
              return newMsgs;
            });
          } catch (e) {
            console.error('Error parsing stream chunk', e);
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Unable to connect to the Dhara engine." }]);
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
              <Sparkles size={14} fill="currentColor" />
            </div>
            Dhara
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600"><PanelLeftClose size={18} /></button>
        </div>

        <button onClick={startNewChat} className="mx-4 mb-4 p-2.5 bg-white border border-[#e5e5e0] rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors">
          <Plus size={14} /> New Chat
        </button>

        {/* Starred Section */}
        <div className="flex-1 overflow-y-auto px-2">
          <div 
            className="px-3 mb-2 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-[#d97757]"
            onClick={() => setShowStarred(!showStarred)}
          >
            <ChevronRight size={12} className={`transition-transform ${showStarred ? 'rotate-90' : ''}`} />
            Starred
          </div>
          
          {showStarred && sessions.filter(s => s.is_starred).map(s => (
            <div key={`starred-${s.id}`} onClick={() => loadSession(s.id)} className={`group px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between transition-colors ${currentSessionId === s.id ? 'bg-[#ebebe8]' : 'hover:bg-[#ebebe8]/50'}`}>
              {editingSessionId === s.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input 
                    type="text" 
                    value={editTitle} 
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename(s.id)}
                    onBlur={() => saveRename(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-1 py-0.5 text-xs border rounded"
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />
                    <span className="truncate font-medium">{s.title || "New Inquiry"}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => toggleStar(e, s.id, s.is_starred)} className="text-gray-400 hover:text-yellow-500">
                      <Star size={12} className="fill-yellow-500 text-yellow-500" />
                    </button>
                    <button onClick={(e) => startRename(e, s.id, s.title)} className="text-gray-400 hover:text-blue-500">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={(e) => deleteSession(e, s.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {!showStarred && (
            <>
              <div className="px-3 mb-2 mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent</div>
              {sessions.filter(s => !s.is_starred).map(s => (
                <div key={s.id} onClick={() => loadSession(s.id)} className={`group px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between transition-colors ${currentSessionId === s.id ? 'bg-[#ebebe8]' : 'hover:bg-[#ebebe8]/50'}`}>
                  {editingSessionId === s.id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input 
                        type="text" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(s.id)}
                        onBlur={() => saveRename(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-1 py-0.5 text-xs border rounded"
                        autoFocus
                      />
                      <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }} className="text-gray-400 hover:text-gray-600">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate flex-1 font-medium">{s.title || "New Inquiry"}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={(e) => toggleStar(e, s.id, s.is_starred)} className="text-gray-400 hover:text-yellow-500">
                          <Star size={12} />
                        </button>
                        <button onClick={(e) => startRename(e, s.id, s.title)} className="text-gray-400 hover:text-blue-500">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={(e) => deleteSession(e, s.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#e5e5e0]">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 bg-white border border-[#e5e5e0] rounded-full flex items-center justify-center text-[10px] font-bold uppercase">{user.username?.[0]}</div>
            <span className="text-xs font-bold flex-1 truncate">{user.username}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-white">
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-20 p-2 text-gray-400 hover:text-gray-600 bg-white/50 backdrop-blur rounded-lg">
            <PanelLeftOpen size={20} />
          </button>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center">
              <h1 className="text-3xl font-serif font-medium mb-8">How can Dhara help you?</h1>
              <div className="grid grid-cols-2 gap-3 w-full">
                {[
                  "Plot Feasibility for Kothrud",
                  "FSI for Residential Zones",
                  "DCPR 2017 side margins",
                  "Society Registration process"
                ].map((q, i) => (
                  <button key={i} onClick={() => setInput(q)} className="p-4 border border-[#e5e5e0] rounded-xl text-sm font-medium hover:border-[#d97757] hover:bg-[#fffcfb] transition-all text-left">
                    {q} <ChevronRight size={14} className="inline float-right mt-1 opacity-30" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-6 py-12 space-y-12">
              {(Array.isArray(messages) ? messages : []).map((m, i) => (
                <div key={i} className={`flex gap-6 group ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-md bg-[#d97757]/10 flex items-center justify-center text-[#d97757] shrink-0 mt-1">
                      <Sparkles size={16} fill="currentColor" />
                    </div>
                  )}
                  <div className={`flex flex-col ${m.role === 'user' ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
                    
                    {/* Assistant Thinking Block - Show inline with better styling */}
                    {(m.role === 'assistant') && (m.metadata?.thought_process?.length > 0) && (
                      <div className="mb-4 p-3 bg-[#fafafa] rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-[#d97757]" />
                          <span className="text-xs font-semibold text-[#d97757]">AI Thinking</span>
                        </div>
                        <div className="space-y-1.5">
                          {(Array.isArray(m.metadata.thought_process) ? m.metadata.thought_process : []).filter((step: any) => {
                            const stepStr = String(step);
                            return !stepStr.includes('Found 0') && 
                                   !stepStr.includes('Vectorstore connection failed') &&
                                   !stepStr.includes('Expanded to') &&
                                   !stepStr.includes('search queries');
                          }).map((step: any, idx: number) => {
                            const stepStr = String(step);
                            let icon = '○';
                            let iconColor = 'text-gray-400';
                            if (stepStr.includes('Analyzing') || stepStr.includes('Identified intent')) {
                              icon = '🔍';
                              iconColor = 'text-[#d97757]';
                            } else if (stepStr.includes('Searching local') || stepStr.includes('Searching web')) {
                              icon = '📚';
                              iconColor = 'text-amber-500';
                            } else if (stepStr.includes('Found') && !stepStr.includes('Found 0')) {
                              icon = '✅';
                              iconColor = 'text-emerald-500';
                            } else if (stepStr.includes('Synthesizing')) {
                              icon = '✍️';
                              iconColor = 'text-blue-500';
                            }
                            return (
                              <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                                <span className={`${iconColor} mt-0.5`}>{icon}</span>
                                <span className="leading-relaxed">{stepStr}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className={`text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-[#f4f4f2] px-4 py-3 rounded-2xl' : ''}`}>
                      <div className="prose prose-slate prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Metadata Metadata Block */}
                    {m.role === 'assistant' && m.metadata && (
                      <div className="mt-6 space-y-4 animate-fade-in border-t border-gray-50 pt-4">
                        {/* Confidence Score - Only show if > 0 */}
                        {m.metadata.confidence !== undefined && m.metadata.confidence > 0 && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span>Confidence:</span>
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${m.metadata.confidence > 0.7 ? 'bg-emerald-500' : m.metadata.confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${m.metadata.confidence * 100}%` }}
                              />
                            </div>
                            <span className={m.metadata.confidence > 0.7 ? 'text-emerald-600' : m.metadata.confidence > 0.4 ? 'text-amber-600' : 'text-rose-600'}>
                              {Math.round(m.metadata.confidence * 100)}%
                            </span>
                          </div>
                        )}

                        {/* Clauses & Tables */}
                        {(m.metadata.clauses_found?.length > 0 || m.metadata.tables_found?.length > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {m.metadata.clauses_found?.map((c: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md border border-blue-100 uppercase tracking-tight">
                                {c}
                              </span>
                            ))}
                            {m.metadata.tables_found?.map((t: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-md border border-purple-100 uppercase tracking-tight">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Suggestions */}
                        {m.metadata.suggestions?.length > 0 && i === messages.length - 1 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Suggested follow-ups</p>
                            <div className="flex flex-wrap gap-2">
                              {m.metadata.suggestions.map((s: string, idx: number) => (
                                <button 
                                  key={idx} 
                                  onClick={() => setInput(s)}
                                  className="text-left px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-[#d97757] hover:text-[#d97757] hover:bg-[#fffcfb] transition-all"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {m.role === 'assistant' && (
                      <div className="flex items-center gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => copyToClipboard(m.content, `c-${i}`)} className="text-gray-400 hover:text-[#d97757] flex items-center gap-1 text-[10px] font-bold uppercase">
                           {copiedId === `c-${i}` ? <Check size={12} /> : <Copy size={12} />} {copiedId === `c-${i}` ? 'Copied' : 'Copy'}
                         </button>
                         <button onClick={() => resendMessage(m.content)} className="text-gray-400 hover:text-[#d97757] flex items-center gap-1 text-[10px] font-bold uppercase"><Share2 size={12} /> Resend</button>
                         <button className="text-gray-400 hover:text-[#d97757] flex items-center gap-1 text-[10px] font-bold uppercase"><ThumbsDown size={12} /> Dislike</button>
                         {currentSources.length > 0 && (
                           <button 
                            onClick={() => setShowSourcesPanel(!showSourcesPanel)} 
                            className="text-gray-400 hover:text-[#d97757] flex items-center gap-1 text-[10px] font-bold uppercase"
                           >
                             <FileText size={12} /> Sources ({currentSources.length})
                           </button>
                         )}
                       </div>
                    )}
                  </div>
                </div>
              ))}
              {isThinking && messages.length === 0 && (
                <div className="flex gap-6 animate-pulse">
                  <div className="w-8 h-8 rounded-md bg-[#d97757]/10 flex items-center justify-center text-[#d97757] shrink-0"><Sparkles size={16} /></div>
                  <div className="text-gray-400 text-sm italic font-serif py-1">Thinking...</div>
                </div>
              )}
              <div ref={scrollRef} className="h-32" />
            </div>
          )}
        </div>

        {/* Floating Input Area - Claude Style */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="relative bg-[#f4f4f2] rounded-2xl border border-[#e5e5e0] focus-within:border-gray-400 transition-all p-2 shadow-sm">
              <textarea 
                rows={1}
                className="w-full bg-transparent resize-none py-3 px-4 focus:outline-none text-[15px] placeholder-gray-500 max-h-48 overflow-y-auto"
                placeholder="Message Dhara..."
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 192) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-md transition-colors"><Paperclip size={16} /></button>
                  <button className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-md transition-colors"><Maximize2 size={16} /></button>
                </div>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  className={`p-1.5 rounded-lg transition-all ${input.trim() && !isThinking ? 'bg-[#d97757] text-white' : 'bg-gray-300 text-gray-50'}`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3 font-medium">Dhara can provide regulatory guidance but always verify with PMC officers.</p>
          </div>
        </div>
      </main>

      {/* Sources Panel - Right Side */}
      {showSourcesPanel && (
        <aside className="w-80 bg-white border-l border-[#e5e5e0] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#e5e5e0] flex items-center justify-between">
            <h3 className="font-bold text-sm">Sources</h3>
            <button onClick={() => setShowSourcesPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentSources.length > 0 ? (
              currentSources.map((source: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-[#d97757]" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Source {idx + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-4">{source.text || source.content || 'No content'}</p>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#d97757] hover:underline mt-2 block">
                      View Source →
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 text-sm py-8">
                No sources available for this response.
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
