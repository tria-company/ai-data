const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkIfPrivate(page) {
  try {
    console.log("🔍 Verificando se a conta é privada...");
    await delay(1500);

    const result = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();

      // Indicadores de conta privada
      const privateIndicators = [
        "essa conta é privada",
        "this account is private",
        "siga esse usuário",
        "follow this account",
      ];

      const isPrivate = privateIndicators.some((indicator) =>
        text.includes(indicator),
      );

      const hasPosts =
        document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length >
        0;

      return {
        isPrivate: isPrivate && !hasPosts,
        hasPrivateText: isPrivate,
        hasVisiblePosts: hasPosts,
      };
    });

    console.log(
      `${result.isPrivate ? "🔒" : "🔓"} Conta ${result.isPrivate ? "PRIVADA" : "PÚBLICA"}`,
    );

    return result.isPrivate;
  } catch (err) {
    console.error("❌ Erro ao verificar privacidade:", err);
    return false;
  }
}

async function scrollToBottom(page, sendLog, username, maxPosts = 50) {
  try {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let unchangedCount = 0;
    const MAX_SCROLL_ATTEMPTS = 20; // Reduzido
    const SCROLL_DELAY = 2000;
    const MAX_UNCHANGED = 3;

    sendLog("Iniciando scroll para carregar posts", "info", {
      account: username,
    });

    while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      const currentPosts = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
          .length;
      });

      if (currentPosts >= maxPosts) {
        sendLog(
          `Já carregamos ${currentPosts} posts (limite: ${maxPosts})`,
          "info",
          {
            account: username,
          },
        );
        break;
      }

      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight,
      );

      if (currentHeight === previousHeight) {
        unchangedCount++;
        if (unchangedCount >= MAX_UNCHANGED) {
          sendLog(`Chegou ao fim após ${scrollAttempts} scrolls`, "info", {
            account: username,
          });
          break;
        }
      } else {
        unchangedCount = 0;
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(SCROLL_DELAY);

      previousHeight = currentHeight;
      scrollAttempts++;

      if (scrollAttempts % 5 === 0) {
        sendLog(
          `Scrolling... (${scrollAttempts} scrolls, ${currentPosts} posts carregados)`,
          "info",
          {
            account: username,
          },
        );
      }
    }

    // Scroll
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(1000);

    sendLog("Scroll finalizado", "success", { account: username });
  } catch (err) {
    sendLog(`Erro durante scroll: ${err.message}`, "warning", {
      account: username,
    });
  }
}

async function extractCarouselImages(page, postUrl, sendLog, username) {
  try {
    sendLog(`Extraindo imagens do carousel: ${postUrl}`, "info", {
      account: username,
    });

    // Abrir post em nova aba
    const newPage = await page.browser().newPage();

    try {
      await newPage.goto(postUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await delay(2000);

      // Extrair todas as imagens do carousel
      const carouselData = await newPage.evaluate(() => {
        const images = [];

        // Procurar por todas as imagens dentro do carousel
        const imgElements = document.querySelectorAll(
          'img[style*="object-fit"], img[srcset]',
        );

        const seenUrls = new Set();

        for (const img of imgElements) {
          let url =
            img.src || img.getAttribute("srcset")?.split(" ")[0] || null;

          // Filtrar apenas imagens de conteúdo (não ícones/avatares)
          if (
            url &&
            !seenUrls.has(url) &&
            (url.includes("scontent") || url.includes("cdninstagram")) &&
            !url.includes("44x44") &&
            !url.includes("150x150")
          ) {
            seenUrls.add(url);
            images.push({
              url: url,
              alt: img.alt || "",
            });
          }
        }

        // Se não encontrou imagens, tentar extrair do script JSON
        if (images.length === 0) {
          try {
            const scripts = document.querySelectorAll("script");
            for (const script of scripts) {
              if (script.textContent.includes("carousel_media")) {
                const match = script.textContent.match(
                  /"carousel_media":\s*\[(.*?)\]/s,
                );
                if (match) {
                  // Extrair URLs de imagens do JSON
                  const urlMatches = script.textContent.matchAll(
                    /"display_url":"([^"]+)"/g,
                  );
                  for (const urlMatch of urlMatches) {
                    const url = urlMatch[1].replace(/\\u0026/g, "&");
                    if (!seenUrls.has(url)) {
                      seenUrls.add(url);
                      images.push({
                        url: url,
                        alt: "",
                      });
                    }
                  }
                  break;
                }
              }
            }
          } catch (e) {
            console.error("Erro ao extrair do JSON:", e);
          }
        }

        return {
          totalImages: images.length,
          images: images,
        };
      });

      await newPage.close();

      sendLog(
        `✅ Extraídas ${carouselData.totalImages} imagens do carousel`,
        "success",
        {
          account: username,
        },
      );

      return carouselData;
    } catch (err) {
      await newPage.close();
      throw err;
    }
  } catch (err) {
    sendLog(`❌ Erro ao extrair carousel: ${err.message}`, "warning", {
      account: username,
    });
    return { totalImages: 0, images: [] };
  }
}

