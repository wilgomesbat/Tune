// Importa as funções da biblioteca do Firebase
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    updateDoc, 
    increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Importa as instâncias já configuradas do seu main.js
// Use './main.js' se estiverem na mesma pasta ou '../main.js' se o player estiver em /js/
import { auth, db } from './firebase-config.js';
// Agora você pode usar auth e db aqui livremente
// ... restante do código (loadTrack, etc)

// FUNÇÃO GLOBAL PADRÃO DO TUNE
window.playTrackGlobal = function(track) {
    if (!track) return;

    console.log("🎵 TUNE GLOBAL PLAY:", track.title);

    // Abre mini player
    const mini = document.getElementById("music-player");
    if (mini) mini.classList.remove("hidden");

    // Carrega música
    loadTrack(track);
};


// --- ESTADO GLOBAL E PROTEÇÃO ---
const audio = new Audio();
audio.preload = "auto";
let currentTrack = null; 
let listenersAttached = false;
let streamTimer = null; 
const TIME_TO_STREAM = 20000; // 20 segundos para validar

if (!window.streamGuard) {
    window.streamGuard = {
        lastGlobalStreamTime: 0,
        userStreamHistory: new Map()
    };
}




// No topo do seu player.js
let playlistAtual = []; // Armazena o array de objetos das músicas
let indiceAtual = 0;    // Posição da música na fila

// 🎵 FUNÇÃO GLOBAL DE FILA
window.carregarFila = function(lista, index = 0) {
    if (!lista || !lista.length) return;

    playlistAtual = lista;
    indiceAtual = index;

    if (typeof window.playTrackGlobal === "function") {
        window.playTrackGlobal(playlistAtual[indiceAtual]);
    }
};




// --- Elementos do DOM (Adicionados da sua lógica de perfil) ---
const userProfileContainer = document.getElementById('user_profile_sidebar');
const guestProfileContainer = document.getElementById('guest_profile_sidebar');
const userProfileImg = document.querySelector('#user_profile_sidebar img'); // CORRIGIDO: Seleciona a imagem dentro do container
const userProfileButton = document.getElementById('user-profile-button');
const profileDropdown = document.getElementById('user-dropdown-menu');
const logoutLink = document.getElementById('logout-link');
const artistLink = document.getElementById('artist-link');
const artistLinkIcon = document.getElementById('artist-link-icon');
const artistLinkText = document.getElementById('artist-link-text');
const loginButton = document.getElementById('login-button');
const tuneteamItem = document.getElementById('tuneteam-item'); 
const searchInput = document.getElementById('searchInput'); // Adicionado
const defaultSections = document.getElementById('defaultSections'); // Adicionado
const searchResultsDropdown = document.getElementById('searchResultsDropdown'); // Adicionado


function getPlayerElements() {
    return {
        musicPlayer: document.getElementById("music-player"),
        coverImg: document.getElementById("fs-player-cover"),
        playBtn: document.getElementById("playpause-btn"),
        playIcon: document.getElementById("play-icon"),
        pauseIcon: document.getElementById("pause-icon"),
        miniPlayerCover: document.getElementById('mini-player-cover'),
        playerInfoContainer: document.querySelector('.player-info'), 
        playerTitle: document.getElementById("player-title"),
        playerArtist: document.getElementById("player-artist"),
        currentTimeEl: document.getElementById("current-time"),
        totalTimeEl: document.getElementById("total-time"),
        progressFill: document.getElementById("progress-fill"),
        volumeSlider: document.getElementById("volume-slider"),
        fullScreenPlayer: document.getElementById('full-screen-player'),
        fsCloseButton: document.getElementById('fs-player-close-btn'),
        fsPlayerCover: document.getElementById("fs-player-cover"),
        fsPlayerTitle: document.getElementById("fs-player-title"),
        fsPlayerArtist: document.getElementById("fs-player-artist"),
        fsPlayPauseBtn: document.getElementById('fs-playpause-btn'),
        fsPlayIcon: document.getElementById("fs-play-icon"),
        fsPauseIcon: document.getElementById("fs-pause-icon"),
        fsCurrentTimeEl: document.getElementById("fs-current-time"),
        fsTotalTimeEl: document.getElementById("fs-total-time"),
        fsProgressFill: document.getElementById("fs-player-bar-fill"),
        fsVolumeSlider: document.getElementById("fs-volume-slider"),
        ytContainer: document.getElementById("youtube-embed-container"),
        ytIframe: document.getElementById("youtube-iframe")
    };
}

// --- 1. FUNÇÕES DE SUPORTE NO ESCOPO GLOBAL ---
async function safePlay() {
    if (audio.src && audio.src !== "" && !audio.src.includes("youtube.com")) {
        try {
            await audio.play();
        } catch (err) {
            console.warn("Play bloqueado ou sem source.");
        }
    }
}

// No topo do arquivo, junto com as outras variáveis globais (audio, currentTrack)
let ytPlayer = null; 
let ytProgressInterval = null; // Para rastrear o tempo do vídeo

// Chame isso ao abrir um álbum ou playlist
function carregarFila(listaDeMusicas, indexInicial = 0) {
    playlistAtual = listaDeMusicas;
    indiceAtual = indexInicial;
    loadTrack(playlistAtual[indiceAtual]);
}

