// Relato (P2): o cidadão conta em poucas palavras o que e onde, sem foto e sem descrever pessoas. O app
// só limita o que é seguro limitar; o que é abuso ou dado pessoal quem decide é a API, e a resposta dela
// aparece na tela. Sem rede o relato fica na fila local e sai quando a tela abre de novo.
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { RelatoNovo } from '../api/tipos';
import { abrirBanco } from '../db/db';
import { relatoRepo, sessaoRepo } from '../db/repos';
import { enviarRelatos, limitarTexto, MAX_TEXTO, podeEnviarRelato, validarRelato, type TipoRelato } from '../relato/validacao';
import { cores, espacos, fontes, tamanhos } from '../theme/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Texto } from '../ui/Texto';

const CHAVE_ULTIMO = 'relato.ultimoEm';
const TEMPO_GPS_MS = 8000;
const TIPOS: { tipo: TipoRelato; rotulo: string }[] = [
  { tipo: 'roubo', rotulo: 'Roubo' },
  { tipo: 'furto', rotulo: 'Furto' },
  { tipo: 'suspeita', rotulo: 'Suspeita' },
];

const SEM_LOCAL = 'Não deu para achar o local. Ligue a localização do celular ou escolha o ponto no mapa e tente de novo.';
const AGUARDE = 'Espere 2 minutos entre um relato e outro.';

type Ponto = { lat: number; lng: number };
type Aviso = { texto: string; alerta: boolean };

const numero = (v: string | string[] | undefined): number | null => {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Ponto escolhido no mapa (parâmetros) ou a posição atual, com a espera do GPS limitada. */
async function descobrirLocal(escolhido: Ponto | null): Promise<Ponto | null> {
  if (escolhido) return escolhido;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rejeita) => {
      relogio = setTimeout(() => rejeita(new Error('gps')), TEMPO_GPS_MS);
    });
    try {
      const p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), limite]);
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  } catch {
    return null;
  }
}

export default function Relato() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const lat = numero(params.lat);
  const lng = numero(params.lng);
  const escolhido: Ponto | null = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

  const [tipo, setTipo] = useState<TipoRelato | null>(null);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Trava síncrona: dois toques antes de re-renderizar não mandam duas vezes.
  const ocupado = useRef(false);
  const montada = useRef(true);

  useEffect(() => {
    montada.current = true;
    // O que ficou na fila de uma vez anterior sai agora, se houver rede.
    (async () => {
      try {
        await enviarRelatos(await abrirBanco(), (r) =>
          api.relatos.criar({
            tipo: r.tipo as RelatoNovo['tipo'],
            lat: r.lat as number,
            lng: r.lng as number,
            em: r.em,
            ...(r.texto ? { texto: r.texto } : {}),
          }),
        );
      } catch {
        // sem banco ou sem rede: fica para a próxima vez
      }
    })();
    return () => {
      montada.current = false;
    };
  }, []);

  const mostrar = (a: Aviso) => {
    if (montada.current) setAviso(a);
  };

  async function enviar() {
    if (ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setAviso(null);
    try {
      const limpo = texto.trim();
      const v = validarRelato({ tipo: tipo ?? '', texto: limpo });
      if (!v.ok) return mostrar({ texto: v.motivo, alerta: true });

      const db = await abrirBanco();
      const sessao = sessaoRepo(db);
      const ultimo = await sessao.get(CHAVE_ULTIMO);
      if (!podeEnviarRelato(ultimo ? new Date(ultimo) : null, new Date())) return mostrar({ texto: AGUARDE, alerta: true });

      const em = new Date().toISOString();
      const local = await descobrirLocal(escolhido);
      if (!local) return mostrar({ texto: SEM_LOCAL, alerta: true });

      const corpo: RelatoNovo = { tipo: tipo as TipoRelato, lat: local.lat, lng: local.lng, em, ...(limpo ? { texto: limpo } : {}) };
      try {
        await api.relatos.criar(corpo);
        await sessao.set(CHAVE_ULTIMO, em);
        if (montada.current) setTexto('');
        mostrar({ texto: 'Relato enviado. Obrigado.', alerta: false });
      } catch (e) {
        if (e instanceof ApiErro && e.status === 0) {
          await relatoRepo(db).adicionar({ tipo: corpo.tipo, lat: corpo.lat, lng: corpo.lng, em, texto: limpo || null });
          await sessao.set(CHAVE_ULTIMO, em);
          if (montada.current) setTexto('');
          mostrar({ texto: 'Guardado. Envio quando a internet voltar.', alerta: false });
        } else {
          // A resposta da API (detalheCidadao) vai como veio; o texto digitado nunca entra na mensagem.
          mostrar({ texto: mensagemDeErro(e), alerta: true });
        }
      }
    } catch {
      mostrar({ texto: 'Não foi possível concluir agora. Tente de novo.', alerta: true });
    } finally {
      ocupado.current = false;
      if (montada.current) setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Relatar' }} />
      <Texto variante="titulo">Relatar um problema</Texto>
      <Texto>
        {escolhido ? 'O relato vai para o ponto escolhido no mapa.' : 'O relato vai para o lugar onde você está agora.'}
      </Texto>
      <Texto accessibilityRole="alert">Não descreva pessoas. Diga só o que e onde.</Texto>

      <View accessibilityRole="radiogroup" accessibilityLabel="O que aconteceu" style={estilos.tipos}>
        {TIPOS.map((t) => {
          const marcado = tipo === t.tipo;
          return (
            <Pressable
              key={t.tipo}
              accessibilityRole="radio"
              accessibilityLabel={t.rotulo}
              accessibilityState={{ checked: marcado }}
              onPress={() => setTipo(t.tipo)}
              style={[estilos.tipo, marcado && estilos.tipoMarcado]}
            >
              <Texto style={[estilos.tipoTexto, marcado && estilos.tipoTextoMarcado]}>
                {`${marcado ? '✓ ' : ''}${t.rotulo}`}
              </Texto>
            </Pressable>
          );
        })}
      </View>

      <Campo
        rotulo="O que aconteceu (opcional)"
        valor={texto}
        onChangeText={(t) => setTexto(limitarTexto(t))}
        maxLength={MAX_TEXTO}
        placeholder="Ex.: moto parada na esquina"
        autoCorrect
      />
      <Texto variante="legenda">{`${texto.length} de ${MAX_TEXTO} caracteres`}</Texto>

      {aviso ? (
        <View style={estilos.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {aviso.alerta ? (
            <Texto accessibilityElementsHidden importantForAccessibility="no">
              {'⚠'}
            </Texto>
          ) : null}
          <Texto style={estilos.fluxo}>{aviso.texto}</Texto>
        </View>
      ) : null}

      <Botao rotulo="Enviar relato" onPress={() => void enviar()} carregando={enviando} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  tipos: { gap: espacos.p },
  aviso: { flexDirection: 'row', gap: espacos.p, alignItems: 'flex-start' },
  fluxo: { flex: 1 },
  tipo: {
    minHeight: tamanhos.alvoMin + 16,
    minWidth: tamanhos.alvoMin,
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    backgroundColor: cores.branco,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: espacos.m,
  },
  tipoMarcado: { backgroundColor: cores.petroleo, borderWidth: 4 },
  tipoTexto: { fontFamily: fontes.semibold, fontSize: 20 },
  tipoTextoMarcado: { color: cores.areia },
});
