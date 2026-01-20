
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StudentDetail, ClassGroup, SavedEssay, School, Assignment } from '../types';
// Certifique-se de que os tipos e serviços estão sendo importados corretamente do seu arquivo
import {
  getAllInstitutionalEssays,
  getClassesBySchool,
  getStudentsByContext,
  getSchoolData,
  getProfessorsBySchool,
  createClass,
  createProfessor,
  createStudent,
  createStudentsBulk,
  deleteInvite,
  updateSchoolProfile,
  deleteClass,
  removeMember,
  createAssignment,
  getSchoolAssignments
} from '../services/databaseService';
import { generateAssignmentTheme } from '../services/geminiService';
import RankingView from './RankingView';

interface InstitutionDashboardProps {
  initialTab?: 'students' | 'essays' | 'ranking' | 'classes' | 'staff' | 'settings' | 'assignments';
  userType?: 'teacher' | 'school_admin';
}

const ITEMS_PER_PAGE = 8;

const InstitutionDashboard: React.FC<InstitutionDashboardProps> = ({ initialTab = 'students', userType = 'school_admin' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);

  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [essays, setEssays] = useState<SavedEssay[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);

  const [currentPage, setCurrentPage] = useState(1);

  // States for Class Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', grade: '', shift: 'Matutino' });
  const [isSavingClass, setIsSavingClass] = useState(false);

  // States for Professor Modal
  const [isProfessorModalOpen, setIsProfessorModalOpen] = useState(false);
  const [newProfessor, setNewProfessor] = useState({ name: '', email: '', class_id: '' });
  const [isSavingProfessor, setIsSavingProfessor] = useState(false);

  // States for Assignment Modal
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', class_id: '', due_date: '' });
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  // States for AI Theme Generation
  const [themePrompt, setThemePrompt] = useState('');
  const [generatedTheme, setGeneratedTheme] = useState<any>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  // States for Student Modal
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', class_id: '', registration_number: '' });
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // States for Bulk Import Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Settings
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isSettingsSuccess, setIsSettingsSuccess] = useState(false);

  // Sync activeTab with prop when it changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    const fetchBaseData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();

        let schoolId = session?.user?.user_metadata?.school_id;
        if (!schoolId && userType === 'school_admin') {
          schoolId = session?.user?.id;
        }

        // Fallback apenas para não quebrar a UI se não houver ID, 
        // mas idealmente deve tratar erro se não houver schoolId
        schoolId = schoolId || 'demo-school';

        const [schoolData, classesData, professorsData, studentsData, essaysData, assignmentsData] = await Promise.all([
          getSchoolData(schoolId),
          getClassesBySchool(schoolId),
          getProfessorsBySchool(schoolId),
          getStudentsByContext(schoolId),
          getAllInstitutionalEssays(schoolId),
          getSchoolAssignments(schoolId)
        ]);

        setSchool(schoolData);
        setClasses(classesData);
        setProfessors(professorsData);
        setStudents(studentsData);
        setEssays(essaysData);
        setAssignments(assignmentsData);
      } catch (error) {
        console.error("Erro ao carregar dados do painel:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBaseData();
  }, [userType]); // Adicionado userType como dependência

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name || !newClass.grade) return;

    setIsSavingClass(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let schoolId = session?.user?.user_metadata?.school_id || session?.user?.id;

      const createdClass = await createClass({
        name: newClass.name,
        grade: newClass.grade,
        shift: newClass.shift,
        school_id: schoolId
      });

      if (createdClass) {
        setClasses(prev => [...prev, createdClass]);
        setIsClassModalOpen(false);
        setNewClass({ name: '', grade: '', shift: 'Matutino' });
        if (activeTab !== 'classes') setActiveTab('classes');
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      alert("Erro ao criar turma: " + msg);
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleCreateProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfessor.name || !newProfessor.email || !newProfessor.class_id) {
      alert("Por favor, preencha todos os campos e selecione uma turma.");
      return;
    }

    setIsSavingProfessor(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let schoolId = session?.user?.user_metadata?.school_id || session?.user?.id;

      const createdProf = await createProfessor({
        name: newProfessor.name,
        email: newProfessor.email,
        class_id: newProfessor.class_id,
        school_id: schoolId
      });

      if (createdProf) {
        setProfessors(prev => [...prev, createdProf]);
        setIsProfessorModalOpen(false);
        setNewProfessor({ name: '', email: '', class_id: '' });
        alert(`Sucesso! Um e-mail de convite foi enviado para ${newProfessor.email}.`);
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      alert("Erro ao cadastrar professor: " + msg);
    } finally {
      setIsSavingProfessor(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.email || !newStudent.class_id) {
      alert("Por favor, preencha os campos obrigatórios e selecione uma turma.");
      return;
    }

    setIsSavingStudent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let schoolId = session?.user?.user_metadata?.school_id || session?.user?.id;

      const createdStudent = await createStudent({
        name: newStudent.name,
        email: newStudent.email,
        class_id: newStudent.class_id,
        school_id: schoolId,
        registration_number: newStudent.registration_number
      });

      if (createdStudent) {
        setStudents(prev => [createdStudent, ...prev]);
        setIsStudentModalOpen(false);
        setNewStudent({ name: '', email: '', class_id: '', registration_number: '' });

        // CORREÇÃO: Removida a duplicidade do setActiveTab que existia aqui
        if (activeTab !== 'students') setActiveTab('students');

        const inviteLink = `https://littera.app.br/?invite_token=${createdStudent.token}`;
        alert(`Aluno cadastrado!\n\nSe o e-mail não chegar, envie este link:\n${inviteLink}`);
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      alert(msg || "Erro ao cadastrar aluno. Verifique se o e-mail já existe.");
    } finally {
      setIsSavingStudent(false);
    }
  };


  const handleGenerateTheme = async () => {
    if (!themePrompt.trim()) {
      alert("Por favor, descreva o tema desejado.");
      return;
    }

    setIsGeneratingTheme(true);
    try {
      const theme = await generateAssignmentTheme(themePrompt);
      setGeneratedTheme(theme);
    } catch (error: any) {
      alert("Erro ao gerar tema: " + error.message);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.title || !newAssignment.class_id || !newAssignment.due_date) {
      alert("Por favor, preencha título, turma e data de entrega.");
      return;
    }

    setIsSavingAssignment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const created = await createAssignment({
        title: newAssignment.title,
        description: newAssignment.description,
        class_id: newAssignment.class_id,
        due_date: newAssignment.due_date,
        created_by: session?.user?.id || '',
        theme: generatedTheme?.title,
        support_texts: generatedTheme?.supportTexts
      });

      if (created) {
        setAssignments(prev => [...prev, created]);
        setIsAssignmentModalOpen(false);
        setNewAssignment({ title: '', description: '', class_id: '', due_date: '' });
        setGeneratedTheme(null);
        setThemePrompt('');
        alert("Atividade criada com sucesso!");
      }
    } catch (error: any) {
      alert("Erro ao criar atividade: " + error.message);
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleCancelInvite = async (studentId: string, studentName: string) => {
    if (!confirm(`Tem certeza que deseja cancelar o convite de "${studentName}"?`)) return;

    try {
      await deleteInvite(studentId);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (error: any) {
      console.error("Erro ao cancelar convite:", error);
      alert("Erro ao cancelar convite: " + error.message);
    }
  };



  const handleDeleteClass = async (classId: string, className: string) => {
    if (!confirm(`Tem certeza que deseja excluir a turma "${className}"? Isso removerá todos os vínculos.`)) return;
    try {
      await deleteClass(classId);
      setClasses(prev => prev.filter(c => c.id !== classId));
    } catch (error: any) {
      alert("Erro ao excluir turma: " + error.message);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string, role: string) => {
    if (!confirm(`Tem certeza que deseja remover o ${role === 'teacher' ? 'professor' : 'aluno'} "${userName}"?`)) return;
    try {
      await removeMember(userId);
      if (role === 'teacher') {
        setProfessors(prev => prev.filter(p => p.id !== userId));
      } else {
        setStudents(prev => prev.filter(s => s.id !== userId));
      }
    } catch (error: any) {
      alert("Erro ao remover usuário: " + error.message);
    }
  };

  const handleDownloadTemplate = () => {
    const header = "Nome,Email,Nome da Turma,Matricula\n";
    const example1 = "Ana Silva,ana@email.com,3º Ano A,2024001\n";
    const example2 = "Bruno Souza,bruno@email.com,3º Ano B,";
    const content = header + example1 + example2;

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_alunos_scritta.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const dataRows = lines.slice(1).filter(line => line.trim() !== '');

      if (dataRows.length === 0) {
        alert("Arquivo vazio ou sem dados.");
        setBulkProcessing(false);
        return;
      }

      const studentsToCreate = [];
      const errors = [];

      for (const row of dataRows) {
        const cols = row.split(/,|;/).map(c => c.trim());
        if (cols.length < 3) continue;

        const [name, email, className, registration] = cols;

        // Encontra ID da turma pelo nome (Case insensitive)
        const classObj = classes.find(c => c.name.toLowerCase() === className.toLowerCase());

        if (!classObj) {
          errors.push(`Turma não encontrada para ${name}: ${className}`);
          continue;
        }

        studentsToCreate.push({
          name: name,
          email: email,
          class_id: classObj.id,
          registration_number: registration || ''
        });
      }

      if (studentsToCreate.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let schoolId = session?.user?.user_metadata?.school_id || session?.user?.id;

          const result = await createStudentsBulk(studentsToCreate, schoolId);

          let msg = `Processamento concluído!\n\nSucesso: ${result.success.length}`;
          if (result.errors.length > 0) {
            msg += `\nErros de cadastro: ${result.errors.length} (ex: e-mails duplicados)`;
          }
          if (errors.length > 0) {
            msg += `\nErros de validação (Turma não encontrada): ${errors.length}`;
          }
          alert(msg);

          if (result.success.length > 0) {
            setStudents(prev => [...result.success, ...prev]);
            setIsBulkModalOpen(false);
            setBulkFile(null);
          }
        } catch (err: any) {
          const msg = err?.message || String(err);
          alert("Erro ao processar lote: " + msg);
        }
      } else {
        alert("Nenhum aluno válido encontrado para importação. Verifique os nomes das turmas.");
      }

      setBulkProcessing(false);
    };

    reader.readAsText(bulkFile);
  };

  const stats = useMemo(() => {
    if (userType === 'teacher') {
      return [
        { label: 'Meus Alunos', value: students.length, icon: 'group', color: 'bg-blue-500' },
        { label: 'Redações Entregues', value: essays.length, icon: 'edit_note', color: 'bg-primary' },
        { label: 'Média da Turma', value: Math.round(essays.reduce((acc, curr) => acc + curr.score, 0) / (essays.length || 1)), icon: 'insights', color: 'bg-emerald-500' },
      ];
    }
    return [
      { label: 'Matrículas', value: students.length, icon: 'group', color: 'bg-blue-500' },
      { label: 'Turmas', value: classes.length, icon: 'layers', color: 'bg-primary' },
      { label: 'Correções', value: essays.length, icon: 'edit_note', color: 'bg-emerald-500' },
      { label: 'Docentes', value: professors.length, icon: 'school', color: 'bg-violet-500' },
    ];
  }, [students, classes, essays, professors, userType]);

  const availableTabs = useMemo(() => {
    const baseTabs = [
      { id: 'students', label: userType === 'teacher' ? 'Meus Alunos' : 'Alunos', icon: 'person' },
      { id: 'essays', label: 'Correções', icon: 'description' },
      { id: 'ranking', label: 'Ranking', icon: 'trophy' },
    ];

    if (userType === 'school_admin') {
      baseTabs.splice(1, 0, { id: 'classes', label: 'Turmas', icon: 'grid_view' });
      baseTabs.splice(2, 0, { id: 'staff', label: 'Docentes', icon: 'school' }); // Add Staff tab
      baseTabs.push({ id: 'settings', label: 'Configurações', icon: 'settings' });
    }

    if (userType === 'teacher') {
      baseTabs.splice(1, 0, { id: 'assignments', label: 'Atividades', icon: 'assignment' });
    }

    return baseTabs;
  }, [userType]);

  const currentStudents = useMemo(() => {
    return students.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [students, currentPage]);

  const studentTotalPages = Math.ceil(students.length / ITEMS_PER_PAGE);

  return (
    <div className="animate-fade-in-up space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block mb-2">
            {userType === 'teacher' ? 'Área do Docente' : 'Painel de Controle'}
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
            {school?.name || "Minha Instituição"}
          </h1>
        </div>

        {userType === 'school_admin' && (
          <div className="flex gap-4">
            <button
              onClick={() => setIsClassModalOpen(true)}
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105"
            >
              Criar Turma
            </button>
            <button
              onClick={() => setIsProfessorModalOpen(true)}
              className="px-6 py-3 bg-white dark:bg-surface-dark text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm transition-all hover:scale-105 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              + Professor
            </button>
            <button
              onClick={() => setIsStudentModalOpen(true)}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-105"
            >
              + Aluno
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="w-12 py-3 bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 rounded-2xl font-black border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm transition-all hover:bg-gray-50 hover:text-primary tooltip-container"
              title="Importar CSV"
            >
              <span className="material-icons-outlined">upload_file</span>
            </button>
          </div>
        )}
      </header>

      {/* Grid de Métricas */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${userType === 'teacher' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5 flex items-center gap-6">
            <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center text-white shadow-lg`}>
              <span className="material-icons-outlined text-2xl">{stat.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Seção Principal de Abas */}
      <div className="bg-white dark:bg-surface-dark rounded-[3rem] shadow-premium border border-gray-100 dark:border-white/5 overflow-hidden">
        <div className="flex border-b border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 p-2 overflow-x-auto">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[140px] py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white dark:bg-surface-dark shadow-md text-primary' : 'text-gray-400 hover:text-gray-900'}`}
            >
              <span className="material-icons-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-10">
          {activeTab === 'students' && (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] border-b border-gray-50 dark:border-white/5">
                      <th className="px-6 py-4">Nome do Aluno</th>
                      <th className="px-6 py-4">Média Geral</th>
                      <th className="px-6 py-4">Entregas</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {currentStudents.map(s => (
                      <tr key={s.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-6 font-black text-sm text-gray-900 dark:text-white">{s.name}</td>
                        <td className="px-6 py-6 font-black text-primary">{s.averageScore}</td>
                        <td className="px-6 py-6 text-sm font-bold text-gray-400">{s.essaysSubmitted}</td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.status === 'active' ? 'bg-green-100 text-green-600' :
                              s.status === 'invited' ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                              {s.status === 'active' ? 'Ativo' :
                                s.status === 'invited' ? 'Convite Pendente' :
                                  'Pendente'}
                            </span>

                            {s.status === 'invited' && (
                              <button
                                onClick={() => handleCancelInvite(s.id, s.name)}
                                className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                title="Cancelar Convite"
                              >
                                <span className="material-icons-outlined text-lg">delete</span>
                              </button>
                            )}

                            {s.status === 'active' && (
                              <button
                                onClick={() => handleRemoveMember(s.id, s.name, 'student')}
                                className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                title="Remover Aluno"
                              >
                                <span className="material-icons-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentStudents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">Nenhum aluno encontrado para sua turma.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {studentTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border hover:bg-gray-50 disabled:opacity-30 transition-all text-gray-500"
                  >
                    <span className="material-icons-outlined">chevron_left</span>
                  </button>
                  <span className="text-xs font-bold text-gray-500">
                    Página {currentPage} de {studentTotalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(studentTotalPages, p + 1))}
                    disabled={currentPage === studentTotalPages}
                    className="p-2 rounded-xl border hover:bg-gray-50 disabled:opacity-30 transition-all text-gray-500"
                  >
                    <span className="material-icons-outlined">chevron_right</span>
                  </button>
                </div>
              )}
            </>
          )}
          {activeTab === 'classes' && userType === 'school_admin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map(cls => (
                <div key={cls.id} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-icons-outlined">class</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cls.shift === 'Noturno' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {cls.shift}
                      </span>
                      <button
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        title="Excluir Turma"
                      >
                        <span className="material-icons-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{cls.name}</h3>
                  <p className="text-sm text-gray-400 font-medium mb-4">{cls.grade}</p>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-white/5">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alunos</p>
                      <p className="font-bold text-gray-900 dark:text-white">{cls.studentCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Média</p>
                      <p className="font-bold text-primary">{cls.averageScore}</p>
                    </div>
                  </div>
                </div>
              ))}
              {classes.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-400 font-bold flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 mb-4">
                    <span className="material-icons-outlined text-2xl">layers_clear</span>
                  </div>
                  <p>Nenhuma turma cadastrada. Crie a primeira acima.</p>
                </div>
              )}
            </div>
          )}
          {
            activeTab === 'staff' && userType === 'school_admin' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] border-b border-gray-50 dark:border-white/5">
                      <th className="px-6 py-4">Nome do Professor</th>
                      <th className="px-6 py-4">E-mail</th>
                      <th className="px-6 py-4">Turma Vinculada</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {professors.map(p => (
                      <tr key={p.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-6 font-black text-sm text-gray-900 dark:text-white">{p.name}</td>
                        <td className="px-6 py-6 text-sm text-gray-500">{p.email}</td>
                        <td className="px-6 py-6 text-sm font-bold text-primary">{p.className}</td>
                        <td className="px-6 py-6 text-right">
                          {p.status === 'invited' ? (
                            <button onClick={() => handleCancelInvite(p.id, p.name)} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase tracking-wider">Cancelar Convite</button>
                          ) : (
                            <button onClick={() => handleRemoveMember(p.id, p.name, 'teacher')} className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                              <span className="material-icons-outlined text-lg">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {professors.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">Nenhum professor cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          }
          {activeTab === 'ranking' && <RankingView showAllEntries={true} />}
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">Atividades</h3>
                <button
                  onClick={() => setIsAssignmentModalOpen(true)}
                  className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                  + Nova Atividade
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.map(assign => (
                  <div key={assign.id} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                        <span className="material-icons-outlined">assignment</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${assign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {assign.status === 'active' ? 'Ativo' : 'Expirado'}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{assign.title}</h4>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{assign.description || 'Sem descrição.'}</p>

                    <div className="pt-4 border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
                      <div className="text-xs font-bold text-gray-400">
                        {new Date(assign.due_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs font-bold text-primary">
                        {assign.className}
                      </div>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && (
                  <div className="col-span-full py-20 text-center text-gray-400 font-bold">
                    Nenhuma atividade criada.
                  </div>
                )}
              </div>
            </div>
          )}
          {
            activeTab === 'essays' && (
              <div className="space-y-4">
                {essays.length > 0 ? essays.map(essay => (
                  <div key={essay.id} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex justify-between items-center group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${essay.score >= 800 ? 'bg-green-500' : essay.score >= 600 ? 'bg-primary' : 'bg-amber-500'}`}>
                        {essay.score}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{essay.tema}</h4>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          {essay.student_name} • {new Date(essay.data_envio).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">
                      Ver Correção
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400">
                      <span className="material-icons-outlined text-2xl">assignment_late</span>
                    </div>
                    <p>Nenhuma redação corrigida encontrada no sistema.</p>
                  </div>
                )}
              </div>
            )
          }
          {
            activeTab === 'settings' && school && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white dark:bg-surface-dark p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5">
                  <div className="mb-8">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Configurações da Instituição</h3>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gerencie as informações públicas da sua escola.</p>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    // Melhoria na captura do valor do input
                    const form = e.target as HTMLFormElement;
                    const nameInput = (form.elements.namedItem('schoolName') as HTMLInputElement).value;
                    if (!nameInput) return;

                    setIsSettingsSaving(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session?.user?.id) {
                        await updateSchoolProfile(session.user.id, nameInput);
                        setSchool(prev => prev ? { ...prev, name: nameInput } : null);

                        setIsSettingsSuccess(true);
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }
                    } catch (err: any) {
                      alert("Erro ao atualizar: " + err.message);
                    } finally {
                      setIsSettingsSaving(false);
                    }
                  }} className="space-y-8">

                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-dashed border-primary/30">
                        <span className="material-icons-outlined text-4xl">domain</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Logo da Escola</p>
                        <p className="text-xs text-gray-400 mb-3">Recomendado: 400x400px</p>
                        <button type="button" disabled className="px-4 py-2 bg-gray-100 dark:bg-white/5 rounded-xl text-xs font-bold text-gray-400 cursor-not-allowed">
                          Alterar Foto (Em breve)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Oficial da Escola</label>
                      <input
                        name="schoolName"
                        defaultValue={school.name}
                        type="text"
                        className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-lg transition-all text-gray-900 dark:text-white"
                        placeholder="Ex: Colégio Scritta"
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-50 dark:border-white/5 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSettingsSaving || isSettingsSuccess}
                        className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${isSettingsSuccess
                          ? "bg-emerald-500 text-white shadow-emerald-500/20 scale-105"
                          : "bg-primary text-white shadow-primary/20 hover:scale-105 active:scale-95"
                          }`}
                      >
                        {isSettingsSaving ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : isSettingsSuccess ? (
                          <>
                            <span className="material-icons-outlined text-lg animate-bounce">check</span>
                            Salvo com Sucesso!
                          </>
                        ) : (
                          "Salvar Alterações"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* Modais (Classes, Professors, Students, Bulk Import) */}
      {/* O código dos modais permanece inalterado, pois estava correto na lógica de renderização */}

      {/* Modal Criar Turma */}
      {
        isClassModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsClassModalOpen(false)}
            ></div>
            <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10">
              <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Nova Turma</h3>
                <p className="text-gray-500 text-sm mt-1">Defina os detalhes da classe para organizar seus alunos.</p>
              </div>

              <form onSubmit={handleCreateClass} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome da Turma</label>
                  <input
                    type="text"
                    value={newClass.name}
                    onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                    placeholder="Ex: 3º Ano A - Ensino Médio"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Série/Ano</label>
                    <input
                      type="text"
                      value={newClass.grade}
                      onChange={e => setNewClass({ ...newClass, grade: e.target.value })}
                      placeholder="Ex: 3º Ano"
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Turno</label>
                    <select
                      value={newClass.shift}
                      onChange={e => setNewClass({ ...newClass, shift: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all appearance-none"
                    >
                      <option value="Matutino">Matutino</option>
                      <option value="Vespertino">Vespertino</option>
                      <option value="Noturno">Noturno</option>
                      <option value="Integral">Integral</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsClassModalOpen(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingClass}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSavingClass ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Criar Turma"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal Adicionar Professor */}
      {
        isProfessorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsProfessorModalOpen(false)}
            ></div>
            <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10">
              <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Novo Docente</h3>
                <p className="text-gray-500 text-sm mt-1">Cadastre um professor e vincule-o a uma turma para iniciar.</p>
              </div>

              <form onSubmit={handleCreateProfessor} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={newProfessor.name}
                    onChange={e => setNewProfessor({ ...newProfessor, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail Profissional</label>
                  <input
                    type="email"
                    value={newProfessor.email}
                    onChange={e => setNewProfessor({ ...newProfessor, email: e.target.value })}
                    placeholder="Ex: professor@escola.com"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vincular Turma</label>
                  <select
                    value={newProfessor.class_id}
                    onChange={e => setNewProfessor({ ...newProfessor, class_id: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all appearance-none"
                    required
                  >
                    <option value="">Selecione uma turma...</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name} ({cls.shift})</option>
                    ))}
                  </select>
                  {classes.length === 0 && (
                    <p className="text-xs text-rose-500 font-bold mt-1">Você precisa criar uma turma antes de adicionar professores.</p>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsProfessorModalOpen(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfessor || classes.length === 0}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSavingProfessor ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Cadastrar"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal Adicionar Aluno */}
      {
        isStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsStudentModalOpen(false)}
            ></div>
            <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10">
              <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Nova Matrícula</h3>
                <p className="text-gray-500 text-sm mt-1">Cadastre um aluno e vincule-o a uma turma ativa.</p>
              </div>

              <form onSubmit={handleCreateStudent} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={newStudent.name}
                    onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="Ex: Maria Oliveira"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail do Aluno</label>
                  <input
                    type="email"
                    value={newStudent.email}
                    onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="Ex: aluno@escola.com"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nº Matrícula (Opcional)</label>
                  <input
                    type="text"
                    value={newStudent.registration_number}
                    onChange={e => setNewStudent({ ...newStudent, registration_number: e.target.value })}
                    placeholder="Ex: 20240015"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vincular Turma</label>
                  <select
                    value={newStudent.class_id}
                    onChange={e => setNewStudent({ ...newStudent, class_id: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all appearance-none"
                    required
                  >
                    <option value="">Selecione uma turma...</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name} ({cls.shift})</option>
                    ))}
                  </select>
                  {classes.length === 0 && (
                    <p className="text-xs text-rose-500 font-bold mt-1">Necessário criar turma antes de matricular alunos.</p>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsStudentModalOpen(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingStudent || classes.length === 0}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSavingStudent ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Matricular"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal Importar CSV */}
      {
        isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsBulkModalOpen(false)}
            ></div>
            <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10">
              <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Importação em Massa</h3>
                <p className="text-gray-500 text-sm mt-1">Cadastre múltiplos alunos de uma vez via arquivo CSV.</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-blue-700 dark:text-blue-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <span className="material-icons-outlined text-sm">info</span> Formato Obrigatório
                    </h4>
                    <button
                      onClick={handleDownloadTemplate}
                      className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-white dark:bg-blue-900/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-xs">download</span> Baixar Modelo
                    </button>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">O arquivo deve conter cabeçalho e as colunas nesta ordem:</p>
                  <code className="block bg-white dark:bg-black/20 p-2 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
                    Nome, Email, Nome da Turma, Matricula (opcional)
                  </code>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">Ex: Ana Silva, ana@email.com, 3º Ano A, 202401</p>
                </div>

                <div
                  className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-slate-800 transition-all group"
                  onClick={() => !bulkProcessing && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    disabled={bulkProcessing}
                  />

                  {bulkFile ? (
                    <div className="flex flex-col items-center">
                      <span className="material-icons-outlined text-4xl text-emerald-500 mb-2">description</span>
                      <p className="font-bold text-gray-900 dark:text-white">{bulkFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">Clique para trocar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="material-icons-outlined text-4xl text-gray-300 group-hover:text-primary mb-2 transition-colors">upload_file</span>
                      <p className="font-bold text-gray-600 dark:text-gray-300">Clique para selecionar arquivo</p>
                      <p className="text-xs text-gray-400 mt-1">Suporta apenas .csv</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={bulkProcessing || !bulkFile}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {bulkProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Processar Arquivo"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Nova Atividade */}
      {
        isAssignmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => {
                setIsAssignmentModalOpen(false);
                setGeneratedTheme(null);
                setThemePrompt('');
              }}
            ></div>
            <div className="relative bg-white dark:bg-surface-dark w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10 my-8">
              <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Nova Atividade</h3>
                <p className="text-gray-500 text-sm mt-1">Crie uma atividade com tema gerado por IA para sua turma.</p>
              </div>

              <form onSubmit={handleCreateAssignment} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Campos Básicos */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Título da Atividade</label>
                  <input
                    type="text"
                    value={newAssignment.title}
                    onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
                    placeholder="Ex: Redação sobre Tecnologia e Sociedade"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descrição (Opcional)</label>
                  <textarea
                    value={newAssignment.description}
                    onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })}
                    placeholder="Instruções adicionais para os alunos..."
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Turma</label>
                    <select
                      value={newAssignment.class_id}
                      onChange={e => setNewAssignment({ ...newAssignment, class_id: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all appearance-none"
                      required
                    >
                      <option value="">Selecione uma turma...</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name} ({cls.shift})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data de Entrega</label>
                    <input
                      type="date"
                      value={newAssignment.due_date}
                      onChange={e => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-white/10 outline-none font-bold text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Seção de Geração de Tema com IA */}
                <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                  <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 p-6 rounded-2xl border border-primary/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-icons-outlined text-primary">auto_awesome</span>
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 dark:text-white">Gerar Tema com IA</h4>
                        <p className="text-xs text-gray-500">Crie um tema ENEM completo com 2 textos base</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={themePrompt}
                        onChange={e => setThemePrompt(e.target.value)}
                        placeholder="Ex: Impactos da inteligência artificial no mercado de trabalho"
                        className="w-full px-5 py-4 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 focus:border-primary/30 outline-none font-bold text-sm transition-all"
                        disabled={isGeneratingTheme}
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateTheme}
                          disabled={isGeneratingTheme || !themePrompt.trim()}
                          className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isGeneratingTheme ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Gerando...
                            </>
                          ) : (
                            <>
                              <span className="material-icons-outlined text-lg">auto_awesome</span>
                              Gerar Tema
                            </>
                          )}
                        </button>

                        {generatedTheme && (
                          <button
                            type="button"
                            onClick={handleGenerateTheme}
                            disabled={isGeneratingTheme}
                            className="px-4 py-3 rounded-xl font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50"
                            title="Regenerar Tema"
                          >
                            <span className="material-icons-outlined">refresh</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview do Tema Gerado */}
                    {generatedTheme && (
                      <div className="mt-6 space-y-4 animate-fade-in">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <span className="material-icons-outlined text-lg">check_circle</span>
                          <span className="text-xs font-black uppercase tracking-wider">Tema Gerado com Sucesso</span>
                        </div>

                        <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-gray-200 dark:border-white/10">
                          <h5 className="font-black text-gray-900 dark:text-white mb-4 text-lg">{generatedTheme.title}</h5>

                          <div className="space-y-3">
                            {generatedTheme.supportTexts?.map((text: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <span className="material-icons-outlined text-primary text-xl">{text.icon}</span>
                                  <div className="flex-1">
                                    <h6 className="font-bold text-sm text-gray-900 dark:text-white mb-1">{text.title}</h6>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{text.content}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssignmentModalOpen(false);
                      setGeneratedTheme(null);
                      setThemePrompt('');
                    }}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAssignment || classes.length === 0}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSavingAssignment ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Criar Atividade"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default InstitutionDashboard;