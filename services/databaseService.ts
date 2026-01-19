import { supabase } from './supabase';
import { EssayInput, CorrectionResult, SavedEssay, School, ClassGroup, StudentDetail } from '../types';

// ==========================================
// TIPOS AUXILIARES (Jornada do Usuário)
// ==========================================
export const JOURNEY_TIERS = [
  { min: 0, max: 2, label: 'Aspirante', icon: 'edit', color: 'text-gray-400', bg: 'bg-gray-100', next: 3 },
  { min: 3, max: 5, label: 'Escritor Bronze', icon: 'workspace_premium', color: 'text-amber-700', bg: 'bg-amber-100', next: 6 },
  { min: 6, max: 10, label: 'Escritor Prata', icon: 'military_tech', color: 'text-slate-400', bg: 'bg-slate-100', next: 11 },
  { min: 11, max: 20, label: 'Escritor Ouro', icon: 'stars', color: 'text-amber-500', bg: 'bg-amber-100', next: 21 },
  { min: 21, max: 40, label: 'Escritor Platina', icon: 'diamond', color: 'text-cyan-400', bg: 'bg-cyan-100', next: 41 },
  { min: 41, max: 70, label: 'Escritor Diamante', icon: 'auto_awesome', color: 'text-blue-500', bg: 'bg-blue-100', next: 71 },
  { min: 71, max: 1000, label: 'Mestre Elite', icon: 'shield', color: 'text-primary', bg: 'bg-primary/10', next: null },
];

export const calculateUserRank = (essayCount: number) => {
  return JOURNEY_TIERS.find(tier => essayCount >= tier.min && essayCount <= tier.max) || JOURNEY_TIERS[0];
};

// ==========================================
// FUNÇÕES DE LEITURA (GET)
// ==========================================

export const getSchoolData = async (userId: string): Promise<School | null> => {
  // Busca o perfil para pegar o nome da escola
  const { data } = await supabase
    .from('profiles')
    .select('id, school_name')
    .eq('id', userId)
    .single();

  if (data) {
    return { id: data.id, name: data.school_name || "Minha Escola" };
  }
  return null;
};

export const updateSchoolProfile = async (userId: string, name: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({ school_name: name })
    .eq('id', userId);

  if (error) throw error;
  return true;
  if (error) throw error;
  return true;
};

export const uploadAvatar = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  // Tenta fazer upload para o bucket 'avatars'
  // Nota: O bucket deve estar criado e com políticas de acesso "public"
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) {
    console.error("Erro no upload:", uploadError);
    throw new Error("Falha ao enviar imagem. Verifique se o bucket 'avatars' existe.");
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
};

export const updateUserProfile = async (userId: string, payload: { full_name?: string, avatar_url?: string, school_name?: string }) => {
  // 1. Atualiza tabela profiles (Fonte de verdade)
  const updates: any = { updated_at: new Date().toISOString() };
  if (payload.full_name !== undefined) updates.full_name = payload.full_name;
  if (payload.avatar_url !== undefined) updates.avatar_url = payload.avatar_url;
  if (payload.school_name !== undefined) updates.school_name = payload.school_name;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;

  // 2. Atualiza Metadata da Sessão (Cache rápido)
  // Isso mantém a sessão sincronizada sem precisar de refresh
  const { error: authError } = await supabase.auth.updateUser({
    data: payload
  });

  if (authError) console.warn("Aviso: Metadata de auth não atualizado:", authError);

  return true;
};

export const getClassesBySchool = async (schoolId: string): Promise<ClassGroup[]> => {
  // Busca turmas criadas por esta escola
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('school_id', schoolId);

  if (error) {
    console.error("Erro ao buscar turmas:", error);
    return [];
  }

  // Mapeia para o formato do Frontend
  return data.map((c: any) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    shift: c.shift,
    studentCount: c.class_members?.[0]?.count || 0, // Count via relation
    averageScore: 0, // TODO: Calcular média real via essays
    school_id: c.school_id,
    trend: 'neutral'
  }));
};

