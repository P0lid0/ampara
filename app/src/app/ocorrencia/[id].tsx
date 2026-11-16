// Detalhe da ocorrência: linha do tempo (iniciada em, momento marcado e cada passo com o horário).
// Passos não feitos aparecem como "Pendente" (em texto, nunca só por cor).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import type { OcorrenciaDto, Passo } from '../../api/tipos';
import { abrirBanco } from '../../db/db';
import { rotuloEstado } from '../../guardiao/eventos';
import { escolherFonte, ORDEM_PASSOS } from '../../guardiao/fonteOcorrencia';
import { dataCurta } from '../../guardiao/formatoData';
import { horaLocal } from '../../guardiao/notificacao';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { EstadoBadge } from '../../ui/EstadoBadge';
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

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const feitos = new Map((ocorrencia?.passos ?? []).map((p) => [p.passo, p.concluidoEm]));
  const badge = ocorrencia ? BADGE[ocorrencia.estado] : undefined;
  const ehDemo = id.startsWith('demo-');

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Ocorrência' }} />
      <Texto variante="titulo">Linha do tempo</Texto>
      {erro ? (
        <>
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
        </>
      ) : null}
      {!ocorrencia && !erro ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}
      {ocorrencia ? (
        <>
          {badge ? <EstadoBadge estado={badge} /> : <Texto>{rotuloEstado(ocorrencia.estado)}</Texto>}
          <Texto>{`Iniciada em ${dataCurta(ocorrencia.iniciadaEm)} às ${horaLocal(ocorrencia.iniciadaEm)}`}</Texto>
          <Texto>
            {ocorrencia.momento ? `Momento marcado: ${horaLocal(ocorrencia.momento.em)}` : 'Momento ainda não marcado'}
          </Texto>
          <View style={estilos.passos}>
            {ORDEM_PASSOS.map((passo) => {
              const hora = feitos.get(passo);
              return <Texto key={passo}>{`${TITULOS[passo]} — ${hora ? horaLocal(hora) : 'Pendente'}`}</Texto>;
            })}
          </View>
          {!ehDemo ? (
            <>
              <Botao
                rotulo="Marcar onde foi (rota)"
                variante="secundario"
                onPress={() => router.push(`/rota?ocorrenciaId=${encodeURIComponent(id)}` as never)}
              />
              <Botao rotulo="Ver o BO" onPress={() => router.push(`/bo?ocorrenciaId=${encodeURIComponent(id)}` as never)} />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  passos: { gap: espacos.p },
});
