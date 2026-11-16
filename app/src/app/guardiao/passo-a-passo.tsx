// Passo a passo do guardião (P1): cinco cartões, um por providência (banco, Celular Seguro, operadora,
// senhas, BO), cada um com o horário em que foi feito. A ordem é sugestão, não trava nada. As contas
// vêm da ocorrência (as da vítima); o app não baixa o catálogo.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../../api/cliente';
import type { OcorrenciaDto, Passo } from '../../api/tipos';
import { abrirBanco } from '../../db/db';
import { escolherFonte, ORDEM_PASSOS, urlTelefone, type FonteOcorrencia } from '../../guardiao/fonteOcorrencia';
import { horaLocal } from '../../guardiao/notificacao';
import { ouvirPassos } from '../../guardiao/passosAoVivo';
import { cores, espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

const CELULAR_SEGURO = 'https://www.celularseguro.sp.gov.br';
const MSG_SEM_REDE = 'Sem conexão. Tente de novo.';

const TITULOS: Record<Passo, string> = {
  Banco: 'Banco',
  CelularSeguro: 'Celular Seguro',
  Operadora: 'Operadora',
  Senhas: 'Senhas',
  Bo: 'BO',
};

const TEXTOS: Record<Passo, string> = {
  Banco: 'Ligue para o banco e peça para bloquear o cartão e o acesso pelo app. Se tiver mais de um banco, faça com todos.',
  CelularSeguro: 'Bloqueie o celular e as linhas pelo Celular Seguro, o serviço do governo.',
  Operadora: 'Ligue para a operadora e peça para bloquear o chip e a linha.',
  Senhas: 'Troque a senha do e-mail e das contas que estavam no celular.',
  Bo: 'Avise que o BO será gerado pela própria pessoa, em outro aparelho.',
};

const SEM_CONTA: Partial<Record<Passo, string>> = {
  Banco: 'Nenhum banco cadastrado. Ligue para o seu banco pelo número do cartão.',
  Operadora: 'Nenhuma operadora cadastrada. Ligue para a sua operadora pelo número do chip.',
};

const TIPO_DO_PASSO: Partial<Record<Passo, string>> = { Banco: 'banco', Operadora: 'operadora' };

/** Falha de rede (status 0) tem frase própria; o resto usa a mensagem da API. */
const mensagem = (e: unknown) => (e instanceof ApiErro && e.status === 0 ? MSG_SEM_REDE : mensagemDeErro(e));

type Feitos = Partial<Record<Passo, string | null>>;

export default function PassoAPasso() {
  const { ocorrenciaId: param } = useLocalSearchParams<{ ocorrenciaId?: string }>();
  const id = typeof param === 'string' ? param : '';
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaDto | null>(null);
  const [feitos, setFeitos] = useState<Feitos>({});
  const [erroTela, setErroTela] = useState<string | undefined>();
  const [erros, setErros] = useState<Partial<Record<Passo, string>>>({});
  const [enviando, setEnviando] = useState<ReadonlySet<Passo>>(new Set());
  const fonte = useRef<FonteOcorrencia | null>(null);
  const montada = useRef(true);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setErroTela(undefined);
    try {
      fonte.current = escolherFonte(id, await abrirBanco());
      const { ocorrencia: o } = await fonte.current.carregar(id);
      if (!montada.current) return;
      setOcorrencia(o);
      setFeitos((atual) => {
        const novo: Feitos = {};
        for (const p of o.passos) novo[p.passo] = p.concluidoEm;
        // um passo já visto como feito não volta a pendente por uma resposta mais antiga
        for (const [p, h] of Object.entries(atual)) if (h && !novo[p as Passo]) novo[p as Passo] = h;
        return novo;
      });
    } catch (e) {
      if (montada.current) setErroTela(mensagem(e));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // PassoAtualizado de outro guardião: atualiza o cartão sem recarregar.
  useEffect(
    () =>
      ouvirPassos((e) => {
        if (e.ocorrenciaId !== id || !ORDEM_PASSOS.includes(e.passo as Passo)) return;
        setFeitos((atual) => ({ ...atual, [e.passo as Passo]: e.concluidoEm }));
      }),
    [id],
  );

  async function marcar(passo: Passo) {
    const f = fonte.current;
    if (!f || enviando.has(passo)) return;
    setErros((e) => ({ ...e, [passo]: undefined }));
    setEnviando((s) => new Set(s).add(passo));
    try {
      const { concluidoEm } = await f.concluirPasso(id, passo);
      if (montada.current) setFeitos((atual) => ({ ...atual, [passo]: concluidoEm }));
    } catch (e) {
      if (montada.current) setErros((er) => ({ ...er, [passo]: mensagem(e) }));
    } finally {
      if (montada.current) {
        setEnviando((s) => {
          const novo = new Set(s);
          novo.delete(passo);
          return novo;
        });
      }
    }
  }

  const abrir = (url: string) => void Linking.openURL(url).catch(() => undefined);
  const total = ORDEM_PASSOS.length;
  const feitosN = ORDEM_PASSOS.filter((p) => feitos[p]).length;

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Passo a passo' }} />
      <Texto variante="titulo">O que fazer agora</Texto>
      <Texto>Siga na ordem que fizer sentido. Cada passo feito fica marcado para os outros guardiões.</Texto>

      {ocorrencia ? (
        <Texto variante="legenda" accessibilityLiveRegion="polite">{`${feitosN} de ${total} feitos`}</Texto>
      ) : null}

      {erroTela ? (
        <>
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroTela}`}</Texto>
          {!ocorrencia ? <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} /> : null}
        </>
      ) : null}
      {!ocorrencia && !erroTela ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}

      {ocorrencia
        ? ORDEM_PASSOS.map((passo) => {
            const tipo = TIPO_DO_PASSO[passo];
            const contas = tipo ? ocorrencia.contas.filter((c) => c.tipo === tipo) : [];
            const feitoEm = feitos[passo];
            const hora = feitoEm ? horaLocal(feitoEm) : '';
            return (
              <View key={passo} testID={`passo-${passo}`} style={estilos.cartao}>
                <Texto variante="titulo" style={estilos.nome}>
                  {TITULOS[passo]}
                </Texto>
                <Texto>{TEXTOS[passo]}</Texto>

                {tipo && contas.length === 0 ? <Texto>{SEM_CONTA[passo]}</Texto> : null}
                {contas.map((c) => {
                  // Sem telefone no catálogo (null na maioria das contas reais): só o site.
                  const tel = urlTelefone(c.telefone);
                  return (
                    <View key={c.nome} style={estilos.conta}>
                      <Texto variante="legenda">{c.nome}</Texto>
                      {tel ? <Botao rotulo={`Ligar para ${c.nome}`} variante="secundario" onPress={() => abrir(tel)} /> : null}
                      <Botao rotulo={`Abrir site de ${c.nome}`} variante="secundario" onPress={() => abrir(c.link)} />
                    </View>
                  );
                })}
                {passo === 'CelularSeguro' ? (
                  <Botao rotulo="Abrir o Celular Seguro" variante="secundario" onPress={() => abrir(CELULAR_SEGURO)} />
                ) : null}

                {feitoEm ? (
                  <Texto accessibilityLiveRegion="polite">{hora ? `Feito às ${hora}` : 'Feito'}</Texto>
                ) : (
                  <Botao
                    rotulo="Marcar como feito"
                    dica={`Passo ${TITULOS[passo]}`}
                    carregando={enviando.has(passo)}
                    onPress={() => void marcar(passo)}
                  />
                )}
                {erros[passo] ? (
                  <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erros[passo]}`}</Texto>
                ) : null}
              </View>
            );
          })
        : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  cartao: {
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    padding: espacos.m,
    gap: espacos.m,
    backgroundColor: cores.branco,
  },
  nome: { fontSize: 20, lineHeight: 28 },
  conta: { gap: espacos.p },
});
