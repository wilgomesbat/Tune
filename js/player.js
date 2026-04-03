import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    serverTimestamp,
    deleteDoc, 
    updateDoc, 
    deleteField,
    increment,
    collection, 
    addDoc,
    Timestamp // Adicionado caso precise para datas
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// AQUI ESTÁ O SEGREDO: Importar do arquivo de FUNCTIONS
import { 
    getFunctions, 
    httpsCallable 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js";

import { auth, db } from './firebase-config.js';

window.repeatMode = false; // Estado inicial: desligado
// Define no window para o player.js enxergar
window.getFunctions = getFunctions;
window.httpsCallable = httpsCallable;

// FUNÇÃO GLOBAL PADRÃO DO TUNE
window.playTrackGlobal = function(track) {
    if (!track) return;

   const user = auth.currentUser; 
    if (user) {
        detectarSpamCliques(user.uid);
    }

    // Abre mini player
    const mini = document.getElementById("music-player");
    if (mini) mini.classList.remove("hidden");

    // Carrega música
    loadTrack(track);
};

localStorage.setItem('tune_tabs_active_session_master', window.SESSION_ID);

document.addEventListener('click', () => window.userInteractions++);
window.ultimaValidacaoSucesso = 0;
window.bonusTimer30s = null;
window.bonusTimer60s = null;
window.bonusEntregue30s = false;
window.bonusEntregue60s = false;
window.tempoAcumuladoNestaMusica = 0;
window.lastCheckTime = null;


// Gerar ID único para esta aba
window.SESSION_ID = 'sess_' + Math.random().toString(36).substr(2, 9);
window.userInteractions = 0;

// Função para assumir o controle
function assumirControleMaster() {
    localStorage.setItem('tune_tabs_active_session_master', window.SESSION_ID);
    localStorage.setItem('tune_master_last_pulse', Date.now());
}

// Verifica se a aba atual deve ser a mestre
function verificarSessaoMaster() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return; // Mobile não entra nesta regra

    const masterTab = localStorage.getItem('tune_tabs_active_session_master');
    const lastPulse = parseInt(localStorage.getItem('tune_master_last_pulse') || 0);
    const agora = Date.now();

    // Se não houver mestre ou a mestre antiga estiver "morta" (mais de 10s sem sinal)
    if (!masterTab || (agora - lastPulse > 10000)) {
        assumirControleMaster();
    }
}

// Manter a aba viva (Heartbeat)
setInterval(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile && localStorage.getItem('tune_tabs_active_session_master') === window.SESSION_ID) {
        localStorage.setItem('tune_master_last_pulse', Date.now());
    }
}, 4000);

document.addEventListener('click', () => { window.userInteractions++; });
verificarSessaoMaster();

