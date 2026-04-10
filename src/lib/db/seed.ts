import { db } from './index';
import { users, teams, teamPokemon } from './schema';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
const SAMPLE_TEAM_ID = '11111111-1111-1111-1111-111111111111';

const now = Date.now();

// ── Default user ────────────────────────────────────────────────────────
db.insert(users)
  .values({
    id: DEFAULT_USER_ID,
    email: 'local@metagross.dev',
    displayName: 'Local Player',
    createdAt: now,
    updatedAt: now,
  })
  .onConflictDoNothing()
  .run();

console.log('Seeded default user:', DEFAULT_USER_ID);

// ── Sample team ─────────────────────────────────────────────────────────
db.insert(teams)
  .values({
    id: SAMPLE_TEAM_ID,
    userId: DEFAULT_USER_ID,
    name: 'Sample Meta Team',
    format: 'champions-reg-m-a',
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })
  .onConflictDoNothing()
  .run();

console.log('Seeded sample team:', SAMPLE_TEAM_ID);

// ── 6 Pokemon ───────────────────────────────────────────────────────────
const pokemon = [
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 1,
    species: 'Metagross',
    ability: 'Clear Body',
    item: 'Metagrossite',
    nature: 'Jolly',
    level: 50,
    megaEvolution: 'Metagross-Mega',
    moves: JSON.stringify(['Meteor Mash', 'Bullet Punch', 'Ice Punch', 'Protect']),
    evs: JSON.stringify({ hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }),
    ivs: JSON.stringify({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 2,
    species: 'Incineroar',
    ability: 'Intimidate',
    item: 'Safety Goggles',
    nature: 'Careful',
    level: 50,
    moves: JSON.stringify(['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']),
    evs: JSON.stringify({ hp: 252, atk: 4, def: 0, spa: 0, spd: 252, spe: 0 }),
    ivs: JSON.stringify({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 3,
    species: 'Rillaboom',
    ability: 'Grassy Surge',
    item: 'Miracle Seed',
    nature: 'Adamant',
    level: 50,
    moves: JSON.stringify(['Grassy Glide', 'Wood Hammer', 'Fake Out', 'U-turn']),
    evs: JSON.stringify({ hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }),
    ivs: JSON.stringify({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 4,
    species: 'Garchomp',
    ability: 'Rough Skin',
    item: 'Life Orb',
    nature: 'Jolly',
    level: 50,
    moves: JSON.stringify(['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect']),
    evs: JSON.stringify({ hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }),
    ivs: JSON.stringify({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 5,
    species: 'Sinistcha',
    ability: 'Hospitality',
    item: 'Focus Sash',
    nature: 'Modest',
    level: 50,
    teraType: 'Grass',
    moves: JSON.stringify(['Matcha Gotcha', 'Shadow Ball', 'Trick Room', 'Protect']),
    evs: JSON.stringify({ hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }),
    ivs: JSON.stringify({ hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
  {
    teamId: SAMPLE_TEAM_ID,
    slot: 6,
    species: 'Sneasler',
    ability: 'Unburden',
    item: 'Covert Cloak',
    nature: 'Jolly',
    level: 50,
    moves: JSON.stringify(['Close Combat', 'Dire Claw', 'Fake Out', 'Protect']),
    evs: JSON.stringify({ hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }),
    ivs: JSON.stringify({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    createdAt: now,
  },
];

for (const mon of pokemon) {
  db.insert(teamPokemon).values(mon).onConflictDoNothing().run();
}

console.log(`Seeded ${pokemon.length} Pokemon on team "${SAMPLE_TEAM_ID}"`);
console.log('Done!');