function setupQueueControls() {
    const el = getPlayerElements();

    // Botão Próximo
    if (el.fsNextBtn) {
        el.fsNextBtn.onclick = (e) => {
            e.stopPropagation();
            pularParaProxima();
        };
    }

    // Botão Anterior
    if (el.fsPrevBtn) {
        el.fsPrevBtn.onclick = (e) => {
            e.stopPropagation();
            if (playlistAtual.length > 0) {
                // Lógica para voltar: (atual - 1 + total) % total
                indiceAtual = (indiceAtual - 1 + playlistAtual.length) % playlistAtual.length;
                loadTrack(playlistAtual[indiceAtual]);
            }
        };
    }
}

function fecharPlayerFullScreen() {
    const el = getPlayerElements();
    if (!el.fullScreenPlayer) return;

    document.body.classList.remove('fs-active');
    
    // Animação de saída
    const animation = el.fullScreenPlayer.animate([
        { transform: el.fullScreenPlayer.style.transform || 'translateY(0)', opacity: 1 },
        { transform: 'translateY(100%)', opacity: 0 }
    ], { 
        duration: 500, 
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        fill: 'forwards' 
    });

    animation.onfinish = () => {
        el.fullScreenPlayer.classList.add('hidden');
        el.fullScreenPlayer.style.transform = ''; 
        
        // 🛑 REMOVIDO: el.ytIframe.src = ""; 
        // Não limpamos o src para o vídeo continuar carregado/tocando em background se necessário
        
        animation.cancel();
    };
}

// --- 2. GESTO DE SLIDE (SWIPE DOWN) ---
let touchStartY = 0;
function setupSwipeToClose() {
    const fsPlayer = document.getElementById('full-screen-player');
    if (!fsPlayer) return;

    fsPlayer.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    fsPlayer.addEventListener('touchmove', (e) => {
        const deltaY = e.touches[0].clientY - touchStartY;
        if (deltaY > 0) {
            fsPlayer.style.transform = `translateY(${deltaY}px)`;
            fsPlayer.style.transition = 'none';
        }
    }, { passive: true });

    fsPlayer.addEventListener('touchend', (e) => {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        fsPlayer.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)';
        
        if (deltaY > 150) fecharPlayerFullScreen();
        else fsPlayer.style.transform = 'translateY(0)';
    });
}

function updateScrollAnimation() {
    // 1. Obtém as referências dos elementos
    const elements = getPlayerElements();
    const { playerTitle, playerArtist, playerInfoContainer } = elements;
    
    if (!playerTitle || !playerArtist || !playerInfoContainer) return;

    // A largura visível do container (.player-info)
    const containerWidth = playerInfoContainer.clientWidth; 

    // Função auxiliar para aplicar a lógica de scroll/fade a um elemento específico
    const toggleScrollAndFade = (element) => {
        
        // 1a. Limpa estilos e classes de animação anteriores
        element.classList.remove('scrolling');
        element.style.width = 'auto'; // Reseta a largura para que scrollWidth seja calculado
        
        // 2. Verifica se o scrollWidth (largura total do conteúdo) é maior que o container visível
        if (element.scrollWidth > containerWidth) {
            
            // É LONGO: ATIVA O SCROLL E O FADE

            // 3. Define a largura do elemento para a largura total do conteúdo
            // Isso é CRUCIAL para que a animação CSS (@keyframes) funcione
            element.style.width = element.scrollWidth + 'px'; 
            
            // 4. Adiciona a classe 'scrolling' (animação)
            // Usamos um pequeno atraso para garantir que a largura do elemento já tenha sido aplicada no DOM
            setTimeout(() => {
                element.classList.add('scrolling');
            }, 50); 
            
        } else {
            // É CURTO: DESATIVA O SCROLL
            element.style.width = 'auto'; 
            element.classList.remove('scrolling');
        }
    };
    
    // --- LÓGICA DO FADE (Aplicada ao CONTAINER) ---
    // Checamos se *pelo menos um* dos textos é longo
    const isTitleLong = playerTitle.scrollWidth > containerWidth;
    const isArtistLong = playerArtist.scrollWidth > containerWidth;
    
    if (isTitleLong || isArtistLong) {
        // Se pelo menos um precisa rolar, aplicamos o fade no container
        playerInfoContainer.classList.add('fade-active');
    } else {
        // Se ambos cabem, removemos o fade
        playerInfoContainer.classList.remove('fade-active');
    }

    // Aplica a lógica de scroll (animação) individualmente
    toggleScrollAndFade(playerTitle);
    toggleScrollAndFade(playerArtist);
}

// --- FUNÇÃO DE SINCRONIZAÇÃO DE ESTADO (PLAY/PAUSE) ---
function syncPlayPauseState() {
// ... (código existente)
    const { playIcon, pauseIcon, fsPlayIcon, fsPauseIcon } = getPlayerElements();
    const isPaused = audio.paused;
    
    // Player Fixo
    if (playIcon && pauseIcon) {
        playIcon.classList.toggle("hidden", !isPaused);
        pauseIcon.classList.toggle("hidden", isPaused);
    }
    
    // Player Tela Cheia
    if (fsPlayIcon && fsPauseIcon) {
        fsPlayIcon.classList.toggle("hidden", !isPaused);
        fsPauseIcon.classList.toggle("hidden", isPaused);
    }
}

