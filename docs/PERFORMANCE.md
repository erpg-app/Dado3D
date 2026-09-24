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

## Primeira referência local — 24/09/2026

| Medida | Resultado |
|---|---:|
| Conteúdo web, bruto | 581.212 bytes |
| Conteúdo web, gzip por arquivo | 259.908 bytes |
| APK Android debug | 3.732.731 bytes |
| Instalador Windows NSIS no CI | 2.074.989 bytes |
| Pacote Linux `.deb` no CI | 3.078.678 bytes |
| WebView interativa após início da navegação | 474 ms |
| Cena 3D e assets prontos | 2.064 ms |
| Cálculo de `2d6+d20` | 9 ms |
| Primeira rolagem 3D, do toque ao fim | 3.576 ms |
| PSS em repouso após rolagem | 123.335 KiB |
| CPU em repouso | 0,0% na amostra de `top` |
| CPU durante rolagem | 103% na amostra de `top` |
| Quadros solicitados em 2 s de repouso | 0 |

Medição em emulador Pixel 10 Pro XL com Android 17, WebView e imagem de sistema
do host em 24/09/2026. O primeiro `am start -W` após iniciar o emulador levou
7.085 ms, incluindo o custo de abertura da Activity nesse ambiente. O PSS foi
medido para o processo do app; não é o consumo total do sistema/WebView. O
espaço instalado total e o comportamento em aparelho físico ainda precisam ser
medidos. Estes números são uma referência local, não metas nem promessa de
desempenho em outros dispositivos.

Com Wi-Fi e dados móveis desativados no emulador, o app abriu em
`https://localhost`, carregou os assets 3D locais e completou `2d6+d20`.
Ao voltar para a tela inicial do Android, o evento `pause` liberou o canvas;
`resume` recriou a cena na volta ao app.

O AppImage Linux mediu 78.785.016 bytes no primeiro build porque leva mais
dependências consigo. Por priorizar tamanho, o CI publica o `.deb`, que usa o
WebKitGTK do sistema; o AppImage pode ser gerado manualmente quando for
necessária distribuição portátil.
