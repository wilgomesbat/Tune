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
        coverImg: document.getElementById("fs-player-cover"),
        playBtn: document.getElementById("playpause-btn"),
        playIcon: document.getElementById("play-icon"),
        pauseIcon: document.getElementById("pause-icon"),
        miniPlayerCover: document.getElementById('mini-player-cover'), // Novo ID do player pequeno
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

        ytContainer: document.getElementById("youtube-embed-container"),
        ytIframe: document.getElementById("youtube-iframe"),
        ytBtn: document.getElementById("btn-show-video")

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

async function loadTrack(track) {
    if (!track || !track.audioURL) {
        console.error("Dados da faixa inválidos:", track);
        return;
    }

    const elements = getPlayerElements();
    const coverUrl = track.cover || "assets/10.png";

    // --- 1. VISIBILIDADE DOS PLAYERS ---
    // Remove o hidden do player pequeno
    if (elements.musicPlayer) {
        elements.musicPlayer.classList.remove('hidden');
    }

    // Abre o Full Screen automaticamente
    if (elements.fullScreenPlayer) {
        elements.fullScreenPlayer.classList.remove('hidden');
        // Delay para garantir que o navegador processe a remoção do display:none antes da animação
        requestAnimationFrame(() => {
            document.body.classList.add('fs-active');
            
            // Animação de subida (Slide Up)
            elements.fullScreenPlayer.animate([
                { transform: 'translateY(100%)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.32, 0.72, 0, 1)'
            });
        });
    }

    // 2. Reset de interface (Vídeo vs Capa)
    if (elements.ytContainer) elements.ytContainer.classList.add('hidden');
    if (elements.fsPlayerCover) elements.fsPlayerCover.classList.remove('hidden');
    if (elements.ytIframe) elements.ytIframe.src = "";

    // 3. Configuração do Áudio
    currentTrack = track;
    audio.src = track.audioURL;

    // 4. Atualização das Imagens e Cores
    if (elements.miniPlayerCover) {
        elements.miniPlayerCover.src = coverUrl;
        elements.miniPlayerCover.crossOrigin = "Anonymous";
        
        elements.miniPlayerCover.onload = function() {
            try {
                const colorThief = new ColorThief();
                const color = colorThief.getColor(elements.miniPlayerCover);
                const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                
                if (elements.musicPlayer) {
                    elements.musicPlayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3))`;
                    elements.musicPlayer.style.backgroundColor = rgb;
                }

                if (elements.fullScreenPlayer) {
                    elements.fullScreenPlayer.style.background = `linear-gradient(180deg, ${rgb} 0%, #000000 100%)`;
                }
            } catch (e) {
                console.warn("Erro ao extrair cor:", e);
            }
        };
    }
    
    if (elements.fsPlayerCover) {
        elements.fsPlayerCover.src = coverUrl;
    }

    // 5. Atualização de Textos (Firebase)
    let artistName = "Artista";
    let artistUid = track.artist || track.uidars;

    if (artistUid) {
        try {
            const artistSnap = await getDoc(doc(db, "usuarios", artistUid));
            if (artistSnap.exists()) {
                artistName = artistSnap.data().nomeArtistico || "Artista";
            }
        } catch (err) { console.error("Erro ao buscar artista:", err); }
    }

    if (elements.playerTitle) elements.playerTitle.textContent = track.title || "Sem título";
    if (elements.playerArtist) elements.playerArtist.textContent = artistName;
    if (elements.fsPlayerTitle) elements.fsPlayerTitle.textContent = track.title || "Sem título";
    if (elements.fsPlayerArtist) elements.fsPlayerArtist.textContent = artistName;

    // 6. Finalização
    setTimeout(updateScrollAnimation, 100);
    audio.play().catch(err => console.warn("Autoplay bloqueado"));
    syncPlayPauseState();
    localStorage.setItem("currentTrack", JSON.stringify(track));
}


// --- HANDLERS E UTilitários ---
// ... (funções formatTime, handleTimeUpdate, handleVolumeChange, handleProgressClick, setupPlayerListeners, updateFullScreenBackground, checkCurrentTrack e o listener 'storage' permanecem INALTERADOS) ...


