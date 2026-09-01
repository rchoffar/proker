export * from './hand';

export interface UserSettings {
  language: 'fr' | 'en';
  notifications: boolean;
  theme: 'light' | 'dark';
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  createdAt: string;
  settings: UserSettings;
}

// Compte serveur (apps/api), distinct de User qui reste le profil local (settings, thème).
export interface AuthUser {
  id: string;
  provider: 'google' | 'apple';
  email: string | null;
  pseudo: string | null;
}

export interface Player {
  id: string;
  name: string;
  notes?: string;
}

export type Continent = 'Europe' | 'North America' | 'South America' | 'Asia' | 'Africa' | 'Oceania';

export interface Country {
  id: string;
  name: string;
  code: string;
  continent: Continent;
}

export interface Organizer {
  id: string;
  name: string;
  logo?: string; // key into the OrganizerLogo asset lookup map
}

export interface Festival {
  id: string;
  name: string;
  location?: string;
  countryId?: string;
  organizerId?: string;
  startDate?: string; // ISO date, festival start
  endDate?: string; // ISO date, festival end
  featured?: boolean; // "Coup de cœur" pin
  /**
   * The organiser's own page. When set, the home card opens it instead of the in-app
   * festival detail — for a festival we do not have a tournament list for, the real site is
   * more use than an empty screen.
   */
  url?: string;
}

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface BlindStructure {
  startingStack: number;
  levelDurationMinutes: number; // typical/display duration (mode of levels' durationMinutes)
  levels: BlindLevel[];
}

export interface Tournament {
  id: string;
  festivalId: string;
  name: string;
  buyIn: number;
  totalPlayers?: number;
  startDate?: string; // ISO date, when known
  endDate?: string; // ISO date; omit for single-day tournaments
  guaranteed?: number; // guaranteed prize pool
  isMainEvent?: boolean; // flags the festival's main event
  blindStructure?: BlindStructure; // populated for main-event tournaments
}
