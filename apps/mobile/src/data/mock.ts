import type { User, Festival, Tournament, Country, Organizer } from '../types';

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Martin',
  createdAt: '2024-01-15T00:00:00Z',
  settings: {
    language: 'fr',
    currency: 'EUR',
    notifications: true,
    theme: 'light',
  },
};

export const mockCountries: Country[] = [
  { id: 'co1', name: 'France',         code: 'FR' },
  { id: 'co2', name: 'Espagne',        code: 'ES' },
  { id: 'co3', name: 'Monaco',         code: 'MC' },
  { id: 'co4', name: 'République Tchèque', code: 'CZ' },
  { id: 'co5', name: 'Malte',          code: 'MT' },
  { id: 'co6', name: 'Royaume-Uni',    code: 'GB' },
  { id: 'co7', name: 'Italie',         code: 'IT' },
  { id: 'co8', name: 'Belgique',       code: 'BE' },
];

export const mockOrganizers: Organizer[] = [
  { id: 'or1', name: 'Barrière'    },
  { id: 'or2', name: 'Winamax'     },
  { id: 'or3', name: 'PokerStars'  },
  { id: 'or4', name: 'WPT'         },
  { id: 'or5', name: 'SBM'         },
  { id: 'or6', name: 'Independent' },
  { id: 'or7', name: 'WSOP'        },
  { id: 'or8', name: 'GGPoker'     },
];

export const mockFestivals: Festival[] = [
  // France
  { id: 'f1',  name: 'Casino de Paris',          location: 'Paris',     countryId: 'co1', organizerId: 'or6' },
  { id: 'f2',  name: 'Cercle Clichy Montmartre', location: 'Paris',     countryId: 'co1', organizerId: 'or6' },
  { id: 'f3',  name: 'Casino Barrière Paris',    location: 'Paris',     countryId: 'co1', organizerId: 'or1' },
  { id: 'f5',  name: 'SHRPO',                    location: 'Cannes',    countryId: 'co1', organizerId: 'or2' },
  { id: 'f6',  name: 'WPTDeepStacks',            location: 'Deauville', countryId: 'co1', organizerId: 'or4' },
  { id: 'f8',  name: 'Aviation Club de France',  location: 'Paris',     countryId: 'co1', organizerId: 'or6' },
  { id: 'f9',  name: 'Casino de Lyon',           location: 'Lyon',      countryId: 'co1', organizerId: 'or2' },
  // Monaco
  { id: 'f7',  name: 'Casino de Monte-Carlo',    location: 'Monaco',    countryId: 'co3', organizerId: 'or5' },
  // Espagne
  { id: 'f4',  name: 'EPT Barcelone',            location: 'Barcelone', countryId: 'co2', organizerId: 'or3' },
  { id: 'f10', name: 'WPT Spain',                location: 'Madrid',    countryId: 'co2', organizerId: 'or4' },
  // République Tchèque
  { id: 'f11', name: 'EPT Prague',               location: 'Prague',    countryId: 'co4', organizerId: 'or3' },
  // Malte
  { id: 'f12', name: 'EPT Malta',                location: 'La Valette',countryId: 'co5', organizerId: 'or3' },
  { id: 'f13', name: 'GGPoker Series Malta',     location: 'La Valette',countryId: 'co5', organizerId: 'or8' },
  // Royaume-Uni
  { id: 'f14', name: 'WSOP Circuit London',      location: 'Londres',   countryId: 'co6', organizerId: 'or7' },
  { id: 'f15', name: 'GGPoker UK Open',          location: 'Londres',   countryId: 'co6', organizerId: 'or8' },
  // Italie
  { id: 'f16', name: 'EPT Rome',                 location: 'Rome',      countryId: 'co7', organizerId: 'or3' },
  { id: 'f17', name: 'WPT Italy',                location: 'Venise',    countryId: 'co7', organizerId: 'or4' },
  // Belgique
  { id: 'f18', name: 'WSOP Circuit Brussels',    location: 'Bruxelles', countryId: 'co8', organizerId: 'or7' },
];