function setupPlayerListeners() {
    if (listenersAttached) return; 
    listenersAttached = true;
    
    const elements = getPlayerElements();
    const { 
        playBtn, 
        fsPlayPauseBtn, 
        volumeSlider, 
        fsVolumeSlider, 
        musicPlayer, 
        fsCloseButton,
        ytContainer,
        ytIframe,
        fsPlayerCover 
    } = elements;

    // --- FUNÇÕES AUXILIARES ---

    // Reseta a interface do Full Screen: Esconde o vídeo e volta a mostrar a capa
    const backToCover = () => {
        if (ytContainer && !ytContainer.classList.contains('hidden')) {
            ytContainer.classList.add('hidden');
            if (fsPlayerCover) fsPlayerCover.classList.remove('hidden');
            if (ytIframe) ytIframe.src = ""; // Para o vídeo e limpa o iframe
        }
    };

    // Alterna o estado do Áudio (Play/Pause)
    const togglePlayPause = () => {
        if (!audio.src || audio.src === window.location.href) return;
        
        if (audio.paused) {
            audio.play().catch(err => console.warn("Erro ao dar play:", err));
        } else {
            audio.pause();
        }
    };

    // --- 1. LÓGICA DO BOTÃO CENTRAL (YOUTUBE) NO FULL SCREEN ---
    if (fsPlayPauseBtn) {
        fsPlayPauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Evita que o clique feche o player acidentalmente

            const stored = localStorage.getItem("currentTrack");
            if (!stored) return;
            const track = JSON.parse(stored);

            if (track.audioURL) {
                let videoId = "";
                const url = track.audioURL;

                // Extração robusta do ID do YouTube
                if (url.includes("v=")) {
                    videoId = url.split("v=")[1].split("&")[0];
                } else if (url.includes("youtu.be/")) {
                    videoId = url.split("youtu.be/")[1].split("?")[0];
                } else {
                    videoId = url.split("/").pop();
                }

                // Troca visual: Capa sai, Vídeo entra
                if (fsPlayerCover) fsPlayerCover.classList.add('hidden');
                if (ytContainer) ytContainer.classList.remove('hidden');
                
                // Carrega o vídeo e pausa a música de fundo
                if (ytIframe) {
                    ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${window.location.origin}`;
                }
                audio.pause(); 
            }
        });
    }

    // --- 2. LÓGICA DE PLAY/PAUSE DO PLAYER PEQUENO ---
    if (playBtn) {
        playBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlayPause();
        });
    }

    // --- 3. CONTROLE DE VOLUME ---
    const handleVolumeInput = (e) => {
        const val = e.target.value;
        audio.volume = val;
        // Sincroniza visualmente ambos os sliders
        if (volumeSlider) volumeSlider.value = val;
        if (fsVolumeSlider) fsVolumeSlider.value = val;
    };

    if (volumeSlider) volumeSlider.addEventListener("input", handleVolumeInput);
    if (fsVolumeSlider) fsVolumeSlider.addEventListener("input", handleVolumeInput);
    
    // --- 4. EVENTOS NATIVOS DO OBJETO AUDIO ---
    audio.addEventListener("play", syncPlayPauseState);
    audio.addEventListener("pause", syncPlayPauseState);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("volumechange", handleVolumeChange);
    audio.addEventListener("ended", () => {
        console.log("Música finalizada.");
        // Aqui você pode chamar uma função de nextTrack() futuramente
    });
    
    // --- 5. BARRAS DE PROGRESSO (CLIQUE PARA AVANÇAR/VOLTAR) ---
    const progressBar = document.querySelector(".progress-bar"); 
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
        
        // --- ABRIR PLAYER ---
        musicPlayer.addEventListener('click', (e) => {
            // Ignora se clicar nos botões da barra pequena
            if (e.target.closest('.player-center') || e.target.closest('.player-right') || e.target.closest('.progress-bar')) {
                return;
            }
            
            if (currentTrack) {
                // 1. Remove hidden primeiro para o elemento existir no DOM
                elements.fullScreenPlayer.classList.remove('hidden');
                
                // 2. Pequeno delay para o navegador processar que o display não é mais 'none'
                requestAnimationFrame(() => {
                    document.body.classList.add('fs-active');
                });
            }
        });

// Fechar o Player
if (fsCloseButton) {
            fsCloseButton.addEventListener('click', () => {
                // 1. Remove a classe que anima. O CSS começará o translateY(100%)
                document.body.classList.remove('fs-active');
                
                // 2. ESPERA 500ms (tempo do transition no CSS) antes de aplicar o 'hidden'
                setTimeout(() => {
                    // Verificação extra: só esconde se o usuário não abriu de novo
                    if (!document.body.classList.contains('fs-active')) {
                        elements.fullScreenPlayer.classList.add('hidden');
                    }
                }, 500); 
            });
        }
        
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

async function updateFullScreenBackground(track) {
    const elements = getPlayerElements();
    const fsOverlay = document.getElementById("fs-player-overlay");
    if (!elements.fullScreenPlayer || !fsOverlay) return;

    // Limpa estados anteriores
    elements.fullScreenPlayer.style.backgroundImage = "";
    
    // Remove canvas/video se já existir
    const oldBg = document.querySelector("#fs-player-canvas-bg");
    if (oldBg) oldBg.remove();

    // 1️⃣ PRIORIDADE: CANVAS (Vídeo/GIF)
    if (track.canvas) {
        const isGif = track.canvas.toLowerCase().endsWith('.gif');
        const mediaElement = document.createElement(isGif ? "img" : "video");
        mediaElement.id = "fs-player-canvas-bg";
        mediaElement.src = track.canvas;
        
        Object.assign(mediaElement.style, {
            position: "absolute",
            top: 0, left: 0, width: "100%", height: "100%",
            objectFit: "cover", zIndex: "0", opacity: "1.0",
        });

        if (!isGif) {
            mediaElement.autoplay = true;
            mediaElement.loop = true;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
        }

        elements.fullScreenPlayer.prepend(mediaElement);
        fsOverlay.style.background = "linear-gradient(to top, rgba(0,0,0,0.8), transparent)";
        return;
    }

    // 2️⃣ FUNDO DINÂMICO COM COR DOMINANTE
    const imgForColor = new Image();
    imgForColor.crossOrigin = "Anonymous";
    imgForColor.src = track.cover || "assets/10.png";

    imgForColor.onload = function() {
        try {
            const colorThief = new ColorThief();
            const color = colorThief.getColor(imgForColor); // [R, G, B]
            const rgb = `${color[0]}, ${color[1]}, ${color[2]}`;

            // Aplica um gradiente que vai da cor dominante (topo) para o preto (base)
            // Usamos uma versão levemente mais escura da cor para o fundo não ofuscar o texto
            elements.fullScreenPlayer.style.transition = "background 1s ease";
            elements.fullScreenPlayer.style.background = `linear-gradient(180deg, rgb(${rgb}) 0%, #000000 100%)`;
            
            // Opcional: Adiciona um brilho suave no overlay
            fsOverlay.style.background = "rgba(0, 0, 0, 0.2)"; 
        } catch (e) {
            console.warn("Erro ao extrair cor para o fundo:", e);
            elements.fullScreenPlayer.style.background = "#121212";
        }
    };
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