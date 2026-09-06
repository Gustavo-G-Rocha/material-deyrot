/**
 * Gera o hash de uma senha para colar em `acessos`, no config.js.
 *
 *   npm run senha "a senha nova"
 *
 * O hash tem sal próprio, então rodar duas vezes na mesma senha dá resultados
 * diferentes — e os dois continuam válidos.
 */

import { gerarHash } from '../lib/auth.js';

const senha = process.argv.slice(2).join(' ');

if (!senha) {
  console.error('\n  Uso: npm run senha "a senha nova"\n');
  process.exit(1);
}
if (senha.length < 8) {
  console.error('\n  Use pelo menos 8 caracteres.\n');
  process.exit(1);
}

console.log(`\n  hash: '${gerarHash(senha)}',\n`);
