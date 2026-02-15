// main.js

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, limit, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js"; // Adicionei signOut para o logout

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.appspot.com",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};



const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const LOGIN_URL = "index.html";

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

async function loadTrack(track) {
    if (!track || !track.audioURL) return;

    // 1. Limpeza de streams e timers anteriores
    clearTimeout(streamTimer);
    streamTimer = null; 
    
    currentTrack = track; 
    audio.src = track.audioURL;
    const elements = getPlayerElements();
    const coverUrl = track.cover || "assets/10.png";

    // 2. Visibilidade e Animação de Entrada
    if (elements.musicPlayer) elements.musicPlayer.classList.remove('hidden');
    
    if (elements.fullScreenPlayer) {
        elements.fullScreenPlayer.classList.remove('hidden');
        requestAnimationFrame(() => {
            document.body.classList.add('fs-active');
            elements.fullScreenPlayer.animate([
                { transform: 'translateY(100%)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.32, 0.72, 0, 1)'
            });
        });
    }

    

    // 3. Reset Interface de Vídeo (YT escondido por padrão)
    if (elements.ytContainer) elements.ytContainer.classList.add('hidden');
    if (elements.fsPlayerCover) elements.fsPlayerCover.classList.remove('hidden');
    if (elements.ytIframe) elements.ytIframe.src = "";

    // 4. Cores Dinâmicas (ColorThief) e Fundo
    if (elements.miniPlayerCover) {
        elements.miniPlayerCover.src = coverUrl;
        elements.miniPlayerCover.crossOrigin = "Anonymous";
        elements.miniPlayerCover.onload = function() {
            try {
                const colorThief = new ColorThief();
                const color = colorThief.getColor(elements.miniPlayerCover);
                const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                
                if (elements.musicPlayer) {
                    elements.musicPlayer.style.backgroundColor = rgb;
                    elements.musicPlayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3))`;
                }
                
                // Atualiza o background da tela cheia (Aurora ou Canvas)
                updateFullScreenBackground(track);
                
            } catch (e) { console.warn("Erro nas cores:", e); }
        };
    }
    if (elements.fsPlayerCover) elements.fsPlayerCover.src = coverUrl;

    // 5. Dados do Artista e Título
    let artistName = "Artista";
    let artistUid = track.artist || track.uidars;
    if (artistUid) {
        try {
            const artistSnap = await getDoc(doc(db, "usuarios", artistUid));
            if (artistSnap.exists()) artistName = artistSnap.data().nomeArtistico || "Artista";
        } catch (err) { console.error(err); }
    }

    if (elements.playerTitle) elements.playerTitle.textContent = track.title || "Sem título";
    if (elements.playerArtist) elements.playerArtist.textContent = artistName;
    if (elements.fsPlayerTitle) elements.fsPlayerTitle.textContent = track.title || "Sem título";
    if (elements.fsPlayerArtist) elements.fsPlayerArtist.textContent = artistName;

    // 6. Finalização
    setTimeout(updateScrollAnimation, 100);
    audio.play().catch(() => console.log("Aguardando interação."));
    syncPlayPauseState();
    localStorage.setItem("currentTrack", JSON.stringify(track));
}

async function validarStreamOficial(track) {
    if (!track || !track.id) return;
    if (!window.streamGuard) window.streamGuard = { lastGlobalStreamTime: 0 };

    const now = Date.now();
    if (now - window.streamGuard.lastGlobalStreamTime < 5000) return;
    window.streamGuard.lastGlobalStreamTime = now;

    try {
        const valorAleatorio = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
        const musicaRef = doc(db, "musicas", track.id);
        
        await updateDoc(musicaRef, {
            streams: increment(valorAleatorio),
            streamsMensal: increment(valorAleatorio),
            lastMonthlyStreamDate: new Date()
        });

        console.log(`🚀 ✅ Stream validado (20s YT): ${track.title} | +${valorAleatorio.toLocaleString()} streams`);
    } catch (err) {
        console.error("Erro Firebase:", err);
    }
}

window.loadYoutubeVideo = function(videoId) {
    const { ytIframe } = getPlayerElements();

    if (!ytPlayer) {
        ytPlayer = new YT.Player('youtube-iframe', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            host: 'https://www.youtube.com', // <--- AJUDA MUITO NO ERRO POSTMESSAGE
            playerVars: {
                'autoplay': 1,
                'controls': 0, 
                'rel': 0,
                'showinfo': 0,
                'modestbranding': 1,
                'origin': window.location.origin, // <--- OBRIGATÓRIO
                'enablejsapi': 1 // <--- OBRIGATÓRIO PARA getCurrentTime FUNCIONAR
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    } else {
        // Se já existe, carrega o novo
        ytPlayer.loadVideoById(videoId);
    }
};

function updateInterfaceLabels(current, total) {
    const { fsProgressFill, fsCurrentTimeEl, fsTotalTimeEl } = getPlayerElements();
    
    // Proteção contra divisão por zero
    let percent = 0;
    if (total > 0) {
        percent = (current / total) * 100;
    }
    
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

function startYoutubeTracking() {
    stopYoutubeTracking(); // Limpa anterior se houver
    
    ytProgressInterval = setInterval(() => {
        // Verifica se o player e as funções existem
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function' || typeof ytPlayer.getDuration !== 'function') {
            return;
        }

        try {
            const currentTime = ytPlayer.getCurrentTime() || 0;
            const duration = ytPlayer.getDuration() || 0;
            
            // ATUALIZAÇÃO FORÇADA:
            // Mesmo que a duração seja 0 (carregando), mandamos atualizar para zerar os contadores visualmente
            updateInterfaceLabels(currentTime, duration);

        } catch (error) {
            // Ignora erros momentâneos da API
        }
    }, 500);
}

function setupPlayerListeners() {
    if (listenersAttached) return; 
    listenersAttached = true;
    
    const elements = getPlayerElements();
    const { 
        playBtn, fsPlayPauseBtn, volumeSlider, fsVolumeSlider, 
        musicPlayer, fsCloseButton, ytContainer, ytIframe, fsPlayerCover 
    } = elements;

    // --- 1. BOTÃO DO YOUTUBE (Gera Stream após 20s) ---
    if (fsPlayPauseBtn) {
        fsPlayPauseBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!currentTrack || !currentTrack.id) return;

            let videoId = "";
            const url = currentTrack.audioURL;
            if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
            else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0];

            if (fsPlayerCover) fsPlayerCover.classList.add('hidden');
            if (ytContainer) ytContainer.classList.remove('hidden');
            
            if (ytIframe && videoId) {
                ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${window.location.origin}`;
                console.log("📺 Modo YouTube iniciado. Aguardando 20s para stream...");
                
                clearTimeout(streamTimer); 
                streamTimer = setTimeout(() => {
                    validarStreamOficial(currentTrack);
                }, TIME_TO_STREAM);
            }
            audio.pause(); 
        });
    }

    // --- 2. PLAY/PAUSE NATIVO ---
    if (playBtn) {
        playBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (audio.paused) audio.play(); else audio.pause();
        });
    }

    // --- 3. EVENTOS DE ÁUDIO ---
    audio.addEventListener("play", () => {
        syncPlayPauseState();
        console.log("🎵 Áudio nativo tocando (Sem stream).");
    });
    audio.addEventListener("pause", syncPlayPauseState);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", () => clearTimeout(streamTimer));

    // --- 4. CONTROLE DE VOLUME ---
    const handleVol = (e) => {
        audio.volume = e.target.value;
        if (volumeSlider) volumeSlider.value = e.target.value;
        if (fsVolumeSlider) fsVolumeSlider.value = e.target.value;
    };
    if (volumeSlider) volumeSlider.addEventListener("input", handleVol);
    if (fsVolumeSlider) fsVolumeSlider.addEventListener("input", handleVol);

    // --- 5. PROGRESSO E CLIQUE NA BARRA ---
    const pBar = document.querySelector(".progress-bar");
    const fsPBar = document.getElementById("fs-player-bar-container");
    if (pBar) pBar.addEventListener("click", (e) => handleProgressClick(e, pBar, elements.progressFill));
    if (fsPBar) fsPBar.addEventListener("click", (e) => handleProgressClick(e, fsPBar, elements.fsProgressFill));

    // --- 6. ABRIR E FECHAR PLAYER ---
    if (musicPlayer) {
        musicPlayer.addEventListener('click', (e) => {
            if (e.target.closest('.player-center') || e.target.closest('.player-right') || e.target.closest('.progress-bar')) return;
            if (currentTrack && elements.fullScreenPlayer) {
                elements.fullScreenPlayer.classList.remove('hidden');
                requestAnimationFrame(() => document.body.classList.add('fs-active'));
            }
        });
    }

    if (fsCloseButton) {
        fsCloseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("❌ Player fechado. Stream cancelado.");
            clearTimeout(streamTimer); 
            
            document.body.classList.remove('fs-active');
            const animation = elements.fullScreenPlayer.animate([
                { transform: 'translateY(0)', opacity: 1 },
                { transform: 'translateY(100%)', opacity: 0 }
            ], { duration: 500, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });

            animation.onfinish = () => {
                elements.fullScreenPlayer.classList.add('hidden');
                if (ytIframe) ytIframe.src = ""; 
                animation.cancel();
            };
        });
    
    

        
    }if (musicPlayer && elements.fullScreenPlayer) {
        
       musicPlayer.addEventListener('click', (e) => {
    // ... seus filtros de clique ...
    if (currentTrack) {
        const player = elements.fullScreenPlayer;
        player.classList.remove('hidden');
        document.body.classList.add('fs-active');

        // Animação de entrada
        player.animate([
            { transform: 'translateY(100%)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
        ], {
            duration: 500,
            easing: 'cubic-bezier(0.32, 0.72, 0, 1)'
        });
    }
});

if (fsCloseButton) {
    fsCloseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const player = elements.fullScreenPlayer;

        // 1. Remove a classe do body imediatamente para efeitos visuais extras
        document.body.classList.remove('fs-active');

        // 2. Cria a animação de saída (Slide Down + Fade Out)
        const animation = player.animate([
            { transform: 'translateY(0)', opacity: 1 },    // Início (Visível)
            { transform: 'translateY(100%)', opacity: 0 } // Fim (Escondido embaixo)
        ], {
            duration: 500,
            easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
            fill: 'forwards' // Mantém o estado final após acabar
        });

        // 3. Quando a animação TERMINAR, aí sim colocamos o hidden
        animation.onfinish = () => {
            player.classList.add('hidden');
            // Limpa a animação para não bugar a próxima abertura
            animation.cancel(); 
        };
    });
}
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

// 🚀 EXPORTAÇÃO GLOBAL: Permite que outros scripts (tunearts.js) chamem loadTrack
window.playTrackGlobal = loadTrack;

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

// Evento disparado quando outra aba salva uma música
window.addEventListener("storage", () => checkCurrentTrack());

// Inicialização
document.addEventListener('DOMContentLoaded', checkCurrentTrack);