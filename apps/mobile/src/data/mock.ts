import type { User, Festival, Tournament, Country, Organizer, BlindStructure, BlindLevel } from '../types';

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Martin',
  createdAt: '2024-01-15T00:00:00Z',
  settings: {
    language: 'fr',
    notifications: true,
    theme: 'light',
  },
};

export const mockCountries: Country[] = [
  { id: 'co1', name: 'France',         code: 'FR', continent: 'Europe' },
  { id: 'co2', name: 'Spain',          code: 'ES', continent: 'Europe' },
  { id: 'co3', name: 'Monaco',         code: 'MC', continent: 'Europe' },
  { id: 'co4', name: 'Czech Republic', code: 'CZ', continent: 'Europe' },
  { id: 'co5', name: 'Malta',          code: 'MT', continent: 'Europe' },
  { id: 'co6', name: 'United Kingdom', code: 'GB', continent: 'Europe' },
  { id: 'co7', name: 'Italy',          code: 'IT', continent: 'Europe' },
  { id: 'co8', name: 'Belgium',        code: 'BE', continent: 'Europe' },
  { id: 'co9', name: 'United States',  code: 'US', continent: 'North America' },
  { id: 'co10', name: 'Brazil',        code: 'BR', continent: 'South America' },
];

export const mockOrganizers: Organizer[] = [
  { id: 'or1', name: 'Barrière',    logo: 'barriere'   },
  { id: 'or2', name: 'Winamax',     logo: 'winamax'    },
  { id: 'or3', name: 'PokerStars',  logo: 'pokerstars' },
  { id: 'or4', name: 'WPT',         logo: 'wpt'        },
  { id: 'or5', name: 'SBM',         logo: 'sbm'        },
  { id: 'or6', name: 'Independent' },
  { id: 'or7', name: 'WSOP',        logo: 'wsop'       },
  { id: 'or8', name: 'GGPoker',     logo: 'ggpoker'    },
  { id: 'or9', name: 'BSOP',        logo: 'bsop'       },
];

export const mockFestivals: Festival[] = [
  // France
  { id: 'f1',  name: 'Casino de Paris',          location: 'Paris',     countryId: 'co1', organizerId: 'or6', startDate: '2026-06-25', endDate: '2026-07-06' },
  { id: 'f2',  name: 'Cercle Clichy Montmartre', location: 'Paris',     countryId: 'co1', organizerId: 'or6', startDate: '2026-07-15', endDate: '2026-07-21' },
  { id: 'f3',  name: 'Casino Barrière Paris',    location: 'Paris',     countryId: 'co1', organizerId: 'or1', startDate: '2026-07-18', endDate: '2026-07-28' },
  { id: 'f5',  name: 'SHRPO',                    location: 'Cannes',    countryId: 'co1', organizerId: 'or2', startDate: '2026-08-01', endDate: '2026-08-10' },
  { id: 'f6',  name: 'WPTDeepStacks',            location: 'Deauville', countryId: 'co1', organizerId: 'or4', startDate: '2026-08-15', endDate: '2026-08-24' },
  { id: 'f8',  name: 'Aviation Club de France',  location: 'Paris',     countryId: 'co1', organizerId: 'or6', startDate: '2026-07-05', endDate: '2026-07-09' },
  { id: 'f9',  name: 'Casino de Lyon',           location: 'Lyon',      countryId: 'co1', organizerId: 'or2', startDate: '2026-09-01', endDate: '2026-09-07' },
  // Monaco
  { id: 'f7',  name: 'Casino de Monte-Carlo',    location: 'Monaco',    countryId: 'co3', organizerId: 'or5', startDate: '2026-09-15', endDate: '2026-09-25' },
  // Espagne
  { id: 'f4',  name: 'EPT Barcelone',            location: 'Barcelona', countryId: 'co2', organizerId: 'or3', startDate: '2026-08-20', endDate: '2026-08-30' },
  { id: 'f10', name: 'WPT Spain',                location: 'Madrid',    countryId: 'co2', organizerId: 'or4', startDate: '2026-07-10', endDate: '2026-07-18', featured: true },
  // République Tchèque
  { id: 'f11', name: 'EPT Prague',               location: 'Prague',    countryId: 'co4', organizerId: 'or3', startDate: '2026-10-01', endDate: '2026-10-12' },
  // Malte
  { id: 'f12', name: 'EPT Malta',                location: 'Valletta',  countryId: 'co5', organizerId: 'or3', startDate: '2026-11-01', endDate: '2026-11-10' },
  { id: 'f13', name: 'GGPoker Series Malta',     location: 'Valletta',  countryId: 'co5', organizerId: 'or8', startDate: '2026-11-15', endDate: '2026-11-22' },
  // Royaume-Uni
  { id: 'f14', name: 'WSOP Circuit London',      location: 'London',    countryId: 'co6', organizerId: 'or7', startDate: '2026-10-15', endDate: '2026-10-25' },
  { id: 'f15', name: 'GGPoker UK Open',          location: 'London',    countryId: 'co6', organizerId: 'or8', startDate: '2026-12-01', endDate: '2026-12-08' },
  // Italie
  { id: 'f16', name: 'EPT Rome',                 location: 'Rome',      countryId: 'co7', organizerId: 'or3', startDate: '2027-01-10', endDate: '2027-01-20' },
  { id: 'f17', name: 'WPT Italy',                location: 'Venice',    countryId: 'co7', organizerId: 'or4', startDate: '2027-02-01', endDate: '2027-02-08' },
  // Belgique
  { id: 'f18', name: 'WSOP Circuit Brussels',    location: 'Brussels',  countryId: 'co8', organizerId: 'or7', startDate: '2027-03-01', endDate: '2027-03-10' },
  // États-Unis
  { id: 'f19', name: 'WSOP Las Vegas',           location: 'Las Vegas', countryId: 'co9', organizerId: 'or7', startDate: '2026-09-27', endDate: '2026-10-15' },
  // Brésil
  { id: 'f20', name: 'BSOP São Paulo',           location: 'São Paulo', countryId: 'co10', organizerId: 'or9', startDate: '2027-04-01', endDate: '2027-04-12' },
];

