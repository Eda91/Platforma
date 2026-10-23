import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (password.length < 12) throw new Error('Use at least 12 characters.');
const salt = randomBytes(16).toString('hex');
console.log(`${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