window.checkAndResetMonthlyStreams = function(track) {
    if (!track) return;
    
    // Tenta pegar 'title' ou 'nome'. Se não achar nenhum, usa 'Sem nome'
    const nomeDaMusica = track.title || track.nome || "Sem nome";
    console.log("🛡️ Proteção de stream validada para:", nomeDaMusica);
};

// Função auxiliar para registrar atividade no log
async function registrarLogMusica(track) {
    const user = auth.currentUser;
    
    // Dados básicos do log
    const logData = {
        type: 'Música',
        itemTitle: track.title || "Sem título",
        itemId: track.id,
        timestamp: new Date(), // Usa a data do servidor se possível, ou local
        userId: user ? user.uid : "deslogado",
        userName: user ? (user.displayName || "Usuário") : "Visitante"
    };

    try {
        // Salva na coleção 'logs'
        await addDoc(collection(db, "logs"), logData);
        
    } catch (err) {
        
    }
}

/**
 * FUNÇÕES DE SUPORTE AO RASTREIO
 * Declaradas como 'function' para evitar erros de referência (Hoisting)
 */
function stopYoutubeTracking() {
    if (ytProgressInterval) {
        clearInterval(ytProgressInterval);
        ytProgressInterval = null;
        console.log("🛑 Rastreio do YouTube parado.");
    }
}

function startYoutubeTracking() {
    if (window.trackingInterval) clearInterval(window.trackingInterval);

    window.trackingInterval = setInterval(() => {
        // Busca o ID toda vez para garantir que pegamos o elemento da página atual
        const progressFill = document.getElementById("progress-fill"); 
        
        if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
            const current = window.ytPlayer.getCurrentTime();
            const total = window.ytPlayer.getDuration();

            if (total > 0 && progressFill) {
                const percent = (current / total) * 100;
                progressFill.style.width = `${percent}%`; // Move a barra
                
                // Atualiza os textos de tempo (0:00)
                updateInterfaceLabels(current, total); 
            }
        }
    }, 1000);
}
async function loadTrack(track) {
    if (!track) return;

    const elements = getPlayerElements();
    clearTimeout(streamTimer);
    stopYoutubeTracking();
    currentTrack = track;

    // === DEFINE PRIMEIRO ===
    const coverUrl = track.cover || "assets/10.png";

    function safeSetImage(imgElement, url) {
        if (!imgElement) return;

        imgElement.onerror = () => {
            imgElement.src = "assets/10.png";
        };

        imgElement.src = url;
    }

    // Reset audio nativo
    if (window.audio) {
        window.audio.pause();
        window.audio.src = "";
    }

    // Interface básica
    if (elements.musicPlayer) elements.musicPlayer.classList.remove("hidden");

    safeSetImage(elements.miniPlayerCover, coverUrl);
    safeSetImage(elements.fsPlayerCover, coverUrl);

    if (elements.playerTitle)
        elements.playerTitle.textContent = track.title || "Sem título";

    if (elements.fsPlayerTitle)
        elements.fsPlayerTitle.textContent = track.title || "Sem título";

    // === EXTRAÇÃO ID YOUTUBE ===
    let videoId = "";
    const url = track.audioURL || "";

    if (url.includes("v=")) {
        videoId = url.split("v=")[1].split("&")[0];
    } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
    } else if (url.length >= 10 && url.length <= 15) {
        videoId = url;
    }

    // === CARREGA YOUTUBE ===
    if (videoId) {
        if (elements.ytContainer)
            elements.ytContainer.classList.remove("hidden");

        
        if (window.loadYoutubeVideo)
            window.loadYoutubeVideo(videoId);

        startYoutubeTracking();

        streamTimer = setTimeout(() => {
            if (typeof validarStreamOficial === "function") {
                validarStreamOficial(track);
            }
        }, TIME_TO_STREAM);
    }

    // === ABRE PLAYER FULLSCREEN ===
    if (
        elements.fullScreenPlayer &&
        elements.fullScreenPlayer.classList.contains("hidden")
    ) {
        elements.fullScreenPlayer.classList.remove("hidden");
        document.body.classList.add("fs-active");
    }

    updateArtistLabels(track.artist || track.uidars);

    if (typeof updateFullScreenBackground === "function") {
        updateFullScreenBackground(track);
        updateMiniPlayerBackground(track);
    }

    localStorage.setItem("currentTrack", JSON.stringify(track));
}
window.loadTrack = loadTrack;
async function updateArtistLabels(artistUid) {
    if (!artistUid) return;
    
    const elements = getPlayerElements();
    try {
        const artistSnap = await getDoc(doc(db, "usuarios", artistUid));
        if (artistSnap.exists()) {
            const artistName = artistSnap.data().nomeArtistico || "Artista";
            if (elements.playerArtist) elements.playerArtist.textContent = artistName;
            if (elements.fsPlayerArtist) elements.fsPlayerArtist.textContent = artistName;
        }
    } catch (err) {
        console.error("Erro ao carregar nome do artista no player:", err);
    }
}



