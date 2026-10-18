const env = import.meta.env || {};
const url = String(env.VITE_SUPABASE_URL || '').trim();
const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
const local = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
export const MODE = url && key ? 'cloud' : (!url && !key && (env.VITE_ENABLE_DEMO === 'true' || local)) ? 'demo' : 'setup';
export const CONFIG = Object.freeze({ url, key, mode: MODE });
