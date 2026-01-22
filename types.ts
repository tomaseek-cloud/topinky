
export type UserRole = 'admin' | 'leader' | 'user';

export type ActivityStatus = 'none' | 'working' | 'done' | 'signed';

export interface Activity {
  id: string;
  title: string;
  description: string;
  isMandatory: boolean;
  pointsValue: number;
  originalPage?: number;
}

export interface Subcategory {
  title: string;
  requiredOptionalCount: number;
  activities: Activity[];
}

export interface Area {
  id: string;
  title: string;
  icon: string;
  subcategories: Subcategory[];
}

export interface TrailLevel {
  id: string;
  name: string;
  color: string;
  icon: string;
  areas: Area[];
}

export interface Article {
  id: string;
  scoutId: string;
  scoutNickname: string;
  content: string;
  timestamp: string;
}

export interface AdminProfile {
  nickname: string;
  avatar: string;
}

export interface Scout {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  role: UserRole; // Nová vlastnost pro role
  pointsByLevel: Record<string, number>; 
  activitiesProgress: Record<string, ActivityStatus>;
  activityCompletionDates: Record<string, string>; 
  completedActivities: string[];
  isProfileLocked?: boolean;
  password?: string;
  mustChangePassword?: boolean;
  unlockedLevels?: string[]; 
}

export interface Bonus {
  id: string;
  scoutId: string;
  points: number;
  reason: string;
  date: string;
  meetingId?: string;
  levelId: string; 
}

export interface PendingPhoto {
  url: string;
  scoutNickname: string;
  timestamp: string;
}

export interface Meeting {
  id: string;
  title?: string;
  date: string;
  notes: string;
  attendance?: Record<string, AttendanceStatus>;
  photos?: string[];
  albumUrl?: string;
  teams?: MeetingTeam[];
  pendingPhotos?: PendingPhoto[]; 
  articles?: Article[]; 
}

export interface ScoringConfig {
  mandatoryTask: number;
  optionalTask: number;
  attendancePresent: number;
  attendanceLate: number;
  attendanceExcused: number;
}

export interface AppSettings {
  leaderSecret: string;
  meetings: Meeting[];
  mandatoryPoints: number; 
  optionalPoints: number;  
  scoring: ScoringConfig;
  pdfUrl: string;
  pageTaskGoals?: Record<number, number>;
  bonuses: Bonus[];
  flappyScores: FlappyScore[];
  playTimes: DailyPlayTime[];
  activeLevelId: string;
  showTotalLeaderboard?: boolean;
  adminProfile?: AdminProfile; 
}

export interface FlappyScore {
  nickname: string;
  score: number;
  date: string;
}

export interface DailyPlayTime {
  scoutId: string;
  date: string;
  seconds: number;
}

export interface GameResult {
  scoutId: string;
  pointsGained: number;
  rank?: number;
  teamId?: string;
}

export interface GameTeam {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  name: string;
  meetingId: string;
  gameType: 'individual' | 'team';
  teams?: GameTeam[];
  results: GameResult[];
  levelId: string; 
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface MeetingTeam {
  name: string;
  members: string[]; 
}