export const getProfessorsBySchool = async (schoolId: string) => {
  // Busca professores VINCULADOS (class_members)
  const { data: activeProfs } = await supabase
    .from('class_members')
    .select('user_id, profiles:user_id(full_name, email), classes(name)')
    .eq('role', 'teacher');

  // Busca professores CONVIDADOS (invites)
  const { data: invitedProfs } = await supabase
    .from('invites')
    .select('*')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .eq('status', 'pending');

  const formattedActive = activeProfs?.map((p: any) => ({
    id: p.user_id,
    name: p.profiles?.full_name,
    email: p.profiles?.email,
    className: p.classes?.name,
    status: 'active'
  })) || [];

  const formattedInvited = invitedProfs?.map((p: any) => ({
    id: p.id,
    name: '(Pendente)',
    email: p.email,
    className: 'Aguardando',
    status: 'invited'
  })) || [];

  return [...formattedActive, ...formattedInvited];
};

export const getStudentsByContext = async (schoolId: string): Promise<StudentDetail[]> => {
  // 1. Busca alunos ATIVOS (tabela class_members -> profiles)
  const { data: activeMembers } = await supabase
    .from('class_members')
    .select(`
      user_id,
      classes!inner(school_id, name),
      profiles:user_id(full_name, email)
    `)
    .eq('classes.school_id', schoolId)
    .eq('role', 'student');

  // 2. Busca alunos PENDENTES (tabela invites)
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .eq('status', 'pending');

  // Formata Ativos
  const activeStudents = activeMembers?.map((m: any) => ({
    id: m.user_id,
    name: m.profiles?.full_name || 'Aluno Sem Nome',
    email: m.profiles?.email,
    averageScore: 0,
    essaysSubmitted: 0,
    lastActivity: "Ativo",
    status: 'active' as const,
    class_name: m.classes?.name
  })) || [];

  // Formata Pendentes
  const pendingStudents = invites?.map((i: any) => ({
    id: i.id,
    name: i.name || i.email,
    email: i.email,
    averageScore: 0,
    essaysSubmitted: 0,
    lastActivity: "Aguardando",
    status: 'invited' as const, // Mantém invited para diferenciar visualmente
    class_name: '-',
    token: i.token
  })) || [];

  return [...activeStudents, ...pendingStudents];
};

export const getAllInstitutionalEssays = async (schoolId: string): Promise<SavedEssay[]> => {
  // Passo 1: Pegar IDs dos alunos da escola
  const { data: studentIds } = await supabase
    .from('class_members')
    .select('user_id, classes!inner(school_id)')
    .eq('classes.school_id', schoolId)
    .eq('role', 'student');

  if (!studentIds || studentIds.length === 0) return [];

  const ids = studentIds.map((s: any) => s.user_id);

  // Passo 2: Buscar essays desses IDs
  const { data: essays } = await supabase
    .from('essays')
    .select(`
      *,
      profiles:student_id(full_name)
    `)
    .in('student_id', ids)
    .order('created_at', { ascending: false });

  return (essays || []).map((item: any) => ({
    id: item.id,
    topic_title: item.topic_title,
    student_name: item.profiles?.full_name || 'Aluno',
    score: item.total_score,
    created_at: item.created_at,
    status: item.status,
    result: item.correction_json
  }));
};

// ==========================================
// FUNÇÕES DE CRIAÇÃO (INSERT)
// ==========================================

export const createClass = async (payload: { name: string, grade: string, shift: string, school_id: string }) => {
  const { data, error } = await supabase
    .from('classes')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    grade: data.grade,
    shift: data.shift,
    studentCount: 0,
    averageScore: 0,
    school_id: data.school_id,
    trend: 'neutral' as const
  };
};



export const createStudentsBulk = async (students: any[], schoolId: string) => {
  const success = [];
  const errors = [];

  for (const student of students) {
    try {
      const created = await createStudent({
        name: student.name,
        email: student.email,
        class_id: student.class_id,
        school_id: schoolId,
        registration_number: student.registration_number
      });
      success.push(created);
    } catch (err: any) {
      errors.push({ email: student.email, reason: err.message });
    }
  }

  return { success, errors };
};

// ==========================================
// FUNÇÕES DE REDAÇÃO (SALVAR/CORRIGIR)
// ==========================================

export const saveEssayToDatabase = async (topicTitle: string, input: EssayInput, userId: string, result?: CorrectionResult) => {
  const content = input.type === 'text' ? input.content : 'Imagem enviada';

  try {
    const dbPayload = {
      student_id: userId,
      topic_title: topicTitle,
      content: content,
      status: 'corrected',
      total_score: result?.totalScore || 0,
      correction_json: result,
    };

    const { data, error } = await supabase
      .from('essays')
      .insert([dbPayload])
      .select();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Erro ao salvar redação:", error);
    throw error;
  }
};

