// A spec proíbe prometer o que o Ampara não faz: ele avisa, não bloqueia o celular nem rastreia o aparelho.
import { screen } from '@testing-library/react-native';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { Text } from 'react-native';
import { renderTela } from '../testing/renderTela'; // primeiro: registra os mocks antes das telas
import { abrir, nos, TELAS, textosRenderizados } from '../testing/telas';
import { textosDoCodigo } from '../testing/textosDoCodigo';

jest.setTimeout(60000);

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

const NEGACAO = /(n[ãa]o|nunca|jamais|sem)\s+(\w+\s+){0,2}$/i;

// Devolve, para um texto, cada trecho que a spec proíbe.
function proibidos(texto: string): string[] {
  const ruins: string[] = [];
  if (/modo bloqueado/i.test(texto)) ruins.push('Modo bloqueado');
  if (/\bSMS\b/i.test(texto)) ruins.push('SMS');
  if (/rastrear o aparelho/i.test(texto)) ruins.push('rastrear o aparelho');
  for (const m of texto.matchAll(/bloqueia o celular/gi)) {
    if (!NEGACAO.test(texto.slice(0, m.index))) ruins.push('bloqueia o celular');
  }
  return ruins;
}

describe('detector de textos proibidos', () => {
  it('pega texto JSX entre tags, string, template e string com //', () => {
    const codigo = [
      "const a = <Texto>Modo bloqueado ativo</Texto>;",
      "const b = <Texto>Enviamos um SMS</Texto>;",
      "const c = 'a // b rastrear o aparelho';",
      'const d = `o app bloqueia o celular ${x}`;',
    ].join('\n');
    expect(textosDoCodigo(codigo).flatMap(proibidos).sort()).toEqual(
      ['Modo bloqueado', 'SMS', 'bloqueia o celular', 'rastrear o aparelho'].sort(),
    );
  });

  it('ignora comentários e aceita a negação', () => {
    const codigo = "// Modo bloqueado\n/* SMS */\nconst a = 'não bloqueia o celular';";
    expect(textosDoCodigo(codigo).flatMap(proibidos)).toEqual([]);
  });

  it('pega o texto renderizado de um componente (JSX, interpolação e rótulo)', async () => {
    const Falsa = () => createElement(Text, { accessibilityLabel: 'Enviar SMS' }, 'Modo ', 'bloqueado');
    await renderTela(Falsa);
    const lidos = textosRenderizados(nos(screen.root));
    expect(lidos.flatMap(proibidos)).toContain('SMS');
    expect(lidos.join('').toLowerCase()).toContain('modo bloqueado');
  });
});

describe('textos proibidos', () => {
  it('nenhum texto do código (literais e JSX) contém "Modo bloqueado", "bloqueia o celular" (sem negação), "SMS" nem "rastrear o aparelho"', () => {
    const ruins: string[] = [];
    for (const a of arquivos) {
      for (const t of textosDoCodigo(fs.readFileSync(a, 'utf8'), a)) {
        for (const r of proibidos(t)) ruins.push(`${rel(a)}: ${r} em "${t}"`);
      }
    }
    expect(ruins).toEqual([]);
  });

  describe.each(TELAS)('tela %s renderizada', (nome, Tela) => {
    it('não mostra nem fala nenhum texto proibido', async () => {
      const todos = await abrir(Tela);
      const ruins = textosRenderizados(todos).flatMap((t) => proibidos(t).map((r) => `${r} em "${t}"`));
      expect(ruins).toEqual([]);
    });
  });

  it('a tela Ajustes mostra a frase "não bloqueia o seu celular"', async () => {
    const Ajustes = TELAS.find(([n]) => n === '(tabs)/ajustes')![1];
    const todos = await abrir(Ajustes);
    expect(textosRenderizados(todos).join(' ')).toContain('não bloqueia o seu celular');
  });
});