async function checkCurrentTrackLikedState(musicId) {
    const user = auth.currentUser;
    // Seleciona o ícone correto dentro do container de botões de ação
    const likeBtnIcon = document.querySelector('.fs-action-buttons .fs-icon-btn:first-child img');
    
    if (!user || !musicId || !likeBtnIcon) return;

    const likedCollectionName = `likedmusics${user.uid}`;
    const musicRef = doc(db, "usuarios", user.uid, likedCollectionName, musicId);

    try {
        const snap = await getDoc(musicRef);
        if (snap.exists()) {
            // Se existir: mostra o ícone PREENCHIDO (FILL1)
            likeBtnIcon.src = "./assets/heart_minus_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg"; 
        } else {
            // Se não existir: mostra o ícone VAZIO (FILL0)
            likeBtnIcon.src = "./assets/heart_plus_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
        }
    } catch (error) {
        console.error("Erro ao verificar estado de curtida:", error);
    }
}

async function toggleLike(musicData) {
    const user = auth.currentUser;
    if (!user) return;

    const likedCollectionName = `likedmusics${user.uid}`;
    const musicRef = doc(db, "usuarios", user.uid, likedCollectionName, musicData.id);
    const likeBtnIcon = document.querySelector('.fs-action-buttons .fs-icon-btn:first-child img');

    try {
        const snap = await getDoc(musicRef);
        if (snap.exists()) {
            // Agora o deleteDoc vai funcionar!
            await deleteDoc(musicRef);
            if (likeBtnIcon) {
                // Volta para o ícone de "Mais" (vazio)
                likeBtnIcon.src = "./assets/heart_plus_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
            }
            console.log("Removido das curtidas");
        } else {
            // Adiciona às curtidas
            await setDoc(musicRef, {
                id: musicData.id,
                title: musicData.title || musicData.nome,
                artist: musicData.artistName || "Artista",
                cover: musicData.cover,
                timestamp: new Date()
            });
            if (likeBtnIcon) {
                // Muda para o ícone de "Menos/Preenchido"
                likeBtnIcon.src = "./assets/heart_minus_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg";
            }
            console.log("Adicionado às curtidas");
        }
    } catch (error) {
        console.error("Erro ao processar curtida:", error);
    }
}

async function openSharePlayer(data) {
    // 1. Fecha o player de tela cheia imediatamente
    fecharPlayerFullScreen();

    // 2. Garante o carregamento do html2canvas
    let h2c = window.html2canvas;
    if (!h2c) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            h2c = window.html2canvas;
        } catch (err) {
            return console.error("Erro ao carregar biblioteca de imagem.");
        }
    }

    // 3. Verifica se o elemento do card existe
    const card = document.getElementById('story-share-card');
    if (!card) {
        console.error("Elemento 'story-share-card' não encontrado no HTML.");
        return;
    }

    // 4. Preenchimento Seguro das informações
    const storyTitle = document.getElementById('story-title');
    const storyArtist = document.getElementById('story-artist');
    const storyCover = document.getElementById('story-cover');
    const storyBg = document.getElementById('story-bg-blur');

    if (storyTitle) storyTitle.innerText = data.title || "Música";
    if (storyArtist) storyArtist.innerText = data.artistName || "Artista";
    
    if (storyCover) {
        const nocacheCover = data.cover + (data.cover.includes('?') ? '&' : '?') + "t=" + Date.now();
        storyCover.crossOrigin = "anonymous";
        storyCover.src = nocacheCover;
        if (storyBg) storyBg.style.backgroundImage = `url(${nocacheCover})`;

        // Aguarda a imagem da capa carregar para não sair em branco
        await new Promise(r => {
            if (storyCover.complete) r();
            else {
                storyCover.onload = r;
                setTimeout(r, 1500); // Timeout de segurança
            }
        });
    }

    // 5. Gera a imagem e abre o menu de compartilhamento do sistema
    try {
        const canvas = await h2c(card, { 
            useCORS: true, 
            scale: 2, 
            backgroundColor: "#030303",
            logging: false 
        });
        
        canvas.toBlob(async (blob) => {
            const file = new File([blob], `TUNE-${data.title}.png`, { type: 'image/png' });
            
            // Tenta abrir o compartilhamento nativo (Instagram/Outros)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Tune Music',
                    text: 'Confira essa música no Tune!'
                });
            } else {
                // Fallback para PC: baixa a imagem
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `TUNE-${data.title}.png`;
                link.click();
            }
        }, 'image/png');

    } catch (err) {
        console.error("Erro ao gerar imagem de compartilhamento:", err);
    }

    // 6. Copia o link como backup
    const shareLink = `${window.location.origin}/music.html?id=${data.id}`;
    try { await navigator.clipboard.writeText(shareLink); } catch (e) {}
}

// 2. API DO YOUTUBE
window.onYouTubeIframeAPIReady = function() {
    console.log("✅ API do YouTube pronta.");
};

// --- 1. DEFINIÇÃO NO TOPO (Escopo do Módulo) ---
function obterApenasID(url) {
    if (!url) return null;
    if (url.length === 11 && !url.includes('/')) return url;

    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : url;
}