export const mockTournaments: Tournament[] = [
  // Casino de Paris
  { id: 't1',  festivalId: 'f1',  name: 'Sunday Special',      buyIn: 500,  totalPlayers: 150  },
  { id: 't2',  festivalId: 'f1',  name: 'Big Bounty',          buyIn: 200,  totalPlayers: 290  },
  // Cercle Clichy
  { id: 't3',  festivalId: 'f2',  name: 'Big Stack',           buyIn: 300,  totalPlayers: 98   },
  { id: 't4',  festivalId: 'f2',  name: 'Sunday Deepstack',    buyIn: 300,  totalPlayers: 112  },
  // Casino Barrière Paris
  { id: 't5',  festivalId: 'f3',  name: 'Warm-Up',             buyIn: 200,  totalPlayers: 212, startDate: '2026-07-20' },
  { id: 't6',  festivalId: 'f3',  name: 'Saturday Festival',   buyIn: 500,  totalPlayers: 175  },
  { id: 't7',  festivalId: 'f3',  name: 'Marathon',            buyIn: 300,  totalPlayers: 320  },
  // SHRPO Cannes
  { id: 't9',  festivalId: 'f5',  name: 'High Roller',         buyIn: 3000, totalPlayers: 210  },
  { id: 't20', festivalId: 'f5',  name: 'Main Event',          buyIn: 1100, totalPlayers: 680  },
  // WPTDeepStacks Deauville
  { id: 't10', festivalId: 'f6',  name: 'Main',                buyIn: 500,  totalPlayers: 430  },
  { id: 't21', festivalId: 'f6',  name: 'High Roller',         buyIn: 2200, totalPlayers: 95   },
  // Aviation Club
  { id: 't22', festivalId: 'f8',  name: 'Classic',             buyIn: 400,  totalPlayers: 140, startDate: '2026-07-08' },
  // Casino de Lyon
  { id: 't12', festivalId: 'f9',  name: 'Main Event',          buyIn: 1500, totalPlayers: 620  },
  // Monte-Carlo
  { id: 't11', festivalId: 'f7',  name: 'Monte-Carlo Masters', buyIn: 1000, totalPlayers: 380  },
  { id: 't23', festivalId: 'f7',  name: 'High Roller',         buyIn: 5000, totalPlayers: 120  },
  // EPT Barcelone
  { id: 't8',  festivalId: 'f4',  name: 'Main Event',          buyIn: 5300, totalPlayers: 1840 },
  { id: 't13', festivalId: 'f4',  name: 'High Roller',         buyIn: 10000,totalPlayers: 230  },
  { id: 't14', festivalId: 'f4',  name: 'Warm-Up',             buyIn: 1100, totalPlayers: 940  },
  // WPT Spain
  { id: 't24', festivalId: 'f10', name: 'Main Event',          buyIn: 1650, totalPlayers: 510  },
  { id: 't25', festivalId: 'f10', name: 'Bounty',              buyIn: 550,  totalPlayers: 390, startDate: '2026-07-12', guaranteed: 15000, featured: true },
  // EPT Prague
  { id: 't15', festivalId: 'f11', name: 'Main Event',          buyIn: 5300, totalPlayers: 2150 },
  { id: 't16', festivalId: 'f11', name: 'High Roller',         buyIn: 10000,totalPlayers: 195  },
  { id: 't26', festivalId: 'f11', name: 'Warm-Up',             buyIn: 1100, totalPlayers: 1020 },
  // EPT Malta
  { id: 't17', festivalId: 'f12', name: 'Main Event',          buyIn: 5300, totalPlayers: 1640 },
  { id: 't18', festivalId: 'f12', name: 'High Roller',         buyIn: 25000,totalPlayers: 80   },
  { id: 't27', festivalId: 'f12', name: 'National',            buyIn: 1100, totalPlayers: 870  },
  // GGPoker Malta
  { id: 't28', festivalId: 'f13', name: 'Main Event',          buyIn: 2200, totalPlayers: 720  },
  { id: 't29', festivalId: 'f13', name: 'Super High Roller',   buyIn: 10000,totalPlayers: 110  },
  // WSOP London
  { id: 't19', festivalId: 'f14', name: 'Main Event',          buyIn: 1650, totalPlayers: 890  },
  { id: 't30', festivalId: 'f14', name: 'High Roller',         buyIn: 5000, totalPlayers: 160  },
  { id: 't31', festivalId: 'f14', name: 'Colossus',            buyIn: 400,  totalPlayers: 1200 },
  // GGPoker UK
  { id: 't32', festivalId: 'f15', name: 'Main Event',          buyIn: 1100, totalPlayers: 640  },
  // EPT Rome
  { id: 't33', festivalId: 'f16', name: 'Main Event',          buyIn: 5300, totalPlayers: 1380 },
  { id: 't34', festivalId: 'f16', name: 'High Roller',         buyIn: 10000,totalPlayers: 175  },
  { id: 't35', festivalId: 'f16', name: 'National',            buyIn: 1100, totalPlayers: 760  },
  // WPT Italy
  { id: 't36', festivalId: 'f17', name: 'Main Event',          buyIn: 3300, totalPlayers: 480  },
  { id: 't37', festivalId: 'f17', name: 'Warm-Up',             buyIn: 550,  totalPlayers: 310  },
  // WSOP Brussels
  { id: 't38', festivalId: 'f18', name: 'Main Event',          buyIn: 1700, totalPlayers: 540  },
  { id: 't39', festivalId: 'f18', name: 'High Roller',         buyIn: 5000, totalPlayers: 140  },
];