// Generates a plausible, non-hand-authored blind structure scaled to a tournament's buy-in.
// Not meant to be a precise real-world structure — just realistic-looking mock data.
const CHIP_STEPS = [
  25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500,
  3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000, 40000, 50000,
];

function roundToChip(value: number): number {
  for (const step of CHIP_STEPS) {
    if (value <= step) return step;
  }
  return Math.round(value / 1000) * 1000;
}

function buildBlindStructure(buyIn: number): BlindStructure {
  const scale = Math.max(1, buyIn / 500);
  const startingStack = Math.max(20000, Math.round((buyIn * 4) / 1000) * 1000);
  const levelCount = 20;
  const levels: BlindLevel[] = [];

  for (let level = 1; level <= levelCount; level++) {
    const growth = Math.pow(1.25, level - 1);
    const smallBlind = roundToChip(25 * scale * growth);
    const bigBlind = smallBlind * 2;
    const ante = level >= 5 ? roundToChip(bigBlind / 2) : 0;
    const durationMinutes = level <= 6 ? 20 : level <= 12 ? 30 : 40;
    levels.push({ level, smallBlind, bigBlind, ante, durationMinutes });
  }

  return { startingStack, levelDurationMinutes: 20, levels };
}

// Hand-authored showcase structure for the WSOP Las Vegas Main Event.
const WSOP_MAIN_EVENT_STRUCTURE: BlindStructure = {
  startingStack: 60000,
  levelDurationMinutes: 60,
  levels: [
    { level: 1,  smallBlind: 100,   bigBlind: 100,   ante: 100,   durationMinutes: 60 },
    { level: 2,  smallBlind: 100,   bigBlind: 200,   ante: 200,   durationMinutes: 60 },
    { level: 3,  smallBlind: 200,   bigBlind: 300,   ante: 300,   durationMinutes: 60 },
    { level: 4,  smallBlind: 200,   bigBlind: 400,   ante: 400,   durationMinutes: 60 },
    { level: 5,  smallBlind: 300,   bigBlind: 500,   ante: 500,   durationMinutes: 60 },
    { level: 6,  smallBlind: 400,   bigBlind: 800,   ante: 800,   durationMinutes: 60 },
    { level: 7,  smallBlind: 500,   bigBlind: 1000,  ante: 1000,  durationMinutes: 60 },
    { level: 8,  smallBlind: 600,   bigBlind: 1200,  ante: 1200,  durationMinutes: 60 },
    { level: 9,  smallBlind: 800,   bigBlind: 1600,  ante: 1600,  durationMinutes: 60 },
    { level: 10, smallBlind: 1000,  bigBlind: 2000,  ante: 2000,  durationMinutes: 60 },
    { level: 11, smallBlind: 1500,  bigBlind: 3000,  ante: 3000,  durationMinutes: 60 },
    { level: 12, smallBlind: 2000,  bigBlind: 4000,  ante: 4000,  durationMinutes: 60 },
    { level: 13, smallBlind: 3000,  bigBlind: 5000,  ante: 5000,  durationMinutes: 60 },
    { level: 14, smallBlind: 4000,  bigBlind: 8000,  ante: 8000,  durationMinutes: 60 },
    { level: 15, smallBlind: 5000,  bigBlind: 10000, ante: 10000, durationMinutes: 60 },
  ],
};

