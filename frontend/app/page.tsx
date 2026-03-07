"use client";

import React, { useState, useRef, useEffect } from 'react';

type Message = {
    role: 'user' | 'ai';
    content: string;
    sources?: { filename: string; chunk_index: number; content_preview: string }[];
};

type UploadedFile = {
    filename: string;
    status: 'uploading' | 'processing' | 'done' | 'error';
    size?: number;
};

export default function Home() {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState('user1');
    const [password, setPassword] = useState('secret456');
    const [loginError, setLoginError] = useState('');

    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: "Hello! I am your AskMyDocs Assistant. Please upload a document on the left, and I'll be ready to answer your questions." }
    ]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Invalid credentials');
            }

            const data = await res.json();
            setToken(data.access_token);
        } catch (err: any) {
            setLoginError(err.message);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        await uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        if (!token) return;
        const newFile: UploadedFile = { filename: file.name, status: 'uploading', size: file.size };
        setFiles(prev => [newFile, ...prev]);
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_URL}/upload/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Upload failed');
            }

            setFiles(prev => prev.map(f => f.filename === file.name ? { ...f, status: 'done' } : f));
        } catch (error) {
            console.error(error);
            setFiles(prev => prev.map(f => f.filename === file.name ? { ...f, status: 'error' } : f));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) {
            await uploadFile(e.dataTransfer.files[0]);
        }
    };

    const sendQuery = async () => {
        if (!input.trim() || !token || isStreaming) return;

        const query = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: query }]);
        setIsStreaming(true);

        // Add an empty AI message to stream into
        setMessages(prev => [...prev, { role: 'ai', content: '' }]);

        try {
            const res = await fetch(`${API_URL}/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question: query })
            });

            if (!res.ok || !res.body) throw new Error('Chat failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') {
                            setIsStreaming(false);
                            return;
                        }
                        if (!dataStr) continue;

                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'token') {
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1].content += parsed.content;
                                    return newMsgs;
                                });
                            } else if (parsed.type === 'sources') {
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1].sources = parsed.content;
                                    return newMsgs;
                                });
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = "Sorry, an error occurred while connecting to the assistant.";
                return newMsgs;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    if (!token) {
        return (
            <div className="flex-1 flex items-center justify-center h-full w-full">
                <div className="glass p-8 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-xl">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400 text-center mb-4">AskMyDocs Login</h2>
                    {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-medium text-textMuted mb-1 block">Username</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-surface/50 border border-white/10 rounded-lg p-3 text-textMain focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-textMuted mb-1 block">Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-surface/50 border border-white/10 rounded-lg p-3 text-textMain focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                        <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold py-3 rounded-lg mt-2 transition-all shadow-lg hover:shadow-cyan-500/25">
                            Secure Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Left Panel: Document Upload and Management */}
            <section className="glass flex-1 flex flex-col h-full rounded-2xl overflow-hidden p-6 gap-6 relative transition-all duration-300">
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400 flex items-center gap-2">
                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            AskMyDocs
                        </h1>
                        <p className="text-sm text-textMuted mt-1">Tenant Data Isolation Active</p>
                    </div>
                    <button onClick={() => setToken(null)} className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">Log out</button>
                </header>

                {/* Upload Area */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 flex flex-col justify-center items-center border-2 border-dashed ${isUploading ? 'border-primary bg-primary/5' : 'border-gray-600 bg-surface/50 hover:bg-surface'} rounded-xl transition-colors cursor-pointer group p-8 relative overflow-hidden`}
                >
                    {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm z-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.txt,.docx,.xlsx,.pptx" />
                    <div className="p-4 bg-primary/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-textMain">Drag & Drop Documents</h3>
                    <p className="text-textMuted text-sm text-center mt-2 max-w-xs">
                        Upload PDF, DOCX, XLSX, or PPTX files to generate insights instantly. Secure & isolated.
                    </p>
                </div>

                {/* Recent Documents List */}
                <div className="mt-2 flex-shrink-0 h-[30%] overflow-hidden flex flex-col">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-textMuted mb-3">Your Secure Documents</h4>
                    <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                        {files.length === 0 ? (
                            <p className="text-xs text-textMuted italic">No documents uploaded yet...</p>
                        ) : (
                            files.map((file, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-white/5 transition-colors">
                                    <svg className={`w-6 h-6 ${file.status === 'error' ? 'text-red-400' : 'text-teal-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-textMain truncate">{file.filename}</p>
                                        <p className="text-xs font-semibold mt-0.5 capitalize flex items-center gap-1">
                                            {file.status === 'done' ? (
                                                <span className="text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 block"></span> Indexed</span>
                                            ) : file.status === 'error' ? (
                                                <span className="text-red-400">Failed</span>
                                            ) : (
                                                <span className="text-blue-400 animate-pulse">Processing...</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Right Panel: Chat Interface */}
            <section className="glass flex-[1.5] flex flex-col h-full rounded-2xl overflow-hidden relative">
                <header className="p-6 border-b border-white/10 flex items-center justify-between bg-surface/20">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <h2 className="text-xl font-semibold">Intelligence Assistant</h2>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">RAG Engine Online</span>
                </header>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 items-start max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gradient-to-tr from-blue-500 to-teal-400 text-white'}`}>
                                {msg.role === 'user' ? 'U' : 'AI'}
                            </div>
                            <div className={`p-4 rounded-2xl flex flex-col gap-2 shadow-sm border ${msg.role === 'user' ? 'bg-primary/20 border-primary/30 rounded-tr-sm' : 'bg-surface/80 border-white/5 rounded-tl-sm'}`}>
                                <p className="text-sm text-textMain whitespace-pre-wrap leading-relaxed">
                                    {msg.content}
                                    {msg.role === 'ai' && isStreaming && idx === messages.length - 1 && (
                                        <span className="inline-block w-1.5 h-4 ml-1 bg-teal-400 animate-pulse align-middle"></span>
                                    )}
                                </p>

                                {/* Citations block */}
                                {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-textMuted uppercase tracking-wider">Sources Cited</p>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.sources.map((src, sIdx) => (
                                                <div key={sIdx} className="group relative">
                                                    <span className="text-xs text-teal-300 bg-teal-900/30 px-2 py-1 rounded border border-teal-500/20 cursor-help flex items-center gap-1 transition-all hover:bg-teal-900/50">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                        </svg>
                                                        {src.filename} (Chunk {src.chunk_index})
                                                    </span>
                                                    {/* Tooltip for chunk preview */}
                                                    <div className="absolute bottom-full mb-2 left-0 w-64 p-3 bg-surface/90 backdrop-blur-md text-xs text-textMain border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                        <p className="font-semibold text-teal-300 mb-1">{src.filename}</p>
                                                        <p className="italic text-textMuted">"{src.content_preview}"</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-surface/50 backdrop-blur-md border-t border-white/10">
                    <form
                        className="relative flex items-center"
                        onSubmit={(e) => { e.preventDefault(); sendQuery(); }}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={isStreaming}
                            placeholder={isStreaming ? "Thinking..." : "Ask a question about your documents..."}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-4 px-6 pr-14 text-sm text-textMain focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-textMuted/50 disabled:opacity-50 shadow-inner"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isStreaming}
                            className="absolute right-2 p-2.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-full hover:from-blue-600 hover:to-teal-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5 -ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-center text-[10px] text-textMuted mt-3 font-medium tracking-wide">
                        Powered by RAG • Answers generated solely from your uploaded context.
                    </p>
                </div>
            </section>
        </>
    );
}
