/**
 * Sobe o site sem Postgres, só para ver o layout no navegador.
 * Funciona igual no Windows e no Linux (npm run preview).
 *
 * O formulário navega pelas 6 etapas normalmente; só o envio final
 * é recusado, porque não há banco para gravar.
 */
process.env.SEM_BANCO = '1';
process.env.DATABASE_URL ||= 'postgresql://vitrine@localhost:5432/vitrine';

await import('./server.js');
