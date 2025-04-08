/**
 * Utility to generate random application names in the format:
 * adjective-noun-number (e.g. "summer-voice-2275")
 */

const adjectives = [
  'autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark',
  'summer', 'icy', 'delicate', 'quiet', 'white', 'cool', 'spring', 'winter',
  'patient', 'twilight', 'dawn', 'crimson', 'wispy', 'weathered', 'blue',
  'billowing', 'broken', 'cold', 'damp', 'falling', 'frosty', 'green',
  'long', 'late', 'lingering', 'bold', 'little', 'morning', 'muddy', 'old',
  'red', 'rough', 'still', 'small', 'sparkling', 'throbbing', 'shy',
  'wandering', 'withered', 'wild', 'black', 'young', 'holy', 'solitary',
  'fragrant', 'aged', 'snowy', 'proud', 'floral', 'restless', 'divine',
  'polished', 'ancient', 'purple', 'lively', 'nameless', 'lucky', 'odd', 'tiny',
  'free', 'dry', 'yellow', 'orange', 'gentle', 'tight', 'super', 'royal', 'broad',
  'steep', 'flat', 'square', 'round', 'mute', 'noisy', 'hushy', 'raspy', 'soft',
  'shrill', 'rapid', 'sweet', 'curly', 'calm', 'jolly', 'fancy', 'plain', 'shinny',
  'amber', 'azure', 'bright', 'bronze', 'cosmic', 'crystal', 'dancing', 'dazzling',
  'eager', 'echo', 'endless', 'eternal', 'fierce', 'flaming', 'floating', 'flowing',
  'glowing', 'golden', 'graceful', 'grand', 'happy', 'harmonious', 'humming', 'infinite',
  'jade', 'joyful', 'laughing', 'limitless', 'luminous', 'majestic', 'melodic', 'mighty',
  'mysterious', 'nebulous', 'noble', 'novel', 'peaceful', 'perfect', 'playful', 'precious',
  'pristine', 'radiant', 'regal', 'rising', 'sacred', 'sapphire', 'scarlet', 'secret',
  'serene', 'shimmering', 'silver', 'sincere', 'sleek', 'stellar', 'sublime', 'subtle',
  'swift', 'tender', 'tranquil', 'true', 'valiant', 'vibrant', 'vivid', 'wandering',
  'whispering', 'wise', 'zealous', 'zesty', 'clever', 'crisp', 'curious', 'daring',
  'dreamy', 'dynamic', 'elegant', 'enchanted', 'energetic', 'fresh', 'friendly', 'humble',
  'keen', 'kind', 'leading', 'magical', 'nimble', 'passionate', 'patient', 'peaceful',
  'quick', 'resilient', 'rustic', 'smiling', 'soulful', 'spirited', 'thankful', 'thoughtful'
];

const nouns = [
  'waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning',
  'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'glitter',
  'forest', 'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook',
  'butterfly', 'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly',
  'feather', 'grass', 'haze', 'mountain', 'night', 'pond', 'darkness',
  'snowflake', 'silence', 'sound', 'sky', 'shape', 'surf', 'thunder',
  'violet', 'water', 'wildflower', 'wave', 'water', 'resonance', 'sun',
  'wood', 'dream', 'cherry', 'tree', 'fog', 'frost', 'voice', 'paper',
  'frog', 'smoke', 'star', 'atom', 'band', 'bar', 'base', 'block', 'boat',
  'term', 'credit', 'art', 'card', 'shape', 'bread', 'point', 'gift', 'note',
  'film', 'home', 'song', 'trip', 'mind', 'game', 'key', 'plane', 'ship',
  'code', 'link', 'ring', 'stone', 'bell', 'jet', 'metal', 'blade', 'light',
  'seed', 'heat', 'record', 'ribbon', 'medal', 'level', 'story', 'disk',
  'arch', 'arrow', 'beacon', 'beam', 'blossom', 'bridge', 'bubble', 'byte',
  'canyon', 'castle', 'cave', 'coast', 'comet', 'corner', 'crystal', 'cube',
  'cycle', 'desert', 'diamond', 'door', 'drop', 'echo', 'edge', 'ember',
  'emerald', 'energy', 'engine', 'eye', 'face', 'feather', 'flame', 'flare',
  'galaxy', 'garden', 'gate', 'gem', 'glacier', 'globe', 'grove', 'harbor',
  'heart', 'horizon', 'island', 'journey', 'kernel', 'lagoon', 'lantern', 'leaf',
  'library', 'map', 'maze', 'meadow', 'mirror', 'mirage', 'mist', 'moment',
  'nebula', 'nectar', 'nova', 'oasis', 'ocean', 'orbit', 'palace', 'path',
  'pearl', 'phoenix', 'pillar', 'pixel', 'planet', 'pocket', 'portal', 'prism',
  'pulse', 'puzzle', 'pyramid', 'quartz', 'quest', 'rainbow', 'reef', 'relic',
  'ripple', 'rocket', 'root', 'rose', 'sail', 'scale', 'shell', 'shelter',
  'shore', 'signal', 'silk', 'spark', 'spirit', 'spring', 'stream', 'summit',
  'symbol', 'temple', 'tide', 'tower', 'trail', 'treasure', 'valley', 'veil',
  'vertex', 'vessel', 'vista', 'vortex', 'wave', 'whisper', 'zenith', 'zephyr'
];

/**
 * Generates a random application name in the format "adjective-noun-number"
 */
export function generateRandomAppName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 10000);
  
  return `${adjective}-${noun}-${number.toString().padStart(4, '0')}`;
}
