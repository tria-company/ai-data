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

// Extração de URL de vídeo para reels/videos
async function extractVideoUrl(page, postUrl, sendLog, username) {
  try {
    sendLog(`Extraindo URL do vídeo: ${postUrl}`, "info", {
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

      // Extrair URL do vídeo
      const videoData = await newPage.evaluate(() => {
        // Procurar pela tag video
        const videoElement = document.querySelector("video");

        if (videoElement) {
          // Tentar pegar o src direto
          let videoUrl = videoElement.src || null;

          // Se não tiver src direto, procurar no source
          if (!videoUrl || videoUrl.startsWith("blob:")) {
            const sourceElement = videoElement.querySelector("source");
            if (sourceElement) {
              videoUrl = sourceElement.src;
            }
          }

          // Se ainda for blob, tentar extrair do HTML ou atributos
          if (videoUrl && videoUrl.startsWith("blob:")) {
            // Procurar no dataset ou outros atributos
            const dataSrc = videoElement.getAttribute("data-src") ||
                           videoElement.getAttribute("data-video-url");
            if (dataSrc) {
              videoUrl = dataSrc;
            }
          }

          return {
            videoUrl: videoUrl,
            poster: videoElement.poster || null,
            width: videoElement.videoWidth || null,
            height: videoElement.videoHeight || null,
          };
        }

        // Se não encontrou video element, tentar buscar nos scripts JSON
        try {
          const scripts = document.querySelectorAll("script");
          for (const script of scripts) {
            if (script.textContent.includes("video_url")) {
              const match = script.textContent.match(/"video_url":"([^"]+)"/);
              if (match) {
                return {
                  videoUrl: match[1].replace(/\\u0026/g, "&"),
                  poster: null,
                  width: null,
                  height: null,
                };
              }
            }
          }
        } catch (e) {
          console.error("Erro ao extrair video_url do JSON:", e);
        }

        return null;
      });

      await newPage.close();

      if (videoData && videoData.videoUrl) {
        sendLog(`✅ URL do vídeo extraída com sucesso`, "success", {
          account: username,
        });
        return videoData;
      } else {
        sendLog(`⚠️ Não foi possível extrair URL do vídeo`, "warning", {
          account: username,
        });
        return null;
      }
    } catch (err) {
      await newPage.close();
      throw err;
    }
  } catch (err) {
    sendLog(`❌ Erro ao extrair URL do vídeo: ${err.message}`, "warning", {
      account: username,
    });
    return null;
  }
}

// Extração de carousel abrindo em nova aba (método alternativo)
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

// Extração de carousel navegando pelos botões (método mais robusto)
async function extractCarouselMedia(page, postUrl, sendLog) {
  try {
    const carouselMedia = await page.evaluate(() => {
      const media = [];

      // Procura por botão "Próximo" para identificar carrossel
      const nextButton = document.querySelector(
        'button[aria-label*="Próximo"], button[aria-label*="Next"]',
      );

      if (!nextButton) {
        // Não é carrossel ou tem apenas 1 item
        return null;
      }

      // Extrai o item atual
      const extractCurrentMedia = () => {
        // Procura por vídeo primeiro
        const video = document.querySelector("article video");
        if (video) {
          return {
            type: "video",
            url: video.src || video.querySelector("source")?.src,
            poster: video.poster,
            width: video.videoWidth || null,
            height: video.videoHeight || null,
          };
        }

        // Se não for vídeo, procura por imagem
        const img = document.querySelector(
          'article img[srcset], article img[src]:not([alt*="foto do perfil"]):not([alt*="profile picture"])',
        );
        if (img) {
          // Tenta pegar a URL de maior resolução do srcset
          let url = img.src;
          const srcset = img.getAttribute("srcset");
          if (srcset) {
            const urls = srcset.split(",").map((s) => s.trim().split(" "));
            // Pega a última URL (geralmente a de maior resolução)
            url = urls[urls.length - 1][0] || url;
          }

          return {
            type: "image",
            url: url,
            alt: img.alt,
            width: img.naturalWidth || null,
            height: img.naturalHeight || null,
          };
        }

        return null;
      };

      // Extrai a primeira mídia
      const firstMedia = extractCurrentMedia();
      if (firstMedia) {
        media.push({ ...firstMedia, position: 1 });
      }

      return { items: media, hasNext: true };
    });

    if (!carouselMedia || !carouselMedia.hasNext) {
      return null;
    }

    const allMedia = [...carouselMedia.items];

    // Navega pelos próximos itens do carrossel
    let position = 2;
    const MAX_CAROUSEL_ITEMS = 10; // Instagram permite até 10 itens

    while (position <= MAX_CAROUSEL_ITEMS) {
      try {
        // Clica no botão "Próximo"
        const hasNext = await page.evaluate(() => {
          const nextBtn = document.querySelector(
            'button[aria-label*="Próximo"], button[aria-label*="Next"]',
          );
          if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
            return true;
          }
          return false;
        });

        if (!hasNext) break;

        await delay(800); // Aguarda carregar nova mídia

        // Extrai a mídia atual
        const mediaItem = await page.evaluate((pos) => {
          // Procura por vídeo
          const video = document.querySelector("article video");
          if (video) {
            return {
              type: "video",
              url: video.src || video.querySelector("source")?.src,
              poster: video.poster,
              width: video.videoWidth || null,
              height: video.videoHeight || null,
              position: pos,
            };
          }

          // Procura por imagem
          const img = document.querySelector(
            'article img[srcset], article img[src]:not([alt*="foto do perfil"]):not([alt*="profile picture"])',
          );
          if (img) {
            let url = img.src;
            const srcset = img.getAttribute("srcset");
            if (srcset) {
              const urls = srcset.split(",").map((s) => s.trim().split(" "));
              url = urls[urls.length - 1][0] || url;
            }

            return {
              type: "image",
              url: url,
              alt: img.alt,
              width: img.naturalWidth || null,
              height: img.naturalHeight || null,
              position: pos,
            };
          }

          return null;
        }, position);

        if (mediaItem && !allMedia.find((m) => m.url === mediaItem.url)) {
          allMedia.push(mediaItem);
        } else if (!mediaItem) {
          break; // Não encontrou mais mídia
        }

        position++;
      } catch (err) {
        console.error(
          `Erro ao navegar carrossel posição ${position}:`,
          err.message,
        );
        break;
      }
    }

    return allMedia.length > 0 ? allMedia : null;
  } catch (err) {
    sendLog(`Erro ao extrair mídia do carrossel: ${err.message}`, "warning");
    return null;
  }
}