async function extractPostsData(page, username, sendLog, maxPosts = 50) {
  try {
    sendLog("Iniciando extração de dados dos posts", "info", {
      account: username,
    });

    const posts = await page.evaluate(
      (user, max) => {
        const postsData = [];
        const seenUrls = new Set();

        const allLinks = Array.from(
          document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'),
        );

        console.log(`Total de links encontrados: ${allLinks.length}`);

        for (
          let index = 0;
          index < allLinks.length && postsData.length < max;
          index++
        ) {
          try {
            const link = allLinks[index];
            const href = link.getAttribute("href");

            if (!href) continue;

            let postUrl = href;
            if (!postUrl.startsWith("http")) {
              postUrl =
                "https://www.instagram.com" +
                (postUrl.startsWith("/") ? "" : "/") +
                postUrl;
            }

            if (seenUrls.has(postUrl)) continue;
            seenUrls.add(postUrl);

            let postId = null;
            let mediaType = "unknown";

            if (href.includes("/reel/")) {
              const match = href.match(/\/reel\/([^\/]+)/);
              postId = match ? match[1] : null;
              mediaType = "reel";
            } else if (href.includes("/p/")) {
              const match = href.match(/\/p\/([^\/]+)/);
              postId = match ? match[1] : null;
              mediaType = "post";
            }

            if (!postId) continue;

            let imgElement = link.querySelector("img");
            let mediaUrl = null;
            let altText = "";

            if (imgElement) {
              mediaUrl =
                imgElement.src ||
                imgElement.getAttribute("srcset")?.split(" ")[0];
              altText = imgElement.alt || "";
            } else {
              let parent = link.parentElement;
              for (let i = 0; i < 3 && parent && !imgElement; i++) {
                imgElement = parent.querySelector("img");
                parent = parent.parentElement;
              }

              if (imgElement) {
                mediaUrl =
                  imgElement.src ||
                  imgElement.getAttribute("srcset")?.split(" ")[0];
                altText = imgElement.alt || "";
              }
            }

            const hasReelIcon =
              link.querySelector('svg[aria-label*="Clipe"]') !== null ||
              link.querySelector('svg[aria-label*="Clip"]') !== null;

            if (hasReelIcon) {
              mediaType = "reel";
            }

            const isCarousel =
              link.querySelector('svg[aria-label*="Carrossel"]') !== null ||
              link.querySelector('svg[aria-label*="Carousel"]') !== null;

            const isPinned =
              link.querySelector('svg[aria-label*="fixado"]') !== null ||
              link.querySelector('svg[aria-label*="pinned"]') !== null;

            postsData.push({
              postId: postId,
              postUrl: postUrl,
              mediaUrl: mediaUrl,
              mediaType: mediaType,
              altText: altText,
              isCarousel: isCarousel,
              isPinned: isPinned,
              index: postsData.length + 1,
              extractedAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error(`Erro ao extrair post ${index}:`, err.message);
          }
        }

        return postsData;
      },
      username,
      maxPosts,
    );

    // Processar carousels para extrair todas as imagens
    sendLog("Processando posts do tipo carousel...", "info", {
      account: username,
    });

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (post.isCarousel) {
        const carouselData = await extractCarouselImages(
          page,
          post.postUrl,
          sendLog,
          username,
        );

        if (carouselData.totalImages > 0) {
          posts[i].carouselImages = carouselData.images;
          posts[i].carouselCount = carouselData.totalImages;
        }

        // Pequeno delay entre requisições para não sobrecarregar
        await delay(1500);
      }
    }

    sendLog(`✅ Extraídos ${posts.length} posts com sucesso`, "success", {
      account: username,
      postsCount: posts.length,
    });

    return posts;
  } catch (err) {
    sendLog(`❌ Erro ao extrair dados: ${err.message}`, "error", {
      account: username,
    });
    return [];
  }
}

async function extractProfileStats(page, sendLog, username) {
  try {
    const stats = await page.evaluate(() => {
      const result = {
        followers: null,
        following: null,
        posts: null,
      };

      const bodyText = document.body.innerText;

      const followersMatch = bodyText.match(
        /(\d+(?:[.,]\d+)*)\s*(?:seguidores?|followers?)/i,
      );
      const followingMatch = bodyText.match(
        /(\d+(?:[.,]\d+)*)\s*(?:seguindo|following)/i,
      );
      const postsMatch = bodyText.match(
        /(\d+(?:[.,]\d+)*)\s*(?:posts?|publicaç(?:ões?|ao))/i,
      );

      if (followersMatch) {
        result.followers = followersMatch[1].replace(/[,.]/g, "");
      }

      if (followingMatch) {
        result.following = followingMatch[1].replace(/[,.]/g, "");
      }

      if (postsMatch) {
        result.posts = postsMatch[1].replace(/[,.]/g, "");
      }

      return result;
    });

    sendLog("Estatísticas do perfil extraídas", "success", {
      account: username,
      ...stats,
    });

    return stats;
  } catch (err) {
    sendLog(`Falha ao extrair estatísticas: ${err.message}`, "error", {
      account: username,
    });
    return {
      followers: null,
      following: null,
      posts: null,
    };
  }
}

async function scrapInstagramProfile(
  page,
  username,
  profileUrl,
  sendLog,
  maxPosts = 50,
) {
  try {
    const scrapedData = {
      username: username,
      url: profileUrl,
      scrapedAt: new Date().toISOString(),
    };

    sendLog("🚀 Iniciando scraping do perfil", "info", { account: username });

    await delay(3000);

    const isPrivate = await checkIfPrivate(page);
    scrapedData.isPrivate = isPrivate;

    const stats = await extractProfileStats(page, sendLog, username);
    scrapedData.followers = stats.followers;
    scrapedData.following = stats.following;
    scrapedData.postsCount = stats.posts;

    if (!isPrivate) {
      sendLog("Conta pública - Extraindo posts", "info", { account: username });

      await scrollToBottom(page, sendLog, username, maxPosts);

      const posts = await extractPostsData(page, username, sendLog, maxPosts);

      scrapedData.posts = {
        total: posts.length,
        items: posts.slice(0, maxPosts), // Garantir que não passa do limite
      };
    } else {
      sendLog("Conta privada - Não é possível extrair posts", "warning", {
        account: username,
      });
      scrapedData.posts = null;
    }

    sendLog("✅ Scraping finalizado com sucesso!", "success", {
      account: username,
      isPrivate: scrapedData.isPrivate,
      postsExtracted: scrapedData.posts?.total || 0,
    });

    return scrapedData;
  } catch (err) {
    sendLog(`❌ Erro fatal no scraping: ${err.message}`, "error", {
      account: username,
      error: err.stack,
    });
    return null;
  }
}

export default {
  scrapInstagramProfile,
  checkIfPrivate,
  scrollToBottom,
  extractPostsData,
  extractProfileStats,
  extractCarouselImages,
  delay,
};
