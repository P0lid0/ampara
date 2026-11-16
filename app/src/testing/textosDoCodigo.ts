// Extrai o texto de interface de um arquivo .ts/.tsx lendo a sintaxe de verdade (não por regex):
// literais de string, literais de template e texto JSX entre tags. Comentários nunca entram.
import ts from 'typescript';

export function textosDoCodigo(codigo: string, nome = 'arquivo.tsx'): string[] {
  const fonte = ts.createSourceFile(nome, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const saida: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) saida.push(n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) saida.push(n.text);
    else if (ts.isJsxText(n)) saida.push(n.text.replace(/\s+/g, ' ').trim());
    ts.forEachChild(n, visitar);
  };
  visitar(fonte);
  return saida.filter((t) => t !== '');
}
