import { 
  Trophy, Zap, Target, TrendingUp, Dumbbell, CheckSquare, Star, Award, RefreshCw, 
  Flame, Rocket, MountainSnow, Map, Puzzle, Users, MicOff, Clock, Hourglass, 
  Crown, Sparkles, Moon, Sunrise, FileCheck, Bot 
} from 'lucide-react';

export function getBadgeLucideIcon(_iconStr: string, id: string, size = 28) {
  const iconProps = { size, strokeWidth: 1.5, className: "text-[var(--c-accent)] text-current" };
  switch (id) {
    case 'first_session': return <Target {...iconProps} />;
    case 'ten_sessions': return <TrendingUp {...iconProps} />;
    case 'fifty_sessions': return <Dumbbell {...iconProps} />;
    case 'century': return <Trophy {...iconProps} />;
    case 'first_pass': return <CheckSquare {...iconProps} />;
    case 'high_achiever': return <Star {...iconProps} />;
    case 'perfect_ten': return <Award {...iconProps} />;
    case 'comeback_kid': return <RefreshCw {...iconProps} />;
    case 'streak_3': return <Flame {...iconProps} />;
    case 'streak_7': return <Zap {...iconProps} />;
    case 'streak_14': return <Rocket {...iconProps} />;
    case 'streak_30': return <MountainSnow {...iconProps} />;
    case 'domain_explorer': return <Map {...iconProps} />;
    case 'polymath': return <Puzzle {...iconProps} />;
    case 'persona_collector': return <Users {...iconProps} />;
    case 'no_fillers': return <MicOff {...iconProps} />;
    case 'speed_demon': return <Clock {...iconProps} />;
    case 'slow_and_steady': return <Hourglass {...iconProps} />;
    case 'level_5': return <Star {...iconProps} />;
    case 'level_10': return <Crown {...iconProps} />;
    case 'xp_500': return <Sparkles {...iconProps} />;
    case 'night_owl': return <Moon {...iconProps} />;
    case 'early_bird': return <Sunrise {...iconProps} />;
    case 'resume_checker': return <FileCheck {...iconProps} />;
    case 'jd_parser': return <Bot {...iconProps} />;
    default: return <Award {...iconProps} />;
  }
}
