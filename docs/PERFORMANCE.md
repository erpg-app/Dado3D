# Medição de tamanho e uso de recursos

Cada build do CI publica o tamanho dos arquivos web e do pacote nativo. O
relatório web lista JS, CSS, catálogos, assets e cada arquivo. Os relatórios
nativos registram bytes do APK, instalador ou pacote, e o tamanho expandido do
`.app` do simulador iOS. O tamanho instalado e o consumo em execução dependem
do dispositivo; registre-os em aparelho de teste, sem extrapolar do APK.

## Procedimento para Android

1. Gere `npm run android`, conecte um aparelho e instale o APK com
   `adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk`.
2. Feche o app e execute `adb shell am force-stop app.erpg.dado3d`. Use
   `adb shell am start -W app.erpg.dado3d/.MainActivity` para registrar o tempo
   até a Activity; meça o tempo até a interface interativa com as marcas
   `dado3d:interactive` e `dado3d:viewer-ready` no WebView remoto.
3. Meça a primeira rolagem pelas marcas `dado3d:roll-start`,
   `dado3d:result-ready` e `dado3d:roll-complete`. Compare uma rolagem de
   `2d6+d20` com uma de `30d6` para o fallback textual.
4. Após 30 segundos em repouso, registre `adb shell dumpsys meminfo
   app.erpg.dado3d` e CPU no profiler do Android. Repita durante uma rolagem.
   Inspecione os quadros no profiler: após a animação, não deve haver quadros
   contínuos do renderizador.
5. Use a página de armazenamento do Android para registrar espaço instalado.
   Repita com a mesma versão do Android e do WebView ao comparar builds.

Para iOS e desktop, registre as mesmas marcas no inspetor do WebView e use os
monitores de memória/CPU do sistema. Os relatórios de CI medem artefatos; não
substituem medidas em dispositivo real.
