
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getClassesBySchool, updateUserProfile } from '../services/databaseService';
import { ClassGroup } from '../types';

interface ProfileViewProps {
  user?: any;
  onManageSubscription?: () => void;
  currentRole?: 'student' | 'teacher' | 'school_admin';
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Milo',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Bella',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Leo',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Lilly',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Sam',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Zack',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Luna',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Daisy',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Max'
];

const ProfileView: React.FC<ProfileViewProps> = ({ user, onManageSubscription, currentRole }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Avatar Selection State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [photoUrl, setPhotoUrl] = useState(user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=8B5CF6&color=fff`);
  const [schoolName, setSchoolName] = useState(user?.user_metadata?.school || "Não vinculada");

  const userType = currentRole || user?.user_metadata?.user_type;
  const isInstitution = userType === 'school_admin' || userType === 'institution';
  const isProfessor = userType === 'teacher' || userType === 'professor';
  const schoolId = user?.user_metadata?.school_id || null;
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    if (schoolId && (isInstitution || isProfessor)) {
      loadClasses();
    }
  }, [schoolId]);

  const loadClasses = async () => {
    if (schoolId) {
      const data = await getClassesBySchool(schoolId);
      setClasses(data);
    }
  };

  const handleEdit = () => setIsEditing(true);

  const handleCancel = () => {
    setFullName(user?.user_metadata?.full_name || "");
    setPhotoUrl(user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=8B5CF6&color=fff`);
    setSchoolName(user?.user_metadata?.school || "Não vinculada");
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      // Atualizar Perfil no Banco e na Sessão
      await updateUserProfile(user.id, {
        full_name: fullName,
        school_name: schoolName,
        avatar_url: photoUrl
      });

      setIsSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      const msg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      console.error(error);
      alert("Erro ao salvar perfil: " + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const getUserLabel = () => {
    if (isInstitution) return "Administrador Escolar";
    if (isProfessor) return "Professor(a)";
    return "Estudante";
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20 px-4">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">Meu Perfil</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Configurações da sua conta {getUserLabel().toLowerCase()}.</p>
        </div>
        {!isEditing ? (
          <div className="flex gap-3">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95"
            >
              <span className="material-icons-outlined text-[20px]">edit</span> Editar Perfil
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={handleCancel} className="px-6 py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors">Cancelar</button>
            <button
              disabled={isSaving || isSuccess}
              onClick={handleSaveProfile}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-80 disabled:cursor-not-allowed ${isSuccess
                ? "bg-emerald-500 text-white shadow-emerald-500/30 scale-105"
                : "bg-primary text-white shadow-primary/30 hover:bg-primary-dark active:scale-95"
                }`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : isSuccess ? (
                <>
                  <span className="material-icons-outlined animate-bounce">check</span>
                  Perfil salvo com sucesso!
                </>
              ) : (
                "Salvar Alterações"
              )}
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-blue-400 shadow-xl relative group">
                <img src={photoUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-white dark:border-surface-dark bg-white" />
                {isEditing && (
                  <button
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <span className="material-icons-outlined text-3xl">collections</span>
                  </button>
                )}
              </div>
              {isEditing && <p className="text-xs text-primary font-bold mt-2 cursor-pointer hover:underline" onClick={() => setIsAvatarModalOpen(true)}>Alterar foto</p>}
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white truncate w-full">{fullName || "Sem Nome"}</h2>
            <p className="text-gray-400 text-sm font-bold truncate w-full mb-6">{user?.email}</p>
            <div className="w-full pt-6 border-t border-gray-50 dark:border-slate-800">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Função Ativa</span>
              <span className="px-4 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                {getUserLabel()}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="material-icons-outlined text-primary">badge</span>
              Informações Pessoais
            </h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!isEditing} className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border-none outline-none font-bold text-sm focus:ring-2 focus:ring-primary/10 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Instituição Vinculada</label>
                <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 font-bold text-sm text-gray-900 dark:text-white ${isEditing && isInstitution ? 'ring-2 ring-primary/20' : ''}`}>
                  <span className="material-icons-outlined text-primary text-xl">domain</span>
                  {isEditing && isInstitution ? (
                    <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="bg-transparent border-none outline-none w-full p-0 font-bold" />
                  ) : (
                    <span>{schoolName}</span>
                  )}
                </div>
                {(isProfessor || !isInstitution) && <p className="text-[9px] text-gray-400 mt-1 italic">* O vínculo institucional é gerido pela conta mestre da escola.</p>}
              </div>
            </div>
          </div>

          {(isInstitution || isProfessor) && (
            <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-icons-outlined text-primary">groups</span>
                Minhas Turmas Ativas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map(cls => (
                  <div key={cls.id} className="p-4 border border-gray-50 dark:border-slate-800 rounded-2xl bg-gray-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 transition-all">
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{cls.name}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{cls.grade}</p>
                  </div>
                ))}
                {classes.length === 0 && (
                  <div className="col-span-full py-8 text-center text-gray-400 font-bold italic bg-gray-50 dark:bg-slate-900/30 rounded-2xl">
                    Nenhuma turma registrada neste vínculo ainda.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAvatarModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-white/10">
            <div className="p-8 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Escolha seu Avatar</h3>
              <p className="text-gray-500 text-sm mt-1">Selecione uma imagem para personalizar seu perfil.</p>
            </div>
            <div className="p-8 grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
              {AVATAR_OPTIONS.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setPhotoUrl(avatar);
                    setIsAvatarModalOpen(false);
                  }}
                  className={`relative aspect-square rounded-2xl overflow-hidden group border-2 transition-all ${photoUrl === avatar
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                    }`}
                >
                  <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover bg-gray-50 dark:bg-slate-800" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  {photoUrl === avatar && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white">
                      <span className="material-icons-outlined text-xs font-bold">check</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-6 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
