// Passo a passo do guardião (P1): cinco cartões, um por providência (banco, Celular Seguro, operadora,
// senhas, BO), cada um com o horário em que foi feito. A ordem é sugestão, não trava nada. As contas
// vêm da ocorrência (as da vítima); o app não baixa o catálogo.
// Desenho: cartões brancos (verde-claro quando feitos), ações de contato com ícone, e o próximo passo
// a barra da base só aparece com tudo feito (BarraAcao).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../../api/cliente';
import type { OcorrenciaDto, Passo } from '../../api/tipos';
import { abrirBanco } from '../../db/db';
import { escolherFonte, ORDEM_PASSOS, urlTelefone, type FonteOcorrencia } from '../../guardiao/fonteOcorrencia';
import { horaLocal } from '../../guardiao/notificacao';
import { ouvirPassos } from '../../guardiao/passosAoVivo';
import { bordas, cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { BarraAcao } from '../../ui/BarraAcao';
import { Botao } from '../../ui/Botao';
import { Icone, type NomeIcone } from '../../ui/Icone';
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
  const todosFeitos = Boolean(ocorrencia) && feitosN === total;

  return (
    <View style={estilos.fundo}>
      <Stack.Screen options={{ title: 'Passo a passo' }} />
      <ScrollView contentContainerStyle={estilos.tela}>
        <Texto variante="titulo">O que fazer agora</Texto>
        <Texto>Siga na ordem que fizer sentido. Cada passo feito fica marcado para os outros guardiões.</Texto>

        {ocorrencia ? (
          <View style={estilos.progresso}>
            <Texto variante="rotulo" accessibilityLiveRegion="polite">{`${feitosN} de ${total} feitos`}</Texto>
            <View style={estilos.trilho} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[estilos.cheio, { width: `${(feitosN / total) * 100}%` }]} />
            </View>
          </View>
        ) : null}

        {erroTela ? (
          <>
            <Mensagem texto={erroTela} />
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
                <View key={passo} testID={`passo-${passo}`} style={[estilos.cartao, feitoEm ? estilos.cartaoFeito : null]}>
                  <View style={estilos.cabecalho}>
                    <View style={[estilos.selo, feitoEm ? estilos.seloFeito : null]}>
                      <Icone nome={feitoEm ? 'ok' : 'anel'} tamanho={20} cor={feitoEm ? cores.tinta : cores.textoSuave} />
                    </View>
                    <Texto variante="secao" style={estilos.nome}>
                      {TITULOS[passo]}
                    </Texto>
                  </View>
                  <Texto>{TEXTOS[passo]}</Texto>

                  {tipo && contas.length === 0 ? <Texto>{SEM_CONTA[passo]}</Texto> : null}
                  {contas.map((c) => {
                    // Sem telefone no catálogo (null na maioria das contas reais): só o site.
                    const tel = urlTelefone(c.telefone);
                    return (
                      <View key={c.nome} style={estilos.conta}>
                        <Texto variante="corpoForte">{c.nome}</Texto>
                        <View style={estilos.acoes}>
                          {tel ? (
                            <LinhaAcao icone="telefone" rotulo="Ligar" acessivel={`Ligar para ${c.nome}`} onPress={() => abrir(tel)} />
                          ) : null}
                          <LinhaAcao icone="link" rotulo="Abrir site" acessivel={`Abrir site de ${c.nome}`} onPress={() => abrir(c.link)} />
                        </View>
                      </View>
                    );
                  })}
                  {passo === 'CelularSeguro' ? (
                    <View style={estilos.acoes}>
                      <LinhaAcao icone="link" rotulo="Abrir o Celular Seguro" onPress={() => abrir(CELULAR_SEGURO)} />
                    </View>
                  ) : null}

                  {feitoEm ? (
                    <View style={estilos.feitoLinha}>
                      <Icone nome="relogio" tamanho={20} cor={cores.tinta} />
                      <Texto variante="corpoForte" accessibilityLiveRegion="polite">
                        {hora ? `Feito às ${hora}` : 'Feito'}
                      </Texto>
                    </View>
                  ) : (
                    <Botao
                      rotulo="Marcar como feito"
                      variante="secundario"
                      dica={`Passo ${TITULOS[passo]}`}
                      carregando={enviando.has(passo)}
                      onPress={() => void marcar(passo)}
                    />
                  )}
                  {erros[passo] ? <Mensagem texto={erros[passo] as string} /> : null}
                </View>
              );
            })
          : null}
      </ScrollView>

      {todosFeitos ? (
        <BarraAcao>
          <View style={estilos.tudoFeito} accessibilityLiveRegion="polite">
            <Icone nome="ok" cor={cores.tinta} />
            <Texto variante="corpoForte" style={estilos.nome}>
              Todos os passos feitos. Obrigado por ajudar.
            </Texto>
          </View>
        </BarraAcao>
      ) : null}
    </View>
  );
}

/** Aviso de erro: ícone vetorial e texto (nunca só a cor). */
function Mensagem({ texto }: { texto: string }) {
  return (
    <View style={estilos.erro} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icone nome="alerta" tamanho={22} cor={cores.alarmeTexto} />
      <Texto style={estilos.erroTexto}>{texto}</Texto>
    </View>
  );
}

type LinhaAcaoProps = { icone: NomeIcone; rotulo: string; acessivel?: string; onPress: () => void };

/** Ação de contato: ícone + verbo curto, 48 dp, tonal. O rótulo falado traz o nome do banco. */
function LinhaAcao({ icone, rotulo, acessivel, onPress }: LinhaAcaoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={acessivel ?? rotulo}
      onPress={onPress}
      android_ripple={{ color: cores.bordaSuave, foreground: true }}
      style={({ pressed }) => [estilos.acao, pressed && estilos.acaoPressionada]}
    >
      <Icone nome={icone} tamanho={20} cor={cores.petroleo} />
      <Texto variante="rotulo" style={estilos.acaoTexto}>
        {rotulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  tela: { padding: espacos.m, gap: espacos.m },
  progresso: { gap: espacos.p },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.bordaSuave, overflow: 'hidden' },
  cheio: { height: '100%', backgroundColor: cores.esmeralda, borderRadius: 4 },
  cartao: {
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    borderRadius: raios.m,
    padding: espacos.m,
    gap: espacos.pm,
    backgroundColor: cores.branco,
  },
  cartaoFeito: { backgroundColor: cores.esmeraldaSuave, borderColor: cores.esmeraldaSuave },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm },
  selo: {
    width: 32,
    height: 32,
    borderRadius: raios.pilula,
    backgroundColor: cores.areiaFunda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloFeito: { backgroundColor: cores.esmeralda },
  nome: { flex: 1 },
  conta: { gap: espacos.p },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.p },
  acao: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    paddingHorizontal: espacos.m,
    borderRadius: raios.m,
    backgroundColor: cores.areiaFunda,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.p,
    overflow: 'hidden',
  },
  acaoPressionada: { transform: [{ scale: 0.98 }] },
  acaoTexto: { color: cores.petroleo },
  feitoLinha: { flexDirection: 'row', alignItems: 'center', gap: espacos.p },
  tudoFeito: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, minHeight: tamanhos.alvoAcao },
  erro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.p,
    backgroundColor: cores.alarmeSuave,
    borderRadius: raios.m,
    padding: espacos.pm,
  },
  erroTexto: { flex: 1, color: cores.alarmeTexto },
});
