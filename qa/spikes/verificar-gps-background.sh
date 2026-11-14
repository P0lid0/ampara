#!/usr/bin/env bash
# Risco (a): o emulador reproduz uma rota e o app Expo recebe localizacao em segundo plano.
# Uso: bash qa/spikes/verificar-gps-background.sh
# Rota SINTETICA: ponto inicial = estacao Pinheiros do contrato; nenhum dado pessoal.
set -u
ANDROID_HOME="${ANDROID_HOME:-C:/Users/pedro.martins/scoop/apps/android-clt/current}"
EMU="$ANDROID_HOME/emulator/emulator.exe"
ADB="$ANDROID_HOME/platform-tools/adb.exe"
AVD="${AVD:-guardiao_vitima}"
PKG=br.fiap.ampara.spike

falha() { echo "FALHA asserção $1: $2"; exit 1; }
ok() { echo "OK    asserção $1: $2"; }

[ -x "$EMU" ] || falha 0 "emulador não encontrado em $EMU"
[ -x "$ADB" ] || falha 0 "adb não encontrado (sdkmanager.bat \"platform-tools\")"

# 1. aceleração
"$EMU" -accel-check 2>&1 | grep -q "usable" || falha 1 "-accel-check não imprimiu usable"
ok 1 "WHPX usable"

# 2. o AVD sobe (reaproveita um emulador já ligado)
if ! "$ADB" devices | grep -q "^emulator-.*device$"; then
  "$EMU" -avd "$AVD" -no-snapshot-save -no-boot-anim -accel on -gpu swiftshader_indirect >/dev/null 2>&1 &
fi
"$ADB" wait-for-device
boot=""
for _ in $(seq 1 90); do
  boot="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [ "$boot" = "1" ] && break
  sleep 2
done
[ "$boot" = "1" ] || falha 2 "sys.boot_completed não chegou a 1 em 180 s"
ok 2 "AVD $AVD no ar"

# 3. APK release instalado
"$ADB" shell pm list packages | grep -q "$PKG" || falha 3 "pacote $PKG não instalado"
ok 3 "$PKG instalado"

# 4. permissões e localização ligada
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION POST_NOTIFICATIONS; do
  "$ADB" shell pm grant "$PKG" "android.permission.$p" || falha 4 "pm grant $p"
done
"$ADB" shell settings put secure location_mode 3
ok 4 "permissões concedidas"

# 5. abre o app, vai para a tela inicial e confirma que ele saiu do primeiro plano
"$ADB" shell am force-stop "$PKG"
"$ADB" logcat -c
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 15
"$ADB" shell input keyevent KEYCODE_HOME
sleep 2
topo="$("$ADB" shell dumpsys activity activities | grep -m1 topResumedActivity | tr -d '\r')"
case "$topo" in *"$PKG"*) falha 5 "o app continua em primeiro plano: $topo";; esac
ok 5 "app em segundo plano ($topo)"

# 6. dez fixes sinteticos, 6 s entre eles (longitude primeiro)
"$ADB" logcat -c
for i in 0 1 2 3 4 5 6 7 8 9; do
  lng="$(awk -v i="$i" 'BEGIN{printf "%.7f", -46.7019515 + 0.0007*i}')"
  lat="$(awk -v i="$i" 'BEGIN{printf "%.7f", -23.5672490 - 0.0002*i}')"
  "$ADB" emu geo fix "$lng" "$lat" >/dev/null
  sleep 6
done
sleep 8   # o ultimo fix leva alguns segundos ate virar um AMPARA_PONTO
ok 6 "10 fixes enviados"

# 7. pontos no logcat e último ponto perto do destino
"$ADB" logcat -d > "${TMPDIR:-.}/gps-logcat.$$.txt" 2>&1
n="$(grep -c AMPARA_PONTO "${TMPDIR:-.}/gps-logcat.$$.txt")"
[ "$n" -ge 8 ] || { rm -f "${TMPDIR:-.}/gps-logcat.$$.txt"; falha 7 "só $n linhas AMPARA_PONTO (mínimo 8)"; }
ultimo="$(grep AMPARA_PONTO "${TMPDIR:-.}/gps-logcat.$$.txt" | tail -1)"
rm -f "${TMPDIR:-.}/gps-logcat.$$.txt"
ulat="$(echo "$ultimo" | sed -E 's/.*"lat":(-?[0-9.]+).*/\1/')"
ulng="$(echo "$ultimo" | sed -E 's/.*"lng":(-?[0-9.]+).*/\1/')"
awk -v a="$ulat" -v b="$ulng" 'BEGIN{
  da=a-(-23.5690490); if(da<0)da=-da; db=b-(-46.6956515); if(db<0)db=-db;
  exit !(da<=0.0005 && db<=0.0005)}' || falha 7 "último ponto longe do destino: lat=$ulat lng=$ulng"
ok 7 "$n pontos; último lat=$ulat lng=$ulng"

# 8. encerra só este emulador
"$ADB" emu kill >/dev/null 2>&1
ok 8 "emulador encerrado"
echo "PASSOU: $n pontos AMPARA_PONTO"
