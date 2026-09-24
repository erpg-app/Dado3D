# Dado3D

Rolador de dados 3D offline, com interface pequena e foco em celular. Toque nos
dados no modo **Pool** para montar uma pilha mista (`2d6+d20`) ou alterne para
**Notação** e digite uma fórmula genérica do Dicecore, incluindo modificadores
e pools de sucessos. O resultado compacto abre os detalhes completos ao toque.
O resultado textual
vem do Dicecore; a cena 3D apenas apresenta os valores. A cena mostra até 24
corpos visuais, e o texto continua completo quando a fórmula ultrapassa o
limite ou o WebGL não está disponível.

## Tecnologia

- Vite + TypeScript + CSS, sem framework de UI, fontes externas, ícones remotos,
  serviços ou plugins Cordova.
- `@erpg/dicecore@3.7.1` pelo entrypoint `/core` e `@erpg/dice3dview` fixado no
  commit `ae00d9f6cb9865378e59d49687c4588751532c5c`.
- Cordova no Android/iOS; Tauri 2 com WebView do sistema no Windows/Linux.
- Um tema de dados 3D, com mapa de relevo; quatro cores. Interface escura por
  padrão, opção clara e 104 idiomas locais. O idioma escolhido é carregado sob
  demanda. As variantes regionais usam o idioma base.

## Desenvolvimento

Requer Node.js 22 ou superior. O projeto não baixa dados no aplicativo; os
assets 3D são copiados da dependência fixada durante o build.

```sh
npm ci
npm run dev
npm run check
```

Para gerar um APK de teste, instale JDK 17+, Android SDK 36 e Gradle 8.14.2.
Depois execute:

```sh
npx cordova platform add android@15.1.0 --nosave
npm run android
```

O APK fica em `platforms/android/app/build/outputs/apk/debug/app-debug.apk`.
Para iOS, em macOS com Xcode e CocoaPods:

```sh
npx cordova platform add ios@8.1.1 --nosave
npm run ios
```

Para desktop, instale Rust e os requisitos de sistema do Tauri 2. Execute
`npm run desktop -- --bundles nsis` no Windows ou
`npm run desktop -- --bundles deb` no Linux. O CI gera os quatro
pacotes de teste e relatórios de tamanho em cada push para `main`.

## Tamanho e desempenho

`npm run build:web` mostra bytes de JavaScript, CSS, idiomas e assets e falha
quando o total web supera a referência de `size-baseline.json` em mais de 5%.
`node scripts/measure.mjs --output web-size.json` detalha cada arquivo.
O 3D começa a preparar depois do primeiro quadro e não deve animar em repouso.
Ao ir para segundo plano, a cena é descartada e reconstruída no retorno.
Consulte `docs/PERFORMANCE.md` para medições no aparelho.

Os 103 catálogos além do inglês foram gerados com tradução automática, e o
português foi revisado manualmente. As traduções devem passar por revisão de
falantes nativos antes de um lançamento público.

## Direitos

O código do Dado3D é visível com **todos os direitos reservados**. A
autorização específica para a biblioteca 3D está em `AUTHORIZATION.md`; os
avisos das bibliotecas e dos assets estão em `THIRD_PARTY_NOTICES.md` e
`public/notices/`.
