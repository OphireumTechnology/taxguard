/**
 * Hidden terminal input for local provisioning scripts.
 *
 * Raw-mode terminals deliver input in chunks: a paste, or fast typing followed by Enter, can
 * arrive as one chunk such as "secret\r\n". The parser therefore works character by character:
 * - Enter (CR or LF) ends input; anything after it in the same chunk is discarded;
 * - a LF that arrives first (the tail of a CRLF split across chunks) is ignored;
 * - Backspace / Delete remove the previous character;
 * - Ctrl+C cancels; Ctrl+D ends input;
 * - escape sequences (arrow keys, bracketed-paste markers) and other control characters are
 *   dropped, so they can never become part of a password.
 */
export function createHiddenInputParser() {
  let value = '';
  let state = 'reading'; // 'reading' | 'done' | 'cancelled'
  let escape = null; // null | 'start' | 'csi' | 'ss3'

  function feed(chunk) {
    if (state !== 'reading') return state;
    for (const ch of String(chunk)) {
      const code = ch.codePointAt(0);
      if (escape) {
        if (escape === 'start') escape = ch === '[' ? 'csi' : ch === 'O' ? 'ss3' : null;
        else if (escape === 'ss3') escape = null;
        else if (code >= 0x40 && code <= 0x7e) escape = null; // CSI final byte
        continue;
      }
      if (ch === '\u001b') { escape = 'start'; continue; }
      if (ch === '\u0003') { state = 'cancelled'; return state; }
      if (ch === '\n' && value === '') continue;
      if (ch === '\r' || ch === '\n' || ch === '\u0004') { state = 'done'; return state; }
      if (ch === '\b' || ch === '\u007f') { value = Array.from(value).slice(0, -1).join(''); continue; }
      if (code < 0x20) continue;
      value += ch;
    }
    return state;
  }

  return { feed, get value() { return value; }, get state() { return state; } };
}

/** Prompts on an interactive terminal without echoing. Rejects when stdin is not a TTY. */
export function askHidden(question, { stdin = process.stdin, stdout = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) return reject(new Error('Run this script in an interactive terminal (input must be hidden).'));
    stdout.write(question);
    const parser = createHiddenInputParser();
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const finish = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); stdout.write('\n'); };
    const onData = chunk => {
      const state = parser.feed(chunk);
      if (state === 'cancelled') { finish(); process.exit(130); }
      if (state === 'done') { finish(); resolve(parser.value); }
    };
    stdin.on('data', onData);
  });
}

/** Password policy shared by the local provisioning scripts. */
export function passwordProblems(password, email) {
  const problems = [];
  if (password.length < 14) problems.push('at least 14 characters');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push('upper- and lower-case letters');
  if (!/\d/.test(password)) problems.push('a digit');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('a symbol');
  if (/[\u0000-\u001f\u007f]/.test(password)) problems.push('no control characters');
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase())) problems.push('must not contain the e-mail name');
  return problems;
}
