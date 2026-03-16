import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Box, 
  Truck, 
  Warehouse, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Phone, 
  Instagram, 
  Facebook, 
  Menu, 
  X,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Calendar,
  Home as HomeIcon,
  AlertCircle,
  MessageCircle,
  Send,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

// --- Types & Context ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error) {
          setError("A database error occurred. Please check your permissions or contact support.");
        }
      } catch {
        // Not a JSON error we're looking for
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
        <div className="bg-white p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-primary mb-4" size={48} />
          <h2 className="text-2xl font-black uppercase mb-4">System Error</h2>
          <p className="text-accent mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">Reload Application</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: "Hi! I'm your Raider Room Assistant. How can I help you with your summer storage or move today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        setMessages(prev => [...prev, { role: 'model', text: "The Gemini API Key is not configured. Please add GEMINI_API_KEY to your secrets in the AI Studio settings." }]);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a helpful assistant for Raider Room Movers, a summer storage and moving service for Texas Tech students. You help students understand the process, pricing, and benefits of the service. Be friendly, professional, and use Texas Tech terminology like 'Raiders', 'Wreck 'em', etc. Pricing: 1-5 boxes: $19.99/mo, 6-10 boxes: $14.99/mo, 11+ boxes: $12.99/mo. Large items: $24.99/mo. 4-month minimum storage."
        }
      });

      // Note: The new SDK might handle history differently or we might need to send the whole context if not using built-in history
      // For simplicity with the new SDK's chat object:
      const result = await chat.sendMessage({ message: userMessage });
      const text = result.text;

      setMessages(prev => [...prev, { role: 'model', text: text || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later or contact us directly." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-80 md:w-96 h-[500px] shadow-2xl flex flex-col mb-4 border border-surface"
          >
            <div className="bg-primary p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white font-black uppercase text-xs tracking-widest">Raider Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface/30">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white font-medium' 
                      : 'bg-white text-dark shadow-sm border border-black/5'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 shadow-sm border border-black/5">
                    <Loader2 size={16} className="animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-surface">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-surface border-none p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-primary text-white p-3 hover:bg-black transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary text-white flex items-center justify-center shadow-2xl hover:bg-black transition-all active:scale-95 group"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} className="group-hover:rotate-12 transition-transform" />}
      </button>
    </div>
  );
};

const BookingModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user, login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dormName: '',
    roomNumber: '',
    pickupDate: '',
    deliveryAddress: '',
    deliveryDate: '',
    phone: '',
    boxCount: 3,
    largeItemCount: 0
  });

  const calculatePricing = () => {
    const { boxCount, largeItemCount } = formData;
    let boxPrice = 19.99;
    if (boxCount >= 11) boxPrice = 12.99;
    else if (boxCount >= 6) boxPrice = 14.99;

    const monthlyTotal = (boxCount * boxPrice) + (largeItemCount * 24.99);
    const contractTotal = monthlyTotal * 4; // 4-month minimum
    return { boxPrice, monthlyTotal, contractTotal };
  };

  const pricing = calculatePricing();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await login();
      return;
    }

    if (step < 2) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    const path = 'orders';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...formData,
        studentUid: user.uid,
        studentName: user.displayName,
        studentEmail: user.email,
        status: 'pending',
        storageMonths: 4,
        createdAt: serverTimestamp(),
        totalAmount: pricing.contractTotal
      });

      // Stripe Checkout
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: docRef.id,
          amount: pricing.contractTotal,
          studentEmail: user.email,
          items: `${formData.boxCount} boxes, ${formData.largeItemCount} large items`
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);

      if (url) {
        const stripeWindow = window.open(url, 'stripe_checkout', 'width=600,height=700');
        if (!stripeWindow) {
          alert('Please allow popups to complete your payment.');
        }
        onClose();
        setStep(1);
      } else {
        alert('Order placed! We will contact you for payment.');
        onClose();
        setStep(1);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-accent hover:text-primary">
              <X size={24} />
            </button>

            <div className="mb-8">
              <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-2">Step {step} of 2</h2>
              <h3 className="text-3xl font-black tracking-tighter uppercase">Book Your Storage</h3>
            </div>

            {!user ? (
              <div className="text-center py-8">
                <p className="text-accent mb-8">Please sign in with your student email to place an order.</p>
                <button onClick={login} className="btn-primary w-full flex items-center justify-center gap-3">
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Sign In with Google
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest mb-2">Number of Boxes</label>
                        <input 
                          required
                          type="number" 
                          min="3"
                          value={formData.boxCount}
                          onChange={(e) => setFormData({...formData, boxCount: parseInt(e.target.value) || 0})}
                          className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        />
                        <p className="text-[10px] text-accent mt-1 uppercase font-bold">Min. 3 boxes</p>
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest mb-2">Large Items</label>
                        <input 
                          type="number" 
                          min="0"
                          value={formData.largeItemCount}
                          onChange={(e) => setFormData({...formData, largeItemCount: parseInt(e.target.value) || 0})}
                          className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <HomeIcon size={14} /> Current Dorm Name
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.dormName}
                        onChange={(e) => setFormData({...formData, dormName: e.target.value})}
                        className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        placeholder="e.g. Bledsoe Hall" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2">Room Number</label>
                      <input 
                        required
                        type="text" 
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                        className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        placeholder="e.g. 204B" 
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Calendar size={14} /> Requested Pickup Date
                      </label>
                      <input 
                        required
                        type="date" 
                        value={formData.pickupDate}
                        onChange={(e) => setFormData({...formData, pickupDate: e.target.value})}
                        className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <MapPin size={14} /> New Delivery Address (Lubbock)
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
                        className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        placeholder="e.g. The Village at Overton" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Phone size={14} /> Contact Phone Number
                      </label>
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full bg-surface border-none p-4 focus:ring-2 focus:ring-primary outline-none" 
                        placeholder="(806) 555-0123" 
                      />
                    </div>
                    <div className="p-4 bg-primary/5 border border-primary/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black uppercase tracking-widest">Monthly Storage</span>
                        <span className="text-lg font-black text-primary">${pricing.monthlyTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-accent font-bold uppercase tracking-widest">
                        <span>4-Month Minimum Total</span>
                        <span>${pricing.contractTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-4 pt-4">
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1">Back</button>
                  )}
                  <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                    {loading ? 'Processing...' : step === 1 ? 'Next Step' : 'Confirm Order'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Navbar = ({ onOpenBooking }: { onOpenBooking: () => void }) => {
  const { user, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'How It Works', href: '#process' },
    { name: 'About Us', href: '#about' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className={`text-2xl font-black tracking-tighter ${scrolled ? 'text-primary' : 'text-white'}`}>
              RAIDER ROOM <span className={scrolled ? 'text-black' : 'text-white/80'}>MOVERS</span>
            </span>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className={`text-sm font-bold uppercase tracking-widest transition-colors hover:text-primary ${scrolled ? 'text-dark' : 'text-white'}`}
                >
                  {link.name}
                </a>
              ))}
              
              {user ? (
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-accent/20">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                    <UserIcon size={16} />
                    {user.displayName?.split(' ')[0]}
                  </div>
                  <button onClick={logout} className={`p-2 hover:text-primary transition-colors ${scrolled ? 'text-dark' : 'text-white'}`}>
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button onClick={login} className={`text-sm font-bold uppercase tracking-widest transition-colors hover:text-primary ${scrolled ? 'text-dark' : 'text-white'}`}>
                  Login
                </button>
              )}
              
              <button onClick={onOpenBooking} className="btn-primary text-sm py-2 px-4">Get Started</button>
            </div>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className={scrolled ? 'text-dark' : 'text-white'}>
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-surface"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2 text-base font-bold text-dark hover:text-primary uppercase tracking-widest"
                >
                  {link.name}
                </a>
              ))}
              {user ? (
                <button onClick={logout} className="block w-full text-left px-3 py-2 text-base font-bold text-primary uppercase tracking-widest">Logout ({user.displayName})</button>
              ) : (
                <button onClick={login} className="block w-full text-left px-3 py-2 text-base font-bold text-dark uppercase tracking-widest">Login</button>
              )}
              <button onClick={() => { setIsOpen(false); onOpenBooking(); }} className="block w-full text-center btn-primary mt-4">Get Started</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = ({ onOpenBooking }: { onOpenBooking: () => void }) => {
  return (
    <section id="home" className="relative h-screen flex items-center overflow-hidden bg-black">
      {/* Background Image Placeholder */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/seed/moving/1920/1080?blur=2" 
          alt="Moving Day" 
          className="w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter mb-6">
            DORM TO <span className="text-primary italic">DREAM</span> APARTMENT.
          </h1>
          <p className="text-xl text-surface mb-8 font-light leading-relaxed">
            The ultimate summer storage solution for Texas Tech students. We deliver boxes, you pack, we store, and we deliver to your new Lubbock address.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onOpenBooking} className="btn-primary text-center">Start Your Move</button>
            <a href="#about" className="btn-outline border-white text-white hover:bg-white hover:text-black text-center">Learn More</a>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
        <ChevronDown size={32} />
      </div>
    </section>
  );
};