export const getUserStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('essays')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return { totalEssays: 0, averageScore: 0, totalPoints: 0, history: [], competencyAverages: [] };
  }

  const history = data.map((item: any) => ({
    id: item.id,
    topic_title: item.topic_title,
    conteudo: item.content,
    score: item.total_score || 0,
    created_at: item.created_at,
    result: item.correction_json
  }));

  return calculateDetailedMetrics(history);
};

// Função que estava quebrada/cortada
const calculateDetailedMetrics = (history: any[]) => {
  const totalEssays = history.length;
  if (totalEssays === 0) return { totalEssays: 0, averageScore: 0, totalPoints: 0, history: [], competencyAverages: [] };

  const totalPoints = history.reduce((acc, curr) => acc + curr.score, 0);

  // Cálculo de médias por competência
  const compTotals: Record<string, { sum: number, count: number }> = {};

  history.forEach(essay => {
    if (essay.result?.competencies) {
      essay.result.competencies.forEach((c: any) => {
        if (!compTotals[c.name]) compTotals[c.name] = { sum: 0, count: 0 };
        compTotals[c.name].sum += c.score;
        compTotals[c.name].count += 1;
      });
    }
  });

  const competencyAverages = Object.entries(compTotals).map(([name, data]) => ({ name, average: Math.round(data.sum / data.count) }));

  return {
    totalEssays,
    averageScore: Math.round(totalPoints / totalEssays),
    totalPoints,
    history,
    competencyAverages
  };
};

// ... imports existentes

const withTimeout = (promise: Promise<any>, ms: number) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("O envio do e-mail excedeu o tempo limite (5s)."));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const createProfessor = async (payload: { name: string, email: string, class_id: string, school_id: string }) => {
  // 1. Cria o convite no Banco
  const { data: inviteData, error } = await supabase
    .from('invites')
    .insert({
      school_id: payload.school_id,
      email: payload.email,
      role: 'teacher',
      class_id: payload.class_id,
      name: payload.name
    })
    .select()
    .single();

  if (error) throw error;

  // 2. DISPARAR EMAIL REAL (Chamando a Edge Function)
  const { data: school } = await supabase.from('profiles').select('school_name').eq('id', payload.school_id).single();
  
  // Gera o link apontando para o seu site atual
  const inviteLink = `https://littera.app.br/?invite_token=${inviteData.token}`;

  // Tenta enviar o e-mail em paralelo com Timeout de 5s
  // Se falhar, APENAS LOGA O ERRO, mas retorna sucesso para a interface
  try {
    const invitePromise = supabase.functions.invoke('send-invite', {
      body: {
        email: payload.email,
        role: 'teacher',
        schoolName: school?.school_name || 'Instituição de Ensino',
        inviteLink: inviteLink
      }
    });

    const { data, error: fnError } = await withTimeout(invitePromise, 5000) as any;

    if (fnError) throw new Error(`Erro na Function: ${fnError.message}`);
    
    // Check for Resend specific errors (wrapped in 200 OK)
    if (data && (data.error || data.statusCode >= 400 || data.name === 'validation_error')) {
      throw new Error(`Erro do Resend: ${data.message || data.error}`);
    }
    
    console.log("E-mail enviado com sucesso!");
  } catch (emailErr: any) {
    console.error("AVISO: Falha ao enviar e-mail (mas professor foi criado):", emailErr.message);
    // NÃO LANÇA ERRO para a UI, apenas loga.
    // O usuário verá o popup de "Sucesso" pois o registro no DB (inviteData) foi criado.
  }

  return {
    id: inviteData.id,
    name: payload.name,
    email: payload.email,
    className: 'Pendente',
    status: 'invited',
    token: inviteData.token
  };
};