// Definição global da função para evitar o erro de ReferenceError
window.updateInterfaceLabels = function(current, total) {
    const el = typeof getPlayerElements === 'function' ? getPlayerElements() : {};
    
    // Proteção contra divisão por zero
    let percent = total > 0 ? (current / total) * 100 : 0;

    const miniBar = document.getElementById("progress-fill");
    const fullBar = document.getElementById("fs-player-bar-fill");
    const timeCurrent = document.getElementById("current-time");

    // Formatação do tempo (Certifique-se de que a função formatTime também existe)
    const currentTimeFormatted = typeof formatTime === 'function' ? formatTime(current) : current;
    const totalTimeFormatted = typeof formatTime === 'function' ? formatTime(total) : total;

    // Aplica no DOM com verificações de existência
    if (miniBar) miniBar.style.width = `${percent}%`;
    if (fullBar) fullBar.style.width = `${percent}%`;
    if (timeCurrent) timeCurrent.textContent = currentTimeFormatted;

    // Atualiza elementos do Player Tela Cheia (FS)
    if (el.fsProgressFill) el.fsProgressFill.style.width = percent + "%";
    if (el.fsCurrentTimeEl) el.fsCurrentTimeEl.textContent = currentTimeFormatted;
    if (el.fsTotalTimeEl) el.fsTotalTimeEl.textContent = totalTimeFormatted;
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

// Gera um ID único para esta aba específica ao abrir o site
if (!window.tabId) {
    window.tabId = Date.now().toString() + Math.random().toString();
}

// --- SISTEMA DE TRAVA GLOBAL (Local Storage com ID de Aba) ---
function tentarObterPosseDoPlayer() {
    const agora = Date.now();
    const ultimaAtividade = localStorage.getItem('tune_player_active_at');
    const donaDaPosse = localStorage.getItem('tune_player_tab_id');
    
    // Se existe atividade recente E o ID da aba que gravou é DIFERENTE desta aqui
    if (ultimaAtividade && (agora - parseInt(ultimaAtividade) < 5000) && donaDaPosse !== window.tabId) {
        console.warn("🚫 Outra aba ativa detectada (ID diferente). Bloqueando stream.");
        return false;
    }

    // Se estiver livre ou se a dona já for esta aba, renova a posse
    localStorage.setItem('tune_player_active_at', agora);
    localStorage.setItem('tune_player_tab_id', window.tabId);
    return true;
}

// Heartbeat para manter a posse enquanto toca
let heartbeatInterval = null;
function iniciarHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (window.ytPlayer && window.ytPlayer.getPlayerState() === 1) {
            localStorage.setItem('tune_player_active_at', Date.now());
            localStorage.setItem('tune_player_tab_id', window.tabId);
        }
    }, 3000);
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
        // Player Pequeno (Mini Player)

        // Player Tela Cheia (Full Screen)
        fsPlayPauseBtn: document.getElementById("fs-playpause-btn"),
        fsPlayIcon: document.getElementById("fs-play-icon"),
        fsPauseIcon: document.getElementById("fs-pause-icon"),
        
        // Player Pequeno (Mini Player)
        playBtn: document.getElementById("playpause-btn"),
        playIcon: document.querySelector("#playpause-btn img"), // Pega a imagem dentro do botão mini

        // Player Tela Cheia (Full Screen)
        fsPlayPauseBtn: document.getElementById("fs-playpause-btn"),
        fsPlayIcon: document.getElementById("fs-play-icon"),
        fsPauseIcon: document.getElementById("fs-pause-icon"),
        
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
// --- 2. GESTO DE SLIDE (SWIPE DOWN) CORRIGIDO ---
let touchStartY = 0;

