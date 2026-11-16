// eslint-disable-next-line @typescript-eslint/no-require-imports
const { escolherCmake, caminhoProperties, conteudoLocalProperties } = require('../preparar-android');

describe('preparar-android', () => {
  it('escolhe a maior versão de CMake a partir de 3.31', () => {
    expect(escolherCmake(['3.22.1', '3.31.6', '3.30.5'])).toBe('3.31.6');
    expect(escolherCmake(['3.31.6', '4.1.2'])).toBe('4.1.2');
  });

  it('devolve null quando só há CMake antigo ou pasta estranha', () => {
    expect(escolherCmake(['3.22.1', '3.18.1'])).toBeNull();
    expect(escolherCmake(['leia-me', ''])).toBeNull();
    expect(escolherCmake([])).toBeNull();
  });

  it('grava caminho do Windows com barras normais e o drive escapado', () => {
    expect(caminhoProperties('C:\\Users\\a\\sdk')).toBe('C\\:/Users/a/sdk');
    expect(caminhoProperties('/opt/android')).toBe('/opt/android');
  });

  it('monta sdk.dir e cmake.dir sem nenhuma barra invertida solta', () => {
    const texto = conteudoLocalProperties('C:\\sdk', '3.31.6');
    expect(texto).toBe('sdk.dir=C\\:/sdk\ncmake.dir=C\\:/sdk/cmake/3.31.6\n');
    expect(texto.replace(/C\\:/g, '')).not.toContain('\\');
  });

  it('omite cmake.dir quando não há versão adequada', () => {
    expect(conteudoLocalProperties('/opt/android', null)).toBe('sdk.dir=/opt/android\n');
  });
});
