// Ajudante de teste das telas: renderiza uma tela com tudo o que ela precisa sem tocar em rede,
// disco ou aparelho. Importe este arquivo ANTES das telas, para os mocks abaixo valerem para elas.
//   - expo-router: navegação falsa; os parâmetros da rota vêm de `renderTela(Tela, { params })`.
//   - api: cada função de `api.*` é um jest.fn com a resposta mínima de `respostaMinima`.
//   - sessao: useSessao devolve um usuario autenticado (as telas protegidas renderizam de verdade).
//   - banco: o SQLite em memória do `__mocks__/expo-sqlite`; `o.db` troca por outro banco.
import { render, type RenderResult } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import * as dbModulo from '../db/db';
import type { Banco } from '../db/db';

let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useSegments: () => [],
    useRootNavigationState: () => ({ key: 'teste' }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});

// Sessão de usuário autenticado: sem ela telas como Início, Histórico e Rota ficam em branco e a suíte nada inspeciona.
jest.mock('../auth/sessao', () => ({
  ...jest.requireActual('../auth/sessao'),
  useSessao: () => ({ autenticado: true, escopo: 'usuario', expiraEm: null }),
}));

jest.mock('../api/endpoints', () => {
  const { respostaMinima } = require('./respostasMinimas');
  const grupos = new Map<string, Map<string, jest.Mock>>();
  const funcao = (grupo: string, nome: string) => {
    const g = grupos.get(grupo) ?? new Map<string, jest.Mock>();
    grupos.set(grupo, g);
    if (!g.has(nome)) g.set(nome, jest.fn(async () => respostaMinima(grupo, nome)));
    return g.get(nome);
  };
  const api = new Proxy({}, { get: (_, grupo: string) => new Proxy({}, { get: (__, nome: string) => funcao(grupo, nome) }) });
  return { __esModule: true, api };
});

export type OpcoesTela = { params?: Record<string, string>; db?: Banco };

export function renderTela(Tela: ComponentType, o: OpcoesTela = {}): Promise<RenderResult> {
  mockParams = { id: 'oc-1', ocorrenciaId: 'oc-1', ...o.params };
  if (o.db) jest.spyOn(dbModulo, 'abrirBanco').mockResolvedValue(o.db);
  return render(
    <View>
      <Tela />
    </View>,
  );
}
