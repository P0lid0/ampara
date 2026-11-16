import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { aoExpirar, definirToken } from '../api/cliente';
import { api } from '../api/endpoints';
import type { Token } from '../api/tipos';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';

export type Escopo = 'usuario' | 'emergencia';
export type EstadoSessao = { autenticado: boolean; escopo: Escopo | null; expiraEm: string | null };
export type MotivoSaida = 'expirou' | 'manual';

const CHAVE_TOKEN = 'ampara.token';
const MAX_TIMER_MS = 2 ** 31 - 1;
const SEM_SESSAO: EstadoSessao = { autenticado: false, escopo: null, expiraEm: null };

let estado: EstadoSessao = SEM_SESSAO;
let motivoSaida: MotivoSaida | null = null;
const ouvintes = new Set<() => void>();
const callbacksSair: (() => void)[] = [];
let timerExpiracao: ReturnType<typeof setTimeout> | null = null;

function publicar(novo: EstadoSessao): void {
  estado = novo;
  ouvintes.forEach((l) => l());
}

function limparTimer(): void {
  if (timerExpiracao) clearTimeout(timerExpiracao);
  timerExpiracao = null;
}

// Agenda a saída no instante de expiração (usado nos dois escopos).
function agendarExpiracao(expiraEm: string): void {
  limparTimer();
  const ms = Math.max(0, new Date(expiraEm).getTime() - Date.now());
  timerExpiracao = setTimeout(() => {
    void sair('expirou');
  }, Math.min(ms, MAX_TIMER_MS));
}

function ativar(t: Token, escopo: Escopo): void {
  motivoSaida = null;
  definirToken(t.token);
  agendarExpiracao(t.expiraEm);
  publicar({ autenticado: true, escopo, expiraEm: t.expiraEm });
}

export async function entrar(email: string, senha: string): Promise<void> {
  const t = await api.auth.login({ email, senha });
  await SecureStore.setItemAsync(CHAVE_TOKEN, JSON.stringify(t));
  ativar(t, 'usuario');
}

export async function criarConta(nome: string, email: string, senha: string): Promise<void> {
  await api.auth.registrar({ nome, email, senha });
  await entrar(email, senha);
}

// RF1: o token de emergência vive só em memória (nunca SecureStore nem SQLite) e expira sozinho.
export async function entrarComoEmergencia(email: string, codigo: string, palavraSecreta: string): Promise<void> {
  const t = await api.auth.emergencia({ email, codigo, palavraSecreta });
  ativar(t, 'emergencia');
}

/** Recupera o token de usuário salvo (chamado uma vez na abertura do app). Token vencido é descartado. */
export async function restaurar(): Promise<void> {
  const bruto = await SecureStore.getItemAsync(CHAVE_TOKEN);
  if (!bruto) return;
  try {
    const t = JSON.parse(bruto) as Token;
    if (typeof t.token === 'string' && new Date(t.expiraEm).getTime() > Date.now()) {
      ativar(t, 'usuario');
      return;
    }
  } catch {
    // token corrompido: apaga abaixo
  }
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
}

// Nunca rejeita: cada etapa roda por conta própria (aparelho emprestado precisa apagar o máximo possível)
// e os callbacks de aoSair rodam sempre. Falhas vão para o log sem dado pessoal.
export async function sair(motivo: MotivoSaida = 'manual'): Promise<void> {
  limparTimer();
  definirToken(null);
  motivoSaida = motivo;
  publicar(SEM_SESSAO);
  try {
    await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  } catch {
    console.warn('sessao: falha ao apagar o token salvo');
  }
  try {
    await sessaoRepo(await abrirBanco()).apagarTudo();
  } catch {
    console.warn('sessao: falha ao limpar o banco local');
  }
  for (const cb of [...callbacksSair]) {
    try {
      cb();
    } catch {
      console.warn('sessao: callback de saida falhou');
    }
  }
}

/** Registra um callback de saída; devolve a função que o remove. */
export function aoSair(cb: () => void): () => void {
  callbacksSair.push(cb);
  return () => {
    const i = callbacksSair.indexOf(cb);
    if (i >= 0) callbacksSair.splice(i, 1);
  };
}

/** Por que a sessão terminou ('expirou' = tempo ou servidor), até a próxima entrada. */
export function useMotivoSaida(): MotivoSaida | null {
  return useSyncExternalStore(assinar, () => motivoSaida, () => motivoSaida);
}

export function limparMotivoSaida(): void {
  if (motivoSaida === null) return;
  motivoSaida = null;
  ouvintes.forEach((l) => l());
}

function assinar(l: () => void): () => void {
  ouvintes.add(l);
  return () => ouvintes.delete(l);
}

/** Estado atual fora de componentes (ex.: tarefa da rota em segundo plano). */
export function sessaoAtual(): EstadoSessao {
  return estado;
}

export function useSessao(): EstadoSessao {
  return useSyncExternalStore(assinar, () => estado, () => estado);
}

// 401 fora de /auth/*: a sessão venceu no servidor.
aoExpirar(() => {
  void sair('expirou');
});
