import notifee from '@notifee/react-native';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { permissaoNotificacao } from '../guardiao/notificacao';
import { cores, espacos } from '../theme/tokens';
import { Botao } from './Botao';
import { Texto } from './Texto';

export const MSG_ALARME_DESATIVADO = 'Alarme desativado: permita notificações em Ajustes.';

/** RF4: aviso visível quando o app não pode notificar (o alarme do guardião não tocaria). */
export function BannerAlarme() {
  const [negada, setNegada] = useState(false);

  useEffect(() => {
    let vivo = true;
    const conferir = () => {
      permissaoNotificacao(false)
        .then((r) => {
          if (vivo) setNegada(r === 'negada');
        })
        .catch(() => undefined);
    };
    conferir();
    // volta de Ajustes: confere de novo
    const assinatura = AppState.addEventListener('change', (s) => {
      if (s === 'active') conferir();
    });
    return () => {
      vivo = false;
      assinatura.remove();
    };
  }, []);

  if (!negada) return null;
  return (
    <View style={estilos.faixa} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Texto>{MSG_ALARME_DESATIVADO}</Texto>
      <Botao rotulo="Abrir Ajustes" variante="secundario" onPress={() => void notifee.openNotificationSettings()} />
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: {
    backgroundColor: cores.areia,
    borderColor: cores.tinta,
    borderWidth: 2,
    borderRadius: 12,
    padding: espacos.m,
    gap: espacos.p,
  },
});
