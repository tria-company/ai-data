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
  delay,
};
