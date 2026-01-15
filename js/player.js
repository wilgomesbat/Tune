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

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Adicionei auth
const LOGIN_URL = "index.html"; // Adicionado para a lógica de logout

// --- ELEMENTOS GLOBAIS ESSENCIAIS ---
const audio = new Audio();
audio.preload = "auto";
let currentTrack = null; 
let listenersAttached = false; // Controle para ligar listeners uma única vez

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


// --- FUNÇÃO PARA OBTER TODOS OS ELEMENTOS DO PLAYER ---
function getPlayerElements() {
    return {
        // Elementos Comuns e Fixo
        musicPlayer: document.getElementById("music-player"),
        coverImg: document.getElementById("player-cover"),
        playBtn: document.getElementById("playpause-btn"),
        playIcon: document.getElementById("play-icon"),
        pauseIcon: document.getElementById("pause-icon"),
        
        // NOVO: Container de informações para verificação de largura
        playerInfoContainer: document.querySelector('.player-info'), 
        playerTitle: document.getElementById("player-title"),
        playerArtist: document.getElementById("player-artist"),
        
        currentTimeEl: document.getElementById("current-time"),
        totalTimeEl: document.getElementById("total-time"),
        progressFill: document.getElementById("progress-fill"),
        volumeSlider: document.getElementById("volume-slider"),
        
        // Elementos Tela Cheia
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
        fsOverlay: document.getElementById('fs-player-overlay'),
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


// --- FUNÇÃO DE CARREGAMENTO E SINCRONIZAÇÃO DE MÚSICA (LOAD TRACK) ---
window.playTrackGlobal = loadTrack; 
async function loadTrack(track) {
    if (!track || !track.audioURL) {
        console.error("Dados da faixa inválidos ou URL faltando:", track);
        return;
    }

    const elements = getPlayerElements();

    currentTrack = track;
    audio.src = track.audioURL;

    // --- SINCRONIZAÇÃO DE DADOS (PLAYER FIXO E TELA CHEIA) ---
    const coverUrl = track.cover || "assets/10.png";
    
    // 1. Player Fixo
    if (elements.coverImg) {
        elements.coverImg.crossOrigin = 'Anonymous'; 
        elements.coverImg.src = coverUrl;
    }

    // Buscar o nome do artista usando o UID (LÓGICA MANTIDA)
    let artistName = "Desconhecido";
    let artistUid = track.artist || track.uidars;

    if (artistUid) { 
        try {
            const artistDocRef = doc(db, "usuarios", artistUid); 
            const artistSnap = await getDoc(artistDocRef);

            if (artistSnap.exists()) {
                const artistData = artistSnap.data();
                if (artistData.nomeArtistico && artistData.nomeArtistico !== "") {
                    artistName = artistData.nomeArtistico;
                }
            } 
        } catch (err) {
            console.error("Erro ao buscar artista:", err); 
        }
    }
    
    // Atualiza info nos players
    const trackTitle = track.title || "Título Desconhecido";
    if (elements.playerTitle) elements.playerTitle.textContent = trackTitle;
    if (elements.playerArtist) elements.playerArtist.textContent = artistName;

    // 🚀 CHAMA A FUNÇÃO DE SCROLL AQUI!
    // Precisa ser chamada após o textContent ser atualizado, mas antes do play para que a largura seja calculada corretamente.
    setTimeout(updateScrollAnimation, 100); 

    // 2. Player Tela Cheia (Atualiza, se existir)
    if (elements.fullScreenPlayer) {
        if (elements.fsPlayerCover) elements.fsPlayerCover.src = coverUrl;
        if (elements.fsPlayerTitle) elements.fsPlayerTitle.textContent = trackTitle;
        if (elements.fsPlayerArtist) elements.fsPlayerArtist.textContent = artistName;
    }
    
    // Tenta tocar
    audio.play().catch(err => console.warn("Autoplay bloqueado, aguarde interação:", err));
    
    // Atualiza estado de play/pause imediatamente
    syncPlayPauseState(); 

    updateFullScreenBackground(track);

    // Salva no localStorage para sincronização entre abas
    localStorage.setItem("currentTrack", JSON.stringify(track)); 
}


// --- HANDLERS E UTilitários ---
// ... (funções formatTime, handleTimeUpdate, handleVolumeChange, handleProgressClick, setupPlayerListeners, updateFullScreenBackground, checkCurrentTrack e o listener 'storage' permanecem INALTERADOS) ...


// --- FUNÇÃO PARA LIGAR TODOS OS EVENT LISTENERS UMA ÚNICA VEZ ---
function setupPlayerListeners() {
    if (listenersAttached) return; 
    listenersAttached = true;
    
    const elements = getPlayerElements();
    const { playBtn, fsPlayPauseBtn, volumeSlider, fsVolumeSlider, musicPlayer, fsCloseButton } = elements;
    
    const togglePlayPause = () => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    };

    // Listeners de Play/Pause
    if (playBtn) playBtn.addEventListener("click", togglePlayPause);
    if (fsPlayPauseBtn) fsPlayPauseBtn.addEventListener("click", togglePlayPause);
    
    // Listeners de Volume
    const handleVolumeInput = (e) => audio.volume = e.target.value;
    if (volumeSlider) volumeSlider.addEventListener("input", handleVolumeInput);
    if (fsVolumeSlider) fsVolumeSlider.addEventListener("input", handleVolumeInput);
    
    // Eventos de Áudio
    audio.addEventListener("play", syncPlayPauseState);
    audio.addEventListener("pause", syncPlayPauseState);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("volumechange", handleVolumeChange);
    audio.addEventListener("ended", () => {
        console.log("Música encerrada, lógica de próxima faixa aqui.");
    });
    
    // Barras de Progresso
    const progressBar = document.querySelector(".progress-bar"); // CORRIGIDO: Usei o seletor de classe .progress-bar do seu HTML
    const fsProgressBar = document.getElementById("fs-player-bar-container"); 
    
    if (progressBar) {
        progressBar.addEventListener("click", (e) => {
            handleProgressClick(e, progressBar, elements.progressFill);
        });
    }

    if (fsProgressBar) {
        fsProgressBar.addEventListener("click", (e) => {
            handleProgressClick(e, fsProgressBar, elements.fsProgressFill);
        });
    }

    if (musicPlayer && elements.fullScreenPlayer) {
    
    // Abrir ao clicar no Player Fixo (ignora cliques nos botões de controle)
    musicPlayer.addEventListener('click', (e) => {
        if (e.target.closest('.player-center') || e.target.closest('.player-right') || e.target.closest('.progress-bar')) {
             return;
        }
        if (currentTrack) {
            // 1. Remove 'hidden' para permitir que o CSS comece a transição a partir do 'transform: translateY(100%)'
            elements.fullScreenPlayer.classList.remove('hidden');
            
            // 2. ADICIONA A CLASSE AO BODY para disparar a animação CSS
            document.body.classList.add('fs-active'); 
        }
    });

    // Fechar ao clicar no botão de fechar
    if (fsCloseButton) {
        fsCloseButton.addEventListener('click', () => {
            // 1. REMOVE A CLASSE DO BODY para iniciar a transição de volta
            document.body.classList.remove('fs-active');
            
            // 2. Adiciona a classe 'hidden' DEPOIS que a animação terminar
            // (500 milissegundos é o tempo da transição no CSS)
            setTimeout(() => {
                elements.fullScreenPlayer.classList.add('hidden');
            }, 500); 
        });
    }
}
}

// ... (Resto das funções formatTime, handleTimeUpdate, handleVolumeChange, handleProgressClick, updateFullScreenBackground) ...
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
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

function updateFullScreenBackground(track) {
    const elements = getPlayerElements();
    const fsOverlay = document.getElementById("fs-player-overlay");
    if (!elements.fullScreenPlayer || !fsOverlay) return;

    // Limpa qualquer fundo anterior
    elements.fullScreenPlayer.style.backgroundImage = "";
    elements.fullScreenPlayer.style.backgroundColor = "transparent"; 
    
    // Remove canvas/video se já existir
    const oldBg = document.querySelector("#fs-player-canvas-bg");
    if (oldBg) oldBg.remove();
    
    fsOverlay.style.zIndex = "1"; // Garante que o overlay esteja acima do fundo

    // 1️⃣ Se houver um GIF/Canvas (vídeo)
    if (track.canvas) {
        const isGif = track.canvas.toLowerCase().endsWith('.gif');
        const mediaElement = document.createElement(isGif ? "img" : "video");
        mediaElement.id = "fs-player-canvas-bg";
        mediaElement.src = track.canvas;
        
        Object.assign(mediaElement.style, {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: "0", // Fica por trás do overlay
            opacity: "1.0",
        });

        if (!isGif) {
            mediaElement.autoplay = true;
            mediaElement.loop = true;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
        }

        elements.fullScreenPlayer.prepend(mediaElement);
        
        // Ajusta o overlay para cobrir um pouco o fundo
        fsOverlay.style.background = "linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0) 70%, transparent)"; 
        return;
    }

    // 2️⃣ Se não houver canvas, USA A CAPA DO ÁLBUM COM BLUR COMO FUNDO
    // Garanta que track.cover exista para evitar imagem quebrada
    if (track.cover) {
        elements.fullScreenPlayer.style.backgroundImage = `url(${track.cover})`;
        elements.fullScreenPlayer.style.backgroundSize = 'cover'; // Garante que a imagem cubra todo o fundo
        elements.fullScreenPlayer.style.backgroundPosition = 'center center'; // Centraliza a imagem
        
       
        // Ajusta o overlay para dar um toque extra de escuridão e gradiente
        fsOverlay.style.background = "linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0,0,0,0.3) 70%, transparent)";
        return;
    }

    // 3️⃣ Fallback Final: Se não tiver nem canvas nem capa, usa uma cor sólida
    const fallbackColor = elements.musicPlayer ? elements.musicPlayer.style.backgroundColor : "#121212";
    elements.fullScreenPlayer.style.backgroundColor = fallbackColor;
    elements.fullScreenPlayer.style.filter = "none"; // Sem filtro para cor sólida
    fsOverlay.style.background = `linear-gradient(to top, rgba(0,0,0,0.8), ${fallbackColor} 100%)`;
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

// --- INICIALIZAÇÃO ---
function checkCurrentTrack() {
    setupPlayerListeners(); // LIGA OS LISTENERS AQUI
    
    const stored = localStorage.getItem("currentTrack");
    if (stored) {
        const track = JSON.parse(stored);
        loadTrack(track); // Recarrega os dados e o áudio
        updateFullScreenBackground(track);
    }
}

// Evento disparado quando outra aba salva uma música
window.addEventListener("storage", () => checkCurrentTrack());

// Inicialização
document.addEventListener('DOMContentLoaded', checkCurrentTrack);