// Real encryption methods — SECURITY UNTESTED, USE AT OWN RISK.
//
// CAVEAT: these are genuine cipher algorithms (AES-GCM/CBC via WebCrypto,
// plus pure-JS AES-CBC, ChaCha20, Rabbit, Speck, XTEA, XXTEA, Trivium, RC4),
// but THIS implementation has not been reviewed, audited, or tested for
// side channels, and the surrounding construction (password handling,
// KDF choices, IV/nonce management, unauthenticated modes) was written
// by a non-specialist. Treat ciphertext as BEST-EFFORT privacy only:
// do not rely on it for anything where disclosure would cause real harm.
// Known-weak members (RC4) and unauthenticated modes are labeled as such.
// Prefer AES-256-GCM (the only authenticated mode here) for anything real.

/* ============================== utilities ============================== */

function rcUtf8ToBytes(s) {
  return new TextEncoder().encode(s);
}

function rcBytesToUtf8(b, fatal) {
  return new TextDecoder().decode(b, { fatal: !!fatal });
}

function rcConcat(...arrs) {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function rcRandomBytes(n) {
  const g =
    typeof globalThis !== "undefined" && globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
      ? globalThis.crypto
      : typeof crypto !== "undefined" &&
          typeof crypto.getRandomValues === "function"
        ? crypto
        : null;
  if (g) {
    const b = new Uint8Array(n);
    g.getRandomValues(b);
    return b;
  }
  // Fallback is NOT cryptographically secure (labeled; see header).
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (Math.random() * 256) | 0;
  return b;
}

function rcB64encode(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  if (typeof btoa === "function") return btoa(s);
  return Buffer.from(s, "binary").toString("base64");
}

function rcB64decode(s) {
  let bin;
  if (typeof atob === "function") bin = atob(String(s).trim());
  else bin = Buffer.from(String(s).trim(), "base64").toString("binary");
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

function rcHex(b) {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function rcUnhex(s) {
  const t = String(s).trim();
  if (t.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(t)) {
    throw new Error("Invalid hex.");
  }
  const b = new Uint8Array(t.length / 2);
  for (let i = 0; i < b.length; i++) {
    b[i] = parseInt(t.substr(i * 2, 2), 16);
  }
  return b;
}

function rcU32be(b, off) {
  return (
    ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>>
    0
  );
}

function rcPutU32be(b, off, v) {
  b[off] = (v >>> 24) & 0xff;
  b[off + 1] = (v >>> 16) & 0xff;
  b[off + 2] = (v >>> 8) & 0xff;
  b[off + 3] = v & 0xff;
}

function rcU32le(b, off) {
  return (
    (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>>
    0
  );
}

function rcPutU32le(b, off, v) {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
  b[off + 2] = (v >>> 16) & 0xff;
  b[off + 3] = (v >>> 24) & 0xff;
}

function rcRotl32(v, n) {
  return ((v << n) | (v >>> (32 - n))) >>> 0;
}

/* ============================== SHA-256 ============================== */
// Constants are derived at runtime (fractional parts of square/cube roots
// of primes) and self-tested, so no 64-entry table is transcribed by hand.

const RC_PRIMES64 = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
  71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139,
  149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223,
  227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293,
  307, 311,
];

let RC_SHA_CONSTS = null;

function rcShaConsts() {
  if (RC_SHA_CONSTS) return RC_SHA_CONSTS;
  const frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const H = [];
  const K = [];
  for (let i = 0; i < 8; i++) H.push(frac32(Math.sqrt(RC_PRIMES64[i])));
  for (let i = 0; i < 64; i++) K.push(frac32(Math.cbrt(RC_PRIMES64[i])));
  RC_SHA_CONSTS = { H, K };
  // Self-test: wrong low bits in any constant break these digests.
  if (
    rcHex(rcSha256Raw(rcUtf8ToBytes(""))) !==
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ||
    rcHex(rcSha256Raw(rcUtf8ToBytes("abc"))) !==
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  ) {
    throw new Error("SHA-256 self-test failed on this platform.");
  }
  return RC_SHA_CONSTS;
}

function rcSha256Raw(data) {
  const { H: H0, K } = RC_SHA_CONSTS || rcShaConstsInit();
  const H = H0.slice();
  const bitLenHi = Math.floor((data.length * 8) / 4294967296);
  const bitLenLo = (data.length * 8) >>> 0;
  const paddedLen = (((data.length + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(paddedLen);
  m.set(data);
  m[data.length] = 0x80;
  m[paddedLen - 8] = (bitLenHi >>> 24) & 0xff;
  m[paddedLen - 7] = (bitLenHi >>> 16) & 0xff;
  m[paddedLen - 6] = (bitLenHi >>> 8) & 0xff;
  m[paddedLen - 5] = bitLenHi & 0xff;
  m[paddedLen - 4] = (bitLenLo >>> 24) & 0xff;
  m[paddedLen - 3] = (bitLenLo >>> 16) & 0xff;
  m[paddedLen - 2] = (bitLenLo >>> 8) & 0xff;
  m[paddedLen - 1] = bitLenLo & 0xff;
  const w = new Array(64);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = rcU32be(m, off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 =
        (rcRotl32(w[i - 15], 25) ^
          rcRotl32(w[i - 15], 14) ^
          (w[i - 15] >>> 3)) >>>
        0;
      const s1 =
        (rcRotl32(w[i - 2], 15) ^
          rcRotl32(w[i - 2], 13) ^
          (w[i - 2] >>> 10)) >>>
        0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 =
        (rcRotl32(e, 26) ^ rcRotl32(e, 21) ^ rcRotl32(e, 7)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 =
        (rcRotl32(a, 30) ^ rcRotl32(a, 19) ^ rcRotl32(a, 10)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) rcPutU32be(out, i * 4, H[i]);
  return out;
}

function rcShaConstsInit() {
  const frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const H = [];
  const K = [];
  for (let i = 0; i < 8; i++) H.push(frac32(Math.sqrt(RC_PRIMES64[i])));
  for (let i = 0; i < 64; i++) K.push(frac32(Math.cbrt(RC_PRIMES64[i])));
  return { H, K };
}

// Public SHA-256 entry point (runs the self-test once via rcShaConsts).
function rcSha256(data) {
  rcShaConsts();
  return rcSha256Raw(data);
}

// Simple non-iterated KDF for the pure-JS ciphers:
// key = SHA-256(salt || password)[0..n). Fast to brute force —
// use long, random passwords. (WebCrypto members use PBKDF2 instead.)
function rcSimpleKdf(password, salt, n) {
  return rcSha256(rcConcat(salt, rcUtf8ToBytes(password))).slice(0, n);
}

/* ============================== AES (pure) ============================== */
// FIPS-197 AES-256. S-box is computed from GF(2^8) math at runtime.

let RC_AES_BOX = null;

function rcGfMul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>>= 1;
  }
  return p;
}

function rcAesBox() {
  if (RC_AES_BOX) return RC_AES_BOX;
  const rotl8 = (v, n) => (((v << n) | (v >>> (8 - n))) & 0xff);
  const s = new Uint8Array(256);
  const si = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let inv = 0;
    if (i !== 0) {
      for (let b = 1; b < 256; b++) {
        if (rcGfMul(i, b) === 1) {
          inv = b;
          break;
        }
      }
    }
    const t =
      inv ^ rotl8(inv, 1) ^ rotl8(inv, 2) ^ rotl8(inv, 3) ^ rotl8(inv, 4) ^ 0x63;
    s[i] = t & 0xff;
    si[t & 0xff] = i;
  }
  RC_AES_BOX = { s, si };
  return RC_AES_BOX;
}

function rcAesExpandKey(key32) {
  const Nk = 8;
  const Nb = 4;
  const Nr = 14;
  const { s } = rcAesBox();
  const w = new Uint32Array(Nb * (Nr + 1));
  for (let i = 0; i < Nk; i++) w[i] = rcU32be(key32, i * 4);
  let rcon = 1;
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = w[i - 1];
    if (i % Nk === 0) {
      temp =
        (((s[(temp >>> 16) & 0xff] << 24) >>>
          0) ^
          (s[(temp >>> 8) & 0xff] << 16) ^
          (s[temp & 0xff] << 8) ^
          s[(temp >>> 24) & 0xff] ^
          (rcon << 24)) >>>
        0;
      rcon = rcGfMul(rcon, 2);
    } else if (Nk > 6 && i % Nk === 4) {
      temp =
        ((s[(temp >>> 24) & 0xff] << 24) ^
          (s[(temp >>> 16) & 0xff] << 16) ^
          (s[(temp >>> 8) & 0xff] << 8) ^
          s[temp & 0xff]) >>>
        0;
    }
    w[i] = (w[i - Nk] ^ temp) >>> 0;
  }
  return { w, Nr };
}

function rcAesAddRoundKey(st, w, round) {
  for (let c = 0; c < 4; c++) {
    const k = w[round * 4 + c];
    st[c * 4] ^= (k >>> 24) & 0xff;
    st[c * 4 + 1] ^= (k >>> 16) & 0xff;
    st[c * 4 + 2] ^= (k >>> 8) & 0xff;
    st[c * 4 + 3] ^= k & 0xff;
  }
}

function rcAesEncryptBlock(block16, rk) {
  const { s } = rcAesBox();
  const st = Array.from(block16);
  const xtime = (x) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
  rcAesAddRoundKey(st, rk.w, 0);
  for (let round = 1; round <= rk.Nr; round++) {
    for (let i = 0; i < 16; i++) st[i] = s[st[i]];
    // ShiftRows
    let t = st[1];
    st[1] = st[5];
    st[5] = st[9];
    st[9] = st[13];
    st[13] = t;
    t = st[2];
    st[2] = st[10];
    st[10] = t;
    t = st[6];
    st[6] = st[14];
    st[14] = t;
    t = st[15];
    st[15] = st[11];
    st[11] = st[7];
    st[7] = st[3];
    st[3] = t;
    if (round !== rk.Nr) {
      for (let c = 0; c < 4; c++) {
        const a0 = st[c * 4];
        const a1 = st[c * 4 + 1];
        const a2 = st[c * 4 + 2];
        const a3 = st[c * 4 + 3];
        st[c * 4] =
          xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
        st[c * 4 + 1] =
          a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
        st[c * 4 + 2] =
          a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
        st[c * 4 + 3] =
          (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
      }
    }
    rcAesAddRoundKey(st, rk.w, round);
  }
  return Uint8Array.from(st);
}

function rcAesDecryptBlock(block16, rk) {
  const { si } = rcAesBox();
  const st = Array.from(block16);
  rcAesAddRoundKey(st, rk.w, rk.Nr);
  for (let round = rk.Nr - 1; round >= 0; round--) {
    // InvShiftRows
    let t = st[13];
    st[13] = st[9];
    st[9] = st[5];
    st[5] = st[1];
    st[1] = t;
    t = st[2];
    st[2] = st[10];
    st[10] = t;
    t = st[6];
    st[6] = st[14];
    st[14] = t;
    t = st[3];
    st[3] = st[7];
    st[7] = st[11];
    st[11] = st[15];
    st[15] = t;
    for (let i = 0; i < 16; i++) st[i] = si[st[i]];
    rcAesAddRoundKey(st, rk.w, round);
    if (round !== 0) {
      for (let c = 0; c < 4; c++) {
        const a0 = st[c * 4];
        const a1 = st[c * 4 + 1];
        const a2 = st[c * 4 + 2];
        const a3 = st[c * 4 + 3];
        st[c * 4] =
          rcGfMul(a0, 0x0e) ^ rcGfMul(a1, 0x0b) ^ rcGfMul(a2, 0x0d) ^ rcGfMul(a3, 0x09);
        st[c * 4 + 1] =
          rcGfMul(a0, 0x09) ^ rcGfMul(a1, 0x0e) ^ rcGfMul(a2, 0x0b) ^ rcGfMul(a3, 0x0d);
        st[c * 4 + 2] =
          rcGfMul(a0, 0x0d) ^ rcGfMul(a1, 0x09) ^ rcGfMul(a2, 0x0e) ^ rcGfMul(a3, 0x0b);
        st[c * 4 + 3] =
          rcGfMul(a0, 0x0b) ^ rcGfMul(a1, 0x0d) ^ rcGfMul(a2, 0x09) ^ rcGfMul(a3, 0x0e);
      }
    }
  }
  return Uint8Array.from(st);
}

function rcPkcs7Pad(data, block) {
  const n = block - (data.length % block);
  const out = new Uint8Array(data.length + n);
  out.set(data);
  out.fill(n, data.length);
  return out;
}

function rcPkcs7Unpad(data, block) {
  if (data.length === 0 || data.length % block !== 0) {
    throw new Error("Invalid padding.");
  }
  const n = data[data.length - 1];
  if (n < 1 || n > block) throw new Error("Invalid padding.");
  for (let i = data.length - n; i < data.length; i++) {
    if (data[i] !== n) throw new Error("Invalid padding.");
  }
  return data.slice(0, data.length - n);
}

function rcAesCbcEncrypt(key32, iv16, data) {
  const rk = rcAesExpandKey(key32);
  const padded = rcPkcs7Pad(data, 16);
  const out = new Uint8Array(padded.length);
  let prev = iv16;
  for (let off = 0; off < padded.length; off += 16) {
    const block = padded.slice(off, off + 16);
    for (let i = 0; i < 16; i++) block[i] ^= prev[i];
    const enc = rcAesEncryptBlock(block, rk);
    out.set(enc, off);
    prev = enc;
  }
  return out;
}

function rcAesCbcDecrypt(key32, iv16, data) {
  if (data.length % 16 !== 0 || data.length === 0) {
    throw new Error("Invalid ciphertext length.");
  }
  const rk = rcAesExpandKey(key32);
  const out = new Uint8Array(data.length);
  let prev = iv16;
  for (let off = 0; off < data.length; off += 16) {
    const block = data.slice(off, off + 16);
    const dec = rcAesDecryptBlock(block, rk);
    for (let i = 0; i < 16; i++) dec[i] ^= prev[i];
    out.set(dec, off);
    prev = block;
  }
  return rcPkcs7Unpad(out, 16);
}

/* ============================== ChaCha20 ============================== */
// RFC 8439, 256-bit key, 96-bit nonce.

function rcChaChaQR(x, a, b, c, d) {
  x[a] = (x[a] + x[b]) >>> 0;
  x[d] ^= x[a];
  x[d] = rcRotl32(x[d], 16);
  x[c] = (x[c] + x[d]) >>> 0;
  x[b] ^= x[c];
  x[b] = rcRotl32(x[b], 12);
  x[a] = (x[a] + x[b]) >>> 0;
  x[d] ^= x[a];
  x[d] = rcRotl32(x[d], 8);
  x[c] = (x[c] + x[d]) >>> 0;
  x[b] ^= x[c];
  x[b] = rcRotl32(x[b], 7);
}

function rcChaChaBlock(key32, counter, nonce12) {
  const st = new Uint32Array(16);
  st[0] = 0x61707865;
  st[1] = 0x3320646e;
  st[2] = 0x79622d32;
  st[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) st[4 + i] = rcU32le(key32, i * 4);
  st[12] = counter >>> 0;
  st[13] = rcU32le(nonce12, 0);
  st[14] = rcU32le(nonce12, 4);
  st[15] = rcU32le(nonce12, 8);
  const x = Uint32Array.from(st);
  for (let i = 0; i < 10; i++) {
    rcChaChaQR(x, 0, 4, 8, 12);
    rcChaChaQR(x, 1, 5, 9, 13);
    rcChaChaQR(x, 2, 6, 10, 14);
    rcChaChaQR(x, 3, 7, 11, 15);
    rcChaChaQR(x, 0, 5, 10, 15);
    rcChaChaQR(x, 1, 6, 11, 12);
    rcChaChaQR(x, 2, 7, 8, 13);
    rcChaChaQR(x, 3, 4, 9, 14);
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    rcPutU32le(out, i * 4, (x[i] + st[i]) >>> 0);
  }
  return out;
}

function rcChaChaXor(key32, nonce12, data, counter0) {
  const out = new Uint8Array(data.length);
  let counter = (counter0 || 0) >>> 0;
  for (let off = 0; off < data.length; off += 64) {
    const ks = rcChaChaBlock(key32, counter, nonce12);
    const n = Math.min(64, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
    counter = (counter + 1) >>> 0;
  }
  return out;
}

/* ============================== RC4 ============================== */
// Raw RC4 (no drop) — matches published test vectors. WEAK: broken,
// biased keystream. Included for compatibility/curiosity only.

function rc4Crypt(keyBytes, data) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + keyBytes[i % keyBytes.length]) & 0xff;
    const t = S[i];
    S[i] = S[j];
    S[j] = t;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    const t = S[i];
    S[i] = S[j];
    S[j] = t;
    out[n] = data[n] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

/* ============================== Rabbit ============================== */
// RFC 4503. 128-bit key, 64-bit IV. BigInt used for the exact
// 32x32->64-bit squaring step.

const RC_RABBIT_A = [
  0x4d34d34d, 0xd34d34d3, 0x34d34d34, 0x4d34d34d,
  0xd34d34d3, 0x34d34d34, 0x4d34d34d, 0xd34d34d3,
];

function rcRabbitState(key16) {
  // x_{2j} from bytes (12-4j).. ; x_{2j+1} from bytes (2-4j)..
  // (big-endian words, indices modulo 16 — matches RFC 4503 debug vectors)
  const x = new Array(8);
  const c = new Array(8);
  for (let j = 0; j < 4; j++) {
    const sx = (((12 - 4 * j) % 16) + 16) % 16;
    x[2 * j] = rcU32be(key16, sx) >>> 0;
    // careful: bytes may wrap past the end
    x[2 * j] = (
      (key16[sx % 16] << 24) |
      (key16[(sx + 1) % 16] << 16) |
      (key16[(sx + 2) % 16] << 8) |
      key16[(sx + 3) % 16]
    ) >>> 0;
    const so = (((2 - 4 * j) % 16) + 16) % 16;
    x[2 * j + 1] = (
      (key16[so % 16] << 24) |
      (key16[(so + 1) % 16] << 16) |
      (key16[(so + 2) % 16] << 8) |
      key16[(so + 3) % 16]
    ) >>> 0;
  }
  // counters: c_{2j} from (6-4j) pattern, c_{2j+1} from (12-4j) pattern,
  // each as (b_s, b_{s+1}, b_{s-2}, b_{s-1})
  for (let j = 0; j < 4; j++) {
    const se = (((6 - 4 * j) % 16) + 16) % 16;
    c[2 * j] = (
      (key16[se % 16] << 24) |
      (key16[(se + 1) % 16] << 16) |
      (key16[(se + 14) % 16] << 8) |
      key16[(se + 15) % 16]
    ) >>> 0;
    const so = (((12 - 4 * j) % 16) + 16) % 16;
    c[2 * j + 1] = (
      (key16[so % 16] << 24) |
      (key16[(so + 1) % 16] << 16) |
      (key16[(so + 14) % 16] << 8) |
      key16[(so + 15) % 16]
    ) >>> 0;
  }
  return { x, c, b: 0 };
}

function rcRabbitNext(st) {
  for (let j = 0; j < 8; j++) {
    const sum = st.c[j] + RC_RABBIT_A[j] + st.b;
    st.b = sum > 0xffffffff ? 1 : 0;
    st.c[j] = sum >>> 0;
  }
  const g = new Array(8);
  for (let j = 0; j < 8; j++) {
    const t = BigInt((st.x[j] + st.c[j]) >>> 0);
    const sq = (t * t) & 0xffffffffffffffffn;
    g[j] = Number((sq ^ (sq >> 32n)) & 0xffffffffn);
  }
  const x = st.x;
  st.x = [
    (g[0] + rcRotl32(g[7], 16) + rcRotl32(g[6], 16)) >>> 0,
    (g[1] + rcRotl32(g[0], 8) + g[7]) >>> 0,
    (g[2] + rcRotl32(g[1], 16) + rcRotl32(g[0], 16)) >>> 0,
    (g[3] + rcRotl32(g[2], 8) + g[1]) >>> 0,
    (g[4] + rcRotl32(g[3], 16) + rcRotl32(g[2], 16)) >>> 0,
    (g[5] + rcRotl32(g[4], 8) + g[3]) >>> 0,
    (g[6] + rcRotl32(g[5], 16) + rcRotl32(g[4], 16)) >>> 0,
    (g[7] + rcRotl32(g[6], 8) + g[5]) >>> 0,
  ];
}

function rcRabbitKeySetup(key16) {
  const st = rcRabbitState(key16);
  for (let i = 0; i < 4; i++) rcRabbitNext(st);
  for (let j = 0; j < 8; j++) st.c[j] = (st.c[j] ^ st.x[(j + 4) & 7]) >>> 0;
  return st;
}

function rcRabbitIvSetup(st, iv8) {
  const w = (a, b, c2, d) =>
    ((iv8[a] << 24) | (iv8[b] << 16) | (iv8[c2] << 8) | iv8[d]) >>> 0;
  st.c[0] ^= w(4, 5, 6, 7);
  st.c[1] ^= w(0, 1, 4, 5);
  st.c[2] ^= w(0, 1, 2, 3);
  st.c[3] ^= w(2, 3, 6, 7);
  st.c[4] ^= w(4, 5, 6, 7);
  st.c[5] ^= w(0, 1, 4, 5);
  st.c[6] ^= w(0, 1, 2, 3);
  st.c[7] ^= w(2, 3, 6, 7);
  for (let i = 0; i < 4; i++) rcRabbitNext(st);
}

function rcRabbitCrypt(key16, iv8, data) {
  const st = rcRabbitKeySetup(key16);
  if (iv8) rcRabbitIvSetup(st, iv8);
  const out = new Uint8Array(data.length);
  const x = st.x;
  for (let off = 0; off < data.length; off += 16) {
    rcRabbitNext(st);
    const s = [
      (st.x[0] ^ (st.x[5] >>> 16) ^ (st.x[3] << 16)) >>> 0,
      (st.x[2] ^ (st.x[7] >>> 16) ^ (st.x[5] << 16)) >>> 0,
      (st.x[4] ^ (st.x[1] >>> 16) ^ (st.x[7] << 16)) >>> 0,
      (st.x[6] ^ (st.x[3] >>> 16) ^ (st.x[1] << 16)) >>> 0,
    ];
    const ks = new Uint8Array(16);
    for (let i = 0; i < 4; i++) rcPutU32le(ks, i * 4, s[i]);
    const n = Math.min(16, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
  }
  void x;
  return out;
}

/* ============================== Speck-128/256 ============================== */
// NSA Speck, block 128, key 256, 34 rounds. BigInt for exact 64-bit math.
// Byte order per the paper's Appendix C (little-endian words).

const RC_SPECK_MASK64 = 0xffffffffffffffffn;

function rcSpeckRotr64(v, n) {
  return ((v >> BigInt(n)) | (v << BigInt(64 - n))) & RC_SPECK_MASK64;
}

function rcSpeckRotl64(v, n) {
  return ((v << BigInt(n)) | (v >> BigInt(64 - n))) & RC_SPECK_MASK64;
}

function rcU64le(b, off) {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[off + i]);
  return v;
}

function rcPutU64le(b, off, v) {
  for (let i = 0; i < 8; i++) {
    b[off + i] = Number((v >> BigInt(8 * i)) & 0xffn);
  }
}

function rcSpeckExpand(key32) {
  const l = [
    rcU64le(key32, 8),
    rcU64le(key32, 16),
    rcU64le(key32, 24),
  ];
  const ks = [rcU64le(key32, 0)];
  for (let i = 0; i < 33; i++) {
    const li = (ks[i] + rcSpeckRotr64(l[i], 8)) & RC_SPECK_MASK64;
    const nxt = (li ^ BigInt(i)) & RC_SPECK_MASK64;
    l.push(nxt);
    ks.push((rcSpeckRotl64(ks[i], 3) ^ nxt) & RC_SPECK_MASK64);
  }
  return ks.slice(0, 34);
}

function rcSpeckEncryptBlock(block16, ks) {
  let x = rcU64le(block16, 8);
  let y = rcU64le(block16, 0);
  for (let i = 0; i < 34; i++) {
    x = ((rcSpeckRotr64(x, 8) + y) & RC_SPECK_MASK64) ^ ks[i];
    y = rcSpeckRotl64(y, 3) ^ x;
  }
  const out = new Uint8Array(16);
  rcPutU64le(out, 0, y);
  rcPutU64le(out, 8, x);
  return out;
}

function rcSpeckDecryptBlock(block16, ks) {
  let y = rcU64le(block16, 0);
  let x = rcU64le(block16, 8);
  for (let i = 33; i >= 0; i--) {
    y = rcSpeckRotr64(y ^ x, 61);
    // x = ROTR(((x ^ k) - y) mod 2^64, 8)
    x = rcSpeckRotr64(
      (((x ^ ks[i]) & RC_SPECK_MASK64) - y + (1n << 64n)) & RC_SPECK_MASK64,
      8,
    );
  }
  const out = new Uint8Array(16);
  rcPutU64le(out, 0, y);
  rcPutU64le(out, 8, x);
  return out;
}

function rcSpeckCbcEncrypt(key32, iv16, data) {
  const ks = rcSpeckExpand(key32);
  const padded = rcPkcs7Pad(data, 16);
  const out = new Uint8Array(padded.length);
  let prev = iv16;
  for (let off = 0; off < padded.length; off += 16) {
    const block = padded.slice(off, off + 16);
    for (let i = 0; i < 16; i++) block[i] ^= prev[i];
    const enc = rcSpeckEncryptBlock(block, ks);
    out.set(enc, off);
    prev = enc;
  }
  return out;
}

function rcSpeckCbcDecrypt(key32, iv16, data) {
  if (data.length % 16 !== 0 || data.length === 0) {
    throw new Error("Invalid ciphertext length.");
  }
  const ks = rcSpeckExpand(key32);
  const out = new Uint8Array(data.length);
  let prev = iv16;
  for (let off = 0; off < data.length; off += 16) {
    const block = data.slice(off, off + 16);
    const dec = rcSpeckDecryptBlock(block, ks);
    for (let i = 0; i < 16; i++) dec[i] ^= prev[i];
    out.set(dec, off);
    prev = block;
  }
  return rcPkcs7Unpad(out, 16);
}

/* ============================== XTEA ============================== */
// 64-bit block, 128-bit key, 32 cycles (64 Feistel rounds).

function rcXteaBlock(v0, v1, k, decrypt) {
  const delta = 0x9e3779b9;
  if (!decrypt) {
    let sum = 0;
    for (let i = 0; i < 32; i++) {
      v0 =
        (v0 +
          ((((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + k[sum & 3]))) >>>
        0;
      sum = (sum + delta) >>> 0;
      v1 =
        (v1 +
          ((((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + k[(sum >>> 11) & 3]))) >>>
        0;
    }
  } else {
    let sum = (delta * 32) >>> 0;
    for (let i = 0; i < 32; i++) {
      v1 =
        (v1 -
          ((((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + k[(sum >>> 11) & 3]))) >>>
        0;
      sum = (sum - delta) >>> 0;
      v0 =
        (v0 -
          ((((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + k[sum & 3]))) >>>
        0;
    }
  }
  return [v0 >>> 0, v1 >>> 0];
}

function rcXteaCbc(key16, iv8, data, decrypt) {
  const k = [
    rcU32be(key16, 0),
    rcU32be(key16, 4),
    rcU32be(key16, 8),
    rcU32be(key16, 12),
  ];
  let bytes = data;
  if (!decrypt) bytes = rcPkcs7Pad(data, 8);
  else if (bytes.length % 8 !== 0 || bytes.length === 0) {
    throw new Error("Invalid ciphertext length.");
  }
  const out = new Uint8Array(bytes.length);
  let prev = iv8;
  for (let off = 0; off < bytes.length; off += 8) {
    if (!decrypt) {
      const v0 = rcU32be(bytes, off) ^ rcU32be(prev, 0);
      const v1 = rcU32be(bytes, off + 4) ^ rcU32be(prev, 4);
      const [e0, e1] = rcXteaBlock(v0, v1, k, false);
      rcPutU32be(out, off, e0);
      rcPutU32be(out, off + 4, e1);
      prev = out.slice(off, off + 8);
    } else {
      const block = bytes.slice(off, off + 8);
      const [d0, d1] = rcXteaBlock(
        rcU32be(block, 0),
        rcU32be(block, 4),
        k,
        true,
      );
      const p0 = d0 ^ rcU32be(prev, 0);
      const p1 = d1 ^ rcU32be(prev, 4);
      rcPutU32be(out, off, p0);
      rcPutU32be(out, off + 4, p1);
      prev = block;
    }
  }
  return decrypt ? rcPkcs7Unpad(out, 8) : out;
}

/* ============================== XXTEA ============================== */
// Corrected Block TEA (Wheeler/Needham 1998). Words are little-endian;
// the original plaintext length is appended as a final word (xxtea-c
// convention) so decryption can strip padding exactly.

function rcXxteaMX(y, z, sum, k, p, e) {
  return (
    ((((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^
      ((sum ^ y) + (k[(p & 3) ^ e] ^ z))) >>>
    0
  );
}

function rcXxteaEncryptWords(v, k) {
  const n = v.length;
  if (n < 2) return v;
  const delta = 0x9e3779b9;
  const rounds = 6 + Math.floor(52 / n);
  let sum = 0;
  let z = v[n - 1];
  for (let q = 0; q < rounds; q++) {
    sum = (sum + delta) >>> 0;
    const e = (sum >>> 2) & 3;
    for (let p = 0; p < n - 1; p++) {
      const y = v[p + 1];
      z = v[p] = (v[p] + rcXxteaMX(y, z, sum, k, p, e)) >>> 0;
    }
    const y = v[0];
    z = v[n - 1] = (v[n - 1] + rcXxteaMX(y, z, sum, k, n - 1, e)) >>> 0;
  }
  return v;
}

function rcXxteaDecryptWords(v, k) {
  const n = v.length;
  if (n < 2) return v;
  const delta = 0x9e3779b9;
  const rounds = 6 + Math.floor(52 / n);
  let sum = (rounds * delta) >>> 0;
  let y = v[0];
  while (sum !== 0) {
    const e = (sum >>> 2) & 3;
    for (let p = n - 1; p > 0; p--) {
      const z = v[p - 1];
      y = v[p] = (v[p] - rcXxteaMX(y, z, sum, k, p, e)) >>> 0;
    }
    const z = v[n - 1];
    y = v[0] = (v[0] - rcXxteaMX(y, z, sum, k, 0, e)) >>> 0;
    sum = (sum - delta) >>> 0;
  }
  return v;
}

function rcXxteaEncrypt(key16, data) {
  if (data.length === 0) return new Uint8Array(0);
  const nWords = Math.ceil(data.length / 4) + 1;
  const v = new Array(nWords).fill(0);
  for (let i = 0; i < data.length; i++) {
    v[(i / 4) | 0] |= data[i] << ((i % 4) * 8);
    v[(i / 4) | 0] >>>= 0;
  }
  v[nWords - 1] = data.length >>> 0;
  const k = [
    rcU32le(key16, 0),
    rcU32le(key16, 4),
    rcU32le(key16, 8),
    rcU32le(key16, 12),
  ];
  rcXxteaEncryptWords(v, k);
  const out = new Uint8Array(nWords * 4);
  for (let i = 0; i < nWords; i++) rcPutU32le(out, i * 4, v[i]);
  return out;
}

function rcXxteaDecrypt(key16, data) {
  if (data.length === 0) return new Uint8Array(0);
  if (data.length % 4 !== 0) throw new Error("Invalid ciphertext length.");
  const nWords = data.length / 4;
  if (nWords < 2) throw new Error("Invalid ciphertext length.");
  const v = [];
  for (let i = 0; i < nWords; i++) v.push(rcU32le(data, i * 4));
  const k = [
    rcU32le(key16, 0),
    rcU32le(key16, 4),
    rcU32le(key16, 8),
    rcU32le(key16, 12),
  ];
  rcXxteaDecryptWords(v, k);
  const len = v[nWords - 1] >>> 0;
  if (len > (nWords - 1) * 4) throw new Error("Invalid ciphertext.");
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = (v[(i / 4) | 0] >>> ((i % 4) * 8)) & 0xff;
  return out;
}

/* ============================== Trivium ============================== */
// 80-bit key, 80-bit IV. Bits are MSB-first within each byte.

function rcTriviumCrypt(key10, iv10, data) {
  const s = new Uint8Array(288);
  const getBit = (bytes, i) => (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  for (let i = 0; i < 80; i++) s[i] = getBit(key10, i);
  for (let i = 0; i < 80; i++) s[93 + i] = getBit(iv10, i);
  s[285] = 1;
  s[286] = 1;
  s[287] = 1;
  const clock = (produce) => {
    const t1 = s[65] ^ s[92];
    const t2 = s[161] ^ s[176];
    const t3 = s[242] ^ s[287];
    const z = t1 ^ t2 ^ t3;
    const u1 = t1 ^ (s[90] & s[91]) ^ s[170];
    const u2 = t2 ^ (s[174] & s[175]) ^ s[263];
    const u3 = t3 ^ (s[285] & s[286]) ^ s[68];
    for (let i = 92; i >= 1; i--) s[i] = s[i - 1];
    s[0] = u3;
    for (let i = 176; i >= 94; i--) s[i] = s[i - 1];
    s[93] = u1;
    for (let i = 287; i >= 178; i--) s[i] = s[i - 1];
    s[177] = u2;
    return produce ? z : 0;
  };
  for (let i = 0; i < 1152; i++) clock(false);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let ks = 0;
    for (let j = 0; j < 8; j++) ks = (ks << 1) | clock(true);
    out[i] = data[i] ^ ks;
  }
  return out;
}

/* ==================== WebCrypto AES (GCM + CBC) ==================== */

function rcGetSubtle() {
  const g =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== "undefined"
        ? crypto
        : null;
  return g && g.subtle ? g.subtle : null;
}

async function rcPbkdf2Key(password, salt, algName) {
  const subtle = rcGetSubtle();
  if (!subtle) throw new Error("WebCrypto is unavailable in this context.");
  const base = await subtle.importKey(
    "raw",
    rcUtf8ToBytes(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    base,
    { name: algName, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ==================== envelope + registry ==================== */

function rcPackEnvelope(alg, salt, iv, ct) {
  return (
    "MK2$" + alg + "$" + rcB64encode(salt) + "$" + rcB64encode(iv) + "$" + rcB64encode(ct)
  );
}

function rcParseEnvelope(env) {
  const parts = String(env).trim().split("$");
  if (parts.length !== 5 || parts[0] !== "MK2") {
    throw new Error("Not a Marky envelope (expected MK2$...).");
  }
  return {
    alg: parts[1],
    salt: rcB64decode(parts[2]),
    iv: rcB64decode(parts[3]),
    ct: rcB64decode(parts[4]),
  };
}

const RealCryptoMethods = [
  {
    id: "aes-gcm",
    name: "AES-256-GCM (WebCrypto)",
    note: "Authenticated. Wrong password fails loudly.",
    needsSubtle: true,
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(12);
      const subtle = rcGetSubtle();
      if (!subtle) throw new Error("WebCrypto is unavailable in this context.");
      const key = await rcPbkdf2Key(password, salt, "AES-GCM");
      const ct = new Uint8Array(
        await subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
      );
      return { salt, iv, ct };
    },
    async decryptBytes(salt, iv, ct, password) {
      const subtle = rcGetSubtle();
      if (!subtle) throw new Error("WebCrypto is unavailable in this context.");
      const key = await rcPbkdf2Key(password, salt, "AES-GCM");
      try {
        return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "aes-cbc",
    name: "AES-256-CBC (WebCrypto)",
    note: "NOT authenticated. Wrong password yields garbage.",
    needsSubtle: true,
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(16);
      const subtle = rcGetSubtle();
      if (!subtle) throw new Error("WebCrypto is unavailable in this context.");
      const key = await rcPbkdf2Key(password, salt, "AES-CBC");
      const ct = new Uint8Array(
        await subtle.encrypt({ name: "AES-CBC", iv }, key, rcPkcs7Pad(plain, 16)),
      );
      return { salt, iv, ct };
    },
    async decryptBytes(salt, iv, ct, password) {
      const subtle = rcGetSubtle();
      if (!subtle) throw new Error("WebCrypto is unavailable in this context.");
      if (ct.length % 16 !== 0 || ct.length === 0) {
        throw new Error("Invalid ciphertext length.");
      }
      const key = await rcPbkdf2Key(password, salt, "AES-CBC");
      try {
        const padded = new Uint8Array(
          await subtle.decrypt({ name: "AES-CBC", iv }, key, ct),
        );
        return rcPkcs7Unpad(padded, 16);
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "aes-cbc-pure",
    name: "AES-256-CBC (pure JS)",
    note: "Pure-JS Rijndael. NOT authenticated.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(16);
      const key = rcSimpleKdf(password, salt, 32);
      return { salt, iv, ct: rcAesCbcEncrypt(key, iv, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 32);
      try {
        return rcAesCbcDecrypt(key, iv, ct);
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "chacha20",
    name: "ChaCha20 (pure JS)",
    note: "Unauthenticated stream cipher. Wrong password yields garbage.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const nonce = (opts && opts.iv) || rcRandomBytes(12);
      const key = rcSimpleKdf(password, salt, 32);
      return { salt, iv: nonce, ct: rcChaChaXor(key, nonce, plain, 0) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 32);
      return rcChaChaXor(key, iv, ct, 0);
    },
  },
  {
    id: "rabbit",
    name: "Rabbit-128 (pure JS)",
    note: "Unauthenticated stream cipher. Wrong password yields garbage.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(8);
      const key = rcSimpleKdf(password, salt, 16);
      return { salt, iv, ct: rcRabbitCrypt(key, iv, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 16);
      return rcRabbitCrypt(key, iv, ct);
    },
  },
  {
    id: "speck",
    name: "Speck-128/256-CBC (pure JS)",
    note: "NSA lightweight cipher. NOT authenticated.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(16);
      const key = rcSimpleKdf(password, salt, 32);
      return { salt, iv, ct: rcSpeckCbcEncrypt(key, iv, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 32);
      try {
        return rcSpeckCbcDecrypt(key, iv, ct);
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "xtea",
    name: "XTEA-128-CBC (pure JS)",
    note: "Academic cipher, related-key attacks exist. NOT authenticated.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(8);
      const key = rcSimpleKdf(password, salt, 16);
      return { salt, iv, ct: rcXteaCbc(key, iv, plain, false) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 16);
      try {
        return rcXteaCbc(key, iv, ct, true);
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "xxtea",
    name: "XXTEA-128 (pure JS)",
    note: "Deterministic (no IV): same text+password = same output. Chosen-plaintext attacks published.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const key = rcSimpleKdf(password, salt, 16);
      return { salt, iv: new Uint8Array(0), ct: rcXxteaEncrypt(key, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 16);
      try {
        return rcXxteaDecrypt(key, ct);
      } catch (e) {
        throw new Error("Decryption failed (wrong password or corrupted data).");
      }
    },
  },
  {
    id: "trivium",
    name: "Trivium-80 (pure JS)",
    note: "eSTREAM hardware cipher. Unauthenticated; thin security margin.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const iv = (opts && opts.iv) || rcRandomBytes(10);
      const key = rcSimpleKdf(password, salt, 10);
      return { salt, iv, ct: rcTriviumCrypt(key, iv, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 10);
      return rcTriviumCrypt(key, iv, ct);
    },
  },
  {
    id: "rc4",
    name: "RC4 (pure JS — WEAK, broken)",
    note: "BROKEN cipher (biases, key-recovery attacks). Curiosity only — never use.",
    async encryptBytes(plain, password, opts) {
      const salt = (opts && opts.salt) || rcRandomBytes(16);
      const key = rcSimpleKdf(password, salt, 32);
      return { salt, iv: new Uint8Array(0), ct: rc4Crypt(key, plain) };
    },
    async decryptBytes(salt, iv, ct, password) {
      const key = rcSimpleKdf(password, salt, 32);
      return rc4Crypt(key, ct);
    },
  },
];

const RealCrypto = {
  methods: RealCryptoMethods,
  unavailable(id) {
    const m = RealCryptoMethods.find((x) => x.id === id);
    return !!(m && m.needsSubtle && !rcGetSubtle());
  },
  async encrypt(algId, plaintext, password, opts) {
    const m = RealCryptoMethods.find((x) => x.id === algId);
    if (!m) throw new Error(`Unknown algorithm: ${algId}`);
    if (!password) throw new Error("A password is required.");
    const { salt, iv, ct } = await m.encryptBytes(
      rcUtf8ToBytes(plaintext),
      password,
      opts,
    );
    return rcPackEnvelope(algId, salt, iv, ct);
  },
  async decrypt(envelope, password, opts) {
    const { alg, salt, iv, ct } = rcParseEnvelope(envelope);
    const m = RealCryptoMethods.find((x) => x.id === alg);
    if (!m) throw new Error(`Unknown algorithm: ${alg}`);
    if (!password) throw new Error("A password is required.");
    void opts;
    const plain = await m.decryptBytes(salt, iv, ct, password);
    return rcBytesToUtf8(plain, true);
  },
  // Test hooks: primitives for vector verification (see test harness).
  _test: {
    rcSha256,
    rcAesExpandKey,
    rcAesEncryptBlock,
    rcAesDecryptBlock,
    rcAesCbcEncrypt,
    rcAesCbcDecrypt,
    rcChaChaBlock,
    rcChaChaXor,
    rc4Crypt,
    rcRabbitKeySetup,
    rcRabbitNext,
    rcRabbitCrypt,
    rcSpeckExpand,
    rcSpeckEncryptBlock,
    rcSpeckDecryptBlock,
    rcXteaBlock,
    rcXxteaEncryptWords,
    rcXxteaDecryptWords,
    rcTriviumCrypt,
    rcHex,
    rcUnhex,
  },
};

if (typeof window !== "undefined") {
  window.RealCrypto = RealCrypto;
}
if (typeof globalThis !== "undefined") {
  globalThis.RealCrypto = RealCrypto;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = RealCrypto;
}

/* ==================== panel wiring ==================== */

function rcGetTargetText(editorEl) {
  const sel =
    typeof window !== "undefined" && window.getSelection
      ? window.getSelection()
      : null;
  if (
    sel &&
    !sel.isCollapsed &&
    editorEl.contains(sel.anchorNode) &&
    editorEl.contains(sel.focusNode)
  ) {
    return { mode: "selection", text: sel.toString() };
  }
  return { mode: "document", text: editorEl.innerText || "" };
}

function rcReplaceTarget(editorEl, mode, result) {
  if (mode === "selection") {
    document.execCommand("insertText", false, result);
  } else {
    editorEl.innerHTML = result
      .split("\n")
      .map((line) =>
        line
          ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
          : "<p><br></p>",
      )
      .join("");
  }
  try {
    localStorage.setItem("markdownContent", editorEl.innerHTML);
  } catch (e) {
    // localStorage unavailable, continue anyway
  }
}

function initRealCryptoPanel() {
  const methodSel = document.getElementById("rcMethod");
  const pwdInput = document.getElementById("rcPassword");
  const encBtn = document.getElementById("rcEncryptBtn");
  const decBtn = document.getElementById("rcDecryptBtn");
  const editorEl = document.getElementById("editor");
  if (!methodSel || !pwdInput || !encBtn || !decBtn || !editorEl) return;

  if (methodSel.options.length === 0) {
    for (const m of RealCryptoMethods) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.needsSubtle && !rcGetSubtle()) {
        opt.disabled = true;
        opt.textContent += " (needs secure context)";
      }
      methodSel.appendChild(opt);
    }
  }

  encBtn.addEventListener("click", async () => {
    const target = rcGetTargetText(editorEl);
    if (!target.text) return;
    if (!pwdInput.value) {
      alert("Enter a password first.");
      return;
    }
    encBtn.disabled = true;
    try {
      const env = await RealCrypto.encrypt(
        methodSel.value,
        target.text,
        pwdInput.value,
      );
      rcReplaceTarget(editorEl, target.mode, env);
    } catch (err) {
      alert(`Encryption failed: ${err.message || err}`);
    }
    encBtn.disabled = false;
  });

  decBtn.addEventListener("click", async () => {
    const target = rcGetTargetText(editorEl);
    const env = (target.text || "").trim();
    if (!env) return;
    if (!env.startsWith("MK2$")) {
      alert("No Marky envelope selected (expected text starting with MK2$).");
      return;
    }
    if (!pwdInput.value) {
      alert("Enter a password first.");
      return;
    }
    decBtn.disabled = true;
    try {
      const plain = await RealCrypto.decrypt(env, pwdInput.value);
      rcReplaceTarget(editorEl, target.mode, plain);
    } catch (err) {
      alert(`Decryption failed: ${err.message || err}`);
    }
    decBtn.disabled = false;
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRealCryptoPanel);
  } else {
    initRealCryptoPanel();
  }
}