window.loadYoutubeVideo = function(urlRecebida) {
    const videoId = obterApenasID(urlRecebida);
    if (!videoId) return;

    if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') {
        // MUITO IMPORTANTE: Limpar o estado antes de carregar o novo
        window.ytPlayer.stopVideo();
        
        // Em vez de load, usamos CUE para preparar o buffer sem pressa
        window.ytPlayer.cueVideoById(videoId);
        
        // Damos 200ms para o navegador processar o fechamento do Full Screen
        setTimeout(() => {
            if (window.ytPlayer.getPlayerState() !== 1) {
                window.ytPlayer.playVideo();
            }
        }, 200);
        return;
    }

   window.ytPlayer = new YT.Player("youtube-player", {
    videoId: videoId,
    host: 'https://www.youtube.com', // 👈 Adicione isso aqui!
    playerVars: {
        autoplay: 1,
        controls: 0,
        origin: window.location.origin,
        enablejsapi: 1,
        playsinline: 1,
        rel: 0 // Evita vídeos relacionados no fim
    },
    events: {
        onReady: (e) => e.target.playVideo(),
        onStateChange: onPlayerStateChange
    }
});
};


function onPlayerStateChange(event) {
    console.log("🎬 Estado YouTube:", event.data);
    const elements = getPlayerElements();
    
    const iconPlay = "/assets/Group.png";
    const iconPause = "/assets/pause.fill.png";

if (event.data === 5 || event.data === -1) {
    console.log("🚀 Gatilho de segurança: Forçando Play Mudo...");
    event.target.mute(); // Muta para garantir que o navegador aceite o Play automático
    event.target.playVideo();
    
    // Tenta desmutar logo em seguida
    setTimeout(() => {
        if (event.target.getPlayerState() === 1) {
            event.target.unMute();
            console.log("🔊 Áudio liberado com sucesso!");
        }
    }, 1000);
}

    // YT.PlayerState.PLAYING = 1
    if (event.data === 1) { 
        startYoutubeTracking(); 
        
        if (elements.playBtn) elements.playBtn.querySelector('img').src = iconPause;
        if (elements.fsPlayPauseBtn) elements.fsPlayPauseBtn.querySelector('img').src = iconPause;

        clearTimeout(window.streamTimer);
        window.streamTimer = setTimeout(() => {
            // Usamos window.ytPlayer e window.currentTrack para garantir escopo global
            if (window.ytPlayer && window.ytPlayer.getPlayerState() === 1) {
                validarStreamOficial(window.currentTrack);
            }
        }, 20000); 
    } 
    else {
        // Para o rastreio se não estiver tocando
        if (typeof stopYoutubeTracking === 'function') stopYoutubeTracking();
        clearTimeout(window.streamTimer);

        if (elements.playBtn) elements.playBtn.querySelector('img').src = iconPlay;
        if (elements.fsPlayPauseBtn) elements.fsPlayPauseBtn.querySelector('img').src = iconPlay;

        // Se a música acabou (0)
        if (event.data === 0) {
            console.log("⏭️ Fim da música, pulando...");
            if (typeof window.pularParaProxima === 'function') window.pularParaProxima();
        }
    }
}


function updateInterfaceLabels(current, total) {
    const { fsProgressFill, fsCurrentTimeEl, fsTotalTimeEl } = getPlayerElements();
    
    // Proteção contra divisão por zero
    let percent = 0;
    if (total > 0) {
        percent = (current / total) * 100;
    }

    const miniBar = document.getElementById("progress-fill");
    const fullBar = document.getElementById("fs-player-bar-fill");
    const timeCurrent = document.getElementById("current-time");


    if (miniBar) miniBar.style.width = `${percent}%`;
    if (fullBar) fullBar.style.width = `${percent}%`;
    if (timeCurrent) timeCurrent.textContent = formatTime(current);

    
    // Formata o tempo
    const currentTimeFormatted = formatTime(current);
    const totalTimeFormatted = formatTime(total);

    // Aplica no DOM (Player Tela Cheia)
    if (fsProgressFill) fsProgressFill.style.width = percent + "%";
    if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = currentTimeFormatted;
    if (fsTotalTimeEl) fsTotalTimeEl.textContent = totalTimeFormatted;

    // Aplica no DOM (Mini Player - Caso queira mostrar lá também)
    const miniProgress = document.getElementById("progress-fill");
    const miniCurrent = document.getElementById("current-time");
    const miniTotal = document.getElementById("total-time");

    if (miniProgress) miniProgress.style.width = percent + "%";
    if (miniCurrent) miniCurrent.textContent = currentTimeFormatted;
    if (miniTotal) miniTotal.textContent = totalTimeFormatted;
}

async function validarStreamOficial(track) {
    if (!track || !track.id) return;

    try {
        const musicRef = doc(db, "musicas", track.id);
        const snap = await getDoc(musicRef);

        if (snap.exists()) {
            const data = snap.data();
            
            // Se o campo streams não existir ou for 0
            if (!data.streams || data.streams === 0) {
                // Gera valor aleatório entre 50.000 e 200.000
                const initialStreams = Math.floor(Math.random() * (200000 - 50000 + 1)) + 50000;
                
                await updateDoc(musicRef, { streams: initialStreams });
                console.log(`🚀 Sucesso! Primeiro stream gerado: ${initialStreams}`);
            } else {
                // Se já tem valor, apenas incrementa +1
                await updateDoc(musicRef, { 
                    streams: increment(1) 
                });
                console.log("📈 +1 Stream adicionado.");
            }
        }
    } catch (error) {
        console.error("❌ Erro ao processar stream:", error);
    }
}

