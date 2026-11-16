// Aba Início: reconcilia o onboarding com o servidor (leva ao próximo passo, se faltar algum) e mostra
// o chaveiro, a rota, as permissões, o último alerta e o aviso de quem ainda não tem guardiões.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api/endpoints';
import { useSessao } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { rotuloEstado } from '../../guardiao/eventos';
import { concluirPassoSeguro, proximoPasso, reconciliarComServidor, rotaDoPasso } from '../../onboarding/passos';
import { estadoRota, iniciarRota, retomarRotaAposEntrar, type EstadoRota } from '../../rota/tarefa';
import { cores, espacos } from '../../theme/tokens';
import { BannerAlarme } from '../../ui/BannerAlarme';
import { Botao } from '../../ui/Botao';
import { CartaoChaveiro } from '../../ui/CartaoChaveiro';
import { EstadoBadge, type Estado } from '../../ui/EstadoBadge';
import { Texto } from '../../ui/Texto';

/** Estado da rota sempre por escrito, com o motivo (nunca só por cor). */
export const FRASE_ROTA: Record<EstadoRota, string> = {
  ativa: 'Rota ligada: o Ampara guarda os últimos 7 dias, só para você.',
  'sem-consentimento': 'Rota desligada: você não autorizou guardar a rota neste aparelho.',
  'sem-permissao': 'Rota pausada: falta a permissão de localização.',
  pausada: 'Rota pausada: o registro da rota parou neste aparelho. Toque em "Retomar a rota".',
};

type UltimoAlerta = { estado: string; iniciadaEm: string };

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
        setUltimo(o ? { estado: o.estado, iniciadaEm: o.iniciadaEm } : null);
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
        <Texto>Carregando...</Texto>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <BannerAlarme />

      {semGuardioes ? (
        <View style={estilos.caixa} accessibilityRole="alert">
          <Texto variante="titulo">Você ainda não tem guardiões</Texto>
          <Texto>Guardiões são as pessoas avisadas quando você pede ajuda.</Texto>
          <Botao rotulo="Convidar um guardião" onPress={() => router.push('/onboarding/guardioes' as never)} />
        </View>
      ) : null}

      <CartaoChaveiro />

      <View style={estilos.caixa} accessibilityLabel="Rota">
        <Texto variante="titulo">Rota</Texto>
        <Texto accessibilityLiveRegion="polite">{rota ? FRASE_ROTA[rota] : 'Conferindo a rota...'}</Texto>
        {rota === 'pausada' ? <Botao rotulo="Retomar a rota" onPress={() => void retomar()} carregando={retomando} /> : null}
        {rota === 'sem-permissao' ? (
          <Botao
            rotulo="Abrir configurações do celular"
            variante="secundario"
            onPress={() => void Linking.openSettings().catch(() => undefined)}
          />
        ) : null}
      </View>

      <View style={estilos.caixa} accessibilityLabel="Relatar">
        <Texto variante="titulo">Viu algo na rua?</Texto>
        <Texto>Conte em poucas palavras o que e onde, sem descrever pessoas. Ajuda quem passa por perto.</Texto>
        <Botao rotulo="Relatar um problema" variante="secundario" onPress={() => router.push('/relato' as never)} />
      </View>

      <View style={estilos.caixa} accessibilityLabel="Último alerta">
        {ultimo ? (
          <>
            {BADGE[ultimo.estado] ? <EstadoBadge estado={BADGE[ultimo.estado]} /> : null}
            <Texto>{`Último alerta: ${rotuloEstado(ultimo.estado)}${dataHora(ultimo.iniciadaEm) ? `, em ${dataHora(ultimo.iniciadaEm)}` : ''}`}</Texto>
          </>
        ) : erroUltimo ? (
          <Texto>Não foi possível carregar o último alerta.</Texto>
        ) : ultimo === null ? (
          <Texto>Nenhum alerta até agora.</Texto>
        ) : (
          <Texto>Carregando o último alerta...</Texto>
        )}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  caixa: { gap: espacos.p, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, padding: espacos.m, backgroundColor: cores.branco },
});
