// DEMO ONLY. Production authentication is exclusively Supabase Auth.
export function sha256(str) {
  const rr = (v, n) => (v >>> n) | (v << (32 - n)), P = [], K = [], H = [];
  for (let c = 2; P.length < 64; c++) if (P.every(p => c % p)) P.push(c);
  P.forEach((p, i) => { K[i] = (Math.cbrt(p) % 1) * 4294967296 | 0; if (i < 8) H[i] = (Math.sqrt(p) % 1) * 4294967296 | 0; });
  const bytes = new TextEncoder().encode(str), l = bytes.length, len = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(len); buf.set(bytes); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(len - 8, Math.floor(l / 536870912)); dv.setUint32(len - 4, (l * 8) >>> 0);
  const w = new Array(64);
  for (let i = 0; i < len; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) { const a = w[t - 15], b = w[t - 2]; w[t] = (w[t - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[t - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, k) => { H[k] = (H[k] + v) | 0; });
  }
  return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
export function hashPw(pw, salt) { let h = salt + ':' + pw; for (let i = 0; i < 400; i++) h = sha256(h + salt); return h; }
export function setPassword(u, pw) { u.salt = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); u.pw = hashPw(String(pw), u.salt); delete u.password; }
export function checkPassword(u, pw) {
  if (!u) return false;
  if (typeof u.password === 'string') { const ok = u.password === pw; if (ok) setPassword(u, pw); return ok; }
  return !!u.pw && hashPw(String(pw), u.salt || '') === u.pw;
}