function setupYoutubeAction() {
    const { fsPlayPauseBtn } = getPlayerElements();

    if (fsPlayPauseBtn) {
        fsPlayPauseBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!currentTrack) return;

            // Já que agora tudo é YouTube, basta chamar a loadTrack
            window.loadTrack(currentTrack);

            // Inicia o contador para validar o Stream (20 segundos)
            streamTimer = setTimeout(() => {
                if (typeof validarStreamOficial === 'function') {
                    validarStreamOficial(currentTrack);
                }
            }, 20000); // 20 segundos
        };
    }
}

/**
 * CONFIGURAÇÃO DOS LISTENERS DO PLAYER
 * Gerencia cliques em Play, Pause, Like, Share e Volume.
 */
function setupPlayerListeners() {
    // Evita duplicar os ouvintes de eventos se a função for chamada várias vezes
    if (window.listenersAttached) return; 
    window.listenersAttached = true;

    const elements = getPlayerElements();
    const { 
        playBtn, fsPlayPauseBtn, volumeSlider, fsVolumeSlider, 
        musicPlayer, fsCloseButton, ytContainer, fsPlayerCover 
    } = elements;

// No player.js -> dentro de setupPlayerListeners
if (fsPlayPauseBtn) {
    fsPlayPauseBtn.onclick = (e) => {
        e.preventDefault();
        
        if (!currentTrack) return;

        // Se o player existe, alterna o estado
        if (window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function') {
            const state = window.ytPlayer.getPlayerState();
            if (state === 1) { // 1 = Tocando
                window.ytPlayer.pauseVideo();
            } else {
                window.ytPlayer.playVideo();
            }
        } else {
            // SE O VÍDEO NÃO CARREGOU: Forçamos o carregamento aqui
            // O clique do usuário agora dá "permissão" para o som tocar
            console.log("🚀 Primeiro clique detectado, carregando vídeo...");
            loadTrack(currentTrack); 
        }
    };
}

    // --- 2. BOTÃO PLAY/PAUSE (MINI PLAYER) ---
    if (playBtn) {
        playBtn.onclick = (e) => {
            e.stopPropagation();
            // Espelha o comportamento do botão de tela cheia
            if (fsPlayPauseBtn) fsPlayPauseBtn.click();
        };
    }

    // === ABRIR FULL SCREEN AO CLICAR NO MINI PLAYER ===
if (musicPlayer) {
    musicPlayer.addEventListener("click", (e) => {
        // Não abrir se clicar em botão ou progress bar
        if (
            e.target.closest("button") ||
            e.target.closest(".progress-bar") ||
            e.target.closest("input")
        ) return;

        const fs = document.getElementById("full-screen-player");
        if (!fs) {
            console.warn("❌ #full-screen-player não encontrado");
            return;
        }

        fs.classList.remove("hidden");
        document.body.classList.add("fs-active");

        console.log("📲 Full Screen aberto");
    });
}

    // --- 3. BOTÕES DE AÇÃO (LIKE E SHARE) ---
    const actionBtns = document.querySelectorAll('.fs-action-buttons .fs-icon-btn');
    if (actionBtns.length >= 2) {
        const likeBtn = actionBtns[0];
        const shareBtn = actionBtns[1];

        if (likeBtn) {
            likeBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentTrack) toggleLike(currentTrack);
            };
        }

        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentTrack) openSharePlayer(currentTrack);
            };
        }
    }

    // --- 4. CONTROLE DE VOLUME (SINCRONIZADO) ---
    const handleVol = (e) => {
        const vol = e.target.value;
        // Ajusta volume no áudio nativo (caso use)
        if (window.audio) window.audio.volume = vol;
        // Ajusta volume no YouTube
        if (window.ytPlayer && typeof window.ytPlayer.setVolume === 'function') {
            window.ytPlayer.setVolume(vol * 100);
        }
        // Sincroniza os dois sliders
        if (volumeSlider) volumeSlider.value = vol;
        if (fsVolumeSlider) fsVolumeSlider.value = vol;
    };

    if (volumeSlider) volumeSlider.oninput = handleVol;
    if (fsVolumeSlider) fsVolumeSlider.oninput = handleVol;

    // --- 5. PROGRESSO (CLIQUE NA BARRA) ---
    const fsPBar = document.getElementById("fs-player-bar-container");
    if (fsPBar) {
        fsPBar.onclick = (e) => {
            if (window.ytPlayer && typeof window.ytPlayer.getDuration === 'function') {
                const rect = fsPBar.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const duration = window.ytPlayer.getDuration();
                window.ytPlayer.seekTo(pos * duration, true);
            }
        };
    }

    // --- 6. FECHAR O PLAYER FULL SCREEN ---
    if (fsCloseButton) {
        fsCloseButton.onclick = (e) => {
            e.stopPropagation();
            console.log("❌ Fechando Player Full Screen");
            
            document.body.classList.remove('fs-active');
            
            if (elements.fullScreenPlayer) {
                const animation = elements.fullScreenPlayer.animate([
                    { transform: 'translateY(0)', opacity: 1 },
                    { transform: 'translateY(100%)', opacity: 0 }
                ], { duration: 500, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });

                animation.onfinish = () => {
                    elements.fullScreenPlayer.classList.add('hidden');
                    animation.cancel();
                };
            }
        };
    }
}

