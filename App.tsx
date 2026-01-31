
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import TopicCard from './components/TopicCard';
import CreateTopicCard from './components/CreateTopicCard';
import PerformanceView from './components/PerformanceView';
import ExploreView from './components/ExploreView';
import EssayEditor from './components/EssayEditor';
import CorrectionResultView from './components/CorrectionResult';
import RankingView from './components/RankingView';
import NotificationsView from './components/NotificationsView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';
import InstitutionDashboard from './components/InstitutionDashboard';
import { Topic, CorrectionResult, EssayInput, Notification } from './types';
import { correctEssay } from './services/geminiService';
import { saveEssayToDatabase, getNotifications, createNotification, markNotificationAsRead, markAllNotificationsAsRead } from './services/databaseService';
import { supabase } from './supabaseClient';
import { exploreTopics } from './data/exploreTopics';

const INITIAL_INDEX = Math.floor(Math.random() * exploreTopics.length);
const INITIAL_TOPIC: Topic = {
  id: exploreTopics[INITIAL_INDEX].id,
  title: exploreTopics[INITIAL_INDEX].title,
  supportTexts: exploreTopics[INITIAL_INDEX].supportTexts
};

type ViewState = 'practice' | 'performance' | 'explore' | 'writing' | 'result' | 'ranking' | 'notifications' | 'profile' | 'inst-students' | 'inst-performance' | 'inst-ranking' | 'inst-classes' | 'inst-staff' | 'inst-settings';
type UserType = 'student' | 'teacher' | 'school_admin';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [userType, setUserType] = useState<UserType>('student');
  const [topic, setTopic] = useState<Topic>(INITIAL_TOPIC);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('practice');
  const [isInitializing, setIsInitializing] = useState(true);

  // Estado para controlar se há uma sessão de escrita ativa (independente da view atual)
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const [writingTopicTitle, setWritingTopicTitle] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [essayStartTime, setEssayStartTime] = useState<number | null>(null);
  const [initialMode, setInitialMode] = useState<'text' | 'image'>('text');

  const getDefaultView = (type: UserType): ViewState => {
    if (type === 'school_admin') return 'inst-students';
    if (type === 'teacher') return 'inst-students'; // Docente cai direto na lista de alunos
    return 'practice';
  };

  // Recuperação de Sessão de Escrita e Autenticação
  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro de sessão:", error);
          // Se der erro na sessão, limpa tudo para evitar loop
          await supabase.auth.signOut();
          localStorage.removeItem('sb-exvwyiwiagpzoohtjyhh-auth-token');
          setSession(null);
        } else if (session) {
          setSession(session);
          const metadataType = session.user?.user_metadata?.user_type as UserType;
          const finalType = metadataType || 'student';
          setUserType(finalType);
        } else {
          // Recuperar sessão DEMO se existir no cache
          const savedDemoMode = localStorage.getItem('scritta_demo_mode');
          const savedDemoType = localStorage.getItem('scritta_demo_type') as UserType;

          if (savedDemoMode === 'true') {
            setIsDemoMode(true);
            const type = savedDemoType || 'student';
            setUserType(type);
            setSession({ user: { id: 'demo', email: 'demo@tese.com.br', user_metadata: { user_type: type } } });
          }
        }

        // Verifica se há uma redação em andamento salva localmente
        const savedSession = localStorage.getItem('active_writing_session');
        if (savedSession) {
          try {
            const { title, startTime, mode } = JSON.parse(savedSession);
            setWritingTopicTitle(title);
            setEssayStartTime(startTime);
            setInitialMode(mode);
            setHasActiveSession(true);
          } catch (e) {
            localStorage.removeItem('active_writing_session');
          }
        }
      } catch (err) {
        console.error("Falha fatal na inicialização:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        const metadataType = session.user?.user_metadata?.user_type as UserType;
        const finalType = metadataType || 'student';
        setUserType(finalType);
        if (!hasActiveSession && currentView !== 'writing') {
          setCurrentView(getDefaultView(finalType));
        }
      } else if (!localStorage.getItem('scritta_demo_mode')) {
        // Só limpa tudo se NÃO for demo mode persistente
        setSession(null);
        setIsDemoMode(false);
        setUserType('student');
        setCurrentView('practice');
        setHasActiveSession(false);
        localStorage.removeItem('active_writing_session');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Carregar Notificações
  useEffect(() => {
    const fetchNotifications = async () => {
      const currentUserId = session?.user?.id || (isDemoMode ? 'demo' : null);
      if (currentUserId) {
        const data = await getNotifications(currentUserId);
        setNotifications(data);
      }
    };
    fetchNotifications();

    // Polling simples para novas notificações (a cada 30s)
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session, isDemoMode]);

  const handleRefreshTopic = () => {
    setIsLoading(true);
    setTimeout(() => {
      let nextIndex;
      do { nextIndex = Math.floor(Math.random() * exploreTopics.length); } while (exploreTopics[nextIndex].id === topic.id);
      setTopic(exploreTopics[nextIndex]);
      setIsLoading(false);
    }, 400);
  };

  const handleEssaySubmit = async (input: EssayInput) => {
    setIsCorrecting(true);
    const durationMs = essayStartTime ? Date.now() - essayStartTime : 0;
    const timeStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    try {
      const result = await correctEssay(writingTopicTitle, input);
      const res = { ...result, timeTaken: timeStr, topicTitle: writingTopicTitle };
      setCorrectionResult(res);
      setCurrentView('result');
      setHasActiveSession(false); // Finaliza sessão ativa

      // Persistência Vitalícia (Local + Supabase)
      console.log("Saving essay to DB...", { writingTopicTitle, userId: session?.user?.id || 'demo' });
      const savedData = await saveEssayToDatabase(writingTopicTitle, input, session?.user?.id || 'demo', res, session?.user?.user_metadata);
      console.log("Essay saved successfully:", savedData);

      // Notificação de Sucesso Real no Banco
      const userId = session?.user?.id || 'demo';
      console.log("Creating success notification for user:", userId);
      await createNotification({
        userId,
        type: 'system',
        title: 'Redação Salva',
        message: `Sua redação sobre "${writingTopicTitle}" foi salva no histórico com sucesso.`
      });
      console.log("Notification created.");

      // Atualiza lista local
      const notifs = await getNotifications(userId);
      setNotifications(notifs);

      // Limpeza de rascunho local e sessão de escrita após sucesso
      localStorage.removeItem(`draft_${writingTopicTitle}`);
      localStorage.removeItem('active_writing_session');

    } catch (err: any) {
      // Não usa alert, usa UI de erro ou console e mantem estado
      console.error(err);
      const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert("Erro ao corrigir: " + msg);
    } finally {
      setIsCorrecting(false);
      setEssayStartTime(null);
    }
  };

  const startWriting = (mode: 'text' | 'image') => {
    setWritingTopicTitle(topic.title);
    setInitialMode(mode);
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer);
          const startTime = Date.now();
          setEssayStartTime(startTime);
          setCurrentView('writing');
          setHasActiveSession(true);

          // Salva a sessão de escrita para persistência em caso de reload ou troca de aba
          localStorage.setItem('active_writing_session', JSON.stringify({
            title: topic.title,
            startTime: startTime,
            mode: mode
          }));

          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 800);
  };

  const cancelWriting = () => {
    localStorage.removeItem('active_writing_session');
    localStorage.removeItem(`draft_${writingTopicTitle}`);
    setHasActiveSession(false);
    setEssayStartTime(null);
    setCurrentView('practice');
  };

  const handleLogout = async () => {
    // 1. Avisa o Supabase para deslogar
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Erro ao sair:', error);
    }

    setSession(null);
    setIsDemoMode(false);
    localStorage.removeItem('active_writing_session');
    // Limpa flag de persistência demo
    localStorage.removeItem('scritta_demo_mode');
    localStorage.removeItem('scritta_demo_type');

    // 2. SÓ DEPOIS de deslogar, força o envio para a tela de login
    // O window.location.href é melhor que navigate aqui pois limpa estados da memória
    window.location.href = '/login';
  };

  const handleEnterDemo = (t: UserType) => {
    setIsDemoMode(true);
    setUserType(t);
    setSession({ user: { id: 'demo', email: 'demo@tese.com.br', user_metadata: { user_type: t } } });
    setCurrentView(getDefaultView(t));

    // Persistir sessão demo para sobreviver ao refresh
    localStorage.setItem('scritta_demo_mode', 'true');
    localStorage.setItem('scritta_demo_type', t);
  };

  const handleMarkAsRead = async (id: string) => {
    const userId = session?.user?.id || 'demo';
    await markNotificationAsRead(id, userId);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    const userId = session?.user?.id || 'demo';
    await markAllNotificationsAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const renderView = () => {
    if (userType === 'school_admin' || userType === 'teacher') {
      const type = userType as 'teacher' | 'school_admin';
      switch (currentView) {
        case 'inst-students': return <InstitutionDashboard initialTab="students" userType={type} />;
        case 'inst-performance': return <InstitutionDashboard initialTab="essays" userType={type} />;
        case 'inst-ranking': return <InstitutionDashboard initialTab="ranking" userType={type} />;
        case 'inst-classes': return <InstitutionDashboard initialTab="classes" userType={type} />;
        case 'inst-staff': return <InstitutionDashboard initialTab="staff" userType={type} />;
        case 'inst-settings': return <InstitutionDashboard initialTab="settings" userType={type} />;
        case 'profile': return <ProfileView user={session?.user} />;
        case 'notifications': return <NotificationsView notifications={notifications} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllAsRead} onClose={() => setCurrentView(getDefaultView(userType))} />;
        default: return <InstitutionDashboard userType={type} />;
      }
    }

    switch (currentView) {
      case 'practice':
        return (
          <div className="max-w-7xl mx-auto pb-20">
            <header className="flex justify-between items-center mb-10 px-4">
              <div className="text-left">
                <h1 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">Praticar Redação</h1>
                <p className="text-gray-400 font-bold text-xs">Escolha entre um tema aleatório ou crie o seu. Boa escrita!</p>
              </div>
              <button
                onClick={() => setCurrentView('explore')}
                className="text-primary font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-all"
              >
                Ver todos os temas
                <span className="material-icons-outlined text-base">arrow_forward</span>
              </button>
            </header>

            <div className="space-y-12">
              <TopicCard
                topic={topic}
                onRefresh={handleRefreshTopic}
                isLoading={isLoading}
                onWrite={() => startWriting('text')}
                onUpload={() => startWriting('image')}
              />
              <CreateTopicCard onTopicGenerated={(t) => { setTopic(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>
          </div>
        );
      case 'writing': return <EssayEditor topicTitle={writingTopicTitle} onCancel={cancelWriting} onSubmit={handleEssaySubmit} isSubmitting={isCorrecting} initialMode={initialMode} startTime={essayStartTime || Date.now()} />;
      case 'result': return correctionResult ? <CorrectionResultView result={correctionResult} onBack={() => setCurrentView('practice')} onViewHistory={() => setCurrentView('performance')} /> : null;
      case 'performance': return <PerformanceView userId={session?.user?.id} isDemo={isDemoMode} />;
      case 'explore': return <ExploreView onSelectTopic={(title) => { const found = exploreTopics.find(t => t.title === title); if (found) setTopic(found); setCurrentView('practice'); }} />;
      case 'ranking': return <RankingView />;
      case 'notifications': return <NotificationsView notifications={notifications} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllAsRead} onClose={() => setCurrentView(getDefaultView(userType))} />;
      case 'profile': return <ProfileView user={session?.user} />;
      default: return <div className="py-20 text-center">Carregando...</div>;
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl animate-pulse">
          <span className="text-primary font-black text-4xl">s</span>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Iniciando Sistema...</p>
      </div>
    );
  }

  if (!session && !isDemoMode) return <LoginView onLoginSuccess={() => { }} onEnterDemo={handleEnterDemo} />;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans selection:bg-primary/20 transition-colors relative">
      {/* Banner Superior de Sessão Ativa */}
      {hasActiveSession && currentView !== 'writing' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] w-full max-w-xl px-4 animate-fade-in-up">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-primary/20 shadow-premium rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse-slow shrink-0">
                <span className="material-icons-outlined text-lg">edit_note</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">Redação em Andamento</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate" title={writingTopicTitle}>{writingTopicTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={cancelWriting}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={() => setCurrentView('writing')}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold shadow-md hover:bg-primary-dark transition-all active:scale-95"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {countdown !== null && (
        <div className="fixed inset-0 z-[1000] bg-primary flex items-center justify-center text-white animate-fade-in">
          <div className="text-[12rem] font-black">{countdown}</div>
        </div>
      )}

      <Navbar currentView={currentView} onViewChange={setCurrentView} onLogout={handleLogout} userType={userType} user={session?.user} notifications={notifications} onMarkAsRead={handleMarkAsRead} />

      <main className="px-6 pt-24 mx-auto max-w-[1400px]">
        {renderView()}
      </main>

      <footer className="py-14 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">
        &copy; 2024 Scritta. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default App;