interface ProcessStepProps {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
  delay: number;
  key?: React.Key;
}

const ProcessStep = ({ number, title, description, icon: Icon, delay }: ProcessStepProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    viewport={{ once: true }}
    className="relative p-8 bg-white border border-surface hover:border-primary transition-colors group"
  >
    <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-white flex items-center justify-center font-black text-xl italic">
      {number}
    </div>
    <div className="mb-6 text-primary group-hover:scale-110 transition-transform duration-300">
      <Icon size={48} strokeWidth={1.5} />
    </div>
    <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">{title}</h3>
    <p className="text-accent leading-relaxed">{description}</p>
  </motion.div>
);

const Process = ({ onOpenBooking }: { onOpenBooking: () => void }) => {
  const steps = [
    {
      number: "01",
      title: "We Deliver Boxes",
      description: "We bring high-quality packing materials right to your dorm room. No need to hunt for boxes.",
      icon: Box
    },
    {
      number: "02",
      title: "You Pack 'Em",
      description: "Take your time packing your belongings. Label them clearly so we know what's what.",
      icon: CheckCircle2
    },
    {
      number: "03",
      title: "We Pick Up & Store",
      description: "Our professional team picks up your items and stores them in a secure, climate-controlled facility.",
      icon: Warehouse
    },
    {
      number: "04",
      title: "Summer Delivery",
      description: "Once summer is over, we deliver everything to your new off-campus apartment in Lubbock.",
      icon: Truck
    }
  ];

  return (
    <section id="process" className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-4">The Game Plan</h2>
          <h3 className="text-5xl font-black tracking-tighter uppercase">How It Works</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <ProcessStep 
              key={index} 
              number={step.number}
              title={step.title}
              description={step.description}
              icon={step.icon}
              delay={index * 0.1} 
            />
          ))}
        </div>

        <div className="mt-16 text-center">
          <button onClick={onOpenBooking} className="btn-primary px-12">Reserve Your Spot Now</button>
        </div>
      </div>
    </section>
  );
};

