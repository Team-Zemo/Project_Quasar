import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { motion } from 'framer-motion';
import { Building2, Rocket, Users, Zap, Target } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  description: string;
  interruption_style: string;
  follow_up_aggression: number;
}

interface PersonaSelectorProps {
  selectedPersona: string | null;
  onSelect: (personaId: string) => void;
}

export function PersonaSelector({ selectedPersona, onSelect }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Persona[]>('/api/personas')
      .then(res => {
        if (res.success) setPersonas(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getPersonaIcon = (id: string, selected: boolean) => {
    const props = { 
      size: 28, 
      strokeWidth: 2, 
      className: `transition-all duration-300 ${selected ? 'text-white' : 'text-[var(--c-accent)]'}` 
    };
    switch (id) {
      case 'faang_engineer': return <Building2 {...props} />;
      case 'startup_founder': return <Rocket {...props} />;
      case 'hr_manager': return <Users {...props} />;
      case 'hostile_panel': return <Zap {...props} />;
      default: return <Target {...props} />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[800px] mx-auto py-8">
        <h3 className="text-[24px] font-black text-center text-[var(--c-text)] m-0 tracking-tight">Choose Your Interviewer</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-3 p-5 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-[var(--c-surface-2)] mb-2" />
              <div className="w-3/4 h-5 rounded bg-[var(--c-surface-2)]" />
              <div className="w-full h-12 rounded bg-[var(--c-surface-2)]" />
              <div className="w-1/2 h-4 rounded bg-[var(--c-surface-2)] mt-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-[900px] mx-auto py-8">
      <h3 className="text-[28px] font-black text-center text-[var(--c-text)] m-0 tracking-tight">Choose Your Interviewer</h3>
      <p className="text-[15px] text-center text-[var(--c-text-dim)] m-0 mb-8">Each persona brings a unique interview style and difficulty.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {personas.map(persona => {
          const isSelected = selectedPersona === persona.id;
          return (
            <motion.button
              key={persona.id}
              id={`persona-${persona.id}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex flex-col text-left p-5 rounded-[24px] border-2 transition-all duration-300 relative overflow-hidden group ${
                isSelected 
                  ? 'bg-[var(--c-accent)] border-[var(--c-accent)] shadow-[0_12px_32px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' 
                  : 'bg-[var(--c-surface)] border-[var(--c-border)] hover:border-[var(--c-accent-dim)] shadow-sm'
              }`}
              onClick={() => onSelect(persona.id)}
            >
              {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
              )}
              
              <div className={`flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-colors duration-300 ${
                isSelected ? 'bg-black/20' : 'bg-[var(--c-accent-dim)] group-hover:scale-110'
              }`}>
                {getPersonaIcon(persona.id, isSelected)}
              </div>
              
              <h4 className={`text-[18px] font-bold mb-2 tracking-tight transition-colors duration-300 ${isSelected ? 'text-white drop-shadow-sm' : 'text-[var(--c-text)]'}`}>
                {persona.name}
              </h4>
              
              <p className={`text-[13px] leading-relaxed mb-6 flex-1 transition-colors duration-300 ${isSelected ? 'text-white/90' : 'text-[var(--c-text-dim)]'}`}>
                {persona.description}
              </p>
              
              <div className={`flex items-center justify-between w-full pt-4 border-t transition-colors duration-300 ${isSelected ? 'border-white/20' : 'border-[var(--c-border)]'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${isSelected ? 'text-white/80' : 'text-[var(--c-text-mute)]'}`}>
                  Intensity
                </span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => {
                    const isActive = level <= persona.follow_up_aggression;
                    return (
                      <span
                        key={level}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          isActive 
                            ? (isSelected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-[var(--c-accent)] shadow-[0_0_6px_var(--c-accent-glow)]') 
                            : (isSelected ? 'bg-black/20' : 'bg-[var(--c-surface-3)]')
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
