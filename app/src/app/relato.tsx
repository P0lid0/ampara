// Relato (P2): o cidadão conta em poucas palavras o que e onde, sem foto e sem descrever pessoas. O app
// só limita o que é seguro limitar; o que é abuso ou dado pessoal quem decide é a API, e a resposta dela
// aparece na tela. Sem rede o relato fica na fila local e sai quando a tela abre de novo.
import * as Haptics from 'expo-haptics';
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
import { bordas, cores, espacos, raios, tamanhos } from '../theme/tokens';
import { Aviso } from '../ui/Aviso';
import { BarraAcao } from '../ui/BarraAcao';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Icone } from '../ui/Icone';
import { Texto } from '../ui/Texto';

const CHAVE_ULTIMO = 'relato.ultimoEm';
const TEMPO_GPS_MS = 8000;
const TIPOS: { tipo: TipoRelato; rotulo: string }[] = [
  { tipo: 'roubo', rotulo: 'Roubo' },
  { tipo: 'furto', rotulo: 'Furto' },
  { tipo: 'suspeita', rotulo: 'Suspeita' },
];

// Sem GPS, o caminho que existe é o botão "Relatar aqui" do Mapa (centro do mapa visível).
const SEM_LOCAL = 'Não deu para achar o local. Ligue a localização do celular e tente de novo, ou abra o Mapa e toque em "Relatar aqui".';
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
    <View style={estilos.fundo}>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Relatar' }} />
        <Texto variante="titulo">O que você viu?</Texto>

        <View style={estilos.local}>
          <Icone nome="ponto" tamanho={20} cor={cores.petroleo} />
          <Texto style={estilos.fluxo}>
            {escolhido ? 'O relato vai para o ponto escolhido no mapa.' : 'O relato vai para o lugar onde você está agora.'}
          </Texto>
        </View>

        <View style={estilos.regra}>
          <Icone nome="info" tamanho={24} cor={cores.petroleo} />
          <Texto variante="corpoForte" style={estilos.fluxo}>Não descreva pessoas. Diga só o que e onde.</Texto>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="O que aconteceu" style={estilos.tipos}>
          {TIPOS.map((t) => {
            const marcado = tipo === t.tipo;
            return (
              <Pressable
                key={t.tipo}
                accessibilityRole="radio"
                accessibilityLabel={t.rotulo}
                accessibilityState={{ checked: marcado }}
                android_ripple={{ color: cores.bordaSuave }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setTipo(t.tipo);
                }}
                style={({ pressed }) => [estilos.tipo, marcado && estilos.tipoMarcado, pressed && !marcado && estilos.tipoPressionado]}
              >
                {marcado ? <Icone nome="ok" tamanho={20} cor={cores.areia} /> : null}
                <Texto variante="corpoForte" style={marcado ? estilos.tipoTextoMarcado : estilos.tipoTexto}>
                  {t.rotulo}
                </Texto>
              </Pressable>
            );
          })}
        </View>

        <View>
          <Campo
            rotulo="O que aconteceu (opcional)"
            valor={texto}
            onChangeText={(t) => setTexto(limitarTexto(t))}
            maxLength={MAX_TEXTO}
            placeholder="Ex.: moto parada na esquina"
            autoCorrect
          />
          <Texto variante="legenda" style={estilos.contador}>{`${texto.length} de ${MAX_TEXTO} caracteres`}</Texto>
        </View>

        {aviso ? (
          aviso.alerta ? (
            <Aviso mensagem={aviso.texto} />
          ) : (
            <View style={estilos.feito} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Icone nome="ok" tamanho={20} cor={cores.petroleo} />
              <Texto style={estilos.fluxo}>{aviso.texto}</Texto>
            </View>
          )
        ) : null}
      </ScrollView>

      <BarraAcao>
        <Botao rotulo="Enviar relato" onPress={() => void enviar()} carregando={enviando} />
      </BarraAcao>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  rolagem: { flex: 1 },
  tela: { padding: espacos.m, paddingBottom: espacos.g, gap: espacos.m },
  fluxo: { flex: 1 },
  local: { flexDirection: 'row', alignItems: 'center', gap: espacos.p },
  regra: {
    flexDirection: 'row', alignItems: 'center', gap: espacos.pm, padding: espacos.m,
    borderRadius: raios.m, backgroundColor: cores.areiaFunda,
  },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.p },
  tipo: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: tamanhos.alvoAcao + espacos.m,
    minWidth: tamanhos.alvoMin,
    flexDirection: 'row',
    gap: espacos.xs,
    borderWidth: bordas.padrao,
    borderColor: cores.petroleo,
    borderRadius: raios.m,
    backgroundColor: cores.branco,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: espacos.p,
  },
  tipoMarcado: { backgroundColor: cores.petroleo },
  tipoPressionado: { backgroundColor: cores.areiaFunda },
  tipoTexto: { color: cores.petroleo },
  tipoTextoMarcado: { color: cores.areia },
  contador: { color: cores.textoSuave, textAlign: 'right', marginTop: -espacos.p },
  feito: { flexDirection: 'row', alignItems: 'center', gap: espacos.p, padding: espacos.pm, borderRadius: raios.m, backgroundColor: cores.esmeraldaSuave },
});