const Pricing = ({ onOpenBooking }: { onOpenBooking: () => void }) => {
  const tiers = [
    { range: "1–5 Boxes", price: "$19.99", note: "per box / month" },
    { range: "6–10 Boxes", price: "$14.99", note: "per box / month" },
    { range: "11+ Boxes", price: "$12.99", note: "per box / month" },
  ];

  const largeItems = [
    "Mini-fridges",
    "Fans",
    "Suitcases",
    "Small Furniture"
  ];

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-4">Simple Pricing</h2>
          <h3 className="text-5xl font-black tracking-tighter uppercase">Summer Storage Rates</h3>
          <p className="mt-4 text-accent font-bold italic">"Students storing more boxes receive lower pricing per box."</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Box Tiers */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.map((tier, i) => (
              <div key={i} className="p-8 bg-surface border-t-4 border-primary flex flex-col items-center text-center">
                <span className="text-xs font-black uppercase tracking-widest mb-4">{tier.range}</span>
                <span className="text-4xl font-black mb-1">{tier.price}</span>
                <span className="text-[10px] font-bold uppercase text-accent">{tier.note}</span>
              </div>
            ))}
          </div>

          {/* Large Items */}
          <div className="p-8 bg-dark text-white flex flex-col justify-center">
            <span className="text-xs font-black uppercase tracking-widest mb-4 text-primary">Large Items</span>
            <span className="text-4xl font-black mb-1">$24.99</span>
            <span className="text-[10px] font-bold uppercase text-white/50 mb-6">per item / month</span>
            <ul className="text-xs space-y-2 opacity-70">
              {largeItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-primary rounded-full" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div>
              <h4 className="text-xl font-black uppercase tracking-tight mb-4">What's Included</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Dorm Pickup",
                  "Climate Controlled",
                  "30-Mile Delivery",
                  "Packing Materials",
                  "Item Protection",
                  "Moving Labels"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-bold text-accent">
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 bg-surface border-l-4 border-primary">
              <h4 className="text-sm font-black uppercase tracking-widest mb-2">Storage Term</h4>
              <p className="text-sm text-accent leading-relaxed">
                4-month minimum storage period. Billed monthly. First month due at booking. All services must be paid before pickup.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-xl font-black uppercase tracking-tight mb-4">Insurance & Protection</h4>
              <p className="text-sm text-accent leading-relaxed mb-4">
                Basic protection included: <span className="text-dark font-black">$100 coverage per box or item.</span>
              </p>
              <p className="text-xs text-accent italic">
                * Fragile items such as electronics are stored at the customer's risk.
              </p>
            </div>
            <div className="pt-4">
              <button onClick={onOpenBooking} className="btn-primary w-full py-6 text-lg">
                Reserve Your Summer Storage Spot
              </button>
              <p className="text-center text-[10px] font-black uppercase tracking-widest mt-4 text-accent">
                Minimum order: 3 boxes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const About = () => {
  return (
    <section id="about" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-4">Our Story</h2>
            <h3 className="text-5xl font-black tracking-tighter uppercase mb-8">Built for Raiders, By Raiders.</h3>
            <div className="space-y-6 text-lg text-accent leading-relaxed">
              <p>
                Raider Room Movers was born out of the chaos of moving day in Lubbock. We saw thousands of freshmen struggling to haul their lives back home for three months, only to bring it all back again in August.
              </p>
              <p>
                We knew there was a better way. By focusing specifically on the transition from Texas Tech dorms to off-campus apartments, we've streamlined the most stressful part of the college experience.
              </p>
              <p className="font-bold text-dark italic">
                "Wreck 'em Tech! We handle the heavy lifting so you can enjoy your summer."
              </p>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <Clock className="text-primary" />
                <span className="font-bold uppercase text-sm tracking-widest">Saves 20+ Hours</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-primary" />
                <span className="font-bold uppercase text-sm tracking-widest">Fully Insured</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-square bg-surface relative overflow-hidden">
              <img 
                src="https://picsum.photos/seed/tech/800/800" 
                alt="Texas Tech Campus" 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none"></div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-primary p-8 flex flex-col justify-center">
              <span className="text-white text-5xl font-black italic leading-none">100%</span>
              <span className="text-white text-xs font-bold uppercase tracking-widest mt-2">Lubbock Local</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

interface FAQItemProps {
  question: string;
  answer: string;
  key?: React.Key;
}

const FAQItem = ({ question, answer }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-surface">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex justify-between items-center text-left hover:text-primary transition-colors"
      >
        <span className="text-xl font-black uppercase tracking-tight">{question}</span>
        {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-accent leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const faqs = [
    {
      question: "When do you deliver the boxes?",
      answer: "We typically start box deliveries 2-3 weeks before the official move-out dates for Texas Tech dorms. You can schedule your specific delivery window through our portal."
    },
    {
      question: "Is my stuff safe over the summer?",
      answer: "Absolutely. We use a secure, climate-controlled facility in Lubbock with 24/7 surveillance. Your items are protected from the West Texas heat and dust."
    },
    {
      question: "What if I don't have my new address yet?",
      answer: "No problem! You can sign up now to reserve your space and provide your new Lubbock address later in the summer. We just need it at least 14 days before your requested delivery date."
    },
    {
      question: "Do you move furniture?",
      answer: "We specialize in box storage and small items (mini-fridges, microwaves, etc.). For large furniture items like couches or mattresses, please contact us for a custom quote."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-4">Got Questions?</h2>
          <h3 className="text-5xl font-black tracking-tighter uppercase">Frequently Asked</h3>
        </div>
        <div className="bg-white p-8 md:p-12 shadow-xl">
          {faqs.map((faq, index) => (
            <FAQItem 
              key={index} 
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-4">Get In Touch</h2>
            <h3 className="text-5xl font-black tracking-tighter uppercase mb-8">Ready to Move?</h3>
            <p className="text-lg text-accent mb-10 leading-relaxed">
              Have a specific question or need a custom quote? Our team is standing by to help you make your move as smooth as possible.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface flex items-center justify-center text-primary">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-accent">Call Us</p>
                  <p className="text-xl font-black">(806) 555-RAID</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface flex items-center justify-center text-primary">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-accent">Email Us</p>
                  <p className="text-xl font-black">hello@raiderroommovers.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface flex items-center justify-center text-primary">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-accent">Office</p>
                  <p className="text-xl font-black">Lubbock, TX 79401</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-8 md:p-12">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2">Name</label>
                  <input type="text" className="w-full bg-white border-none p-4 focus:ring-2 focus:ring-primary outline-none" placeholder="Raider Red" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2">Email</label>
                  <input type="email" className="w-full bg-white border-none p-4 focus:ring-2 focus:ring-primary outline-none" placeholder="red@ttu.edu" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Subject</label>
                <select className="w-full bg-white border-none p-4 focus:ring-2 focus:ring-primary outline-none">
                  <option>General Inquiry</option>
                  <option>Quote Request</option>
                  <option>Box Delivery Issue</option>
                  <option>Storage Question</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Message</label>
                <textarea rows={4} className="w-full bg-white border-none p-4 focus:ring-2 focus:ring-primary outline-none" placeholder="How can we help?"></textarea>
              </div>
              <button type="submit" className="w-full btn-primary">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-black text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <span className="text-3xl font-black tracking-tighter mb-6 block">
              RAIDER ROOM <span className="text-primary">MOVERS</span>
            </span>
            <p className="text-accent max-w-md mb-8">
              The premier moving and storage service for the Texas Tech community. We make the transition from dorm to apartment effortless.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-dark flex items-center justify-center hover:bg-primary transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-dark flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook size={20} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest mb-6">Quick Links</h4>
            <ul className="space-y-4 text-accent text-sm">
              <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#process" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-black uppercase tracking-widest mb-6">Legal</h4>
            <ul className="space-y-4 text-accent text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Insurance Details</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-12 border-t border-dark flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-accent text-xs uppercase tracking-widest">
            © {new Date().getFullYear()} Raider Room Movers. All Rights Reserved.
          </p>
          <p className="text-accent text-xs uppercase tracking-widest flex items-center gap-2">
            Made with <span className="text-primary">♥</span> in Lubbock, TX
          </p>
        </div>
      </div>
    </footer>
  );
};

// --- Main App ---

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'client',
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      }
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default function App() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancel' | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;

      if (event.data?.type === 'STRIPE_PAYMENT_STATUS') {
        setPaymentStatus(event.data.status as 'success' | 'cancel');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <AuthProvider>
      <ErrorBoundary>
        <div className="font-sans selection:bg-primary selection:text-white">
          <Navbar onOpenBooking={() => setIsBookingOpen(true)} />
          
          <AnimatePresence>
            {paymentStatus && (
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] p-4 shadow-2xl flex items-center gap-3 border ${
                  paymentStatus === 'success' ? 'bg-emerald-500 border-emerald-400' : 'bg-red-500 border-red-400'
                } text-white`}
              >
                {paymentStatus === 'success' ? (
                  <>
                    <CheckCircle2 size={24} />
                    <div>
                      <p className="font-black uppercase text-xs tracking-widest">Payment Successful</p>
                      <p className="text-xs opacity-90">Your storage is now confirmed. Wreck 'em!</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={24} />
                    <div>
                      <p className="font-black uppercase text-xs tracking-widest">Payment Cancelled</p>
                      <p className="text-xs opacity-90">Your order was saved, but payment was not completed.</p>
                    </div>
                  </>
                )}
                <button onClick={() => setPaymentStatus(null)} className="ml-4 hover:scale-110 transition-transform">
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <main>
            <Hero onOpenBooking={() => setIsBookingOpen(true)} />
            <Process onOpenBooking={() => setIsBookingOpen(true)} />
            <Pricing onOpenBooking={() => setIsBookingOpen(true)} />
            <About />
            <FAQ />
            <Contact />
          </main>
          <Footer />
          <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
          <ChatAssistant />
        </div>
      </ErrorBoundary>
    </AuthProvider>
  );
}
