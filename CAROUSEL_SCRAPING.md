# Carousel Scraping Implementation

## Overview
Esta implementação adiciona suporte completo para extração de posts do tipo Carousel no Instagram.

## O que mudou

### Novo Recurso: Extração de Carousels
- Posts do tipo carousel agora têm todas as suas imagens extraídas
- Cada carousel é processado individualmente abrindo o post em uma nova aba
- As imagens são filtradas para evitar duplicatas e ícones de interface

### Estrutura de Dados

Quando um post é identificado como carousel (`isCarousel: true`), os seguintes campos adicionais são incluídos:

```javascript
{
  "postId": "...",
  "postUrl": "...",
  "mediaUrl": "...",  // URL da primeira imagem (thumbnail)
  "mediaType": "post",
  "isCarousel": true,
  "carouselCount": 5,  // Número total de imagens no carousel
  "carouselImages": [  // Array com todas as imagens
    {
      "url": "https://scontent.cdninstagram.com/...",
      "alt": "Texto alternativo da imagem"
    },
    // ... outras imagens
  ],
  // ... outros campos
}
```

## Implementação Técnica

### Nova Função: `extractCarouselImages()`

Esta função:
1. Abre o post do carousel em uma nova aba do navegador
2. Busca todas as imagens no DOM com seletores específicos
3. Filtra imagens válidas (exclui avatares e ícones pequenos)
4. Tenta extrair do JSON estruturado se não encontrar no DOM
5. Retorna array com URLs e textos alternativos
6. Fecha a aba ao finalizar

### Modificação: `extractPostsData()`

A função foi atualizada para:
1. Identificar posts do tipo carousel (já existente)
2. Processar cada carousel chamando `extractCarouselImages()`
3. Adicionar os dados do carousel ao objeto do post
4. Incluir delay de 1.5s entre requisições para evitar sobrecarga

## Performance

- Delay de 1.5 segundos entre cada carousel para evitar rate limiting
- Usa abas separadas que são fechadas após extração
- Processamento sequencial para manter controle e evitar sobrecarga

## Arquivos Modificados

- `src/scraper/instagram-posts-scraper.js`
  - Nova função: `extractCarouselImages()`
  - Modificação: `extractPostsData()` - adiciona processamento de carousels
  - Exportação: Adicionado `extractCarouselImages` às exportações

## Exemplo de Uso

O scraper funciona automaticamente. Quando um perfil é processado:

```javascript
const posts = await extractPostsData(page, username, sendLog, maxPosts);

// Para carousels, cada post terá:
// - isCarousel: true
// - carouselCount: número de imagens
// - carouselImages: array de objetos {url, alt}
```

## Testes

Para testar a funcionalidade:
1. Execute o scraper em um perfil com posts carousel
2. Verifique o arquivo `output/success.json`
3. Procure por posts com `isCarousel: true`
4. Verifique se `carouselImages` contém todas as imagens

## Arquivo de Exemplo

- `examples/carrouscel.html` - HTML de exemplo de um post carousel do Instagram
  - Usado como referência para análise da estrutura DOM
  - Post de exemplo: https://www.instagram.com/hiagonascimento/p/DDIMe2_hPpv/

## Observações

- A função tenta dois métodos de extração:
  1. Busca direta no DOM por elementos `<img>`
  2. Extração do JSON estruturado nos scripts da página
- Filtra URLs duplicadas usando `Set()`
- Inclui apenas imagens de conteúdo (exclui avatares e ícones)

## Limitações

- Requer que o post seja aberto em nova aba (aumenta tempo de processamento)
- Pode ser afetado por mudanças na estrutura HTML do Instagram
- Delay fixo de 1.5s pode precisar ajuste baseado em testes de uso real

## Próximos Passos

Possíveis melhorias futuras:
- [ ] Cache de carousels já processados
- [ ] Processamento paralelo controlado
- [ ] Detecção de vídeos em carousels
- [ ] Extração de metadados adicionais (curtidas, comentários)
