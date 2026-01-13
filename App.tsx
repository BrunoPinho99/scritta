import React, { useState, useCallback, useEffect, useRef } from 'react';
// Components
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

// Types & Data
import { Topic, CorrectionResult, EssayInput, Notification } from './types';
import { exploreTopics } from './data/exploreTopics';
import { notificationsData } from './data/notificationsData';

// Services
import { correctEssay } from './services/geminiService';
import { saveEssayToDatabase } from './services/databaseService'; // Certifique-se que o arquivo se chama databaseService.ts (singular)
import { supabase } from './services/supabase'; // Caminho corrigido para services/supabase.ts

const INITIAL_INDEX = Math.floor(Math.random() * exploreTopics.length);
const INITIAL_TOPIC: Topic = {
  id: exploreTopics[INITIAL_INDEX].id,
  title: exploreTopics[INITIAL_INDEX].title,
  supportTexts: exploreTopics[INITIAL_INDEX].supportTexts || [] // Garante array vazio se undefined
};

type ViewState = 'practice' | 'performance' | 'explore' | 'writing' | 'result' | 'ranking' | 'notifications' | 'profile' | 'inst-students' | 'inst-performance' | 'inst-ranking' | 'inst-classes' | 'inst-staff' | 'inst-settings';
type UserType = 'student' | 'teacher' | 'school_admin';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [userType, setUserType] = useState<UserType>('student');
  const [topic, setTopic] = useState<Topic>(INITIAL_TOPIC);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('practice');
  const [isInitializing, setIsInitializing] = useState(true);

  // Estado para controlar se há uma sessão de escrita ativa
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Refs para evitar loops no useEffect de autenticação
  const currentViewRef = useRef(currentView);
  const hasActiveSessionRef = useRef(hasActiveSession);

  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { hasActiveSessionRef.current = hasActiveSession; }, [hasActiveSession]);

  const [writingTopicTitle, setWritingTopicTitle] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(notificationsData);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [essayStartTime, setEssayStartTime] = useState<number | null>(null);
  const [initialMode, setInitialMode] = useState<'text' | 'image'>('text');

  const getDefaultView = (type: UserType): ViewState => {
    if (type === 'school_admin') return 'inst-students';
    if (type === 'teacher') return 'inst-students';
    return 'practice';
  };

  // Recuperação de Sessão
  // Inicialização: Forçar Logout e Limpeza
  useEffect(() => {
    const initApp = async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Erro ao desconectar:", e);
      } finally {
        // Limpeza de tokens e dados locais
        localStorage.removeItem('sb-xfmztntqxhbrxvwswys-auth-token');
        localStorage.removeItem('sb-exvwyiwiagpzoohtjyhh-auth-token');
        localStorage.removeItem('active_writing_session');
        localStorage.removeItem('scritta_demo_mode');
        localStorage.removeItem('scritta_demo_type');

        setSession(null);
        setIsDemoMode(false);
        setIsInitializing(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setSession(session);

        // Busca a role real do banco para garantir segurança e redirecionamento correto
        let finalType: UserType = 'student';

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          const dbRole = profile?.role;

          if (dbRole === 'school') finalType = 'school_admin';
          else if (dbRole === 'teacher') finalType = 'teacher';
          else if (dbRole === 'student') finalType = 'student';
          else {
            // Fallback
            finalType = (session.user?.user_metadata?.user_type as UserType) || 'student';
          }
        } catch (error) {
          console.error("Erro ao buscar role:", error);
          finalType = (session.user?.user_metadata?.user_type as UserType) || 'student';
        }

        setUserType(finalType);

        if (!hasActiveSessionRef.current && currentViewRef.current !== 'writing') {
          setCurrentView(getDefaultView(finalType));
        }
      } else {
        setSession(null);
        // Não reseta Demo Mode aqui automaticamente para evitar loop se fosse o caso, 
        // mas initApp já cuidou da limpeza inicial.
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRefreshTopic = () => {
    setIsLoading(true);
    setTimeout(() => {
      let nextIndex;
      do { nextIndex = Math.floor(Math.random() * exploreTopics.length); } while (exploreTopics[nextIndex].id === topic.id);
      setTopic({
        id: exploreTopics[nextIndex].id,
        title: exploreTopics[nextIndex].title,
        supportTexts: exploreTopics[nextIndex].supportTexts || []
      });
      setIsLoading(false);
    }, 400);
  };

  const handleEssaySubmit = async (input: EssayInput) => {
    setIsCorrecting(true);
    const durationMs = essayStartTime ? Date.now() - essayStartTime : 0;
    const timeStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    try {
      // 1. Correção via IA
      const result = await correctEssay(writingTopicTitle, input);
      const res = { ...result, timeTaken: timeStr, topicTitle: writingTopicTitle };
      setCorrectionResult(res);
      setCurrentView('result');
      setHasActiveSession(false);

      // 2. Salvar no Banco de Dados (Argumentos corrigidos para combinar com databaseService.ts)
      await saveEssayToDatabase(
        writingTopicTitle,
        input,
        session?.user?.id || 'demo',
        res
      );

      // 3. Limpeza
      localStorage.removeItem(`draft_${writingTopicTitle}`);
      localStorage.removeItem('active_writing_session');

    } catch (err: any) {
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
    try {
      // Tenta desconectar do servidor (pode falhar se sem internet/erro)
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao sair do Supabase:", error);
    } finally {
      // --- LIMPEZA LOCAL FORÇADA (Sempre executa) ---

      // 1. Limpa tokens de autenticação (ID correto do seu projeto: xfmztntqxhbrxvwswys)
      localStorage.removeItem('sb-xfmztntqxhbrxvwswys-auth-token');

      // 2. Limpa dados de sessão e demo
      localStorage.removeItem('active_writing_session');
      localStorage.removeItem('scritta_demo_mode');
      localStorage.removeItem('scritta_demo_type');

      // 3. Reseta estados React
      setSession(null);
      setIsDemoMode(false);

      // 4. Recarrega a página para garantir estado zero
      window.location.href = '/';
    }
  };

  const handleEnterDemo = (t: UserType) => {
    setIsDemoMode(true);
    setUserType(t);
    setSession({ user: { id: 'demo', email: 'demo@tese.com.br', user_metadata: { user_type: t } } });
    setCurrentView(getDefaultView(t));

    localStorage.setItem('scritta_demo_mode', 'true');
    localStorage.setItem('scritta_demo_type', t);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
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
        case 'profile': return <ProfileView onManageSubscription={() => { }} />;
        case 'notifications': return (
          <NotificationsView
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClose={() => setCurrentView(getDefaultView(type))}
          />
        );
        default: return <InstitutionDashboard userType={type} />;
      }
    }

    switch (currentView) {
      case 'practice':
        return (
          <div className="max-w-7xl mx-auto pb-20">
            <header className="flex justify-between items-center mb-10 px-4">
              <div className="text-left">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">Praticar Redação</h1>
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

            <div className="space-y-16">
              <TopicCard
                topic={topic}
                onRefresh={handleRefreshTopic}
                isLoading={isLoading}
                onWrite={() => startWriting('text')}
                onUpload={() => startWriting('image')}
              />
              <CreateTopicCard onTopicGenerated={(newTopic) => setTopic(newTopic)} />
            </div>
          </div>
        );
      case 'writing':
        return <EssayEditor
          topicTitle={writingTopicTitle}
          onCancel={cancelWriting}
          onSubmit={handleEssaySubmit}
          isSubmitting={isCorrecting}
          initialMode={initialMode}
          startTime={essayStartTime || Date.now()}
        />;
      case 'result':
        return correctionResult
          ? <CorrectionResultView result={correctionResult} onBack={() => setCurrentView('practice')} />
          : null;
      case 'performance': return <PerformanceView />;
      case 'explore':
        return <ExploreView onSelectTopic={(title) => {
          const found = exploreTopics.find(t => t.title === title);
          if (found) {
            setTopic({
              id: found.id,
              title: found.title,
              supportTexts: []
            });
          }
          setCurrentView('practice');
        }} />;
      case 'ranking': return <RankingView />;
      case 'notifications': return (
        <NotificationsView
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClose={() => setCurrentView('practice')}
        />
      );
      case 'profile': return <ProfileView />;
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

  if (!session && !isDemoMode) return <LoginView onEnterDemo={handleEnterDemo} onLoginSuccess={() => { }} />;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans selection:bg-primary/20 transition-colors relative">
      {/* Banner Superior de Sessão Ativa */}
      {hasActiveSession && currentView !== 'writing' && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] w-[90%] sm:w-full max-w-2xl sm:px-6 animate-fade-in-up">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-primary/20 shadow-premium rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse-slow shrink-0">
                <span className="material-icons-outlined">edit_note</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-primary uppercase tracking-widest mb-0.5">Redação em Andamento</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 max-w-[120px] sm:max-w-xs">{writingTopicTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={cancelWriting}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={() => setCurrentView('writing')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary-dark transition-all active:scale-95"
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

      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        userType={userType}
        user={session?.user}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
      />

      <main className="px-6 pt-32 mx-auto max-w-[1400px]">
        {renderView()}
      </main>

      <footer className="py-14 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">
        &copy; 2024 Scritta. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default App;