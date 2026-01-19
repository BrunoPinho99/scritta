
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabase'; // Ajuste o caminho se necessário

interface LoginViewProps {
  onLoginSuccess: () => void;
  onEnterDemo: (type: 'student' | 'teacher' | 'school_admin') => void;
}

type UserTypeSelection = 'student' | 'teacher' | 'school_admin';

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onEnterDemo }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState<UserTypeSelection>('student');
  const [name, setName] = useState(''); // Usado para Nome da Escola ou Nome Completo
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Captura token de convite da URL
  const inviteToken = new URLSearchParams(window.location.search).get('invite_token');

  // Regra: Aluno e Professor só podem criar conta COM convite. Escola é livre.
  const isSignupAllowed = useMemo(() => {
    if (userType === 'school_admin') return true;
    return !!inviteToken;
  }, [userType, inviteToken]);

  // Se tentar mudar para cadastro sem permissão, força login ou mostra aviso (mas a UI principal já vai bloquear a tab)
  useEffect(() => {
    if (!isLogin && !isSignupAllowed) {
      setIsLogin(true); // Força volta para login se tentar burlar
    }
  }, [isSignupAllowed, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isLogin) {
        // --- FLUXO DE LOGIN ---
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Sucesso
        onLoginSuccess();

      } else {
        // --- FLUXO DE CADASTRO ---
        // Trava final de segurança
        if (!isSignupAllowed) throw new Error("Cadastro não permitido sem convite.");

        if (password !== confirmPassword) throw new Error("As senhas não coincidem!");
        if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

        // Prepara os metadados que o Trigger SQL vai usar para criar o perfil
        const metaData = {
          role: userType === 'school_admin' ? 'school' : userType, // Mapeia para o ENUM do banco
          full_name: name || (userType === 'school_admin' ? 'Administrador Escolar' : 'Novo Usuário'),
          // Se for escola, salvamos o nome da escola no perfil
          school_name: userType === 'school_admin' ? name : null,
          invite_token: inviteToken // Passa o token se houver
        };

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metaData // Isso é enviado para o raw_user_meta_data
          }
        });

        if (error) throw error;

        if (data.user && !data.session) {
          setSuccessMessage("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
          setTimeout(() => setIsLogin(true), 3000);
        } else if (data.session) {
          setSuccessMessage("Conta criada com sucesso! Entrando...");
          setTimeout(() => onLoginSuccess(), 1500);
        }
      }
    } catch (error: any) {
      console.error("Erro no processo:", error);
      // Tratamento de mensagens de erro amigáveis
      let msg = error.message;
      if (msg.includes("Invalid login")) msg = "E-mail ou senha incorretos.";
      if (msg.includes("already registered")) msg = "Este e-mail já está cadastrado.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background-light dark:bg-background-dark overflow-hidden font-sans">
      {/* Lado Esquerdo - Branding Imersivo */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary items-center justify-center p-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 text-white max-w-xl text-left">
          <div className="flex items-center gap-4 mb-16 animate-fade-in">
            <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center shadow-2xl">
              <div className="flex flex-col items-center translate-y-[2px]">
                <span className="text-primary font-black text-4xl leading-none tracking-tighter">L</span>
                <div className="w-7 h-[6px] bg-primary mt-[1px] rounded-full"></div>
              </div>
            </div>
            <span className="font-black text-6xl tracking-tighter text-white">
              littera<span className="text-white/40">.</span>
            </span>
          </div>

          <div className="space-y-8 animate-fade-in-up">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              {isLogin ? 'Potencialize sua escrita com I.A.' : 'Comece sua jornada.'}
            </h1>
            <p className="text-xl opacity-80 leading-relaxed font-medium max-w-md">
              {isLogin
                ? 'A plataforma definitiva para quem busca excelência. Correção instantânea, gestão de dados e evolução contínua.'
                : userType === 'school_admin'
                  ? 'Cadastre sua instituição para gerenciar turmas e acompanhar o desempenho dos alunos.'
                  : 'Crie sua conta para acessar as correções e atividades.'}
            </p>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário Glassmorphism */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-grid">
        {/* Aviso de Bloqueio de Cadastro para Alunos/Profs sem convite */}
        {!isLogin && !isSignupAllowed && (
          <div className="fixed top-6 right-6 z-50 max-w-sm animate-shake">
            <div className="bg-rose-500 text-white p-4 rounded-2xl shadow-premium flex items-start gap-3">
              <span className="material-icons-outlined text-xl mt-0.5">block</span>
              <div>
                <p className="font-black text-xs uppercase tracking-wider mb-1">Cadastro Restrito</p>
                <p className="text-xs opacity-90 leading-relaxed">
                  Alunos e Professores precisam de um <strong>link de convite</strong> da escola para criar conta.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-md animate-fade-in-up">
          <div className="bg-white dark:bg-surface-dark rounded-[3.5rem] p-10 md:p-12 shadow-premium border border-gray-100 dark:border-white/5 relative overflow-hidden">

            <div className="mb-12 text-center">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter">
                {isLogin ? 'Bem-vindo' : 'Criar Conta'}
              </h2>
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em]">
                {isLogin ? 'Acesse seu painel exclusivo' : 'Preencha seus dados de acesso'}
              </p>
            </div>

            {/* Selector de Perfil Dinâmico (Agora reseta para login se mudar para um tipo bloqueado durante cadastro) */}
            <div className="flex bg-gray-50 dark:bg-white/5 p-1.5 rounded-[1.8rem] mb-10 shadow-inner">
              {(['student', 'teacher', 'school_admin'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setUserType(type);
                    setErrorMessage(null);
                    // Se estiver na aba cadastro e mudar para um tipo não permitido, volta pro login
                    if (!isLogin && type !== 'school_admin' && !inviteToken) {
                      setIsLogin(true);
                    }
                  }}
                  className={`flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest rounded-[1.4rem] transition-all duration-300 ${userType === type
                    ? 'bg-white dark:bg-white/10 text-primary shadow-lg scale-100'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                >
                  {type === 'student' ? 'ALUNO' : type === 'teacher' ? 'DOCENTE' : 'ESCOLA'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
              {errorMessage && (
                <div className="p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold text-center animate-shake">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-5 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-2xl text-green-600 dark:text-green-400 text-xs font-bold text-center animate-pulse">
                  {successMessage}
                </div>
              )}

              {/* Nome: Obrigatório para Cadastro */}
              {!isLogin && (
                <div className="space-y-2 group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-primary">
                    {userType === 'school_admin' ? 'NOME DA INSTITUIÇÃO' : 'SEU NOME COMPLETO'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={userType === 'school_admin' ? "Ex: Colégio Anglo" : "Ex: Ana Clara Silva"}
                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                  />
                </div>
              )}

              <div className="space-y-2 group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-primary">E-MAIL</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={userType === 'school_admin' ? "admin@escola.com" : "seu@email.com"}
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                />
              </div>

              <div className="space-y-2 group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-primary">SENHA</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2 group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-primary">CONFIRMAR SENHA</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-5 rounded-[1.8rem] font-black text-white bg-primary hover:bg-primary-dark shadow-xl shadow-primary/25 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span className="text-sm uppercase tracking-widest">
                    {isLogin ? 'Entrar Agora' : 'Criar Minha Conta'}
                  </span>
                )}
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-gray-50 dark:border-white/5 text-center space-y-4">
              {/* Link para Demo continua visível */}
              <button
                type="button"
                onClick={() => onEnterDemo(userType)}
                className="text-[10px] font-black text-primary hover:text-primary-dark uppercase tracking-[0.2em] transition-colors"
              >
                Acesso Demonstrativo ({userType === 'student' ? 'Aluno' : userType === 'teacher' ? 'Docente' : 'Escola'})
              </button>

              {/* Switch Login/Cadastro - Condicionado às regras */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  {isLogin ? 'Ainda não tem conta?' : 'Já tem cadastro?'}

                  {/* Se for Admin OU tiver Token, mostra o botão normal. Se não, mostra texto alternativo ou botão bloqueado */}
                  {isSignupAllowed ? (
                    <button
                      type="button"
                      onClick={() => { setIsLogin(!isLogin); setErrorMessage(null); }}
                      className="ml-2 text-gray-900 dark:text-white hover:text-primary transition-colors underline decoration-primary/20 underline-offset-4"
                    >
                      {isLogin ? 'Criar Cadastro' : 'Fazer Login'}
                    </button>
                  ) : (
                    // Estado onde cadastro é proibido (Aluno/Prof sem token)
                    // Só mostramos a opção de voltar pro Login se estiver na tela de cadastro (o que o useEffect previne, mas ok)
                    // Se estiver no Login, mostramos um botão "Tenho Convite" que pode explicar como prosseguir
                    <span className="ml-2 text-gray-400 italic">
                      (Cadastro requer convite)
                    </span>
                  )}
                </p>

                {/* Novo Botão para quem tem código (Redirecionamento simples ou info) */}
                {!isSignupAllowed && isLogin && (
                  <button
                    onClick={() => alert("Utilize o link enviado pela sua escola (ex: scritta.com/?invite_token=...)")}
                    className="text-[9px] font-bold text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    Tenho um código de convite
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bg-grid {
          background-image: radial-gradient(circle, #e5e7eb 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .dark .bg-grid {
          background-image: radial-gradient(circle, #1f2937 1px, transparent 1px);
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginView;