export const createStudent = async (payload: { name: string, email: string, class_id: string, school_id: string, registration_number?: string }) => {
  // 1. Cria o convite no Banco
  const { data: inviteData, error } = await supabase
    .from('invites')
    .insert({
      school_id: payload.school_id,
      email: payload.email,
      role: 'student',
      class_id: payload.class_id,
      name: payload.name
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('unique')) throw new Error("Convite já enviado para este e-mail.");
    throw error;
  }

  // 2. DISPARAR EMAIL REAL
  const { data: school } = await supabase.from('profiles').select('school_name').eq('id', payload.school_id).single();
  
  const inviteLink = `https://littera.app.br/?invite_token=${inviteData.token}`;

  // Chama a função que criamos no Passo 2
  // Tenta enviar o e-mail em paralelo com Timeout de 5s
  // Se falhar, APENAS LOGA O ERRO, mas retorna sucesso para a interface
  try {
    const invitePromise = supabase.functions.invoke('send-invite', {
      body: {
        email: payload.email,
        role: 'student',
        schoolName: school?.school_name || 'Instituição de Ensino',
        inviteLink: inviteLink
      }
    });

    const { data, error: fnError } = await withTimeout(invitePromise, 5000) as any;

    if (fnError) throw new Error(`Erro na Function: ${fnError.message}`);
    
    // Check for Resend specific errors (wrapped in 200 OK)
    if (data && (data.error || data.statusCode >= 400 || data.name === 'validation_error')) {
      throw new Error(`Erro do Resend: ${data.message || data.error}`);
    }
    
    console.log("E-mail enviado com sucesso!");
  } catch (emailErr: any) {
    console.error("AVISO: Falha ao enviar e-mail (mas aluno foi criado):", emailErr.message);
    // NÃO LANÇA ERRO para a UI, apenas loga.
    // O usuário verá o popup de "Sucesso" pois o registro no DB (inviteData) foi criado.
  }

  return {
    id: inviteData.id,
    name: payload.name,
    email: payload.email,
    averageScore: 0,
    essaysSubmitted: 0,
    lastActivity: "Novo",
    status: 'pending' as const,
    class_id: payload.class_id,
    class_name: '...',
    token: inviteData.token
  };
};

// ... (existing code top)

export const deleteInvite = async (inviteId: string) => {
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw error;
};

export const deleteClass = async (classId: string) => {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);

  if (error) throw error;
};

export const removeMember = async (userId: string, classId?: string) => {
  let query = supabase.from('class_members').delete().eq('user_id', userId);
  
  if (classId) {
    query = query.eq('class_id', classId);
  }

  const { error } = await query;
  if (error) throw error;
};


export const acceptInvite = async (token: string, userId: string) => {
  // 1. Busca o convite pelo token
  const { data: invite, error: fetchError } = await supabase
    .from('invites')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !invite) {
    console.error("Convite inválido ou não encontrado:", fetchError);
    return false;
  }

  // 2. Adiciona o usuário à turma (class_members)
  // school_id removido pois é normalizado via classes
  const { error: insertError } = await supabase
    .from('class_members')
    .insert({
      class_id: invite.class_id,
      user_id: userId,
      role: invite.role
    });

  if (insertError) {
    if (!insertError.message.includes('unique')) {
      console.error("Erro ao aceitar convite:", insertError);
      throw insertError;
    }
  }
  
  // Atualiza profile com school_id para contexto rápido
  await supabase.from('profiles').update({ school_id: invite.school_id }).eq('id', userId);

  // 3. Atualiza status do convite ou deleta
  const { error: deleteError } = await supabase
    .from('invites')
    .delete()
    .eq('id', invite.id);

  if (deleteError) console.error("Erro ao limpar convite:", deleteError);

  return true;
};

// ==========================================
// FUNÇÕES DE TAREFAS (ASSIGNMENTS)
// ==========================================

export const createAssignment = async (payload: { title: string, description: string, due_date: string, class_id: string, created_by: string }) => {
  const { data, error } = await supabase
    .from('assignments')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getSchoolAssignments = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, classes!inner(school_id, name)')
    .eq('classes.school_id', schoolId)
    .order('due_date', { ascending: true });

  if (error) {
    console.error("Erro ao buscar assignments:", error);
    return [];
  }
  
  return data.map((a: any) => ({
     id: a.id,
     title: a.title,
     description: a.description,
     class_id: a.class_id,
     due_date: a.due_date,
     created_at: a.created_at,
     status: new Date(a.due_date) < new Date() ? 'expired' : 'active',
     className: a.classes?.name
  }));
};


export const getAssignmentsByClass = async (classId: string) => {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('class_id', classId)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data;
};

// ... (Rest of existing stats/notification functions)
export const createNotification = async (
  userId: string,
  type: 'correction' | 'ranking' | 'system' | 'tip' | 'assignment',
  title: string,
  message: string
) => {
// ...
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      read: false
    });

  if (error) console.error("Erro ao criar notificação:", error);
};

export const getNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro ao buscar notificações:", error);
    return [];
  }

  return data.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    timestamp: new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  }));
};

export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) console.error("Erro ao marcar notificação como lida:", error);
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (error) console.error("Erro ao marcar todas como lidas:", error);
};

export const clearAllNotifications = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) console.error("Erro ao limpar notificações:", error);
};