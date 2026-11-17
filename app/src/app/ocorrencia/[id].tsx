// Detalhe da ocorrência: linha do tempo (iniciada em, momento marcado e cada passo com o horário).
// Passos não feitos aparecem como "Pendente" (em texto, nunca só por cor).
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import type { OcorrenciaDto, Passo } from '../../api/tipos';
import { abrirBanco } from '../../db/db';
import { rotuloEstado } from '../../guardiao/eventos';
import { escolherFonte, ORDEM_PASSOS } from '../../guardiao/fonteOcorrencia';
import { dataCurta } from '../../guardiao/formatoData';
import { horaLocal } from '../../guardiao/notificacao';
import { bordas, cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BarraAcao } from '../../ui/BarraAcao';
import { Botao } from '../../ui/Botao';
import { EstadoBadge } from '../../ui/EstadoBadge';
import { Icone } from '../../ui/Icone';
import { SairEmergencia } from '../../ui/SairEmergencia';
import { Texto } from '../../ui/Texto';
import { BADGE } from '../(tabs)/historico';

const TITULOS: Record<Passo, string> = {
  Banco: 'Banco',
  CelularSeguro: 'Celular Seguro',
  Operadora: 'Operadora',
  Senhas: 'Senhas',
  Bo: 'BO',
};

export default function DetalheOcorrencia() {
  const { id: param } = useLocalSearchParams<{ id?: string }>();
  const id = typeof param === 'string' ? param : '';
  const router = useRouter();
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaDto | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const montada = useRef(true);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setErro(undefined);
    try {
      const { ocorrencia: o } = await escolherFonte(id, await abrirBanco()).carregar(id);
      if (montada.current) setOcorrencia(o);
    } catch (e) {
      if (montada.current) setErro(mensagemDeErro(e));
    }
  }, [id]);

  // Recarrega sempre que a tela volta ao foco (item 11): o Stack mantém o detalhe montado enquanto a pessoa
  // marca o momento na rota e vê o BO, e na volta o momento e os passos precisam estar atualizados.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const feitos = new Map((ocorrencia?.passos ?? []).map((p) => [p.passo, p.concluidoEm]));
  const badge = ocorrencia ? BADGE[ocorrencia.estado] : undefined;
  const ehDemo = id.startsWith('demo-');

  return (
    <View style={estilos.fundo}>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.tela}>
        <Stack.Screen options={{ title: 'Ocorrência' }} />
        <Texto variante="titulo">Linha do tempo</Texto>
        <SairEmergencia />
        {erro ? (
          <>
            <Aviso mensagem={erro} />
            <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
          </>
        ) : null}
        {!ocorrencia && !erro ? (
          <View style={estilos.carregando} accessibilityLiveRegion="polite">
            <ActivityIndicator color={cores.petroleo} />
            <Texto>Carregando...</Texto>
          </View>
        ) : null}
        {ocorrencia ? (
          <>
            <View style={estilos.cartao}>
              {badge ? <EstadoBadge estado={badge} /> : <Texto variante="corpoForte">{rotuloEstado(ocorrencia.estado)}</Texto>}
              <Texto>{`Iniciada em ${dataCurta(ocorrencia.iniciadaEm)} às ${horaLocal(ocorrencia.iniciadaEm)}`}</Texto>
              <Texto variante={ocorrencia.momento ? 'corpoForte' : 'corpo'}>
                {ocorrencia.momento ? `Momento marcado: ${horaLocal(ocorrencia.momento.em)}` : 'Momento ainda não marcado'}
              </Texto>
            </View>
            <Texto variante="secao">O que já foi feito</Texto>
            <View style={estilos.passos}>
              {ORDEM_PASSOS.map((passo, indice) => {
                const hora = feitos.get(passo);
                return (
                  <View key={passo} style={[estilos.passo, indice < ORDEM_PASSOS.length - 1 && estilos.divisor]}>
                    <Icone nome={hora ? 'ok' : 'relogio'} tamanho={24} cor={cores.petroleo} />
                    <Texto variante={hora ? 'corpoForte' : 'corpo'} style={estilos.passoTexto}>
                      {`${TITULOS[passo]} — ${hora ? horaLocal(hora) : 'Pendente'}`}
                    </Texto>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
      {ocorrencia && !ehDemo ? (
        <BarraAcao>
          <Botao
            rotulo="Ver o BO"
            variante={ocorrencia.estado === 'Cancelada' ? 'secundario' : 'primario'}
            onPress={() => router.push(`/bo?ocorrenciaId=${encodeURIComponent(id)}` as never)}
          />
          <Botao
            rotulo="Marcar onde foi (rota)"
            variante="secundario"
            onPress={() => router.push(`/rota?ocorrenciaId=${encodeURIComponent(id)}` as never)}
          />
        </BarraAcao>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  rolagem: { flex: 1 },
  tela: { padding: espacos.m, gap: espacos.m, paddingBottom: espacos.g },
  carregando: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm },
  cartao: {
    gap: espacos.p,
    padding: espacos.m,
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
  },
  // Lista agrupada: uma superfície, divisor de 1 px entre as linhas (menos na última).
  passos: {
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
    paddingHorizontal: espacos.m,
  },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, minHeight: tamanhos.alvoMin, paddingVertical: espacos.pm },
  divisor: { borderBottomWidth: bordas.fina, borderBottomColor: cores.bordaSuave },
  passoTexto: { flex: 1 },
});