function setupSwipeToClose() {
    const fsPlayer = document.getElementById('full-screen-player');
    const scrollArea = document.getElementById('fs-main-scroll-area'); // O container que criamos com scroll
    
    if (!fsPlayer || !scrollArea) return;

    fsPlayer.addEventListener('touchstart', (e) => {
        // Registra o início do toque
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    fsPlayer.addEventListener('touchmove', (e) => {
        const touchCurrentY = e.touches[0].clientY;
        const deltaY = touchCurrentY - touchStartY;

        // ⭐ TRAVA DE SEGURANÇA: ⭐
        // Se a área de scroll não estiver no topo (0) OU se o usuário estiver deslizando para CIMA,
        // interrompemos a lógica de fechar para permitir o scroll natural da letra.
        if (scrollArea.scrollTop > 0 || deltaY < 0) {
            return; 
        }

        // Se estiver no topo e deslizando para BAIXO, anima a descida do player
        if (deltaY > 0) {
            fsPlayer.style.transform = `translateY(${deltaY}px)`;
            fsPlayer.style.transition = 'none';
        }
    }, { passive: true });

    fsPlayer.addEventListener('touchend', (e) => {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const scrollArea = document.getElementById('fs-main-scroll-area');

        // Se o scroll não estava no topo, não faz nada no final
        if (scrollArea.scrollTop > 0) return;

        fsPlayer.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)';
        
        // Se o arraste foi longo o suficiente e estava no topo, fecha
        if (deltaY > 150) {
            fecharPlayerFullScreen();
        } else {
            // Caso contrário, volta para a posição original
            fsPlayer.style.transform = 'translateY(0)';
        }
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
    const el = getPlayerElements();

    // 1. Limpeza de processos
    if (window.streamTimer) clearTimeout(window.streamTimer);
    if (typeof stopYoutubeTracking === "function") stopYoutubeTracking();
    window.isProcessingStream = false;
    window.currentTrack = track; 
    window.streamEntregueNestaExecucao = false; // Permite o motor de 20s rodar para a NOVA música
    window.isProcessingStream = false;        // Destrava o processo de gravação
    window.streamEntregueNestaExecucao = false; 
    window.isProcessingStream = false;
    if (window.streamTimer) clearTimeout(window.streamTimer);

// 1. Atualiza o Mini Player
    if (el.playerTitle) el.playerTitle.textContent = track.title || "Sem título";
    if (el.playerArtist) el.playerArtist.textContent = track.artistName || "Artista Desconhecido";

    // 2. ATUALIZA O FULL SCREEN (Onde estava falhando)
    if (el.fsPlayerTitle) el.fsPlayerTitle.textContent = track.title || "Sem título";
    if (el.fsPlayerArtist) el.fsPlayerArtist.textContent = track.artistName || "Artista Desconhecido";

    // 2. Atualiza Textos e Capas
    const coverUrl = track.cover || "assets/10.png";
    if (el.musicPlayer) el.musicPlayer.classList.remove("hidden");
    if (el.playerTitle) el.playerTitle.textContent = track.title;
    if (el.miniPlayerCover) el.miniPlayerCover.src = coverUrl;
    if (el.fsPlayerCover) el.fsPlayerCover.src = coverUrl;

    // 3. ATUALIZA CORES E SLIDE (O que tinha parado)
    // Chamamos as funções locais
    updateFullScreenBackground(track);
    updateLyricsDisplay(track);
    updateMiniPlayerBackground(track);
    checkCurrentTrackLikedState(track.id);
    if (typeof updateArtistLabels === "function") {
        updateArtistLabels(track.artist || track.uidars);
    }

    // 4. Carrega o Vídeo
    const videoId = obterApenasID(track.audioURL);
    if (videoId) {
        if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') {
            window.ytPlayer.loadVideoById(videoId);
        } else if (typeof window.loadYoutubeVideo === "function") {
            window.loadYoutubeVideo(videoId);
        }
    }

async function checkCurrentTrackLikedState(trackId) {
    const user = auth.currentUser;
    if (!user) return;

    const likedCollName = `likedmusics${user.uid}`;
    const musicRef = doc(db, "usuarios", user.uid, likedCollName, trackId);
    const snap = await getDoc(musicRef);
    const icon = document.querySelector('.fs-action-buttons .fs-icon-btn img');

    if (icon) {
        icon.src = snap.exists() 
            ? "/assets/heart_minus_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg" 
            : "/assets/heart_plus_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
    }
}

    // 5. Re-vincula botões e salva
    if (typeof vincularBotoesInterface === "function") vincularBotoesInterface();
    localStorage.setItem("currentTrack", JSON.stringify(track));
}
// 2. Disponibiliza para o mundo (Escopo Global)
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
    const likeBtnIcon = document.querySelector('.fs-action-buttons .fs-icon-btn:first-child img');
    
    // 1. RESET IMEDIATO: Assume que não está curtida para evitar o bug visual
    if (likeBtnIcon) {
        likeBtnIcon.src = "./assets/heart_plus_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
    }

    if (!user || !musicId || !likeBtnIcon) return;

    // 2. CAMINHO DA SUBCOLEÇÃO: usuarios > UID > likedmusicsUID > musicId
    const likedCollName = `likedmusics${user.uid}`;
    const musicRef = doc(db, "usuarios", user.uid, likedCollName, musicId);

    try {
        const snap = await getDoc(musicRef);
        if (snap.exists()) {
            // 3. SÓ MUDA PARA PREENCHIDO SE O DOCUMENTO EXISTIR
            likeBtnIcon.src = "./assets/heart_minus_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg"; 
        }
    } catch (error) {
        console.error("Erro ao verificar estado de curtida:", error);
    }
}

async function toggleLike(trackData) {
    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para curtir músicas.");
        return;
    }

    // Define o nome da subcoleção conforme sua imagem do Firestore
    const likedCollName = `likedmusics${user.uid}`;
    
    // usuarios -> UID -> likedmusicsUID -> TrackID
    const musicRef = doc(db, "usuarios", user.uid, likedCollName, trackData.id);
    const likeBtnIcon = document.querySelector('.fs-action-buttons .fs-icon-btn:first-child img');

    try {
        const snap = await getDoc(musicRef);
        
        if (snap.exists()) {
            // Remove da subcoleção
            await deleteDoc(musicRef);
            if (likeBtnIcon) {
                likeBtnIcon.src = "./assets/heart_plus_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
            }
           
        } else {
            // Adiciona na subcoleção do usuário
            await setDoc(musicRef, {
                id: trackData.id,
                title: trackData.title,
                artist: trackData.artistName || trackData.artist || "Artista",
                cover: trackData.cover,
                timestamp: serverTimestamp()
            });
            if (likeBtnIcon) {
                likeBtnIcon.src = "./assets/heart_minus_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg";
            }
           
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

// Função principal para dar Play/Pause
function togglePlay() {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;

    if (!window.currentTrack) {
        console.warn("Nenhuma música carregada para dar play.");
        return;
    }

    if (window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function') {
        const state = window.ytPlayer.getPlayerState();
        
        if (state === 1) { // 1 = YT.PlayerState.PLAYING
            window.ytPlayer.pauseVideo();
            console.log("⏸️ Pausado");
        } else { 
            window.ytPlayer.playVideo();
            console.log("▶️ Tocando");
        }

        // 🌟 ADICIONE ISSO: Pequeno delay para o YouTube processar o estado e o ícone mudar
        setTimeout(() => {
            if (typeof window.syncPlayPauseState === 'function') {
                window.syncPlayPauseState();
            }
        }, 100);

    } else {
        console.log("🚀 Inicializando track pela primeira vez...");
        if (typeof window.loadTrack === 'function') {
            window.loadTrack(window.currentTrack);
        }
    }
}

// Variáveis globais (no topo do seu player.js)
window.streamTimer = null; 
window.isProcessingStream = false;
window.streamEntregueNestaExecucao = false;

function vincularBotoesInterface() {
    const elements = typeof getPlayerElements === 'function' ? getPlayerElements() : {};
    
    // Vincula o botão principal (Mini Player)
    if (elements.playBtn) {
        elements.playBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlay();
        };
    }

    // Vincula o botão da tela cheia
    if (elements.fsPlayPauseBtn) {
        elements.fsPlayPauseBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlay();
        };
    }
}

// Chame essa função ao carregar o script
vincularBotoesInterface();
// ==========================================
// 1. CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==========================================
window.streamTimer = null; 
window.isProcessingStream = false;
window.streamEntregueNestaExecucao = false; 
window.idDaMusicaAtualNoPlayer = null; 
window.streamStartTime = null;
window.historicoGlobal = window.historicoGlobal || [];
window.historicoValidacao = window.historicoValidacao || {};
let validacaoJaEnviada = false;
let trackingInterval = null;




function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = Math.floor(segundos % 60);
    return `${min}:${seg < 10 ? '0' : ''}${seg}`;
}

