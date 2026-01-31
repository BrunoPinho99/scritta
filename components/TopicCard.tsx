
import React from 'react';
import { Topic } from '../types';

interface TopicCardProps {
  topic: Topic;
  onRefresh: () => void;
  isLoading: boolean;
  onWrite: () => void;
  onUpload: () => void;
}

const TopicCard: React.FC<TopicCardProps> = ({ topic, onRefresh, isLoading, onWrite, onUpload }) => {
  return (
    <div className="relative group perspective">

      <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-premium border border-gray-100 dark:border-white/5 overflow-hidden transition-all duration-500">

        {/* Barra de Loading Sutil */}
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-white/5 overflow-hidden z-30">
            <div className="h-full bg-primary animate-shimmer w-1/3 absolute top-0" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
          </div>
        )}

        <div className="p-6 md:p-8 flex flex-col items-center text-center relative z-20">

          {/* Badge Flutuante */}
          <div className="mb-6 animate-float">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg shadow-purple-500/10 border border-purple-100 dark:border-purple-900/30 text-primary hover:bg-primary hover:text-white transition-all duration-300 group/badge"
            >
              <span className={`material-icons-outlined text-sm transition-transform duration-700 ${isLoading ? 'animate-spin' : 'group-hover/badge:rotate-180'}`}>autorenew</span>
              <span className="text-[11px] font-black uppercase tracking-widest">Gerar Novo Tema</span>
            </button>
          </div>

          {/* Título Hero */}
          <h2 className={`max-w-4xl text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-[1.1] mb-6 tracking-tight transition-all duration-500 ${isLoading ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
            {topic.title}
          </h2>

          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full mb-8"></div>

          {/* Seção de Apoio - Cards Modernos */}
          <div className="w-full max-w-4xl mb-8">
            <div className="flex items-center justify-center gap-3 mb-6 opacity-60">
              <div className="h-px w-12 bg-gray-300 dark:bg-slate-700"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Contexto & Apoio</span>
              <div className="h-px w-12 bg-gray-300 dark:bg-slate-700"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {topic.supportTexts.slice(0, 2).map((text) => (
                <div key={text.id} className="text-left bg-gray-50/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary/20 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 group/card cursor-default">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-primary group-hover/card:bg-primary group-hover/card:text-white transition-colors">
                      <span className="material-icons-outlined text-base">{text.icon === 'article' ? 'description' : text.icon}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{text.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 pl-9">
                    {text.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Principais (CTAs) */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button
              onClick={onWrite}
              disabled={isLoading}
              className="group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="material-icons-outlined text-xl group-hover:rotate-12 transition-transform">edit_note</span>
              <span>Escrever Redação</span>
            </button>

            <button
              onClick={onUpload}
              disabled={isLoading}
              className="px-6 py-3 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-white/10 text-slate-700 dark:text-white rounded-xl font-black text-xs transition-all hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined text-lg">add_a_photo</span>
              <span>Enviar Foto</span>
            </button>
          </div>
        </div>

        {/* Efeito de Fundo Sutil */}
        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-gray-50/50 dark:from-slate-800/50 to-transparent pointer-events-none z-0"></div>
      </div>
    </div>
  );
};

export default TopicCard;
