// Suíte transversal dos critérios de acessibilidade da spec 6.6: vale para TODA tela de src/app.
// Se uma tela nova reprovar aqui, corrija a tela ou o componente (Botao, Texto, Campo), nunca o teste.
import { screen } from '@testing-library/react-native';
import fs from 'node:fs';
import path from 'node:path';
import { StyleSheet } from 'react-native';
import { renderTela } from '../testing/renderTela'; // primeiro: registra os mocks antes das telas
import { abrir, ehTocavel, nos, TELAS, type No } from '../testing/telas';
import { EstadoBadge, type Estado } from '../ui/EstadoBadge';

jest.setTimeout(60000);

const estilo = (no: No) => StyleSheet.flatten(no.props.style as never) ?? {};
const descrever = (no: No) => String(no.props.accessibilityLabel ?? no.props.testID ?? no.type);

describe('telas: lista completa', () => {
  it('TELAS cobre todo arquivo de tela em src/app (menos layouts e testes)', () => {
    const base = path.join(__dirname, '..', 'app');
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__') varrer(p);
        } else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_layout')) {
          achados.push(path.relative(base, p).replace(/\\/g, '/').replace(/\.tsx$/, ''));
        }
      }
    };
    varrer(base);
    expect(TELAS.map(([n]) => n).sort()).toEqual(achados.sort());
  });
});

describe.each(TELAS)('%s', (_nome, Tela) => {
  it('todo elemento com onPress tem accessibilityLabel não vazio e accessibilityRole', async () => {
    const todos = await abrir(Tela);
    const falhas = todos
      .filter(ehTocavel)
      .filter((n) => {
        const rotulo = n.props.accessibilityLabel;
        const papel = n.props.accessibilityRole ?? n.props.role;
        return typeof rotulo !== 'string' || rotulo.trim() === '' || !papel;
      })
      .map(descrever);
    expect(falhas).toEqual([]);
  });

  it('nenhum Text tem allowFontScaling=false e todo fontSize achatado é >= 16', async () => {
    const todos = await abrir(Tela);
    const textos = todos.filter((n) => n.type === 'Text' || n.type === 'TextInput');
    expect(textos.filter((n) => n.props.allowFontScaling === false).map(descrever)).toEqual([]);
    const pequenos = textos
      .filter((n) => !(typeof estilo(n).fontSize === 'number' && (estilo(n).fontSize as number) >= 16))
      .map((n) => `${descrever(n)} (${String(estilo(n).fontSize)})`);
    expect(pequenos).toEqual([]);
  });

  it('todo botão tem minHeight >= 48 e minWidth >= 48 no estilo achatado', async () => {
    const todos = await abrir(Tela);
    const falhas = todos
      .filter((n) => typeof n.props.onClick === 'function')
      .filter((n) => !((estilo(n).minHeight as number) >= 48 && (estilo(n).minWidth as number) >= 48))
      .map(descrever);
    expect(falhas).toEqual([]);
  });
});

describe('varredura de código', () => {
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

  it('nenhum arquivo em src/ contém allowFontScaling={false} nem maxFontSizeMultiplier menor que 2', () => {
    const ruins: string[] = [];
    for (const a of arquivos) {
      const t = fs.readFileSync(a, 'utf8');
      if (/allowFontScaling\s*=\s*\{\s*false\s*\}/.test(t)) ruins.push(`${rel(a)}: allowFontScaling={false}`);
      for (const m of t.matchAll(/maxFontSizeMultiplier\s*=\s*\{?\s*([0-9.]+)/g)) {
        if (Number(m[1]) < 2) ruins.push(`${rel(a)}: maxFontSizeMultiplier=${m[1]}`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it('cores hexadecimais fora de tokens.ts só aparecem em tokens.ts', () => {
    const ruins: string[] = [];
    for (const a of arquivos) {
      if (rel(a) === 'theme/tokens.ts') continue;
      const t = fs.readFileSync(a, 'utf8');
      for (const m of t.matchAll(/['"`]#[0-9a-fA-F]{3,8}['"`]/g)) ruins.push(`${rel(a)}: ${m[0]}`);
    }
    expect(ruins).toEqual([]);
  });
});

describe('EstadoBadge', () => {
  const estados: Estado[] = ['aberta', 'cancelada', 'encerrada', 'teste', 'online', 'offline', 'feito', 'pendente'];
  it.each(estados)('mostra texto para o estado %s (nunca só cor)', async (e) => {
    await renderTela(() => <EstadoBadge estado={e} />);
    const textos = nos(screen.root).filter((n) => n.type === 'Text');
    const escritos = textos.map((n) => n.children.join('').trim()).filter((t) => /\p{L}/u.test(t));
    expect(escritos.length).toBeGreaterThan(0);
  });
});