window.onPlayerStateChange = function(event) {
    const state = event.data;
    const el = typeof getPlayerElements === 'function' ? getPlayerElements() : {};
    
    // Caminhos das imagens (conforme seu HTML)
    const iconPlay = "/assets/Group.png";
    const iconPause = "/assets/pause.fill.png";

    // 1. Reset de música (manteve igual)
    if (window.currentTrack && window.idDaMusicaAtualNoPlayer !== window.currentTrack.id) {
        window.idDaMusicaAtualNoPlayer = window.currentTrack.id;
        window.streamEntregueNestaExecucao = false;
        window.streamStartTime = null;
        limparTodosOsTimers();
    }

    if (state === 1) { // --- TOCANDO ---
        // Mini Player: Troca o SRC da imagem única
        if (el.playIcon) el.playIcon.src = iconPause;

        // Full Screen: Esconde o ícone de Play e mostra o de Pause
        if (el.fsPlayIcon) el.fsPlayIcon.classList.add('hidden');
        if (el.fsPauseIcon) el.fsPauseIcon.classList.remove('hidden');

        if (typeof startYoutubeTracking === 'function') startYoutubeTracking();
    } 
    else { // --- PAUSADO OU PARADO ---
        // Mini Player: Volta para o ícone de Play
        if (el.playIcon) el.playIcon.src = iconPlay;

        // Full Screen: Mostra o ícone de Play e esconde o de Pause
        if (el.fsPlayIcon) el.fsPlayIcon.classList.remove('hidden');
        if (el.fsPauseIcon) el.fsPauseIcon.classList.add('hidden');

        if (typeof stopYoutubeTracking === 'function') stopYoutubeTracking();
        
        if (state === 0 && typeof window.pularParaProxima === "function") {
            window.pularParaProxima();
        }
    }
};

function limparTodosOsTimers() {
    if (window.streamTimer) { clearTimeout(window.streamTimer); window.streamTimer = null; }
    if (window.bonusTimer30s) { clearTimeout(window.bonusTimer30s); window.bonusTimer30s = null; }
    if (window.bonusTimer60s) { clearTimeout(window.bonusTimer60s); window.bonusTimer60s = null; }
}

