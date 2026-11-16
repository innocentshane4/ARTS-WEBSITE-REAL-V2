/**
 * ARTS - TOTP (RFC 6238) helper, pure Web Crypto, no dependencies.
 * Mirrors the app's TotpHelper.kt: 6 digits, SHA-1, 30 second step,
 * so a code from Google Authenticator/Authy works in both places.
 */
const TOTP = (() => {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const STEP = 30;

  function base32Encode(bytes) {
    let bits = 0, value = 0, out = "";
    for (const b of bytes) {
      value = (value << 8) | b; bits += 8;
      while (bits >= 5) { bits -= 5; out += ALPHABET[(value >>> bits) & 31]; }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
  }

  function base32Decode(str) {
    const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0, value = 0; const out = [];
    for (const ch of clean) {
      value = (value << 5) | ALPHABET.indexOf(ch); bits += 5;
      if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 0xff); }
    }
    return new Uint8Array(out);
  }

  function counterBytes(counter) {
    const buf = new ArrayBuffer(8); const view = new DataView(buf);
    // JS numbers are safe up to 2^53, counter never gets remotely that large.
    view.setUint32(4, counter >>> 0);
    view.setUint32(0, Math.floor(counter / 2 ** 32));
    return new Uint8Array(buf);
  }

  async function hotp(secretBase32, counter) {
    const key = await crypto.subtle.importKey("raw", base32Decode(secretBase32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
    const offset = sig[sig.length - 1] & 0x0f;
    const code = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, "0");
  }

  return {
    generateSecret() {
      const bytes = crypto.getRandomValues(new Uint8Array(20));
      return base32Encode(bytes);
    },
    buildOtpAuthUri(secret, accountEmail) {
      return `otpauth://totp/ARTS:${encodeURIComponent(accountEmail)}?secret=${secret}&issuer=ARTS&digits=6&period=30`;
    },
    async currentCode(secret) {
      return hotp(secret, Math.floor(Date.now() / 1000 / STEP));
    },
    /** Allows one 30s step of drift either way, same as the app. */
    async verify(secret, code) {
      const clean = String(code || "").trim();
      if (!/^\d{6}$/.test(clean)) return false;
      const counter = Math.floor(Date.now() / 1000 / STEP);
      for (const drift of [0, -1, 1]) {
        if ((await hotp(secret, counter + drift)) === clean) return true;
      }
      return false;
    },
  };
})();