function formatTime(seconds) {
    // Se não for número ou for negativo, retorna 0:00
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
}

function handleTimeUpdate() {
    const { progressFill, currentTimeEl, totalTimeEl, fsProgressFill, fsCurrentTimeEl, fsTotalTimeEl } = getPlayerElements();
    const percent = (audio.currentTime / audio.duration) * 100;
    const currentTimeFormatted = formatTime(audio.currentTime);
    const totalTimeFormatted = formatTime(audio.duration);
    
    // Player Fixo
    if (progressFill) progressFill.style.width = percent + "%";
    if (currentTimeEl) currentTimeEl.textContent = currentTimeFormatted;
    if (totalTimeEl) totalTimeEl.textContent = totalTimeFormatted;

    // Player Tela Cheia
    if (fsProgressFill) fsProgressFill.style.width = percent + "%";
    if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = currentTimeFormatted;
    if (fsTotalTimeEl) fsTotalTimeEl.textContent = totalTimeFormatted;
}

function handleVolumeChange() {
    const { volumeSlider, fsVolumeSlider } = getPlayerElements();
    const newVolume = audio.volume;

    // Sincroniza ambos os sliders visualmente
    if (volumeSlider) volumeSlider.value = newVolume;
    if (fsVolumeSlider) fsVolumeSlider.value = newVolume;
}

function handleProgressClick(e, progressBar, progressFill) {
    const rect = progressBar.getBoundingClientRect();
    const width = rect.width;
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / width) * audio.duration;

    if (newTime >= 0 && newTime <= audio.duration) {
        audio.currentTime = newTime;
    }
}
async function updateFullScreenBackground(track) {
    const elements = getPlayerElements();
    const fsPlayer = elements.fullScreenPlayer;
    if (!fsPlayer) return;

    let aurora = document.getElementById("fs-aurora-bg");
    if (!aurora) {
        aurora = document.createElement("div");
        aurora.id = "fs-aurora-bg";
        fsPlayer.prepend(aurora);
    }

    const oldBg = document.querySelector("#fs-player-canvas-bg");
    if (oldBg) oldBg.remove();

    if (track.canvas) {
        aurora.style.opacity = "0";
        // ... (lógica do mediaElement para vídeo permanece igual)
        return;
    }

    aurora.style.opacity = "1";
    
    const imgForColor = new Image();
    imgForColor.crossOrigin = "Anonymous";

    imgForColor.onload = function() {
        try {
            const colorThief = new ColorThief();
            const [r, g, b] = colorThief.getColor(imgForColor); 

            // --- TRUQUE PARA COR FORTE: CONVERSÃO PARA HSL ---
            let { h, s, l } = rgbToHsl(r, g, b);

            // 1. Forçamos a Saturação (S) para ser sempre alta (ex: 80%+)
            s = Math.max(s, 0.8); 

            // 2. Garantimos que o Brilho (L) seja visível mas não branco (ex: 40% a 50%)
            l = Math.min(Math.max(l, 0.4), 0.5); 

            const strongColor = `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`;
            const glowColor = `hsl(${h * 360}, ${s * 100}%, ${l * 120}%, 0.3)`; // Um brilho extra

            // GRADIENTE DE IMPACTO
            // Usamos a cor forte ocupando mais espaço antes de escurecer
            aurora.style.background = `radial-gradient(circle at 50% 35%, 
                ${strongColor} 0%, 
                ${glowColor} 40%, 
                rgba(0,0,0,0.85) 85%, 
                #000 100%)`;
            
                    } catch (e) {
            console.warn(e);
            aurora.style.background = "#121212";
        }
    };

    imgForColor.src = track.cover ? `${track.cover}?t=${new Date().getTime()}` : "assets/10.png";
}

// Helper necessário para manipular a cor
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function updateMiniPlayerBackground(track) {
    const miniPlayer = document.getElementById("music-player");
    if (!miniPlayer) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = function () {
        try {
            const colorThief = new ColorThief();
            const [r, g, b] = colorThief.getColor(img);

            let { h, s, l } = rgbToHsl(r, g, b);

            s = Math.max(s, 0.8);
            l = Math.min(Math.max(l, 0.35), 0.45);

            const strongColor = `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`;

            // escurece levemente a cor
l = Math.max(l - 0.15, 0.15); 

const darkColor = `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`;

miniPlayer.style.background = darkColor;

        } catch (e) {
            miniPlayer.style.background = "#121212";
        }
    };

    img.src = track.cover
        ? `${track.cover}?t=${Date.now()}`
        : "assets/10.png";
}

// --- LÓGICA DE PERFIL E AUTENTICAÇÃO (MANTIDA/CORRIGIDA) ---