async function extractPostsData(
  page,
  username,
  sendLog,
  maxPosts = 50,
  abortSignal = null,
) {
  try {
    sendLog("Iniciando extração de dados dos posts", "info", {
      account: username,
    });

    // Verifica se foi abortado
    if (abortSignal?.aborted) {
      sendLog("⚠️ Extração cancelada por timeout", "warning", {
        account: username,
      });
      return [];
    }

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

    // Processar reels/videos identificados para extrair URL do vídeo
    const reels = posts.filter((p) => p.mediaType === "reel");
    const MAX_REELS_TO_PROCESS = 10; // Limite para evitar timeout

    if (reels.length > 0) {
      const reelsToProcess = reels.slice(0, MAX_REELS_TO_PROCESS);
      const skippedCount = reels.length - reelsToProcess.length;

      sendLog(
        `🎬 Identificados ${reels.length} reels/vídeos - processando ${reelsToProcess.length} primeiros${skippedCount > 0 ? ` (${skippedCount} ignorados para evitar timeout)` : ""}`,
        "info",
        {
          account: username,
        },
      );

      // Processar cada reel
      for (const post of reelsToProcess) {
        // Verificar se foi abortado antes de processar cada reel
        if (abortSignal?.aborted) {
          sendLog(
            "⚠️ Processamento de reels cancelado por timeout",
            "warning",
            {
              account: username,
            },
          );
          break;
        }

        try {
          sendLog(`Processando reel: ${post.postUrl}`, "info", {
            account: username,
          });

          const videoData = await extractVideoUrl(
            page,
            post.postUrl,
            sendLog,
            username,
          );

          if (videoData && videoData.videoUrl) {
            post.videoUrl = videoData.videoUrl;
            post.videoPoster = videoData.poster;
            post.videoWidth = videoData.width;
            post.videoHeight = videoData.height;

            sendLog(`✅ Reel processado: URL do vídeo extraída`, "success", {
              account: username,
            });
          }

          // Delay menor entre reels
          await delay(800);
        } catch (err) {
          sendLog(
            `⚠️ Erro ao processar reel ${post.postId}: ${err.message}`,
            "warning",
            {
              account: username,
            },
          );
        }
      }

      sendLog(
        `✅ Processamento de reels finalizado (${reelsToProcess.length}/${reels.length})`,
        "success",
        {
          account: username,
        },
      );
    }

    // Processar carrosséis identificados (limitado para evitar timeout)
    const carousels = posts.filter((p) => p.isCarousel);
    const MAX_CAROUSELS_TO_PROCESS = 5; // Limite para evitar timeout

    if (carousels.length > 0) {
      const carouselsToProcess = carousels.slice(0, MAX_CAROUSELS_TO_PROCESS);
      const skippedCount = carousels.length - carouselsToProcess.length;

      sendLog(
        `🎠 Identificados ${carousels.length} carrosséis - processando ${carouselsToProcess.length} primeiros${skippedCount > 0 ? ` (${skippedCount} ignorados para evitar timeout)` : ""}`,
        "info",
        {
          account: username,
        },
      );

      // Processar cada carousel
      for (const post of carouselsToProcess) {
        // Verificar se foi abortado antes de processar cada carousel
        if (abortSignal?.aborted) {
          sendLog(
            "⚠️ Processamento de carrosséis cancelado por timeout",
            "warning",
            {
              account: username,
            },
          );
          break;
        }

        try {
          sendLog(`Processando carousel: ${post.postUrl}`, "info", {
            account: username,
          });

          const carouselData = await extractCarouselImages(
            page,
            post.postUrl,
            sendLog,
            username,
          );

          if (carouselData && carouselData.images.length > 0) {
            post.carouselCount = carouselData.totalImages;
            post.carouselImages = carouselData.images;

            sendLog(
              `✅ Carousel processado: ${carouselData.totalImages} imagens`,
              "success",
              {
                account: username,
              },
            );
          }

          // Delay menor entre carrosséis
          await delay(1000);
        } catch (err) {
          sendLog(
            `⚠️ Erro ao processar carousel ${post.postId}: ${err.message}`,
            "warning",
            {
              account: username,
            },
          );
        }
      }

      sendLog(
        `✅ Processamento de carrosséis finalizado (${carouselsToProcess.length}/${carousels.length})`,
        "success",
        {
          account: username,
        },
      );
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
  extractCarouselMedia,
  extractProfileStats,
  extractCarouselImages,
  extractVideoUrl,
  delay,
};
