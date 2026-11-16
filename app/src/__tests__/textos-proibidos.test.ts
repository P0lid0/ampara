// A spec proíbe prometer o que o Ampara não faz: ele avisa, não bloqueia o celular nem rastreia o aparelho.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.join(__dirname, '..');
const arquivos: string[] = [];
const varrer = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') varrer(p);
    } else if (/\.tsx?$/.test(e.name)) {
      arquivos.push(p);
    }
  }
};
varrer(raiz);
const rel = (p: string) => path.relative(raiz, p).replace(/\\/g, '/');

// Só o que aparece como texto entre aspas ou crases (comentários ficam de fora).
function literais(texto: string): string[] {
  const semComentario = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...semComentario.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? '',
  );
}

const NEGACAO = /(n[ãa]o|nunca|jamais|sem)\s+(\w+\s+){0,2}$/i;

describe('textos proibidos', () => {
  it('nenhum texto de interface contém "Modo bloqueado", "bloqueia o celular" (sem negação), "SMS" nem "rastrear o aparelho"', () => {
    const ruins: string[] = [];
    for (const a of arquivos) {
      for (const l of literais(fs.readFileSync(a, 'utf8'))) {
        if (/modo bloqueado/i.test(l)) ruins.push(`${rel(a)}: ${l}`);
        if (/\bSMS\b/i.test(l)) ruins.push(`${rel(a)}: ${l}`);
        if (/rastrear o aparelho/i.test(l)) ruins.push(`${rel(a)}: ${l}`);
        for (const m of l.matchAll(/bloqueia o celular/gi)) {
          if (!NEGACAO.test(l.slice(0, m.index))) ruins.push(`${rel(a)}: ${l}`);
        }
      }
    }
    expect(ruins).toEqual([]);
  });

  it('a tela Ajustes contém a frase "não bloqueia o seu celular"', () => {
    const t = fs.readFileSync(path.join(raiz, 'app', '(tabs)', 'ajustes.tsx'), 'utf8');
    expect(t).toContain('não bloqueia o seu celular');
  });
});