export const mockTournaments: Tournament[] = [
  // Casino de Paris
  { id: 't1',  festivalId: 'f1',  name: 'Sunday Special',      buyIn: 500,  totalPlayers: 150, startDate: '2026-06-28', endDate: '2026-07-02', isMainEvent: true, blindStructure: buildBlindStructure(500)   },
  { id: 't2',  festivalId: 'f1',  name: 'Big Bounty',          buyIn: 200,  totalPlayers: 290  },
  // Cercle Clichy
  { id: 't3',  festivalId: 'f2',  name: 'Big Stack',           buyIn: 300,  totalPlayers: 98   },
  { id: 't4',  festivalId: 'f2',  name: 'Sunday Deepstack',    buyIn: 300,  totalPlayers: 112, isMainEvent: true, blindStructure: buildBlindStructure(300)   },
  // Casino Barrière Paris
  { id: 't5',  festivalId: 'f3',  name: 'Warm-Up',             buyIn: 200,  totalPlayers: 212, startDate: '2026-07-20', endDate: '2026-07-22' },
  { id: 't6',  festivalId: 'f3',  name: 'Saturday Festival',   buyIn: 500,  totalPlayers: 175, isMainEvent: true, blindStructure: buildBlindStructure(500)   },
  { id: 't7',  festivalId: 'f3',  name: 'Marathon',            buyIn: 300,  totalPlayers: 320  },
  // SHRPO Cannes
  { id: 't9',  festivalId: 'f5',  name: 'High Roller',         buyIn: 3000, totalPlayers: 210  },
  { id: 't20', festivalId: 'f5',  name: 'Main Event',          buyIn: 1100, totalPlayers: 680, isMainEvent: true, blindStructure: buildBlindStructure(1100)  },
  // WPTDeepStacks Deauville
  { id: 't10', festivalId: 'f6',  name: 'Main',                buyIn: 500,  totalPlayers: 430, isMainEvent: true, blindStructure: buildBlindStructure(500)   },
  { id: 't21', festivalId: 'f6',  name: 'High Roller',         buyIn: 2200, totalPlayers: 95   },
  // Aviation Club
  { id: 't22', festivalId: 'f8',  name: 'Classic',             buyIn: 400,  totalPlayers: 140, startDate: '2026-07-08', isMainEvent: true, blindStructure: buildBlindStructure(400) },
  // Casino de Lyon
  { id: 't12', festivalId: 'f9',  name: 'Main Event',          buyIn: 1500, totalPlayers: 620, isMainEvent: true, blindStructure: buildBlindStructure(1500)  },
  // Monte-Carlo
  { id: 't11', festivalId: 'f7',  name: 'Monte-Carlo Masters', buyIn: 1000, totalPlayers: 380, isMainEvent: true, blindStructure: buildBlindStructure(1000)  },
  { id: 't23', festivalId: 'f7',  name: 'High Roller',         buyIn: 5000, totalPlayers: 120  },
  // EPT Barcelone
  { id: 't8',  festivalId: 'f4',  name: 'Main Event',          buyIn: 5300, totalPlayers: 1840, isMainEvent: true, blindStructure: buildBlindStructure(5300) },
  { id: 't13', festivalId: 'f4',  name: 'High Roller',         buyIn: 10000,totalPlayers: 230  },
  { id: 't14', festivalId: 'f4',  name: 'Warm-Up',             buyIn: 1100, totalPlayers: 940  },
  // WPT Spain
  { id: 't24', festivalId: 'f10', name: 'Main Event',          buyIn: 1650, totalPlayers: 510, isMainEvent: true, blindStructure: buildBlindStructure(1650)  },
  { id: 't25', festivalId: 'f10', name: 'Bounty',              buyIn: 550,  totalPlayers: 390, startDate: '2026-07-12', guaranteed: 15000 },
  // EPT Prague
  { id: 't15', festivalId: 'f11', name: 'Main Event',          buyIn: 5300, totalPlayers: 2150, isMainEvent: true, blindStructure: buildBlindStructure(5300) },
  { id: 't16', festivalId: 'f11', name: 'High Roller',         buyIn: 10000,totalPlayers: 195  },
  { id: 't26', festivalId: 'f11', name: 'Warm-Up',             buyIn: 1100, totalPlayers: 1020 },
  // EPT Malta
  { id: 't17', festivalId: 'f12', name: 'Main Event',          buyIn: 5300, totalPlayers: 1640, isMainEvent: true, blindStructure: buildBlindStructure(5300) },
  { id: 't18', festivalId: 'f12', name: 'High Roller',         buyIn: 25000,totalPlayers: 80   },
  { id: 't27', festivalId: 'f12', name: 'National',            buyIn: 1100, totalPlayers: 870  },
  // GGPoker Malta
  { id: 't28', festivalId: 'f13', name: 'Main Event',          buyIn: 2200, totalPlayers: 720, isMainEvent: true, blindStructure: buildBlindStructure(2200)  },
  { id: 't29', festivalId: 'f13', name: 'Super High Roller',   buyIn: 10000,totalPlayers: 110  },
  // WSOP London
  { id: 't19', festivalId: 'f14', name: 'Main Event',          buyIn: 1650, totalPlayers: 890, isMainEvent: true, blindStructure: buildBlindStructure(1650)  },
  { id: 't30', festivalId: 'f14', name: 'High Roller',         buyIn: 5000, totalPlayers: 160  },
  { id: 't31', festivalId: 'f14', name: 'Colossus',            buyIn: 400,  totalPlayers: 1200 },
  // GGPoker UK
  { id: 't32', festivalId: 'f15', name: 'Main Event',          buyIn: 1100, totalPlayers: 640, isMainEvent: true, blindStructure: buildBlindStructure(1100)  },
  // EPT Rome
  { id: 't33', festivalId: 'f16', name: 'Main Event',          buyIn: 5300, totalPlayers: 1380, isMainEvent: true, blindStructure: buildBlindStructure(5300) },
  { id: 't34', festivalId: 'f16', name: 'High Roller',         buyIn: 10000,totalPlayers: 175  },
  { id: 't35', festivalId: 'f16', name: 'National',            buyIn: 1100, totalPlayers: 760  },
  // WPT Italy
  { id: 't36', festivalId: 'f17', name: 'Main Event',          buyIn: 3300, totalPlayers: 480, isMainEvent: true, blindStructure: buildBlindStructure(3300)  },
  { id: 't37', festivalId: 'f17', name: 'Warm-Up',             buyIn: 550,  totalPlayers: 310  },
  // WSOP Brussels
  { id: 't38', festivalId: 'f18', name: 'Main Event',          buyIn: 1700, totalPlayers: 540, isMainEvent: true, blindStructure: buildBlindStructure(1700)  },
  { id: 't39', festivalId: 'f18', name: 'High Roller',         buyIn: 5000, totalPlayers: 140  },
  // WSOP Las Vegas
  { id: 't40', festivalId: 'f19', name: 'Main Event',          buyIn: 10000, totalPlayers: 8500, startDate: '2026-10-05', endDate: '2026-10-12', guaranteed: 80000000, isMainEvent: true, blindStructure: WSOP_MAIN_EVENT_STRUCTURE },
  { id: 't41', festivalId: 'f19', name: 'Colossus',            buyIn: 400,  totalPlayers: 9200  },
  // BSOP São Paulo
  { id: 't42', festivalId: 'f20', name: 'Main Event',          buyIn: 3000, totalPlayers: 1200, isMainEvent: true, blindStructure: buildBlindStructure(3000) },
  { id: 't43', festivalId: 'f20', name: 'High Roller',         buyIn: 10000,totalPlayers: 210  },
];
