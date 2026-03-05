export interface Team {
  id: string;
  name: string;
}

export interface Aggregate {
  id: string;
  teamId: string;
  date: string;
  stressUrgencyScore: number;
  hostilityScore: number;
  offHoursRate: number;
  moodIndexNeg: number;
  cognitiveLoadScore: number;
  replyAnxietyScore: number;
  messageCount: number;
  moodState: 'Sereno' | 'Teso' | 'Critico';
}

export interface Alert {
  id: string;
  teamId: string;
  timestamp: string;
  severity: 'LOW' | 'MED' | 'HIGH';
  kpi: string;
  message: string;
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}