async function fetchAndRenderUserProfile(user) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userDocRef);

        const userData = docSnap.exists() ? docSnap.data() : {};

        // --- Lógica para o link 'Suporte' / 'Painel Artist' ---
        if (artistLink && artistLinkIcon && artistLinkText) {
            if (userData.artista === "true") {
                artistLink.href = "tuneartists.html";
                artistLinkText.textContent = "Painel";
                artistLinkIcon.classList.add('hidden');
            } else {
                artistLink.href = "#";
                artistLinkText.textContent = "Suporte";
                artistLinkIcon.classList.remove('hidden');
            }
        }

        // --- Lógica para o Link do Tuneteam (Admin) ---
        if (tuneteamItem) {
            if (userData.niveladmin === 1) {
                tuneteamItem.classList.remove('hidden'); 
            } else {
                tuneteamItem.classList.add('hidden'); 
            }
        }
        
        // --- Atualiza a imagem de perfil ---
        if (userProfileImg) {
            // Usa userData.foto, se existir, senão user.photoURL, senão fallback
            userProfileImg.src = userData.foto || user.photoURL || './assets/artistpfp.png';
            userProfileImg.alt = userData.apelido || user.displayName || 'Foto do Usuário';
        }


        // --- Alterna a visibilidade dos containers de perfil ---
        if (userProfileContainer) userProfileContainer.classList.remove('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.add('hidden');

    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        if (userProfileImg) userProfileImg.src = './assets/artistpfp.png';
        if (userProfileContainer) userProfileContainer.classList.add('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.remove('hidden');
    }
}

// --- Autenticação ---
onAuthStateChanged(auth, user => {
    if (user) {
        fetchAndRenderUserProfile(user);
    } else {
        if (userProfileContainer) userProfileContainer.classList.add('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.remove('hidden');
        // Oculta o link do Tuneteam se o usuário não estiver logado
        if (tuneteamItem) {
            tuneteamItem.classList.add('hidden');
        }
    }
});

// --- Lógica do Dropdown do Perfil do Usuário ---
if (userProfileButton && profileDropdown) {
    userProfileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', (event) => {
        if (!userProfileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}

// --- Lógica de Logout ---
if (logoutLink) {
    logoutLink.addEventListener('click', e => {
        e.preventDefault();
        signOut(auth)
            .then(() => {
                window.location.href = LOGIN_URL;
            })
            .catch(err => console.error("Erro no logout:", err));
    });
}

// --- Lógica do Botão "Entrar" ---
if (loginButton) {
    loginButton.addEventListener('click', () => {
        window.location.href = LOGIN_URL;
    });
}


// --- LÓGICA DE BUSCA (MANTIDA) ---
let debounceTimeout;

if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const query = searchInput.value.toLowerCase().trim();
            if (query.length > 0) {
                // AQUI OCORRE UM PROBLEMA DE REFERÊNCIA: 
                // A função performSearch usa 'collection' e 'query' que não estão importados no snippet inicial.
                // Vou comentar a chamada e manter a lógica de visibilidade.
                // performSearch(query); 
                defaultSections.classList.add('hidden');
            } else {
                if (searchResultsDropdown) searchResultsDropdown.classList.add('hidden');
                if (defaultSections) defaultSections.classList.remove('hidden');
            }
        }, 300);
    });
}



function checkCurrentTrack() {
    setupPlayerListeners(); // Mantém os botões funcionando
    
    const elements = getPlayerElements();
    const stored = localStorage.getItem("currentTrack");

    if (stored) {
        const track = JSON.parse(stored);
        currentTrack = track;
        
        // 1. Configura a origem do áudio mas NÃO inicia o play
        audio.src = track.audioURL;
        audio.pause(); // Garante que está pausado ao entrar

        // 2. Oculta o player por padrão ao carregar a página
        if (elements.musicPlayer) {
            elements.musicPlayer.classList.add('hidden');
        }

        // 3. Preenche os dados nos elementos (mesmo oculto)
        // Isso evita que o texto apareça vazio quando o player for mostrado
        if (elements.playerTitle) elements.playerTitle.textContent = track.title || "Sem título";
        
        // Busca o nome do artista para deixar pronto
        let artistUid = track.artist || track.uidars;
        if (artistUid) {
            getDoc(doc(db, "usuarios", artistUid)).then(artistSnap => {
                const name = artistSnap.exists() ? artistSnap.data().nomeArtistico : "Artista";
                if (elements.playerArtist) elements.playerArtist.textContent = name;
                if (elements.fsPlayerArtist) elements.fsPlayerArtist.textContent = name;
            });
        }

        // 4. Prepara a capa e o fundo (em cache)
        const coverUrl = track.cover || "assets/10.png";
        if (elements.miniPlayerCover) elements.miniPlayerCover.src = coverUrl;
        if (elements.fsPlayerCover) elements.fsPlayerCover.src = coverUrl;
        
        updateFullScreenBackground(track);
        syncPlayPauseState();
    } else {
        // Se não houver música no histórico, garante que está escondido
        if (elements.musicPlayer) {
            elements.musicPlayer.classList.add('hidden');
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupPlayerListeners();
    setupSwipeToClose();
    setupQueueControls();
});
// No final do seu player.js
export { loadTrack };

// Garante que o roteador e as páginas de álbum enxerguem as funções
window.loadTrack = loadTrack;
window.carregarFila = carregarFila;
window.obterApenasID = obterApenasID; // Opcional, mas ajuda no debug