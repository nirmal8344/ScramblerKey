import React, { useState, useEffect } from 'react';
import { CanvasKeyboard } from './components/CanvasKeyboard';
import { Shield, Lock, User, Key, Sun, Moon, RefreshCw, AlertCircle, CheckCircle2, Database as DatabaseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [layout, setLayout] = useState<string[][]>([]);
  const [rowConfig, setRowConfig] = useState<number[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [username, setUsername] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameCount, setUsernameCount] = useState(0);
  const [passwordCount, setPasswordCount] = useState(0);
  const [activeField, setActiveField] = useState<'username' | 'password'>('username');
  const [mode, setMode] = useState<'all' | 'alpha' | 'numeric'>('all');
  const [scramble, setScramble] = useState(true);
  const [isUppercase, setIsUppercase] = useState(true);
  const [hackerView, setHackerView] = useState(false);
  const [interceptedData, setInterceptedData] = useState<any[]>([]);
  const [storedUsers, setStoredUsers] = useState<any[]>([]);
  const [hackerTab, setHackerTab] = useState<'traffic' | 'database'>('traffic');
  const [isWindowActive, setIsWindowActive] = useState(true);

  useEffect(() => {
    if (hackerView) {
      const fetchUsers = async () => {
        try {
          const res = await fetch('/api/admin/users');
          const data = await res.json();
          setStoredUsers(data);
        } catch (err) {
          console.error('Failed to fetch users', err);
        }
      };
      fetchUsers();
      const interval = setInterval(fetchUsers, 5000);
      return () => clearInterval(interval);
    }
  }, [hackerView]);

  useEffect(() => {
    const handleFocus = () => setIsWindowActive(true);
    const handleBlur = () => setIsWindowActive(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const fetchLayout = async (currentScramble?: boolean, currentUpper?: boolean) => {
    try {
      const scrambleParam = currentScramble !== undefined ? currentScramble : scramble;
      const upperParam = currentUpper !== undefined ? currentUpper : isUppercase;
      
      const res = await fetch(`/api/keyboard/layout?scramble=${scrambleParam}&isUppercase=${upperParam}`);
      const data = await res.json();
      setLayout(data.layout);
    } catch (err) {
      console.error('Failed to fetch layout', err);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, [scramble, isUppercase]);

  const handleInput = async (x: number, y: number, width: number, height: number, keyWidths: number[][], rowOffsets: number[]) => {
    const payload = { x, y, width, height, scramble, isUppercase, keyWidths, rowOffsets, targetField: activeField };
    
    // Add to intercepted data for hacker view
    setInterceptedData(prev => [payload, ...prev].slice(0, 5));

    try {
      const res = await fetch('/api/keyboard/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (data.layout) setLayout(data.layout);
        
        const key = data.key;
        if (key === 'Caps' || key === 'Shift') {
          setIsUppercase(prev => !prev);
        }

        if (activeField === 'username') {
          if (data.count !== undefined) setUsernameCount(data.count);
          if (data.value !== undefined) setUsername(data.value);
        } else {
          if (data.count !== undefined) setPasswordCount(data.count);
        }
      }
    } catch (err) {
      console.error('Input failed', err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSignup })
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Success!' });
        setUsernameCount(0);
        setPasswordCount(0);
        setUsername('');
        if (isSignup) setIsSignup(false);
      } else {
        setMessage({ type: 'error', text: data.message || data.error || 'Authentication failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const clearBuffer = async () => {
    await fetch('/api/keyboard/clear', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetField: activeField })
    });
    if (activeField === 'username') {
      setUsernameCount(0);
      setUsername('');
    } else {
      setPasswordCount(0);
    }
    setMessage(null);
  };

  const handleBackspace = async () => {
    try {
      const res = await fetch('/api/keyboard/backspace', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetField: activeField })
      });
      const data = await res.json();
      if (data.success) {
        if (activeField === 'username') {
          setUsernameCount(data.count);
          setUsername(data.value || '');
        } else {
          setPasswordCount(data.count);
        }
      }
    } catch (err) {
      console.error('Backspace failed', err);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 transition-all duration-700 ${!isWindowActive ? 'blur-2xl scale-[0.98] opacity-50 grayscale' : ''}`}>
        {/* Header */}
        <header className="flex justify-between items-center mb-8 sm:mb-12">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-violet-600 rounded-lg shadow-lg shadow-violet-600/20">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ScramblerKey</h1>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Obfuscation Engine v1.0</p>
            </div>
          </div>
          <button 
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className={`p-2 sm:p-3 rounded-full border transition-all ${theme === 'dark' ? 'border-gray-800 hover:bg-gray-900' : 'border-gray-200 hover:bg-gray-100'}`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          {/* Left Column: Info & Form */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8 order-2 lg:order-1">
            <section className={`p-6 sm:p-10 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-200 shadow-2xl shadow-gray-200/50'}`}>
              <div className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-xl">
                    <Lock className="w-6 h-6 text-violet-500" />
                  </div>
                  {isSignup ? 'Create Account' : 'Secure Sign In'}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Experience true input privacy. Your password is never sent as text; only spatial coordinates are transmitted and decoded server-side.
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div 
                  onClick={() => setActiveField('username')}
                  className="cursor-pointer group"
                >
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500">Username</label>
                    {activeField === 'username' && usernameCount > 0 && (
                      <div className="flex gap-3">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleBackspace(); }}
                          className="text-[9px] font-bold uppercase tracking-widest text-violet-500 hover:text-violet-400"
                        >
                          Backspace
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearBuffer(); }}
                          className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={`relative transition-all duration-300 ${activeField === 'username' ? 'scale-[1.02]' : ''}`}>
                    <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${activeField === 'username' ? 'text-violet-500' : 'text-gray-500'}`} />
                    <div
                      className={`w-full pl-11 pr-4 py-3 rounded-2xl border flex items-center min-h-[50px] transition-all duration-300 ${
                        activeField === 'username'
                          ? (theme === 'dark' ? 'bg-gray-900 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-white border-violet-500 shadow-lg shadow-violet-500/10')
                          : (theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200')
                      }`}
                    >
                      <div className="flex flex-wrap gap-0.5 items-center">
                        {username ? (
                          username.split('').map((char, i) => (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0, y: 5, scale: 0.8 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                            >
                              {char === ' ' ? '\u00A0' : char}
                            </motion.span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs italic">Type username using keyboard...</span>
                        )}
                      </div>
                      {activeField === 'username' && (
                        <motion.div 
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-0.5 h-4 bg-violet-500 ml-1"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setActiveField('password')}
                  className="cursor-pointer group"
                >
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500">Secure Password</label>
                    <div className="flex gap-3">
                      {activeField === 'password' && passwordCount > 0 && (
                        <>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleBackspace(); }}
                            className="text-[9px] font-bold uppercase tracking-widest text-violet-500 hover:text-violet-400"
                          >
                            Backspace
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); clearBuffer(); }}
                            className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`relative transition-all duration-300 ${activeField === 'password' ? 'scale-[1.02]' : ''}`}>
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${activeField === 'password' ? 'text-violet-500' : 'text-gray-500'}`} />
                    <div
                      className={`w-full pl-11 pr-4 py-3 rounded-2xl border flex items-center gap-1.5 min-h-[50px] transition-all duration-300 ${
                        activeField === 'password'
                          ? (theme === 'dark' ? 'bg-gray-900 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-white border-violet-500 shadow-lg shadow-violet-500/10')
                          : (theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200')
                      }`}
                    >
                      {passwordCount > 0 ? (
                        Array.from({ length: passwordCount }).map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                          />
                        ))
                      ) : (
                        <span className="text-gray-500 text-xs italic">Type password using keyboard...</span>
                      )}
                      {activeField === 'password' && (
                        <motion.div 
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-0.5 h-4 bg-violet-500 ml-0.5"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || usernameCount === 0 || passwordCount === 0}
                  className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-xl shadow-violet-600/20 active:scale-[0.98]"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : (isSignup ? 'Create Account' : 'Sign In')}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignup(!isSignup);
                      setMessage(null);
                    }}
                    className="text-xs sm:text-sm text-gray-500 hover:text-violet-500 transition-colors"
                  >
                    {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            </section>

            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-2xl flex items-start gap-3 ${
                    message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p className="text-sm font-medium">{message.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Keyboard */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="lg:sticky lg:top-24">
              <div className="mb-6 flex justify-between items-end px-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-widest text-gray-500">Secure Input Surface</h3>
                  <p className="text-xs text-gray-600">Dynamic layout reshuffles on every interaction</p>
                </div>
                <div className="flex gap-1.5 mb-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>

              <div className={`mb-6 flex justify-between items-center p-1.5 sm:p-2 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
                <div className="flex gap-4 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Scramble Mode</span>
                    <button
                      onClick={() => setScramble(!scramble)}
                      className={`w-10 sm:w-12 h-5 sm:h-6 rounded-full relative transition-all duration-300 ${scramble ? 'bg-violet-600' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-3 sm:w-4 h-3 sm:h-4 bg-white rounded-full transition-all duration-300 ${scramble ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end px-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Layout</span>
                  <span className="text-[8px] text-gray-600 font-mono">PC_STANDARD_104</span>
                </div>
                <div className={`flex items-center gap-2 border-l pl-4 transition-colors ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-500">Hacker View</span>
                  <button
                    onClick={() => setHackerView(!hackerView)}
                    className={`w-10 h-5 rounded-full relative transition-all duration-300 ${hackerView ? 'bg-red-600' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${hackerView ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              
              {layout.length > 0 ? (
                <CanvasKeyboard
                  layout={layout}
                  onInput={handleInput}
                  theme={theme}
                />
              ) : (
                <div className={`aspect-[10/4] w-full rounded-3xl animate-pulse flex items-center justify-center border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
                  <RefreshCw className="w-8 h-8 text-gray-700 animate-spin" />
                </div>
              )}

              <AnimatePresence>
                {hackerView && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="p-4 bg-black rounded-2xl border border-red-900/30 font-mono text-[10px] text-red-500/80 shadow-2xl shadow-red-900/10">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-red-900/20">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setHackerTab('traffic')}
                            className={`flex items-center gap-2 transition-colors ${hackerTab === 'traffic' ? 'text-red-500' : 'text-red-900 hover:text-red-700'}`}
                          >
                            <div className={`w-2 h-2 rounded-full bg-red-500 ${hackerTab === 'traffic' ? 'animate-ping' : ''}`} />
                            TRAFFIC_INTERCEPT
                          </button>
                          <button 
                            onClick={() => setHackerTab('database')}
                            className={`flex items-center gap-2 transition-colors ${hackerTab === 'database' ? 'text-red-500' : 'text-red-900 hover:text-red-700'}`}
                          >
                            <DatabaseIcon className="w-3 h-3" />
                            USER_DATABASE
                          </button>
                        </div>
                        <span className="text-red-900 hidden sm:inline">ENCRYPTION: NONE</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {hackerTab === 'traffic' ? (
                          interceptedData.length > 0 ? (
                            interceptedData.map((data, i) => (
                              <div key={i} className="p-2 bg-red-950/10 rounded border border-red-900/10">
                                <span className="text-red-900">[{new Date().toLocaleTimeString()}] POST /api/keyboard/input</span>
                                <pre className="mt-1 text-red-400/60">
                                  {JSON.stringify({ x: data.x.toFixed(2), y: data.y.toFixed(2), w: data.width.toFixed(0), h: data.height.toFixed(0) }, null, 2)}
                                </pre>
                                <div className="mt-1 text-[8px] text-red-900 italic">
                                  // No character data found in payload. Only spatial coordinates captured.
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 text-red-900 italic">Listening for packets...</div>
                          )
                        ) : (
                          <div className="space-y-2">
                            {storedUsers.length > 0 ? (
                              storedUsers.map((user, i) => (
                                <div key={i} className="p-2 bg-red-950/10 rounded border border-red-900/10 flex justify-between items-center">
                                  <div>
                                    <span className="text-red-500">USER:</span> <span className="text-red-400">{user.username}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-red-900">HASH:</span> <span className="text-red-400/40 text-[8px]">{user.password_hash.substring(0, 20)}...</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-red-900 italic">Database empty. Register a user to see data.</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                <div className={`p-3 sm:p-4 rounded-2xl border ${theme === 'dark' ? 'bg-gray-900/30 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mb-1">Security Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] sm:text-xs font-mono">SESSION_ACTIVE</span>
                  </div>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${theme === 'dark' ? 'bg-gray-900/30 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mb-1">Input Method</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-mono">COORD_MAP_V2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className={`mt-16 sm:mt-24 pt-8 border-t text-center transition-colors ${theme === 'dark' ? 'border-gray-800/50' : 'border-gray-200'}`}>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
            &copy; 2026 SCRAMBLERKEY SECURITY SYSTEMS.
          </p>
        </footer>
      </div>

      <AnimatePresence>
        {!isWindowActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-3xl flex items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md"
            >
              <div className="w-20 h-20 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-violet-500/30">
                <Shield className="w-10 h-10 text-violet-500 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Security Shield Active</h2>
              <p className="text-gray-400 text-sm">
                Content is hidden to prevent unauthorized screen capture and shoulder surfing. 
                Focus the window to resume.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
