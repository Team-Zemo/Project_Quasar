import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';

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

  const getPersonaIcon = (id: string) => {
    switch (id) {
      case 'faang_engineer': return '🏢';
      case 'startup_founder': return '🚀';
      case 'hr_manager': return '🤝';
      case 'hostile_panel': return '⚡';
      default: return '🎯';
    }
  };

  if (loading) {
    return (
      <div className="persona-selector">
        <h3 className="persona-selector__title">Choose Your Interviewer</h3>
        <div className="persona-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="persona-card persona-card--skeleton">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="persona-selector">
      <h3 className="persona-selector__title">Choose Your Interviewer</h3>
      <p className="persona-selector__subtitle">Each persona brings a unique interview style</p>
      <div className="persona-grid">
        {personas.map(persona => (
          <button
            key={persona.id}
            id={`persona-${persona.id}`}
            className={`persona-card ${selectedPersona === persona.id ? 'persona-card--selected' : ''}`}
            onClick={() => onSelect(persona.id)}
          >
            <div className="persona-card__icon">{getPersonaIcon(persona.id)}</div>
            <h4 className="persona-card__name">{persona.name}</h4>
            <p className="persona-card__desc">{persona.description}</p>
            <div className="persona-card__aggression">
              <span className="persona-card__aggression-label">Intensity</span>
              <div className="aggression-dots">
                {[1, 2, 3, 4, 5].map(level => (
                  <span
                    key={level}
                    className={`aggression-dot ${level <= persona.follow_up_aggression ? 'aggression-dot--active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
