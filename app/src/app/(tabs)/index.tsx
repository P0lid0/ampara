// Aba Início: reconcilia o onboarding com o servidor (leva ao próximo passo, se faltar algum) e mostra
// o chaveiro (bloco herói), a rota, o último alerta e o aviso de quem ainda não tem guardiões.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api/endpoints';
import { useSessao } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { rotuloEstado } from '../../guardiao/eventos';
import { concluirPassoSeguro, proximoPasso, reconciliarComServidor, rotaDoPasso } from '../../onboarding/passos';
import { estadoRota, iniciarRota, retomarRotaAposEntrar, type EstadoRota } from '../../rota/tarefa';
import { bordas, cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { BannerAlarme } from '../../ui/BannerAlarme';
import { Botao } from '../../ui/Botao';
import { CartaoChaveiro } from '../../ui/CartaoChaveiro';
import { EstadoBadge, type Estado } from '../../ui/EstadoBadge';
import { Icone, type NomeIcone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';

/** Estado da rota sempre por escrito, com o motivo (nunca só por cor). */
export const FRASE_ROTA: Record<EstadoRota, string> = {
  ativa: 'Rota ligada: o Ampara guarda os últimos 7 dias, só para você.',
  'sem-consentimento': 'Rota desligada: você não autorizou guardar a rota neste aparelho.',
  'sem-permissao': 'Rota pausada: falta a permissão de localização.',
  pausada: 'Rota pausada: o registro da rota parou neste aparelho. Toque em "Retomar a rota".',
};

type UltimoAlerta = { id: string; estado: string; iniciadaEm: string };

const BADGE: Record<string, Estado> = { Aberta: 'aberta', Cancelada: 'cancelada', Encerrada: 'encerrada', Teste: 'teste' };

function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Linha da lista agrupada: ícone à esquerda, conteúdo à direita; divisor de 1 px, menos na última. */
function Linha({ icone, ultima, children }: { icone: NomeIcone; ultima?: boolean; children: ReactNode }) {
  return (
    <View style={[estilos.linha, ultima ? null : estilos.divisor]}>
      <View style={estilos.icone}>
        <Icone nome={icone} tamanho={24} cor={cores.petroleo} />
      </View>
      <View style={estilos.conteudo}>{children}</View>
    </View>
  );
}

const maisRecente = <T extends { iniciadaEm: string }>(l: T[]): T | null =>
  l.reduce<T | null>((m, o) => (!m || Date.parse(o.iniciadaEm) > Date.parse(m.iniciadaEm) ? o : m), null);

export default function Inicio() {
  const router = useRouter();
  const { autenticado, escopo } = useSessao();
  const [verificado, setVerificado] = useState(false);
  const [rota, setRota] = useState<EstadoRota | null>(null);
  const [ultimo, setUltimo] = useState<UltimoAlerta | null | undefined>(undefined);
  const [semGuardioes, setSemGuardioes] = useState(false);
  const [erroUltimo, setErroUltimo] = useState(false);
  const [retomando, setRetomando] = useState(false);

  // Abertura do app: reconcilia com o servidor e leva ao próximo passo do onboarding (ou fica aqui).
  useEffect(() => {
    if (!autenticado) return;
    if (escopo !== 'usuario') {
      setVerificado(true); // modo emergência não tem onboarding
      return;
    }
    let ativo = true;
    (async () => {
      try {
        await concluirPassoSeguro('conta'); // quem chegou aqui autenticado já tem conta
        const db = await abrirBanco();
        const proximo = proximoPasso(await reconciliarComServidor(db));
        // Depois de entrar: religa a rota consentida no servidor e envia a fila guardada (item 4).
        await retomarRotaAposEntrar();
        if (ativo && proximo !== 'fim') {
          router.replace(rotaDoPasso(proximo) as never);
          return;
        }
      } catch {
        // sem banco ou sem rede: segue para a tela inicial
      }
      if (ativo) setVerificado(true);
    })();
    return () => {
      ativo = false;
    };
  }, [autenticado, escopo, router]);

  const carregarRota = useCallback(async () => {
    try {
      setRota(await estadoRota());
    } catch {
      setRota(null);
    }
  }, []);

  // Recarrega ao voltar para a aba (ex.: depois de simular um alerta em Ajustes).
  const carregar = useCallback(() => {
    if (!verificado) return;
    let vivo = true;
    void carregarRota();
    (async () => {
      try {
        const db = await abrirBanco();
        const demo = (await sessaoRepo(db).get('demo')) === '1';
        // Em demonstração o último alerta é o local (funciona sem internet).
        const lista: UltimoAlerta[] = demo ? await ocorrenciaRepo(db).listar() : await api.ocorrencias.listar();
        if (!vivo) return;
        const o = maisRecente(lista);
        setUltimo(o ? { id: o.id, estado: o.estado, iniciadaEm: o.iniciadaEm } : null);
        setErroUltimo(false);
      } catch {
        if (vivo) setErroUltimo(true);
      }
    })();
    api.guardioes
      .listar()
      .then((l) => {
        if (vivo) setSemGuardioes(l.length === 0);
      })
      .catch(() => undefined); // sem rede: não afirma que não há guardiões
    return () => {
      vivo = false;
    };
  }, [verificado, carregarRota]);
  useFocusEffect(carregar);

  async function retomar() {
    setRetomando(true);
    try {
      await iniciarRota();
    } catch {
      // continua "pausada"; o texto abaixo segue dizendo o motivo
    }
    await carregarRota();
    setRetomando(false);
  }

  if (!verificado) {
    return (
      <ScrollView contentContainerStyle={estilos.tela}>
        <View style={estilos.esqueleto} />
        <Texto>Carregando...</Texto>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <BannerAlarme />

      <CartaoChaveiro ocultarCodigo semFrasePresenca />

      {semGuardioes ? (
        <View style={estilos.aviso} accessibilityRole="alert">
          <Texto variante="secao">Você ainda não tem guardiões</Texto>
          <Texto>Guardiões são as pessoas avisadas quando você pede ajuda.</Texto>
          <Botao rotulo="Convidar um guardião" variante="secundario" onPress={() => router.push('/onboarding/guardioes' as never)} />
        </View>
      ) : null}

      <View style={estilos.grupo}>
        <Linha icone="rota">
          <Texto variante="corpoForte">Rota</Texto>
          <Texto accessibilityLiveRegion="polite">{rota ? FRASE_ROTA[rota] : 'Conferindo a rota...'}</Texto>
          {rota === 'pausada' ? <Botao rotulo="Retomar a rota" variante="secundario" onPress={() => void retomar()} carregando={retomando} /> : null}
          {rota === 'sem-permissao' ? (
            <Botao
              rotulo="Abrir configurações do celular"
              variante="secundario"
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          ) : null}
        </Linha>

        <Linha icone="relogio">
          {ultimo ? (
            <>
              {BADGE[ultimo.estado] ? <EstadoBadge estado={BADGE[ultimo.estado]} /> : null}
              <Texto>{`Último alerta: ${rotuloEstado(ultimo.estado)}${dataHora(ultimo.iniciadaEm) ? `, em ${dataHora(ultimo.iniciadaEm)}` : ''}`}</Texto>
              {ultimo.estado === 'Aberta' && ultimo.id ? (
                <Botao
                  rotulo="Ver o que já foi feito"
                  onPress={() => router.push(`/ocorrencia/${encodeURIComponent(ultimo.id)}` as never)}
                />
              ) : null}
            </>
          ) : erroUltimo ? (
            <Texto>Não foi possível carregar o último alerta.</Texto>
          ) : ultimo === null ? (
            <Texto>Nenhum alerta até agora.</Texto>
          ) : (
            <Texto>Carregando o último alerta...</Texto>
          )}
        </Linha>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tenho um código de convite"
          accessibilityHint="Para virar guardião de alguém que enviou um código"
          android_ripple={{ color: cores.bordaSuave }}
          onPress={() => router.push('/guardiao/aceitar' as never)}
          style={({ pressed }) => [estilos.navega, pressed && estilos.pressionada]}
        >
          <View style={estilos.icone}>
            <Icone nome="link" tamanho={24} cor={cores.petroleo} />
          </View>
          <Texto variante="corpoForte" style={estilos.rotuloNavega}>
            Tenho um código de convite
          </Texto>
          <View style={estilos.seta}>
            <Icone nome="voltar" tamanho={20} cor={cores.petroleo} />
          </View>
        </Pressable>
      </View>

      <View style={estilos.relatar} accessibilityLabel="Relatar">
        <Texto variante="secao">Viu algo na rua?</Texto>
        <Texto>Conte em poucas palavras o que é e onde, sem descrever pessoas. Ajuda quem passa por perto.</Texto>
        <Botao rotulo="Relatar um problema" variante="secundario" onPress={() => router.push('/relato' as never)} />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, paddingBottom: espacos.g, gap: espacos.m },
  esqueleto: { height: 200, borderRadius: raios.g, backgroundColor: cores.areiaFunda },
  aviso: { gap: espacos.pm, borderRadius: raios.m, padding: espacos.m, backgroundColor: cores.branco, borderWidth: bordas.fina, borderColor: cores.bordaSuave },
  grupo: { borderRadius: raios.m, backgroundColor: cores.branco, borderWidth: bordas.fina, borderColor: cores.bordaSuave, overflow: 'hidden' },
  linha: { flexDirection: 'row', gap: espacos.pm, padding: espacos.m, minHeight: tamanhos.alvoMin },
  divisor: { borderBottomWidth: bordas.fina, borderBottomColor: cores.bordaSuave },
  icone: { width: 24, paddingTop: espacos.xs },
  conteudo: { flex: 1, gap: espacos.p },
  navega: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, padding: espacos.m, minHeight: tamanhos.alvoMin, minWidth: tamanhos.alvoMin },
  pressionada: { backgroundColor: cores.areiaFunda },
  rotuloNavega: { flex: 1, color: cores.petroleo },
  seta: { transform: [{ rotate: '180deg' }] },
  relatar: { gap: espacos.pm, paddingTop: espacos.p },
});
