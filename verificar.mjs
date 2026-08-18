// Verificador das demos publicadas. Node puro, sem dependencias.
// Roda dentro do GitHub Actions, onde a rede alcanca o github.io.
//
//   node verificar.mjs <url> <whatsapp-com-ddi>

const [url, whatsappBruto] = process.argv.slice(2);
if (!url || !whatsappBruto) {
  console.error('Uso: node verificar.mjs <url> <whatsapp>');
  process.exit(2);
}
const whatsapp = whatsappBruto.replace(/\D/g, '');

let html, status = 0;
for (let i = 1; i <= 6; i++) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    status = r.status;
    if (r.ok) { html = await r.text(); break; }
    console.log(`  tentativa ${i}: HTTP ${status} — aguardando propagacao...`);
  } catch (e) {
    console.log(`  tentativa ${i}: sem resposta (${e.message})`);
  }
  if (i < 6) await new Promise(r => setTimeout(r, 10000));
}

if (!html) {
  console.error(`\nA pagina nao respondeu (ultimo status: ${status || 'sem resposta'}).`);
  console.error('NAO envie o link. Confira se o GitHub Pages esta ativado.');
  process.exit(1);
}

const itens = [];
const check = (rotulo, ok, detalhe) => itens.push({ rotulo, ok, detalhe });

check('Mobile funciona (viewport)',
  /<meta name="viewport" content="width=device-width[^"]*"/.test(html), 'meta viewport');

const zaps = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => m[1]);
check('WhatsApp abre', zaps.length > 0 && zaps.every(l => l.includes(`wa.me/${whatsapp}?`)),
  zaps.length ? `${zaps.length} link(s) para ${whatsapp}` : 'nenhum link wa.me');

const tels = [...html.matchAll(/href="tel:\+?(\d+)"/g)].map(m => m[1]);
check('Telefone funciona', tels.length > 0 && tels.every(t => t === whatsapp),
  tels.length ? `tel:+${tels[0]}` : 'nenhum link tel:');

const ancoras = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const quebradas = ancoras.filter(a => !ids.has(a));
check('Menu e links internos funcionam', quebradas.length === 0,
  quebradas.length ? `sem destino: #${quebradas.join(', #')}` : `${ancoras.length} ancoras ok`);

const externos = [...html.matchAll(/<(?:img|script|link|iframe)[^>]+(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
check('Pagina autocontida', externos.length === 0,
  externos.length ? `externos: ${externos.slice(0, 3).join(', ')}` : 'nenhum recurso externo');

const semAlt = [...html.matchAll(/<img(?![^>]*\balt=)[^>]*>/g)].length;
check('Imagens com texto alternativo', semAlt === 0, semAlt ? `${semAlt} sem alt` : 'ok');
check('Idioma declarado', /<html[^>]+lang="pt-BR"/.test(html), 'lang="pt-BR"');
check('Titulo da pagina', /<title>[^<]{10,}<\/title>/.test(html), '<title> com conteudo');
check('Meta description', /<meta name="description" content="[^"]{30,}"/.test(html), 'ok');

const restos = /undefined|null|\[object Object\]|NaN(?![a-z])/i.test(html.replace(/NaN[a-z]/g, ''));
check('Sem erros de montagem', !restos, restos ? 'texto suspeito' : 'ok');

const kb = Buffer.byteLength(html, 'utf8') / 1024;
check('Pagina leve', kb <= 150, `${kb.toFixed(0)} KB`);
check('Aviso de demonstracao', /demonstra/i.test(html), 'rodape identifica como demo');

console.log(`\nHTTP ${status} · ${kb.toFixed(0)} KB\n`);
for (const i of itens) console.log(` ${i.ok ? 'OK ' : 'X  '} ${i.rotulo} — ${i.detalhe}`);

const passou = itens.every(i => i.ok);
console.log(passou ? '\nAPROVADO: pagina no ar e correta. Pode enviar o link.'
                   : '\nREPROVADO: NAO envie o link.');
process.exit(passou ? 0 : 1);