function calcularStreams(tempoOuvido) {
    let min, max;

    // Invertemos a ordem ou usamos faixas fixas para não haver erro de interpretação
    if (tempoOuvido >= 20 && tempoOuvido < 30) {
        // Faixa dos 20 segundos
        min = 10000;
        max = 40000;
    } else if (tempoOuvido >= 30 && tempoOuvido < 60) {
        // Faixa dos 30 segundos
        min = 40000;
        max = 200000;
    } else if (tempoOuvido >= 60) {
        // Faixa de 1 minuto ou mais
        min = 300000;
        max = 700000;
    } else {
        return 0; // Menos de 20s não ganha nada
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function validarStreamOficial(track) {
    if (!track || !track.id || window.isProcessingStream) return false;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const masterTab = localStorage.getItem('tune_tabs_active_session_master');

    if (!isMobile && masterTab && masterTab !== window.SESSION_ID) return false;

    const agora = Date.now();
    const currentUser = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!currentUser) return false;

    window.isProcessingStream = true;

    try {
        const tempoOuvido = (agora - (window.streamStartTime || agora)) / 1000;
        if (tempoOuvido < 19) { 
            window.isProcessingStream = false; 
            return false; 
        }

        // 1. CÁLCULO DE STREAMS (Sempre Positivo)
        const valorFinal = typeof calcularStreams === 'function' ? calcularStreams(tempoOuvido) : 0;
        if (valorFinal <= 0) {
            window.isProcessingStream = false;
            return false;
        }

        

        // 2. BUSCA DADOS ATUAIS DA MÚSICA (Para evitar negativar)
        const musicRef = doc(db, "musicas", track.id);
        const musicSnap = await getDoc(musicRef);
        let ouvintesAtuais = 0;
        
        if (musicSnap.exists()) {
            ouvintesAtuais = musicSnap.data().ouvintesMensais || 0;
        }

        // 3. LÓGICA DE OUVINTES COM TRAVA ANTI-NEGATIVO
        const valorSorteadoOuvintes = Math.floor(Math.random() * (200000 - 10000 + 1)) + 10000;
        const eAdicao = Math.random() < 0.6; // 60% de chance de subir
        
        let ajusteOuvintes;

        if (eAdicao) {
            ajusteOuvintes = valorSorteadoOuvintes;
        } else {
            // Se for para remover, verificamos se a música tem saldo
            // Se o valor sorteado for maior que o que a música tem, removemos apenas 50% do que ela tem hoje
            if (valorSorteadoOuvintes > ouvintesAtuais) {
                ajusteOuvintes = -(Math.floor(ouvintesAtuais * 0.5)); 
            } else {
                ajusteOuvintes = -valorSorteadoOuvintes;
            }
        }

        // 4. CHAMADA CLOUD FUNCTION
        const functionsInstance = getFunctions(undefined, "us-central1");
        const registrarStreamFN = httpsCallable(functionsInstance, "registrarStream");
        const result = await registrarStreamFN({
            trackId: track.id,
            valor: valorFinal,
            ajusteOuvintes: ajusteOuvintes,
            tempoOuvido: tempoOuvido
        });

        if (!result.data?.success) {
            window.isProcessingStream = false;
            return false;
        }

        // 5. ATUALIZAÇÃO NO FIRESTORE (VALORES SEGUROS)
        await updateDoc(musicRef, {
            streams: increment(valorFinal),
            ouvintesMensais: increment(ajusteOuvintes),
            lastMonthlyStreamDate: serverTimestamp()
        });

        // 6. LOGS (MOSTRANDO O VALOR FINAL COMO ANTES)
        await addDoc(collection(db, "stream_logs"), { 
            type: ajusteOuvintes > 0 ? "play_valid" : "listener_adjustment",
            trackId: track.id,
            itemTitle: track.title || "Música",
            userId: currentUser.uid,
            timestamp: Date.now(),
            valor: valorFinal, // Valor dos streams (ex: 300k)
            valorOuvintes: ajusteOuvintes,
            tempoOuvido: tempoOuvido.toFixed(0),
            platform: isMobile ? 'mobile' : 'desktop'
        });

        console.log(`✅ [TUNE] Streams: +${valorFinal} | Ouvintes: ${ajusteOuvintes}`);
        window.isProcessingStream = false;
        return true;

    } catch (e) {
        console.error("❌ Erro:", e);
        window.isProcessingStream = false;
        return false;
    }
}
/**
 * Função para exibir o Pop-up de alerta estético
 */
function exibirAvisoFraude(mensagem) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Segurança Tune',
            text: mensagem,
            icon: 'warning',
            background: '#121212',
            color: '#fff',
            confirmButtonColor: '#1DB954'
        });
    } else {
        alert("⚠️ [SEGURANÇA TUNE]\n" + mensagem);
    }
}

