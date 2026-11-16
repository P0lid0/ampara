// Lista das telas de src/app e ajudantes de inspeção da árvore renderizada, usados pelas suítes transversais.
import { act, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';
import { PASSOS } from '../onboarding/passos';
import { renderTela } from './renderTela'; // primeiro: registra os mocks antes das telas
import Ajustes from '../app/(tabs)/ajustes';
import Historico from '../app/(tabs)/historico';
import Inicio from '../app/(tabs)/index';
import Mapa from '../app/(tabs)/mapa';
import Bo from '../app/bo';
import Entrar from '../app/entrar';
import Aceitar from '../app/guardiao/aceitar';
import Alarme from '../app/guardiao/alarme';
import PassoAPasso from '../app/guardiao/passo-a-passo';
import Ocorrencia from '../app/ocorrencia/[id]';
import Chaveiro from '../app/onboarding/chaveiro';
import Checklist from '../app/onboarding/checklist';
import Consentimento from '../app/onboarding/consentimento';
import Conta from '../app/onboarding/conta';
import Contas from '../app/onboarding/contas';
import Emergencia from '../app/onboarding/emergencia';
import Guardioes from '../app/onboarding/guardioes';
import Imei from '../app/onboarding/imei';
import Relato from '../app/relato';
import Rota from '../app/rota';


export const TELAS: [string, ComponentType][] = [
  ['(tabs)/index', Inicio],
  ['(tabs)/mapa', Mapa],
  ['(tabs)/historico', Historico],
  ['(tabs)/ajustes', Ajustes],
  ['bo', Bo],
  ['entrar', Entrar],
  ['guardiao/aceitar', Aceitar],
  ['guardiao/alarme', Alarme],
  ['guardiao/passo-a-passo', PassoAPasso],
  ['ocorrencia/[id]', Ocorrencia],
  ['onboarding/chaveiro', Chaveiro],
  ['onboarding/checklist', Checklist],
  ['onboarding/consentimento', Consentimento],
  ['onboarding/conta', Conta],
  ['onboarding/contas', Contas],
  ['onboarding/emergencia', Emergencia],
  ['onboarding/guardioes', Guardioes],
  ['onboarding/imei', Imei],
  ['relato', Relato],
  ['rota', Rota],
];

export type No = { type: unknown; props: Record<string, unknown>; children: unknown[] };

export function nos(raiz: unknown): No[] {
  const saida: No[] = [];
  const andar = (n: unknown) => {
    if (typeof n === 'string' || n == null) return;
    const no = n as No;
    saida.push(no);
    no.children.forEach(andar);
  };
  andar(raiz);
  return saida;
}

export const ehTocavel = (no: No) =>
  typeof no.props.onClick === 'function' || no.type === 'RCTSwitch' || no.type === 'RNCSlider';

// Abre a tela e espera, sem relógio fixo, que ela saia do carregamento: tem de haver algo tocável.
export async function abrir(Tela: ComponentType, params?: Record<string, string>): Promise<No[]> {
  // Onboarding concluido: senao o Inicio redireciona para o proximo passo e fica em branco.
  await sessaoRepo(await abrirBanco()).set('onboarding.concluidos', JSON.stringify(PASSOS));
  await renderTela(Tela, { params });
  await waitFor(() => expect(nos(screen.root).filter(ehTocavel).length).toBeGreaterThan(0), { timeout: 10000 });
  await act(async () => {});
  return nos(screen.root);
}

// Todo texto que a pessoa lê ou ouve na tela renderizada: Text, rótulos de acessibilidade e placeholders.
export function textosRenderizados(todos: No[]): string[] {
  const saida: string[] = [];
  for (const n of todos) {
    for (const c of n.children) if (typeof c === 'string') saida.push(c);
    for (const k of ['accessibilityLabel', 'placeholder', 'accessibilityHint'])
      if (typeof n.props[k] === 'string') saida.push(n.props[k] as string);
  }
  return saida;
}