let clickCount = 0;
let lastClickTime = 0;
const SPAM_THRESHOLD = 5; // Cliques permitidos
const SPAM_TIME_WINDOW = 2000; // Janela de 2 segundos

async function detectarSpamCliques(userId) {
    const now = Date.now();

    if (now - lastClickTime < SPAM_TIME_WINDOW) {
        clickCount++;
    } else {
        clickCount = 1; // Reseta se passou do tempo
    }

    lastClickTime = now;

    if (clickCount >= SPAM_THRESHOLD) {
        await suspenderUsuario(userId);
    }
}

async function suspenderUsuario(userId) {
    if (!userId || userId === "deslogado") return;

    const suspensaoAte = new Date(Date.now() + 5 * 60000); // 5 minutos

    try {
        // Registra o log com o tipo específico para o seu painel
        if (typeof registrarLog === "function") {
            await registrarLog("SUSPENSÃO: DETECÇÃO DE AUTOCLICK", "play_spam_ban", userId);
        }

        await updateDoc(doc(db, "usuarios", userId), {
            status: "suspenso",
            suspensaoAte: suspensaoAte,
            motivoSuspensao: "Uso de autoclicks/spam detectado pelo Player"
        });

        window.location.reload(); // Recarrega para ativar o bloqueio global
        
    } catch (e) {
        console.error("Erro ao suspender:", e);
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

// Dentro de setupPlayerListeners, substitua o clique do botão de play:
if (fsPlayPauseBtn) {
    fsPlayPauseBtn.onclick = (e) => {
        e.preventDefault();
        if (!window.currentTrack) return;

        if (window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function') {
            const state = window.ytPlayer.getPlayerState();
            // Se estiver tocando, pausa. Se não, dá play.
            state === 1 ? window.ytPlayer.pauseVideo() : window.ytPlayer.playVideo();
        } else {
            // Só carrega se o player realmente não existir
            window.loadTrack(window.currentTrack);
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
        // Usamos onclick direto para garantir que o evento anterior seja subscrito
        likeBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Verificamos a track atual na window para evitar erro de escopo
            if (window.currentTrack) {
                await toggleLike(window.currentTrack);
            } else {
                console.warn("Nenhuma música carregada para curtir.");
            }
        };
    }

    if (shareBtn) {
        shareBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.currentTrack) openSharePlayer(window.currentTrack);
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

window.parseTuneCanvasID = function(url) {
    if (!url || typeof url !== 'string') return null;
    
    // Se já for um ID de 11 caracteres puro
    const trimmed = url.trim();
    if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('?')) {
        return trimmed;
    }

    // Regex para extrair ID de: Shorts, Links normais, Embeds e Mobile
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = trimmed.match(regExp);

    if (match && match[2].length === 11) {
        return match[2];
    }

    return null;
};

// --- LÓGICA MIXED PAINT (AURORA DINÂMICO) ---

class ColorBlob {
    constructor(colors) {
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.size = Math.random() * (700 - 350) + 350;
        this.speedX = Math.random() * (0.05 - 0.02) + 0.02;
        this.speedY = Math.random() * (0.05 - 0.02) + 0.02;
        this.phaseX = Math.random() * Math.PI * 2;
        this.phaseY = Math.random() * Math.PI * 2;
    }

    draw(ctx, width, height, time) {
        // Cálculo de posição senoidal igual ao seu código Swift
        const x = width * 0.5 + Math.sin(time * this.speedX + this.phaseX) * (width * 0.5);
        const y = height * 0.5 + Math.cos(time * this.speedY + this.phaseY) * (height * 0.5);

        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(x, y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

let auroraBlobs = [];
let animationFrameId = null;

function startAuroraAnimation(palette) {
    const canvas = document.getElementById('aurora-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Converte a paleta do ColorThief para strings de cor
    const colors = palette.map(c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    
    // Cria 7 blobs como na sua struct
    auroraBlobs = Array.from({ length: 7 }, () => new ColorBlob(colors));

    function animate(time) {
        const t = time * 0.001; // Converte para segundos
        
        // Ajusta tamanho do canvas para o container
        if (canvas.width !== canvas.offsetWidth) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Modo de mesclagem para parecer "tinta misturada"
        ctx.globalCompositeOperation = 'screen'; 
        
        auroraBlobs.forEach(blob => blob.draw(ctx, canvas.width, canvas.height, t));
        
        animationFrameId = requestAnimationFrame(animate);
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animate(0);
}

let fsCanvasPlayer = null;
/**
 * Atualiza o fundo do Player em Ecrã Total.
 * Se houver Canvas E for Mobile, remove a capa e ativa o vídeo em loop.
 */
async function updateFullScreenBackground(track) {
    const elements = getPlayerElements();
    const aurora = document.getElementById("fs-aurora-bg");
    const canvasContainer = document.getElementById("fs-canvas-bg-container");
    const coverWrapper = document.getElementById("fs-cover-wrapper"); 
    
    // Verifica se é um dispositivo móvel
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Tenta obter o ID do vídeo
    const canvasId = track.canvasUrl ? parseTuneCanvasID(track.canvasUrl) : null;
    
    // ⭐ CONDIÇÃO ALTERADA: Só ativa se houver ID E for Mobile
    if (canvasId && isMobile) {
        // --- MODO CANVAS ATIVO (SÓ MOBILE) ---
        if (aurora) aurora.style.opacity = "0"; 
        if (canvasContainer) canvasContainer.classList.remove("hidden"); 
        
        if (coverWrapper) coverWrapper.classList.add("has-canvas");

        if (fsCanvasPlayer && typeof fsCanvasPlayer.loadVideoById === 'function') {
            fsCanvasPlayer.loadVideoById({
                videoId: canvasId,
                startSeconds: 0,
                suggestedQuality: 'small'
            });
        } else {
            fsCanvasPlayer = new YT.Player("fs-canvas-player", {
                videoId: canvasId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    loop: 1,
                    playlist: canvasId,
                    mute: 1,
                    modestbranding: 1,
                    rel: 0,
                    playsinline: 1
                },
                // Onde você cria o player (new YT.Player)
events: {
    'onStateChange': (event) => {
        // Toda vez que o vídeo der play ou pause no YouTube, o ícone do seu site atualiza
        if (typeof window.syncPlayPauseState === 'function') {
            window.syncPlayPauseState();
        }

        if (event.data === YT.PlayerState.ENDED) {
            if (typeof window.nextTrack === 'function') window.nextTrack();
        }
    }
}
            });
        }
    } else {
        // --- MODO SEM CANVAS OU PC (AURORA) ---
        // Se estiver no PC, ele cairá aqui mesmo que a música tenha Canvas
        if (canvasContainer) canvasContainer.classList.add("hidden");
        
        if (fsCanvasPlayer && typeof fsCanvasPlayer.stopVideo === 'function') {
            fsCanvasPlayer.stopVideo();
        }
        
        if (coverWrapper) coverWrapper.classList.remove("has-canvas");
        if (aurora) aurora.style.opacity = "1";

        if (track.cover) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const colorThief = new ColorThief();
                    const palette = colorThief.getPalette(img, 5);
                    const best = palette.map(rgb => ({ rgb, hsl: rgbToHsl(rgb[0], rgb[1], rgb[2]) }))
                                        .filter(c => c.hsl.l > 0.15 && c.hsl.l < 0.85)
                                        .sort((a, b) => b.hsl.s - a.hsl.s)[0];

                    const finalRgb = best ? best.rgb : palette[0];
                    let { h, s, l } = rgbToHsl(finalRgb[0], finalRgb[1], finalRgb[2]);
                    
                    s = Math.max(s, 0.7); 
                    l = 0.45;

                    const generatedGradient = `radial-gradient(circle at 50% 30%, hsl(${h*360},${s*100}%,${l*100}%) 0%, rgba(0,0,0,0.9) 85%)`;

                    aurora.style.background = generatedGradient;

                    const lyricsCard = document.getElementById('fs-lyrics-card');
                    if (lyricsCard) {
                        lyricsCard.style.background = `linear-gradient(135deg, hsl(${h*360},${s*100}%,${(l*100)-10}%), hsl(${h*360},${s*100}%,${(l*100)-20}%))`;
                    }

                    const lyricsOverlay = document.getElementById('fs-lyrics-overlay');
                    if (lyricsOverlay) {
                        lyricsOverlay.style.background = generatedGradient;
                    }

                } catch (e) { 
                    console.warn("Erro ao extrair cores:", e);
                    aurora.style.background = "#121212"; 
                }
            };
            img.src = `${track.cover}?t=${Date.now()}`;
        }
    }
}

function updateLyricsDisplay(track) {
    const lyricsCard = document.getElementById('fs-lyrics-card');
    const lyricsContent = document.getElementById('lyrics-content');
    const lyricsOverlay = document.getElementById('fs-lyrics-overlay');
    const scrollBody = document.getElementById('lyrics-scroll-body');
    
    // Mini info do topo do overlay
    const miniCover = document.getElementById('lyrics-mini-cover');
    const miniTitle = document.getElementById('lyrics-mini-title');
    const miniArtist = document.getElementById('lyrics-mini-artist');

    if (!lyricsCard || !lyricsContent) return;

    if (track.lyrics && track.lyrics.trim() !== "") {
        lyricsCard.classList.remove('hidden');
        const formatted = track.lyrics.replace(/\n/g, '<br>');
        
        // Preenche os textos
        lyricsContent.innerHTML = formatted;
        if (scrollBody) scrollBody.innerHTML = formatted;

        // Preenche a mini info
        if (miniCover) miniCover.src = track.cover || "assets/10.png";
        if (miniTitle) miniTitle.textContent = track.title || "Título";
        if (miniArtist) miniArtist.textContent = track.artistName || "Artista";

        // ⭐ SINCRONIZA O FUNDO COM A AURORA ⭐
        const aurora = document.getElementById('fs-aurora-bg');
        if (aurora && aurora.style.background) {
            lyricsCard.style.background = aurora.style.background.replace('radial-gradient', 'linear-gradient');
            
            const overlay = document.getElementById('fs-lyrics-overlay');
            if (overlay) overlay.style.background = aurora.style.background;
        }
    } else {
        lyricsCard.classList.add('hidden');
        if (lyricsOverlay) lyricsOverlay.classList.remove('active');
    }
}

// 2. Configura os Cliques (Chame isso no seu DOMContentLoaded)
function setupLyricsEvents() {
    const lyricsCard = document.getElementById('fs-lyrics-card');
    const lyricsOverlay = document.getElementById('fs-lyrics-overlay');
    const closeBtn = document.getElementById('close-lyrics-overlay');

    if (lyricsCard && lyricsOverlay) {
        // CLIQUE NO CARD -> ABRE A TELA
        lyricsCard.onclick = (e) => {
            e.stopPropagation();
            lyricsOverlay.classList.remove('hidden');
            // Timeout pequeno para o navegador perceber que o display mudou antes da animação
            setTimeout(() => {
                lyricsOverlay.classList.add('active');
            }, 10);
        };
    }

    if (closeBtn && lyricsOverlay) {
        // CLIQUE NO X -> FECHA A TELA
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            lyricsOverlay.classList.remove('active');
            // Espera a animação de 0.5s acabar para colocar o hidden de volta
            setTimeout(() => {
                lyricsOverlay.classList.add('hidden');
            }, 500);
        };
    }
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

    // Dentro do updateMiniPlayerBackground:
img.onload = function () {
    try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 5);

        const bestColor = palette
            .map(rgb => ({ rgb, hsl: rgbToHsl(rgb[0], rgb[1], rgb[2]) }))
            .sort((a, b) => b.hsl.s - a.hsl.s)[0];

        let { h, s, l } = bestColor.hsl;

        // Ajuste para o MiniPlayer: Menos brilho para o texto branco ler bem
        s = Math.min(s, 0.6); // Saturação moderada
        l = 0.12; // Bem escuro para o efeito Glass que você usa

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

// --- Agora sua Lógica de Logout vai funcionar ---
if (logoutLink) {
    logoutLink.addEventListener('click', e => {
        e.preventDefault();
        signOut(auth) // Agora o navegador saberá o que é signOut!
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
    setupLyricsEvents();
    checkCurrentTrack();
    setupQueueControls();
});
// No final do seu player.js


// Exportação para módulos
export { loadTrack, carregarFila, obterApenasID };

// Atribuição ao window para acesso global (HTML/Roteador)
window.loadTrack = loadTrack;
window.carregarFila = carregarFila;
window.obterApenasID = obterApenasID;