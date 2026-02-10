function initializeRouting() {
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    let page = 'home';
    let id = null;

    // 1. Divide o caminho em partes (ex: ["album", "123"])
    const pathParts = pathname.split('/').filter(p => p !== "" && p !== "menu.html");

    if (pathParts.length > 0) {
        page = pathParts[0]; 
        id = pathParts[1] || null;
    } 
    // 2. Fallback para ?page= (Localhost)
    else if (urlParams.has('page')) {
        page = urlParams.get('page');
        id = urlParams.get('id');
    }

    // Limpeza de segurança para evitar loops ou carregar arquivos errados
    if (page.includes('.html')) page = page.replace('.html', '');
    if (page === 'menu' || page === 'index' || !page) page = 'home';

    console.log(`🚀 Roteamento inicial detectado: Página [${page}] ID [${id}]`);
    
    // Carrega o conteúdo sem criar um novo histórico (false)
    loadContent(page, id, false);
}

/**
 * Escuta o botão voltar/avançar do navegador.
 */
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page) {
        console.log("⬅️ Voltando para:", e.state.page);
        loadContent(e.state.page, e.state.id, false);
    } else {
        // Fallback: se não houver estado, tenta reconstruir pela URL atual
        initializeRouting();
    }
});

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, Timestamp, deleteDoc, collection, addDoc, query, onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, limit, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Configuração do Firebase para a sua aplicação web (APENAS ESTA SEÇÃO)
const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.appspot.com",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};


// -------------------------------
// 🔥 Inicialização do Firebase
// -------------------------------
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const rtdb = getDatabase(app); // Inicializa o Realtime Database

// -------------------------------
// ☁️ Cloudinary (UPLOAD FRONT)
// -------------------------------
const CLOUD_NAME = "dsrrzjwuf";
const UPLOAD_PRESET = "tune_unsigned";

export async function uploadImageToCloudinary(file) {
    if (!file) throw new Error("Nenhum arquivo selecionado");

    if (file.size > 2 * 1024 * 1024) {
        throw new Error("Imagem maior que 2MB");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", "tune/posts");

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );

    const data = await res.json();

    if (!data.secure_url) {
        console.error(data);
        throw new Error("Erro no upload");
    }

    return data.secure_url;
}



// UID do usuário atual (apenas referência, sem bloqueio)
let currentUserUid = null;
// Única linha necessária para o cache no topo do arquivo ou antes das funções:
window.__HOME_CACHE__ = window.__HOME_CACHE__ || { 
    loaded: false, 
    html: null, 
    scrollPosition: 0 
};

function rebindHomeUI() {
    try {
        setGreeting(); 
    } catch (e) {
        console.warn("Erro ao definir saudação:", e);
    }

    // Procura todos os elementos com data-navigate e garante o clique
    document.querySelectorAll('[data-navigate]').forEach(el => {
        el.onclick = (e) => {
            e.preventDefault();
            const page = el.getAttribute('data-navigate');
            const id = el.getAttribute('data-id');
            loadContent(page, id);
        };
    });
}


// Adicione estas definições para evitar o erro de ReferenceError
function setupReleasesPage() {
    console.log("Iniciando setup da página de lançamentos...");
    listarMusicasArtista();
    listarAlbunsArtista();
}

function setupAddMusicPage() {
    console.log("Iniciando setup da página de nova música...");
    carregarAlbunsNoSelect();
}

function setupAddAlbumPage() {
    console.log("Iniciando setup de novo álbum...");
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;

        // --- LÓGICA DO CARD DE ARTISTA (VERSÃO BOOLEAN) ---
        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userDocRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log("Status artista no banco:", userData.artista);

                // Verificação para boolean puro
                if (userData.artista === true) {
                    
                    // Espera o elemento carregar no DOM (importante para SPAs/loadContent)
                    const checkExist = setInterval(() => {
                        const artistCard = document.querySelector('.artist-promo-container');
                        if (artistCard) {
                            artistCard.style.setProperty('display', 'block', 'important');
                            console.log("✅ Card de artista exibido com sucesso.");
                            clearInterval(checkExist); // Para de procurar quando encontrar
                        }
                    }, 500); // Tenta a cada 0.5 segundos

                    // Limite de segurança: para de procurar após 5 segundos para não pesar o site
                    setTimeout(() => clearInterval(checkExist), 5000);
                }
            }
        } catch (error) {
            console.error("Erro ao verificar artista:", error);
        }

        // Carrega o perfil
        if (typeof populateUserProfile === "function") {
            populateUserProfile(user);
        }
        hideLoadingAndShowContent();

    } else {
        window.location.href = "/index";
    }
});

function handleInitialRoute() {
    const params = new URLSearchParams(window.location.search);

    const page = params.get('page') || 'home';
    const id = params.get('id');

    loadContent(page, id);
}

// -------------------------------
// 🎬 Remove loading e mostra app
// -------------------------------
function hideLoadingAndShowContent() {
    const mainContent = document.getElementById('main-content');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (mainContent) {
        mainContent.classList.add('loaded');
    }

    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

controlarFluxoManutencaoFirestore();

function controlarFluxoManutencaoFirestore() {
    console.log("Iniciando monitor de manutenção via Firestore...");

    // Referência para o documento dentro da coleção 'config' e documento 'status'
    const manutencaoDocRef = doc(db, 'config', 'status');

    onSnapshot(manutencaoDocRef, (snapshot) => {
        if (snapshot.exists()) {
            const dados = snapshot.data();
            const estaEmManutencao = dados.manutencao; // Pega o campo 'manutencao'
            
            console.log("Status Manutenção Firestore:", estaEmManutencao);

            const path = window.location.pathname;
            const paginaAtual = path.substring(path.lastIndexOf('/') + 1);
            const tela = document.getElementById('maintenance-screen');

            if (estaEmManutencao === true) {
                if (paginaAtual !== "main" && paginaAtual !== "main") {
                    window.location.href = "main";
                    return;
                }
                if (tela) {
                    tela.style.display = 'flex';
                    tela.classList.remove('maintenance-hidden');
                    document.body.style.overflow = 'hidden';
                }
            } else {
                if (tela) {
                    tela.style.display = 'none';
                    tela.classList.add('maintenance-hidden');
                    document.body.style.overflow = '';
                }
            }
        } else {
            console.warn("⚠️ Documento 'config/status' não encontrado no Firestore!");
        }
    }, (error) => {
        console.error("Erro ao ouvir Firestore:", error);
    });
}

/**
 * 2. Função para preencher a interface com os dados do usuário.
 * @param {firebase.User} user - O objeto de usuário retornado pelo Firebase Auth.
 */
async function populateUserProfile(user) {
    // Imagem de fallback do seu novo HTML
    const DEFAULT_PROFILE_PIC = "./assets/artistpfp.png"; 
    
    
    if (user) {
        const uid = user.uid;
        

        // Variáveis que serão preenchidas
        let nomeArtistico = "Carregando Nome...";
        let apelido = "Carregando ID...";
        let profilePicURL = DEFAULT_PROFILE_PIC;
        let email = user.email;

        // --- 2.2. OBTENDO TODOS OS DADOS DO DOCUMENTO FIRESTORE ---
       try {
    // 💡 IMPORTANTE: MUDE "users" PARA O NOME EXATO DA SUA COLEÇÃO NO FIRESTORE (EX: "Users", "Perfis", "clientes")
    const collectionPath = "usuarios"; // <-- Corrija o nome desta coleção!
    const userDocRef = doc(db, collectionPath, uid); 
    
    
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        
        const userData = userDoc.data();
        
        // Mapeamento das chaves do Firestore
        nomeArtistico = userData.nomeArtistico || user.displayName || 'Artista Desconhecido';
        profilePicURL = userData.foto || user.photoURL || DEFAULT_PROFILE_PIC; 
        apelido = userData.apelido || uid; 
        email = userData.email || user.email;
        
       
        
    } else {
        console.log("ALERTA: Documento do Firestore NÃO encontrado. Usando fallbacks.");
        // Fallbacks: usa o que está no Auth ou o valor padrão
        nomeArtistico = user.displayName || 'Artista Desconhecido';
        apelido = uid;
        profilePicURL = user.photoURL || DEFAULT_PROFILE_PIC;
    }
} catch (error) {
            console.error("ERRO FATAL AO BUSCAR DADOS DO FIRESTORE:", error);
            // Fallbacks em caso de erro de permissão ou conexão
            nomeArtistico = user.displayName || 'Erro ao carregar nome';
            apelido = uid;
            profilePicURL = user.photoURL || DEFAULT_PROFILE_PIC;
        }

        // --- 2.3. INJETANDO DADOS NO HTML ---
        
        // Foto de Perfil
        const profilePic = document.querySelector('.profile-pic');
        if (profilePic) {
            profilePic.src = profilePicURL;
            profilePic.alt = `Foto de Perfil de ${nomeArtistico}`;
        }
        
        // Nome de Exibição
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.textContent = nomeArtistico;
        }

        // Nome de Usuário (Apelido)
        const usernameValue = document.querySelector('.account-details .detail-item:not(.email-item) .detail-value');
        if (usernameValue) {
            usernameValue.textContent = apelido;
        }
        
        // E-mail
        const emailValue = document.querySelector('.email-item .detail-value');
        if (emailValue) {
            emailValue.textContent = email;
        }
        
        // Se a seção do plano fosse dinâmica, ela seria atualizada aqui:
        // document.querySelector('.plan-name').textContent = 'Premium';
        // document.querySelector('.plan-description').textContent = 'Assinatura mensal';


    } else {
        console.log("STATUS: Usuário não está logado.");
    }
    
}

// === SISTEMA DE FILA DE REPRODUÇÃO ===

// Array global da fila
let playbackQueue = JSON.parse(localStorage.getItem("playbackQueue")) || [];
let currentTrackIndex = 0;

// --- Atualiza o LocalStorage ---
function saveQueue() {
    localStorage.setItem("playbackQueue", JSON.stringify(playbackQueue));
}

// --- Renderiza o Popup da Fila ---
function renderQueuePopup() {
    const queueList = document.getElementById("queue-list");
    queueList.innerHTML = "";

    if (playbackQueue.length === 0) {
        queueList.innerHTML = `<li class="p-3 text-gray-400 text-sm text-center">Fila vazia</li>`;
        return;
    }

    playbackQueue.forEach((track, index) => {
        const li = document.createElement("li");
        li.className = "p-3 flex justify-between items-center group hover:bg-white/10 cursor-pointer transition-all";

        li.innerHTML = `
            <div>
                <p class="text-sm font-medium text-white group-hover:text-green-400">${track.title}</p>
                <p class="text-xs text-gray-400">${track.artist}</p>
            </div>
            <div class="flex gap-2">
                <button class="text-gray-400 hover:text-white move-up" data-index="${index}">⬆</button>
                <button class="text-gray-400 hover:text-white move-down" data-index="${index}">⬇</button>
                <button class="text-gray-400 hover:text-red-400 remove-track" data-index="${index}">✕</button>
            </div>
        `;

        // Tocar música ao clicar
        li.addEventListener("click", () => playFromQueue(index));

        queueList.appendChild(li);
    });
}

// --- Adiciona músicas na fila (usado ao clicar no Play do álbum ou faixa) ---
function addToQueue(tracks, startIndex = 0) {
    playbackQueue = tracks.map(t => ({
        title: t.title,
        artist: t.artistName || t.artist || "Desconhecido",
        audioUrl: t.audioUrl,
        cover: t.cover || "./assets/default-cover.png"
    }));

    currentTrackIndex = startIndex;
    saveQueue();
    renderQueuePopup();
    playFromQueue(startIndex);
}

// --- Tocar a música atual da fila ---
function playFromQueue(index) {
    if (!playbackQueue[index]) return;
    currentTrackIndex = index;

    const track = playbackQueue[index];
    localStorage.setItem("currentTrack", JSON.stringify(track));
    window.dispatchEvent(new Event("storage"));
    console.log("🎧 Tocando:", track.title);
}

// --- Controles da Fila ---
document.addEventListener("click", (e) => {
    const btn = e.target;

    // Mover pra cima
    if (btn.classList.contains("move-up")) {
        const i = parseInt(btn.dataset.index);
        if (i > 0) {
            [playbackQueue[i], playbackQueue[i - 1]] = [playbackQueue[i - 1], playbackQueue[i]];
            saveQueue();
            renderQueuePopup();
        }
    }

    // Mover pra baixo
    if (btn.classList.contains("move-down")) {
        const i = parseInt(btn.dataset.index);
        if (i < playbackQueue.length - 1) {
            [playbackQueue[i], playbackQueue[i + 1]] = [playbackQueue[i + 1], playbackQueue[i]];
            saveQueue();
            renderQueuePopup();
        }
    }

    // Remover da fila
    if (btn.classList.contains("remove-track")) {
        const i = parseInt(btn.dataset.index);
        playbackQueue.splice(i, 1);
        saveQueue();
        renderQueuePopup();
    }
});

const queuePopup = document.getElementById("queue-popup");
const closeQueue = document.getElementById("close-queue");

// Função para abrir/fechar popup da fila
function toggleQueuePopup() {
    if (!queuePopup) return;
    queuePopup.classList.toggle("hidden");
}

// Delegação de clique para abrir popup
document.addEventListener("click", (e) => {
    const queueButton = e.target.closest("#queue-btn");
    if (queueButton) {
        e.stopPropagation();
        toggleQueuePopup();
    }
});

// Botão de fechar
if (closeQueue) {
    closeQueue.addEventListener("click", () => {
        queuePopup.classList.add("hidden");
    });
}

// Fecha popup se clicar fora
document.addEventListener("click", (e) => {
    if (queuePopup && !queuePopup.contains(e.target) && !e.target.closest("#queue-btn")) {
        queuePopup.classList.add("hidden");
    }
});



// --- Funções de Ajuda e Utilitários ---

function applyDominantColorToHeader(imgElement, headerElement) {
    if (!imgElement || !headerElement) {
        console.warn("Elementos de imagem ou cabeçalho não fornecidos para extração de cor.");
        return;
    }
    if (!imgElement.complete) {
        return;
    }
    try {
        if (typeof ColorThief === 'undefined') {
            console.error("ColorThief não está carregado. Certifique-se de que a CDN está no seu HTML.");
            headerElement.style.background = 'linear-gradient(to bottom, #1a1a1a, #121212)';
            return;
        }
        const colorThief = new ColorThief();
        const dominantColor = colorThief.getColor(imgElement);
        if (dominantColor) {
            const color1 = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
            const darkerColor = `rgb(${Math.floor(dominantColor[0] * 0.5)}, ${Math.floor(dominantColor[1] * 0.5)}, ${Math.floor(dominantColor[2] * 0.5)})`;
            headerElement.style.background = `linear-gradient(to bottom, ${color1}, ${darkerColor}, #121212 85%)`;
        } else {
            console.warn("Não foi possível extrair cores da imagem. Usando gradiente padrão.");
            headerElement.style.background = 'linear-gradient(to bottom, #1a1a1a, #121212)';
        }
    } catch (e) {
        console.error("Erro ao usar ColorThief:", e);
        headerElement.style.background = 'linear-gradient(to bottom, #1a1a1a, #121212)';
    }
}

/**
 * Calcula a soma total de streams de todas as músicas de um artista.
 * @param {string} artistId O UID do artista.
 * @returns {number} O total de streams.
 */
async function calculateTotalStreams(artistId) {
    try {
        const musicasRef = collection(db, "musicas");
        
        // 1. Consulta todas as músicas desse artista
        const q = query(
            musicasRef, 
            where("artist", "==", artistId) // Filtra todas as músicas pelo UID
        );
        
        // **IMPORTANTE**: Certifique-se de que getDocs está importado do firebase/firestore
        const querySnapshot = await getDocs(q);
        let totalStreams = 0;

        // 2. Soma o campo 'streams' de cada documento
        querySnapshot.forEach((doc) => {
            const streams = doc.data().streams || 0;
            totalStreams += streams;
        });

        return totalStreams;
    } catch (error) {
        console.error("Erro ao calcular total de streams:", error);
        return 0;
    }
}

const artistCache = {}; // Cache para performance

async function getArtistName(artistUid) {
    if (!artistUid) return "Desconhecido";
    
    if (artistCache[artistUid]) return artistCache[artistUid];
    
    try {
        const artistRef = doc(db, "usuarios", artistUid);
        const artistSnap = await getDoc(artistRef);

        if (artistSnap.exists()) {
            const data = artistSnap.data();
            // AJUSTE: Usando a chave 'nomeArtistico' conforme seu banco
            const name = data.nomeArtistico || data.displayName || data.name || "Artista";
            
            artistCache[artistUid] = name;
            return name;
        }
        return "Artista não encontrado";
    } catch (error) {
        console.error("Erro ao buscar nome do artista:", error);
        return "Erro ao carregar";
    }
}

function getTrendIndicator(lastStreamDate) {
    // Se não houver data, tratamos como música nova (NEW)
    if (!lastStreamDate) {
        return '<span style="color: #60a5fa; font-size: 9px; font-weight: bold; display: block; line-height: 1;">NEW</span>';
    }

    try {
        const now = new Date();
        // Converte o Timestamp do Firestore com segurança
        const lastDate = (typeof lastStreamDate.toDate === 'function') 
                         ? lastStreamDate.toDate() 
                         : new Date(lastStreamDate);
        
        const diffInMs = now - lastDate;
        
        // --- NOVA LÓGICA: 7 HORAS ---
        const sevenHoursInMs = 7 * 60 * 60 * 1000;

        if (diffInMs < sevenHoursInMs) {
            // Reproduzida há menos de 7h: Verde (Subindo)
            return '<span style="color: #4ade80; font-size: 10px; display: block; line-height: 1;">▲</span>';
        } else {
            // NÃO reproduzida nas últimas 7h: Vermelha (Caindo)
            return '<span style="color: #f87171; font-size: 10px; display: block; line-height: 1;">▼</span>';
        }
    } catch (e) {
        console.error("Erro ao calcular tendência:", e);
        return '';
    }
}

// --- Setup Página Playlist Completo (Versão Atualizada para Top 50) ---
async function setupPlaylistPage(playlistId) {
    const playlistImgDetail = document.getElementById("playlist-cover-detail");
    const playlistTitleDetail = document.getElementById("playlist-title-detail");
    const playlistDescriptionDetail = document.getElementById("playlist-description-detail");
    const tracksContainer = document.getElementById("tracks-container");
    const playlistBg = document.getElementById("playlist-bg"); 
    const priorityNames = ["Top 50 Brasil", "Top 50", "Top 50 World", "Daily Top 50"];
    
    const fallbackBackground = 'linear-gradient(to bottom, #1a1a1a, #030303)';
    const fallbackImage = 'https://i.ibb.co/HTCFR8Db/Design-sem-nome-4.png'; 

    if (!playlistId) return;

    try {
        const playlistRef = doc(db, "playlists", playlistId);
        const playlistSnap = await getDoc(playlistRef);

        if (!playlistSnap.exists()) {
            if (playlistTitleDetail) playlistTitleDetail.textContent = "Playlist não encontrada";
            tracksContainer.innerHTML = `<p class="text-gray-400">Não foi possível carregar esta playlist.</p>`;
            return;
        }

        const playlist = { id: playlistSnap.id, ...playlistSnap.data() };
        
        const coverUrl = playlist.cover || fallbackImage;
        if (playlistTitleDetail) playlistTitleDetail.textContent = playlist.name || "Sem título";
        if (playlistDescriptionDetail) {
            playlistDescriptionDetail.textContent = playlist.category === "Stations" 
                ? "Baseada nas músicas deste artista." 
                : (playlist.description || "");
        }

        if (playlistImgDetail) playlistImgDetail.src = coverUrl;

        // Lógica ColorThief
        const colorThief = new ColorThief();
        const imgToLoad = new Image();
        imgToLoad.crossOrigin = "Anonymous"; 
        imgToLoad.src = coverUrl;

        imgToLoad.onload = () => {
            try {
                const color = colorThief.getColor(imgToLoad);
                const rgb = `${color[0]}, ${color[1]}, ${color[2]}`;
                if (playlistBg) {
                    playlistBg.style.background = `linear-gradient(to bottom, rgb(${rgb}) 0%, rgba(${rgb}, 0.4) 40%, #030303 100%)`;
                }
            } catch (e) {
                if (playlistBg) playlistBg.style.background = "#030303";
            }
        };

        

      function isPortuguese(title) {
    if (!title) return false;
    // Detecta acentos brasileiros e cedilha (exclusivos do PT-BR)
    const temAcentuacao = /[áàâãéêíóôõúç]/i.test(title);
    if (temAcentuacao) return true;

    // Palavras curtas muito comuns no PT-BR
    const palavrasBR = ["o", "a", "os", "as", "do", "da", "no", "na", "com", "para", "pra", "pro", "que", "você", "te", "meu", "amanhã", "encontro"];
    const palavrasNoTitulo = title.toLowerCase().split(/\s+/);
    return palavrasNoTitulo.some(p => palavrasBR.includes(p));
}

// ... dentro da sua função setupPlaylistPage ...

        let tracks = [];
        const automaticTopNames = ["Top 50", "Daily Top 50", "Top 50 Brasil", "Top 50 World"]; 
        const isRecentReleases = ["Novidades da Semana", "Novidades", "Lançamentos da Semana"].includes(playlist.name);
        const isAutomaticTop = automaticTopNames.includes(playlist.name) && playlist.category === "Charts";
        
        const generosBR = ["Sertanejo", "Funk", "Pagode", "MPB", "Forró", "Arrocha"]; 

        // --- A) Charts Automáticos (Top 50 / Brasil / World) ---
        if (isAutomaticTop) {
            const isBrasilChart = playlist.name.includes("Brasil");
            const isWorldChart = playlist.name.includes("World");

            // Buscamos um limite maior (ex: 200) para ter margem de filtragem no JS
            const q = query(
                collection(db, "musicas"), 
                orderBy("streamsMensal", "desc"), 
                limit(200) 
            );
            
            const snap = await getDocs(q);
            let rawTracks = [];
            snap.forEach((d) => rawTracks.push({ id: d.id, ...d.data() }));

            if (isBrasilChart) {
                // FILTRAGEM JS PARA O BRASIL: Gênero OU Título em Português
                tracks = rawTracks.filter(m => {
                    const porGenero = generosBR.includes(m.genre);
                    const porTitulo = isPortuguese(m.title);
                    return porGenero || porTitulo;
                }).slice(0, 50);
            } 
            else if (isWorldChart) {
                // FILTRAGEM JS PARA WORLD: Nem gênero BR nem título em Português
                tracks = rawTracks.filter(m => {
                    const porGenero = generosBR.includes(m.genre);
                    const porTitulo = isPortuguese(m.title);
                    return !porGenero && !porTitulo;
                }).slice(0, 50);
            } 
            else {
                // TOP 50 GLOBAL: Apenas as 50 mais ouvidas sem filtro
                tracks = rawTracks.slice(0, 50);
            }
        } 
        
        // --- B) Lançamentos Recentes ---
        else if (isRecentReleases) {
            // ... (seu código de lançamentos permanece igual)
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - 3);
            const q = query(collection(db, "musicas"), where("timestamp", ">=", dataLimite), limit(50));
            const snap = await getDocs(q);
            snap.forEach((d) => tracks.push({ id: d.id, ...d.data() }));
            tracks.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
        }

        // --- C) Artist Stations ---
        else if (playlist.uidars) {
            const q = query(collection(db, "musicas"), where("artist", "==", playlist.uidars), limit(30));
            const snap = await getDocs(q);
            snap.forEach((d) => tracks.push({ id: d.id, ...d.data() }));
        } 

        // --- D) Playlists Manuais ---
        else {
            const subColRef = query(collection(db, `playlists/${playlistId}/musicas`), limit(50));
            const subSnap = await getDocs(subColRef);

            if (!subSnap.empty) {
                subSnap.forEach((d) => tracks.push({ id: d.id, ...d.data() }));
            } 
            else if (playlist.track_ids?.length > 0) {
                const lotes = [playlist.track_ids.slice(0, 30)];
                for (const ids of lotes) {
                    const q = query(collection(db, "musicas"), where("__name__", "in", ids));
                    const snapIn = await getDocs(q);
                    snapIn.forEach(d => tracks.push({ id: d.id, ...d.data() }));
                }
            }
        }

        // 5. Ordenação e Renderização
        if (!isAutomaticTop && !playlist.uidars) { 
            tracks.sort((a, b) => (a.trackNumber || 99) - (b.trackNumber || 99));
        }

        renderTracksSpotifyStyle(tracks, playlist, isAutomaticTop);

    } catch (error) {
        console.error("Erro ao carregar playlist:", error);
        if (playlistTitleDetail) playlistTitleDetail.textContent = "Erro ao Carregar";
    }
}

async function toggleLike(type, itemId, buttonElement) {
    // Verifica se o usuário está logado
   if (!currentUserUid || !itemId) {
        alert("Você precisa estar logado para interagir.");
        console.warn("Tentativa de curtir falhou: currentUserUid ou itemId ausente.");
        return;
    }

    try {
        const userLikesRef = collection(db, `usuarios/${currentUserUid}/curtidas`);
        const q = query(userLikesRef, where("itemId", "==", itemId), where("type", "==", type));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // CURTIR
            await addDoc(userLikesRef, {
                itemId: itemId,
                type: type, // 'music' ou 'album'
                timestamp: new Date()
            });
            updateLikeButtonState(buttonElement, true);
            console.log(`Curtida ADICIONADA: ${type} - ${itemId}. Enviado para Firestore.`);
            
            // ⭐ CHAMADA DO TOAST AO CURTIR ⭐
            if (type === 'music') {
                showToast('Adicionado a Músicas Curtidas.', 'like');
            } else if (type === 'album') {
                showToast('Álbum adicionado à sua biblioteca.', 'like');
            }
            
        } else {
            // DESCURTIR
            const docToDelete = querySnapshot.docs[0];
            await deleteDoc(doc(db, `usuarios/${currentUserUid}/curtidas`, docToDelete.id));
            updateLikeButtonState(buttonElement, false);
            console.log(`Curtida REMOVIDA: ${type} - ${itemId}. Deletado do Firestore.`);
            
            // ⭐ CHAMADA DO TOAST AO DESCURTIR ⭐
            showToast('', 'unlike'); 
        }
    } catch (error) {
        console.error("ERRO GRAVE ao processar curtida no Firestore:", error);
        alert("Ocorreu um erro ao salvar sua curtida. Verifique o console.");
        // ⭐ CHAMADA DO TOAST DE ERRO ⭐
        showToast('Ocorreu um erro ao salvar sua curtida.', 'error');
    }
}

async function checkAndSetLikeState(type, itemId, buttonElement) {
    if (!currentUserUid || !itemId || !buttonElement) {
        // Define o estado visual como "não curtido" se não houver UID
        updateLikeButtonState(buttonElement, false); 
        return;
    }
    
    try {
        const userLikesRef = collection(db, `usuarios/${currentUserUid}/curtidas`);
        const q = query(userLikesRef, where("itemId", "==", itemId), where("type", "==", type));
        const querySnapshot = await getDocs(q);

        const isLiked = !querySnapshot.empty;
        updateLikeButtonState(buttonElement, isLiked);
    } catch (error) {
        console.error("Erro ao checar estado de curtida:", error);
        updateLikeButtonState(buttonElement, false);
    }
}

function updateLikeButtonState(button, isLiked) {
    if (!button) return;
    const img = button.querySelector('img');
    const iconBase = "./assets/like.svg";
    const iconLiked = "./assets/favorite_50dp_9DC384_FILL1_wght400_GRAD0_opsz48.svg";

    if (isLiked) {
        img.src = iconLiked;
        button.classList.add('is-liked');
        // Garante que o ícone fique visível (reverte a opacidade do hover)
        button.classList.remove('opacity-0', 'group-hover:opacity-100'); 
    } else {
        img.src = iconBase;
        img.style.filter = "none";
        button.classList.remove('is-liked');
        // Restaura a opacidade para aparecer apenas no hover
        if (button.closest('.group')) {
            button.classList.add('opacity-0', 'group-hover:opacity-100');
        }
    }
}

function showToast(message, type = 'default') {
    const toast = document.getElementById('app-toast');
    const msgElement = document.getElementById('toast-message');
    const iconElement = document.getElementById('toast-icon');
    
    // ⭐ CORREÇÃO 1: Trata o elemento que pode estar faltando no HTML.
    const actionElement = document.getElementById('toast-action'); 
    
    // ⚠️ Verifica se os elementos essenciais existem
    if (!toast || !msgElement) return;

    // 1. Define a mensagem e esconde a ação por padrão
    msgElement.textContent = message;
    
    // ⭐ CORREÇÃO 2: Usa Optional Chaining (?) para manipular 'actionElement' apenas se ele não for null.
    actionElement?.classList.add('hidden'); 
    iconElement.style.display = 'block';

    // 2. Lógica específica para o tipo 'like' e 'unlike'
    if (type === 'like' && actionElement) { // Verifica a existência antes de usar
        actionElement.textContent = 'Mudar';
        actionElement.classList.remove('hidden');
        actionElement.onclick = (e) => {
            e.preventDefault();
            window.location.href = actionElement.href; 
            toast.classList.add('opacity-0', 'translate-y-full');
            clearTimeout(window.toastTimer);
        };
    } else if (type === 'unlike') {
        iconElement.style.display = 'none'; 
        msgElement.textContent = 'Removido das suas músicas curtidas.';
    }

    // 3. Exibe o toast
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-full');
        toast.classList.add('translate-y-0');
    });

    // 4. Temporizador para ocultar (5 segundos)
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-full');
        toast.classList.remove('translate-y-0');
    }, 5000);
}

async function renderTracksSpotifyStyle(tracks, playlist, isChart = false) { 
    const tracksContainer = document.getElementById("tracks-container");
    tracksContainer.innerHTML = "";

    if (!tracks || !tracks.length) {
        tracksContainer.innerHTML = `<p class="text-gray-400 p-4 font-reg">Nenhuma música encontrada.</p>`;
        return;
    }

    const listWrapper = document.createElement("div");
    listWrapper.className = "flex flex-col w-full space-y-1"; 

    const now = new Date();

    for (const [index, track] of tracks.entries()) {
        try {
            const trackId = track.id; 
            if (!trackId) continue;

            // 1. Lógica de Agendamento/Bloqueio
            const scheduledDate = track.scheduledTime && track.scheduledTime !== "Imediato" 
                                  ? new Date(track.scheduledTime) : null;
            const isLocked = scheduledDate && scheduledDate > now;

            const coverUrl = track.cover || playlist.cover || './assets/default-cover.png';
            
            // 2. Lógica da Seta (Só aparece se for um Chart e não estiver bloqueado)
            const trendIcon = (isChart && !isLocked) ? getTrendIndicator(track.lastMonthlyStreamDate) : "";

            const trackRow = document.createElement("div");
            trackRow.className = `track-item group ${isLocked ? 'opacity-30 pointer-events-none grayscale-[0.5]' : 'hover:bg-white/10 cursor-pointer'} flex items-center py-2 px-2 rounded-md transition duration-200`;

            trackRow.innerHTML = `
                <div class="flex flex-col items-center justify-center w-10 min-w-[40px] mr-2">
                    <span class="text-gray-500 text-sm group-hover:text-white font-medium">
                        ${isLocked ? "<i class='bx bxs-lock-alt text-xs'></i>" : (index + 1)}
                    </span>
                    ${trendIcon}
                </div>

                <div class="relative flex-shrink-0">
                    <img src="${coverUrl}" class="w-12 h-12 rounded object-cover ${isLocked ? 'brightness-50' : 'shadow-lg'}">
                </div>

                <div class="track-info-container flex flex-col justify-center min-w-0 ml-4 flex-grow">
                    <span class="text-white text-base font-bold flex items-center gap-2 truncate" style="font-family: 'Nationale Bold';">
                        ${track.title || 'Sem título'}
                        ${isLocked ? '<span class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-normal">EM BREVE</span>' : ''}
                    </span>
                    <div class="text-gray-400 text-sm artist-name-field truncate" style="font-family: 'Nationale Regular';">
                        ${track.artistName || 'Carregando...'}
                    </div>
                </div>

                <div class="text-gray-400 text-xs text-right font-mono ml-4">
                    ${isLocked ? '--:--' : (track.duration || '--:--')}
                </div>
            `;

            // Carregamento assíncrono do nome do artista
            getArtistName(track.artist).then(name => {
                const nameField = trackRow.querySelector('.artist-name-field');
                if (nameField) nameField.textContent = name;
            });

            // 3. Evento de Clique
            if (!isLocked) {
                trackRow.addEventListener("click", (e) => {
                    // Impede o clique se for no botão de curtir (se você adicionar um depois)
                    if (e.target.closest('.track-like-button')) return;

                    if (typeof checkAndResetMonthlyStreams === 'function') {
                        checkAndResetMonthlyStreams(track.id); 
                    }
                    
                    if (window.playTrackGlobal) {
                        window.playTrackGlobal(track);
                    }
                });
            }

            listWrapper.appendChild(trackRow);

        } catch (error) {
            console.error("Erro na renderização da faixa:", error);
        }
    }
    tracksContainer.appendChild(listWrapper);
}

// Função para iniciar a contagem regressiva
function startCountdown(releaseDateString, coverUrl) {
    const countdownContainer = document.getElementById('countdown-container');
    const releaseDate = new Date(releaseDateString).getTime();
    
    // Se não encontrou o container, sai.
    if (!countdownContainer) return;
    
    // Limpa qualquer timer anterior
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }

    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = releaseDate - now;

        if (distance <= 0) {
            clearInterval(window.countdownInterval);
            countdownContainer.innerHTML = '';
            countdownContainer.classList.add('hidden');
            // Você pode adicionar uma mensagem de "Álbum Lançado!" aqui se quiser
            return;
        }
        
        // Cálculos de tempo
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

// Estrutura HTML do contador (Corrigida com Separadores)
countdownContainer.innerHTML = `
    <div class="countdown-box">

        <div class="countdown-segment">
            <span class="countdown-value">${days}</span>
            <span class="countdown-label">Dias</span>
        </div>
        
        <div class="countdown-separator"></div> <div class="countdown-segment">
            <span class="countdown-value">${hours}</span>
            <span class="countdown-label">Horas</span>
        </div>
        
        <div class="countdown-separator"></div> <div class="countdown-segment">
            <span class="countdown-value">${minutes}</span>
            <span class="countdown-label">Min</span>
        </div>
        
        <div class="countdown-separator"></div> <div class="countdown-segment">
            <span class="countdown-value">${seconds}</span>
            <span class="countdown-label">Seg</span>
        </div>
    </div>
`;
        
        // Remove 'hidden' para exibir
        countdownContainer.classList.remove('hidden');
    };

    // Atualiza imediatamente e depois a cada segundo
    updateCountdown();
    window.countdownInterval = setInterval(updateCountdown, 1600);
}
// 1. Criamos um objeto global único que sobrevive à troca de páginas no loadContent
if (!window.streamGuard) {
    window.streamGuard = {
        lastGlobalStreamTime: 0,
        userStreamHistory: new Map()
    };
}

async function checkAndResetMonthlyStreams(musicId) {
    if (!musicId) return;

    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    const now = Date.now();
    const trackKey = `${userId}_${musicId}`;

    // --- 1. VERIFICAÇÃO GLOBAL (DENTRO DO OBJETO PERSISTENTE) ---
    // Impede clicar em QUALQUER música em menos de 5 segundos (aumentei para garantir)
    const GLOBAL_COOLDOWN = 20000; 
    const timeSinceLastAnyMusic = now - window.streamGuard.lastGlobalStreamTime;

    if (timeSinceLastAnyMusic < GLOBAL_COOLDOWN) {
                return;
    }

    // --- 2. VERIFICAÇÃO POR MÚSICA ESPECÍFICA (7 SEGUNDOS) ---
    const MIN_CLICK_INTERVAL = 20000; 
    if (window.streamGuard.userStreamHistory.has(trackKey)) {
        const lastPlayTime = window.streamGuard.userStreamHistory.get(trackKey);
        if (now - lastPlayTime < MIN_CLICK_INTERVAL) {
                       return;
        }
    }

    // --- 3. REGISTRO NO OBJETO GLOBAL ANTES DE ENVIAR AO BANCO ---
    window.streamGuard.lastGlobalStreamTime = now; 
    window.streamGuard.userStreamHistory.set(trackKey, now);

    try {
        const musicRef = doc(db, "musicas", musicId);
        // ... (resto do seu código de updateDoc igual)
        
        const minBoost = 10000;
    const maxBoost = 30000;
    const streamBoost = Math.floor(Math.random() * (maxBoost - minBoost + 1)) + minBoost;

    await updateDoc(musicRef, {
        streams: increment(streamBoost),
        streamsMensal: increment(streamBoost),
        lastMonthlyStreamDate: new Date()
    });

        console.log(`🚀 +${streamBoost.toLocaleString()} streams validados.`);

    } catch (error) {
        console.error("❌ Erro:", error);
        // Se der erro, limpa para permitir tentar de novo
        window.streamGuard.lastGlobalStreamTime = 0;
        window.streamGuard.userStreamHistory.delete(trackKey);
    }
}
// Função para carregar e exibir as playlists com mais streams
async function loadTopStreamedPlaylists() {
    const listElement = document.getElementById('top-playlists-list');
    const loadingMessage = document.getElementById('top-playlists-loading-message');
    const rowElementId = 'top-playlists-list';
    const scrollContainerId = 'top-playlists'; 

    // Exibir mensagem de carregamento
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (listElement) listElement.innerHTML = ''; // Limpa conteúdo anterior

    try {
        const playlistsRef = collection(db, "playlists");
        
        // Query: ordenar por 'streams' (descendente) e limitar a 20 ⭐ ALTERADO AQUI ⭐
        const q = query(playlistsRef, orderBy("streams", "desc"), limit(20));
        
        const querySnapshot = await getDocs(q);
        const playlists = [];

        querySnapshot.forEach((doc) => {
            playlists.push({ id: doc.id, ...doc.data() });
        });

        if (playlists.length > 0) {
            // Renderiza os cards das playlists (usando a função renderCardRow fornecida anteriormente)
            renderCardRow(rowElementId, playlists, 'playlist'); 
            
            // ... (Configuração de rolagem, se você tiver) ...
        } else {
            listElement.innerHTML = `<div class="loading-text">Nenhuma playlist encontrada.</div>`;
        }

    } catch (error) {
        console.error("Erro ao carregar playlists mais ouvidas:", error);
        if (listElement) listElement.innerHTML = `<div class="loading-text text-red-500">Erro ao carregar playlists.</div>`;
    } finally {
        // Ocultar mensagem de carregamento
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

// =========================================================================
// NOVAS FUNÇÕES DE COMPARTILHAMENTO E META TAGS
// =========================================================================

/**
 * Atualiza as meta tags Open Graph e Twitter Card.
 * ESSENCIAL para o link mostrar a capa e o nome do álbum em apps como Instagram/WhatsApp.
 */
function updateMetaTags(title, description, imageUrl, url) {
    const updateTag = (property, content, isName = false) => {
        const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
        let tag = document.querySelector(selector);
        if (!tag) {
            tag = document.createElement('meta');
            if (isName) {
                tag.setAttribute('name', property);
            } else {
                tag.setAttribute('property', property);
            }
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
    };

    // Meta Tags Open Graph (para WhatsApp, Facebook, etc.)
    updateTag('og:title', title);
    updateTag('og:description', description);
    updateTag('og:image', imageUrl);
    updateTag('og:url', url);
    
    // Meta Tags Twitter Card (para Twitter/X)
    updateTag('twitter:card', 'summary_large_image', true);
    updateTag('twitter:title', title, true);
    updateTag('twitter:image', imageUrl, true);
    updateTag('twitter:description', description, true);
}

/**
 * Remove as meta tags dinâmicas para reverter o link preview
 * ao estado padrão da página principal.
 */
function clearDynamicMetaTags() {
    // Lista de todas as propriedades de meta tags que foram adicionadas
    const properties = [
        'og:title', 'og:description', 'og:image', 'og:url',
        'twitter:card', 'twitter:title', 'twitter:image', 'twitter:description'
    ];
    
    properties.forEach(prop => {
        // Remove meta tags por propriedade (Open Graph)
        let tagProp = document.querySelector(`meta[property="${prop}"]`);
        if (tagProp) {
            tagProp.remove();
        }
        
        // Remove meta tags por nome (Twitter Card)
        let tagName = document.querySelector(`meta[name="${prop}"]`);
        if (tagName) {
            tagName.remove();
        }
    });

    // Opcional: Reseta o título da aba do navegador
    // Substitua "TUNE | Música para Todos" pelo título padrão da sua aplicação
    document.title = "TUNE"; 
}


/**
 * Fallback para copiar o link para a área de transferência.
 */
async function copyLinkFallback(url, showToast) {
    try {
        await navigator.clipboard.writeText(url);
        if (showToast) {
            showToast('Link do álbum copiado para a área de transferência!', 'success');
        }
    } catch (err) {
        console.error('Erro ao copiar o link:', err);
        showToast('Erro ao copiar o link. Tente manualmente.', 'error');
    }
}


/**
 * Lida com o compartilhamento do álbum usando o Web Share API ou fallback.
 */
async function shareAlbum(albumTitle, artistName, shareUrl, showToast) {
    const shareData = {
        title: `${albumTitle} de ${artistName} | TUNE`,
        text: `Ouça "${albumTitle}" de ${artistName} na TUNE!`,
        url: shareUrl
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            // Ignora o erro se o usuário abortar o compartilhamento
            if (error.name !== 'AbortError') {
                console.error('Erro ao usar Web Share API:', error);
                copyLinkFallback(shareUrl, showToast);
            }
        }
    } else {
        copyLinkFallback(shareUrl, showToast);
    }
}

/**
 * Função principal para carregar e configurar a página do álbum.
 * @param {string} albumId - O ID único do álbum.
 */
/**
 * Carrega e configura a página de álbum (LOW COST Firestore)
 * @param {string} albumId
 */
/**
 * Carrega e configura a página de álbum mantendo o layout original
 * @param {string} albumId
 */
async function setupAlbumPage(albumId) {
    const detailHeader = document.querySelector('#album-header');
    const albumCoverDetail = document.getElementById('album-cover-detail');
    const albumTitleDetail = document.getElementById('album-title-detail');
    const artistNameDetail = document.getElementById('artist-name-detail');
    const albumYearDetail = document.getElementById('album-year-detail');
    const tracksContainer = document.getElementById('tracks-container');
    const playButton = document.querySelector('.album-actions .play');
    
    // ID CORRETO que você mencionou
    const countdownContainer = document.getElementById('countdown-container');

    if (!albumId) return;

    try {
        const albumRef = doc(db, 'albuns', albumId);
        const albumSnap = await getDoc(albumRef);

        if (!albumSnap.exists()) return;

        const albumData = albumSnap.data();
        const album = { id: albumSnap.id, ...albumData };

        // ====== LÓGICA DE DATA ======
        const now = new Date();
        // Converte a string "2026-02-27" para objeto Date
        const scheduledDate = albumData.date ? new Date(albumData.date + "T00:00:00") : null;
        const isLocked = scheduledDate && scheduledDate > now;

        // ====== PREENCHIMENTO DO HEADER ======
        albumCoverDetail.src = album.cover || './assets/default-cover.png';
        albumTitleDetail.textContent = album.album;
        artistNameDetail.textContent = album.artist;
        albumYearDetail.textContent = album.releaseYear || (scheduledDate ? scheduledDate.getFullYear() : '—');

        // ====== BLOQUEIO E SUA FUNÇÃO DE COUNTDOWN ======
        if (isLocked) {
            albumCoverDetail.style.filter = "grayscale(1) brightness(0.6)";
            
            if (playButton) {
                playButton.style.opacity = "0.3";
                playButton.style.cursor = "not-allowed";
                playButton.onclick = null;
            }

            // CHAMA A SUA FUNÇÃO ORIGINAL
            if (countdownContainer) {
                // Passamos a data e a capa como você definiu na sua startCountdown
                startCountdown(albumData.date + "T00:00:00", album.cover);
            }
        } else {
            albumCoverDetail.style.filter = "none";
            if (countdownContainer) countdownContainer.classList.add('hidden');
        }

        // ====== BUSCA E RENDERIZAÇÃO DAS TRACKS ======
        const musicQuery = query(
            collection(db, 'musicas'),
            where('album', '==', albumId),
            orderBy('trackNumber')
        );

        const musicSnap = await getDocs(musicQuery);
        const tracks = [];

        musicSnap.forEach(docSnap => {
            tracks.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Chama a renderização passando o estado isLocked
        renderAlbumTracks(tracks, isLocked);

        // Ativa play principal se liberado
        if (!isLocked && playButton && tracks.length) {
            playButton.style.opacity = "1";
            playButton.onclick = () => addToQueue(tracks);
        }

    } catch (err) {
        console.error("Erro no setupAlbumPage:", err);
    }
}
function renderAlbumTracks(tracks, isLocked) {
    const tracksContainer = document.getElementById('tracks-container');
    if (!tracksContainer) return;

    tracksContainer.innerHTML = tracks.map((track, index) => {
        const lockClass = isLocked ? "opacity-30 cursor-default" : "hover:bg-white/10 cursor-pointer group";

        return `
            <div class="track-item flex items-center p-0 rounded-md transition-colors ${lockClass}">
                <div class="w-8 text-gray-500 text-sm">${index + 1}</div>
                <img src="${track.cover || './assets/default-cover.png'}" class="w-10 h-10 rounded-md mr-4 ${isLocked ? 'grayscale' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="text-white text-sm font-medium truncate">${track.title}</div>
                    <div class="text-gray-400 text-xs truncate">${track.artistName || 'Artista'}</div>
                </div>
                <div class="text-gray-500 text-xs ml-4">
                    ${isLocked ? '<i class="bx bxs-lock-alt"></i>' : (track.duration || '--:--')}
                </div>
            </div>
        `;
    }).join('');

    if (!isLocked) {
        tracksContainer.querySelectorAll('.track-item').forEach((item, index) => {
            item.onclick = () => window.playTrackGlobal(tracks[index]);
        });
    }
}



// ... (Restante do seu código) ...

   // Botão de voltar (CORRIGIDO)
const backButton = document.getElementById('back-button');
if (backButton) {
    backButton.addEventListener('click', () => {
        if (window.history.length <= 1) {
            // Se não houver histórico anterior no seu site, manda para a home
            loadContent('home', null, true);
        } else {
            window.history.back();
        }
    });
}

    // --- Função de Formatação de Números (Streams) ---
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    // Formata o número com separadores de milhar (ex: 1.234.567)
    return num.toLocaleString('pt-BR');
}
function renderTop5Tracks(tracks, containerId) {
    const tracksContainer = document.getElementById(containerId);
    if (!tracksContainer) return;

    tracksContainer.innerHTML = `
        <h2 class="text-2xl font-bold mb-4 text-white px-2" style="font-family: 'Nationale Bold';">Populares</h2>
        <div id="top-tracks-list" class="flex flex-col w-full"></div>
    `;

    const listContainer = document.getElementById("top-tracks-list");
    
    tracks.forEach((track, index) => {
        const trackRow = document.createElement("div");
        trackRow.className = "track-item group hover:bg-white/10 transition duration-200 cursor-pointer rounded-md px-2";

        const streamsFormatted = formatNumber(track.streams || 0);

        trackRow.innerHTML = `
            <div class="text-gray-500 text-sm text-center w-8 group-hover:text-white">
                ${index + 1}
            </div>

            <img src="${track.cover}" class="w-10 h-10 rounded shadow-lg object-cover">

            <div class="flex flex-col justify-center min-w-0">
                <span class="text-white text-sm font-bold truncate">
                    ${track.title}
                </span>
                <span class="text-gray-400 text-[11px]">
                    ${streamsFormatted} streams
                </span>
            </div>

            <div class="flex justify-end items-center">
                <button class="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01"></path>
                    </svg>
                </button>
            </div>
        `;

        // --- LÓGICA DE CLIQUE (LOGS + PLAYER + STREAMS) ---
        trackRow.addEventListener("click", () => {
            
            // 1. REGISTRA O LOG NO FIRESTORE
            // Enviamos o título e o nome do artista para o log ficar completo
            if (typeof registrarLog === 'function') {
                const identificadorMusica = track.artistName ? `${track.title} - ${track.artistName}` : track.title;
                registrarLog(identificadorMusica, "Música (Populares)");
            }

            // 2. TOCA A MÚSICA NO PLAYER GLOBAL
            if (window.playTrackGlobal) {
                window.playTrackGlobal(track);
            }
            
            // 3. INCREMENTA STREAMS (BOOST)
            if (typeof checkAndResetMonthlyStreams === 'function') {
                checkAndResetMonthlyStreams(track.id);
            }
        });
        
        listContainer.appendChild(trackRow);
    });
}

let isContextLoading = false;

async function getAverageColor(imageUrl) {
    return new Promise((resolve) => {
        if (!imageUrl) return resolve('#000000');
        
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Crucial para imagens do Firebase/Cloudinary
        img.src = imageUrl;

       img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Definimos o canvas para capturar apenas a área inferior
            canvas.width = 100; // Amostra de largura maior para média melhor
            canvas.height = 10;  // Captura apenas os 10 pixels de baixo
            
            // ctx.drawImage(imagem, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            // Aqui pegamos a fatia final da imagem (img.height - 10)
            ctx.drawImage(img, 0, img.height - 10, img.width, 10, 0, 0, 100, 10);
            
            const imageData = ctx.getImageData(0, 0, 100, 10).data;
            
            let r = 0, g = 0, b = 0;
            const totalPixels = imageData.length / 4;

            for (let i = 0; i < imageData.length; i += 4) {
                r += imageData[i];
                g += imageData[i+1];
                b += imageData[i+2];
            }

            r = Math.floor(r / totalPixels);
            g = Math.floor(g / totalPixels);
            b = Math.floor(b / totalPixels);
            
            // Escurecer levemente para o modo Dark (opcional)
            const darken = 0.8;
            resolve(`rgb(${Math.floor(r * darken)}, ${Math.floor(g * darken)}, ${Math.floor(b * darken)})`);
        };
    });
}
async function setupArtistPage(artistId) {
    if (isContextLoading) return;
    isContextLoading = true;

    // 1. Referências dos Elementos
    const artistCoverBg = document.getElementById('artist-cover-bg');
    const artistNameElement = document.getElementById('artist-name');
    const artistListeners = document.getElementById('artist-listeners');
    const banIndicator = document.getElementById('ban-indicator');
    
    // Containers
    const singlesSection = document.getElementById('singles-section');
    const singlesContainer = document.getElementById('singles-container');
    const topTracksContainer = document.getElementById('top-tracks-container');
    const albumsContainer = document.getElementById('albums-container');
    const stationsContainer = document.getElementById('stations-container');

    const bannedImageURL = 'https://i.ibb.co/fzqH088Z/Captura-de-tela-2025-10-06-230858.png';

    if (!artistId) {
        isContextLoading = false;
        return;
    }

    // LIMPEZA INICIAL
    if (singlesContainer) singlesContainer.innerHTML = "";
    if (topTracksContainer) topTracksContainer.innerHTML = "";
    if (albumsContainer) albumsContainer.innerHTML = "";
    if (stationsContainer) stationsContainer.innerHTML = "";

    try {
        const artistRef = doc(db, "usuarios", artistId);
        const docSnap = await getDoc(artistRef);

        if (!docSnap.exists() || docSnap.data().artista !== "true") {
            isContextLoading = false;
            return;
        }
       
        
        const artistData = docSnap.data();
        const artistName = artistData.nomeArtistico || "Nome Desconhecido";
        const now = new Date(); // Referência de tempo atual
        
        // Lógica de Banimento
        if (artistData.banido === "true") {
            if (banIndicator) banIndicator.style.display = 'flex'; 
            artistNameElement.textContent = `${artistName} (Banido)`;
            if (artistCoverBg) artistCoverBg.style.backgroundImage = `url('${bannedImageURL}')`;
            isContextLoading = false;
            return; 
        }

        // --- CAPA E EXTRAÇÃO DE COR DOMINANTE ---
        if (artistData.foto && artistCoverBg) {
            artistCoverBg.style.backgroundImage = `url('${artistData.foto}')`;
            
            // Agora chamando o nome correto da função
            const color = await getAverageColor(artistData.foto);
            document.documentElement.style.setProperty('--artist-dominant-color', color);
        }

const verificadoStatus = String(artistData.verificado || "").toLowerCase().trim();
        const isVerified = verificadoStatus === "true";

        // --- 3. RENDERIZAÇÃO DO NOME E BADGES ---
        if (artistNameElement) {
            artistNameElement.innerHTML = `<span>${artistName}</span>` + 
                (isVerified ? 
                    `<img src="/assets/verificado.png" style="width: 35px; margin-left: 5px; display: inline-block; vertical-align: middle;" alt="Verificado">` : '') +
                (artistData.gravadora?.toLowerCase() === 'shark' ? 
                    `<img src="assets/sharklabel.png" style="width: 35px; margin-left: 12px; display: inline-block; vertical-align: middle;">` : '');
        }

        // --- 4. OUVINTES ---
        const totalStreams = await calculateTotalStreams(artistId); 
        if (artistListeners) artistListeners.textContent = `${formatNumber(totalStreams)} streams`; 

        const musicasRef = collection(db, "musicas");
        // -----------------------------------------------------------
        // 7. RENDERIZAR SINGLES (COM BLOQUEIO VISUAL)
        // -----------------------------------------------------------
        const qSingles = query(
    collection(db, "musicas"), 
    where("artist", "==", artistId), 
    where("single", "==", "true")
);

const singlesSnap = await getDocs(qSingles);

if (!singlesSnap.empty && singlesContainer) {
    singlesSection.classList.remove('hidden');
    
    // 1. Converter para Array para podermos ordenar
    let singlesList = [];
    singlesSnap.forEach(d => {
        singlesList.push({ id: d.id, ...d.data() });
    });

    // 2. ORDENAÇÃO POR DATA (AAAA-MM-DD)
    singlesList.sort((a, b) => {
        // Se usar 'date' (2020-12-11), o JS ordena perfeitamente
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA; // Mais recente primeiro
    });

    // 3. RENDERIZAÇÃO
    singlesContainer.innerHTML = ""; // Limpa antes de injetar
    
    singlesList.forEach(track => {
        const now = new Date();
        const scheduledDate = track.scheduledTime && track.scheduledTime !== "Imediato" 
                            ? new Date(track.scheduledTime) : null;
        
        // Verifica se está bloqueado pelo agendamento
        const isLocked = scheduledDate && scheduledDate > now;

        const card = document.createElement('div');
        card.className = `scroll-item flex flex-col transition-all duration-300 ${isLocked ? 'opacity-40 pointer-events-none' : 'cursor-pointer group'}`;

        // Pega o ano da data (2020-12-11 -> 2020)
        const displayYear = track.date ? track.date.split('-')[0] : 'Single';

        card.innerHTML = `
            <div class="relative aspect-square rounded-md overflow-hidden bg-[#282828] shadow-lg">
                <img src="${track.cover || './assets/default-cover.png'}" 
                     class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                ${isLocked ? `
                    <div class="absolute inset-0 flex items-center justify-center bg-black/40">
                        <i class='bx bxs-lock-alt text-white text-3xl opacity-70'></i>
                    </div>
                ` : `
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div class="w-12 h-12 bg-[#1ed760] rounded-full flex items-center justify-center shadow-2xl translate-y-2 group-hover:translate-y-0 transition-all">
                            <i class='bx bx-play text-black text-3xl ml-1'></i>
                        </div>
                    </div>
                `}
            </div>
            <div class="mt-3">
                <h3 class="text-white font-bold text-sm truncate uppercase">${track.title}</h3>
                <p class="text-gray-400 text-xs mt-1">
                    ${isLocked ? scheduledDate.toLocaleDateString() : displayYear}
                </p>
            </div>
        `;

        if (!isLocked) {
            card.onclick = () => {
                // Chama sua função global de play e a proteção de stream
                window.playTrackGlobal?.(track);
                checkAndResetMonthlyStreams(track.id); 
            };
        }
        singlesContainer.appendChild(card);
    });
        }

        // -----------------------------------------------------------
        // 8. RENDERIZAR POPULARES (FILTRANDO AGENDADOS)
        // -----------------------------------------------------------
        const qPopulares = query(musicasRef, where("artist", "==", artistId), orderBy("streams", "desc"), limit(10));
        const popularesSnap = await getDocs(qPopulares);
        
        const validTopTracks = [];

        popularesSnap.forEach(d => {
            const trackData = d.data();
            const scheduledDate = trackData.scheduledTime && trackData.scheduledTime !== "Imediato" 
                                  ? new Date(trackData.scheduledTime) : null;

            // FILTRO: Só adiciona à lista de Populares se já tiver sido lançada
            if (!scheduledDate || scheduledDate <= now) {
                if (validTopTracks.length < 5) {
                    validTopTracks.push({ id: d.id, ...trackData, artistName });
                }
            }
        });
        
        if (topTracksContainer) {
            renderTop5Tracks(validTopTracks, "top-tracks-container"); 
        }

        // 9. Outros carregamentos
        if (typeof loadArtistAlbums === 'function') await loadArtistAlbums(artistId);
        if (typeof loadArtistStations === 'function') await loadArtistStations(artistId);

    } catch (error) {
        console.error("Erro na setupArtistPage:", error);
    } finally {
        isContextLoading = false;
    }
}
function navigateTo(pageName, id = null, updateHistory = true) {
    // 1. Renderiza o conteúdo
    loadContent(pageName, id);

    // 2. URL limpa (SEM .html)
    const newUrl = `/${pageName}${id ? `?id=${id}` : ''}`;

    // 3. Histórico
    if (updateHistory) {
        history.pushState({ page: pageName, id }, '', newUrl);
    } else {
        history.replaceState({ page: pageName, id }, '', newUrl);
    }
}



/**
 * 2. Listener essencial para o botão Voltar/Avançar do navegador (popstate).
 * Dispara a navegação quando o URL muda via botões do navegador.
 */
window.addEventListener('popstate', (event) => {
    // Verifica o estado salvo. O navegador já mudou a URL, então apenas renderizamos.
    if (event.state && event.state.page) {
        const { page, id } = event.state;
        
        // Chamamos loadContent diretamente para renderizar o estado salvo.
        // Não chamamos navigateTo para evitar que ele tente manipular o histórico.
        loadContent(page, id); 
    } else {
        // Fallback: Se não houver estado (ex: primeira página do site), lê da URL e renderiza 'home'.
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page') || 'home';
        const id = urlParams.get('id');
        
        loadContent(page, id);
    }
});

// Captura todos os links que têm o atributo data-page
document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        // Se for um link real (<a>), evita o refresh
        e.preventDefault();
        
        const page = link.getAttribute('data-page');
        const id = link.getAttribute('data-id') || null;

        console.log(`🖱️ Navegando para: ${page}`);
        loadContent(page, id, true);
    });
});

// Chame a função quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeRouting);

async function loadContent(pageName, id = null, shouldPushState = true) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea || !pageName) return;

    try {
        // 1. Busca o arquivo HTML na pasta /pages
        const response = await fetch(`/pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Página ${pageName} não encontrada.`);

        const html = await response.text();
        contentArea.innerHTML = html;

        // 2. Gerencia o Histórico do Navegador (URLs Limpas)
        if (shouldPushState) {
            const isDev = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
            
            // Define o caminho: /album/123 ou apenas /search
            const cleanPath = id ? `/${pageName}/${id}` : `/${pageName}`;
            
            // Localhost usa ? para evitar problemas com servidores simples sem rewrite
            const newUrl = isDev 
                ? `?page=${pageName}${id ? `&id=${id}` : ''}` 
                : cleanPath;
            
            window.history.pushState({ page: pageName, id: id }, '', newUrl);
        }

        // 3. Setup específico de cada página
        setTimeout(() => {
            console.log(`🛠️ Executando setup para: ${pageName}`);
            switch (pageName) {
                case 'home': if (typeof setupHomePage === 'function') setupHomePage(); break;
                case 'music': if (typeof setupMusicPage === 'function') setupMusicPage(id); break;
                case 'album': if (typeof setupAlbumPage === 'function') setupAlbumPage(id); break;
                case 'artist': if (typeof setupArtistPage === 'function') setupArtistPage(id); break;
                case 'playlist': if (typeof setupPlaylistPage === 'function') setupPlaylistPage(id); break;
                case 'liked': if (typeof setupLikedPage === 'function') setupLikedPage(); break;
                case 'search': 
                    import('./search.js').then(m => m.setupSearchPage()).catch(e => console.error(e));
                    break;
                // Adicione os outros casos aqui conforme necessário...
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);

    } catch (error) {
        console.error("❌ Erro ao carregar página:", error);
        loadContent('home', null, false); // Fallback para home em caso de erro crítico
    }
}

// Inicializa tudo quando o DOM carregar
document.addEventListener('DOMContentLoaded', initializeRouting);

async function setupLibraryPage() {
    console.log("🔧 Carregando página Library...");

    // Exemplo: carregar o perfil do usuário
    if (auth.currentUser) {
        await populateUserProfile(auth.currentUser);
    }

}

function createArtistCard(docData, docId) {
    const card = document.createElement("div");
    card.className = "w-27 flex-shrink-0 text-center cursor-pointer hover:scale-105 transition-transform duration-300 group";
    
    card.setAttribute('data-navigate', 'artist');
    card.setAttribute('data-id', docId);

    const fotoUrl = docData.foto || "";
    
    // Lógica de imagem simplificada
    let imgSrc = "/assets/default-artist.png";
    if (fotoUrl && fotoUrl !== "") {
        imgSrc = fotoUrl;
    } else {
        imgSrc = "/assets/artistpfp.png";
    }

    card.innerHTML = `
        <div class="relative mx-auto w-24 h-24">
            <img src="${imgSrc}" alt="${docData.nomeArtistico}" 
                 class="w-24 h-24 rounded-full object-cover shadow-md">
        </div>
        <p class="text-white text-[11px] font-bold truncate mt-3">
            ${docData.nomeArtistico || "Artista"}
        </p>
    `;

    return card;
}

function createTrendingSongCard(songData, docId, rank) {
    const songItem = document.createElement('div');
    // Aplicamos a classe principal do item da lista
    songItem.className = 'trending-song-item'; 
    
    // Adiciona a lógica de reprodução ao clicar no item
    songItem.addEventListener("click", () => {
        console.log(`Tentando reproduzir a música: ${songData.title}`);
    });

    songItem.innerHTML = `
        <div class="trending-song-content">
            
            <div class="song-rank">
                ${rank}.
            </div>
            
            <img src="${songData.cover || './assets/default-artist.png'}" 
                alt="Capa" 
                class="song-cover-trending">
            
            <div class="song-info">
                <p class="song-title">${songData.title || 'Título Desconhecido'}</p>
                
                <p class="song-artist">
                    ${songData.artistName || 'Artista Desconhecido'}
                </p>
            </div>
        </div>
        
        <div class="song-options-icon">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
        </div>
    `;

songItem.addEventListener("click", () => {
    // Verifica se a função de reprodução está disponível
    if (typeof window.playTrackGlobal === 'function') {
        console.log(`Iniciando a reprodução de: ${songData.title}`);
        // 🚀 AGORA ISSO VAI FUNCIONAR, pois loadTrack está como playTrackGlobal
        window.playTrackGlobal(songData); 
        
    } else {
        console.error("Erro: A função playTrackGlobal não está definida no window.");
    }
});
    
    return songItem;
}

function createPlaylistCard(playlist, playlistId) {
    const playlistCard = document.createElement('div');
    playlistCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
    
    // CORREÇÃO: Atributos de navegação
    playlistCard.setAttribute('data-navigate', 'playlist');
    playlistCard.setAttribute('data-id', playlistId);

    playlistCard.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
        
            <img src="${playlist.cover || '/assets/default-cover.png'}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${playlist.name}</h3>
            <p class="text-gray-400 text-xs truncate">${playlist.genres?.join(', ') || 'Playlist'}</p>
        </div>
    `;
    return playlistCard;
}


/**
 * Renderiza uma lista de itens em uma linha de cards.
 * Esta função deve ser única no main.js.
 * @param {string} rowElementId - O ID do elemento div.card-row onde os cards serão inseridos.
 * @param {Array<object>} items - A lista de dados (playlists, álbuns, etc.).
 * @param {string} type - O tipo de item ('playlist', 'album', 'artist') para escolher a função de criação de card.
 */
function renderCardRow(rowElementId, items, type) {
    const listElement = document.getElementById(rowElementId);
    if (!listElement) return;

    listElement.innerHTML = ''; 

    // Ordenar itens se houver data/ano disponível
    const sortedItems = [...items].sort((a, b) => {
        const valA = a.data || a.ano || 0;
        const valB = b.data || b.ano || 0;
        return valB > valA ? 1 : -1;
    });
    
    sortedItems.forEach(item => {
        let card;
        if (type === 'playlist') card = createPlaylistCard(item, item.id);
        else if (type === 'album') card = createAlbumCard(item, item.id);
        else if (type === 'artist') card = createArtistCard(item, item.id);

        if (card) listElement.appendChild(card);
    });
}

function createAlbumCard(album, albumId) {
    const albumCard = document.createElement('div');
    albumCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
    
    // CORREÇÃO: Atributos de navegação
    albumCard.setAttribute('data-navigate', 'album');
    albumCard.setAttribute('data-id', albumId);

    albumCard.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
            <img src="${album.cover || '/assets/default-cover.png'}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${album.album}</h3>
            <p class="text-gray-400 text-xs truncate">${album.artist}</p>
        </div>
    `;
    return albumCard;
}

async function registrarLog(itemTitle, type) {
    const auth = getAuth();
    const user = auth.currentUser;
    const db = getFirestore();

    const logData = {
        userName: user ? (user.displayName || "Usuário sem nome") : "Anônimo",
        userId: user ? user.uid : "deslogado",
        itemTitle: itemTitle,
        type: type,
        timestamp: new Date() // Ou serverTimestamp() do firebase
    };

    try {
        await addDoc(collection(db, "logs"), logData);
    } catch (e) {
        console.error("Erro ao salvar log: ", e);
    }
}


async function setupContentCarousel(
  listId,
  leftBtnId,
  rightBtnId,
  loadingMsgId,
  collectionName,
  queryConfig,
  contentCallback
) {
  const listContainer = document.getElementById(listId);
  const listWrapper = listContainer?.parentElement;
  const loadingMessage = document.getElementById(loadingMsgId);
  const btnLeft = document.getElementById(leftBtnId);
  const btnRight = document.getElementById(rightBtnId);

  if (!listContainer || !listWrapper || !btnLeft || !btnRight) return;

  // --- CORREÇÃO 1: REMOVER EVENTOS ANTIGOS (Clone do Botão) ---
  // Isso mata qualquer listener acumulado de visitas anteriores à página
  const newBtnLeft = btnLeft.cloneNode(true);
  const newBtnRight = btnRight.cloneNode(true);
  btnLeft.parentNode.replaceChild(newBtnLeft, btnLeft);
  btnRight.parentNode.replaceChild(newBtnRight, btnRight);

  newBtnLeft.classList.add('hidden');
  newBtnRight.classList.add('hidden');

  try {
    const q = query(collection(db, collectionName), ...queryConfig);
    const querySnapshot = await getDocs(q);

    listContainer.innerHTML = '';
    if (loadingMessage) loadingMessage.style.display = 'none';

    if (querySnapshot.empty) {
      listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum item encontrado.</p>`;
    } else {
      querySnapshot.forEach((doc) => {
        const itemData = doc.data();
        const itemId = doc.id;
        const card = contentCallback(itemData, itemId);
        listContainer.appendChild(card);
      });
    }
  } catch (err) {
    console.error('Erro ao carregar carrossel:', err);
  }

  // --- LÓGICA DE VISIBILIDADE ---
  function updateArrowVisibility() {
    const scrollLeft = listContainer.scrollLeft;
    const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
    // Usamos um pequeno offset de 5px para evitar bugs de arredondamento
    newBtnLeft.classList.toggle('hidden', scrollLeft <= 5);
    newBtnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 5);
  }

  // MouseEnter no Wrapper para mostrar setas
  listWrapper.onmouseenter = updateArrowVisibility; 
  listWrapper.onmouseleave = () => {
    newBtnLeft.classList.add('hidden');
    newBtnRight.classList.add('hidden');
  };

  // Scroll e Resize
  listContainer.onscroll = updateArrowVisibility;
  window.onresize = updateArrowVisibility;

  // Clique nos NOVOS botões (Clonados)
  newBtnLeft.onclick = () => listContainer.scrollBy({ left: -400, behavior: 'smooth' });
  newBtnRight.onclick = () => listContainer.scrollBy({ left: 400, behavior: 'smooth' });

  // --- LÓGICA DE DRAG (MOUSE) ---
  let isDown = false;
  let startX;
  let scrollLeftStart;

  listContainer.onmousedown = (e) => {
    isDown = true;
    listContainer.classList.add('active'); // Opcional: mudar cursor
    startX = e.pageX - listContainer.offsetLeft;
    scrollLeftStart = listContainer.scrollLeft;
  };

  window.onmouseup = () => { isDown = false; }; // Window garante que solte mesmo fora do carrossel
  listContainer.onmouseleave = () => { isDown = false; };

  listContainer.onmousemove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - listContainer.offsetLeft;
    const walk = (x - startX) * 2; // Velocidade do arraste
    listContainer.scrollLeft = scrollLeftStart - walk;
    updateArrowVisibility(); // Atualiza setas enquanto arrasta
  };
}

// ⭐ NOVO: Função para buscar e renderizar a seção de Pop unificada ⭐
async function setupPopSection() {
    const listContainer = document.getElementById('pop-list');
    const loadingMessage = document.getElementById('pop-loading-message');
    
    if (loadingMessage) loadingMessage.style.display = 'block';
    
    let popItems = [];

    // Busca por Playlists e Stations (que têm 'genres' como array)
    try {
        const playlistsQuery = query(collection(db, "playlists"), where('genres', 'array-contains', 'Pop'));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsSnapshot.forEach(doc => {
            const playlistData = doc.data();
            popItems.push({ id: doc.id, type: 'playlist', name: playlistData.name, ...playlistData });
        });
    } catch (error) {
        console.error("Erro ao buscar playlists pop:", error);
    }

    // Busca por Álbuns (que têm 'category' como string)
    try {
        const albumsQuery = query(collection(db, "albuns"), where('category', '==', 'pop'));
        const albumsSnapshot = await getDocs(albumsQuery);
        albumsSnapshot.forEach(doc => {
            const albumData = doc.data();
            // Usamos 'album' como nome, já que a chave é 'album', não 'name'
            popItems.push({ id: doc.id, type: 'album', name: albumData.album, ...albumData });
        });
    } catch (error) {
        console.error("Erro ao buscar álbuns pop:", error);
    }

    // ⭐ NOVO: Ordenar o array 'popItems' pelo nome (de A a Z)
    popItems.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    if (loadingMessage) loadingMessage.style.display = 'none';
    if (listContainer) listContainer.innerHTML = '';
    
    if (popItems.length === 0) {
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum item Pop encontrado.</p>`;
    } else {
        popItems.forEach(item => {
            let card;
            if (item.type === 'album') {
                // A função createAlbumCard recebe o objeto 'album'
                card = createAlbumCard(item, item.id);
            } else {
                // A função createPlaylistCard recebe o objeto 'playlist'
                card = createPlaylistCard(item, item.id);
            }
            if (listContainer) listContainer.appendChild(card);
        });
    }

    // Chame a lógica de scroll, drag e visibilidade das setas
    const listWrapper = listContainer?.parentElement;
    const btnLeft = document.getElementById('pop-scroll-left');
    const btnRight = document.getElementById('pop-scroll-right');
    
    if (listWrapper && listContainer && btnLeft && btnRight) {
        const updateArrowVisibility = () => {
            const scrollLeft = listContainer.scrollLeft;
            const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
            btnLeft.classList.toggle('hidden', scrollLeft <= 0);
            btnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 1);
        };

        listWrapper.addEventListener('mouseenter', updateArrowVisibility);
        listWrapper.addEventListener('mouseleave', () => {
            btnLeft.classList.add('hidden');
            btnRight.classList.add('hidden');
        });
        listContainer.addEventListener('scroll', updateArrowVisibility);
        window.addEventListener('resize', updateArrowVisibility);

        btnLeft.addEventListener('click', () => listContainer.scrollBy({ left: -300, behavior: 'smooth' }));
        btnRight.addEventListener('click', () => listContainer.scrollBy({ left: 300, behavior: 'smooth' }));
    }
}

// ⭐ NOVO: Função para buscar e renderizar a seção de Música Latina ⭐
async function setupLatinSection() {
    const listContainer = document.getElementById('latin-list');
    const loadingMessage = document.getElementById('latin-loading-message');
    
    if (loadingMessage) loadingMessage.style.display = 'block';
    
    let latinItems = [];

    // Busca por Playlists e Stations com o gênero "Latin"
    try {
        const playlistsQuery = query(collection(db, "playlists"), where('genres', 'array-contains', 'Latin'));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsSnapshot.forEach(doc => {
            const playlistData = doc.data();
            latinItems.push({ id: doc.id, type: 'playlist', name: playlistData.name, ...playlistData });
        });
    } catch (error) {
        console.error("Erro ao buscar playlists latinas:", error);
    }

    // Busca por Álbuns com a 'category' "latin"
    try {
        const albumsQuery = query(collection(db, "albuns"), where('category', '==', 'latin'));
        const albumsSnapshot = await getDocs(albumsQuery);
        albumsSnapshot.forEach(doc => {
            const albumData = doc.data();
            latinItems.push({ id: doc.id, type: 'album', name: albumData.album, ...albumData });
        });
    } catch (error) {
        console.error("Erro ao buscar álbuns latinos:", error);
    }

    // Ordenar o array 'latinItems' pelo nome (de A a Z)
    latinItems.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    if (loadingMessage) loadingMessage.style.display = 'none';
    if (listContainer) listContainer.innerHTML = '';
    
    if (latinItems.length === 0) {
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum item Latino encontrado.</p>`;
    } else {
        latinItems.forEach(item => {
            let card;
            if (item.type === 'album') {
                card = createAlbumCard(item, item.id);
            } else {
                card = createPlaylistCard(item, item.id);
            }
            if (listContainer) listContainer.appendChild(card);
        });
    }

    // Lógica de scroll, drag e visibilidade das setas para a nova seção
    const listWrapper = listContainer?.parentElement;
    const btnLeft = document.getElementById('latin-scroll-left');
    const btnRight = document.getElementById('latin-scroll-right');
    
    if (listWrapper && listContainer && btnLeft && btnRight) {
        const updateArrowVisibility = () => {
            const scrollLeft = listContainer.scrollLeft;
            const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
            btnLeft.classList.toggle('hidden', scrollLeft <= 0);
            btnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 1);
        };

        listWrapper.addEventListener('mouseenter', updateArrowVisibility);
        listWrapper.addEventListener('mouseleave', () => {
            btnLeft.classList.add('hidden');
            btnRight.classList.add('hidden');
        });
        listContainer.addEventListener('scroll', updateArrowVisibility);
        window.addEventListener('resize', updateArrowVisibility);

        btnLeft.addEventListener('click', () => listContainer.scrollBy({ left: -300, behavior: 'smooth' }));
        btnRight.addEventListener('click', () => listContainer.scrollBy({ left: 300, behavior: 'smooth' }));
    }
}

// ... (seu código existente, incluindo setupLatinSection) ...

// ⭐ FUNÇÃO AJUSTADA: para buscar e renderizar a seção de um artista específico ⭐
async function setupArtistSection(artistUid) { // Removido artistName do parâmetro, buscaremos os dados do artista
    const listContainer = document.getElementById('taylor-swift-list');
    const loadingMessage = document.getElementById('taylor-swift-loading-message');
    const artistHeader = document.getElementById('taylor-swift-header');
    const artistHeaderImg = document.getElementById('taylor-swift-header-img');
    const artistHeaderName = document.getElementById('taylor-swift-header-name');

    if (!listContainer || !artistHeader || !artistHeaderImg || !artistHeaderName) {
        console.error("Elementos HTML da seção de artista não encontrados.");
        return;
    }

    if (loadingMessage) loadingMessage.style.display = 'block';
    
    let artistContent = [];
    let artistData = null; // Para guardar os dados do artista principal

    // Passo 1: Buscar os dados do perfil do artista para o cabeçalho
    try {
        const artistDocRef = doc(db, "usuarios", artistUid);
        const artistDocSnap = await getDoc(artistDocRef);
        if (artistDocSnap.exists()) {
            artistData = { id: artistDocSnap.id, ...artistDocSnap.data() };
            // ATUALIZA O CABEÇALHO DA SEÇÃO
            artistHeaderImg.src = artistData.foto || "/assets/default-artist.png";
            artistHeaderName.textContent = artistData.nomeArtistico || artistData.apelido || "Artista";
            
            // Adiciona evento de clique no cabeçalho
            artistHeader.addEventListener('click', () => {
                loadContent('artist', artistUid); // Supondo que 'artist' é a página do artista
            });

        } else {
            console.warn(`Artista com UID ${artistUid} não encontrado.`);
            artistHeaderName.textContent = "Artista Desconhecido";
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum conteúdo encontrado para este artista.</p>`;
            return; // Sai da função se o artista não for encontrado
        }
    } catch (error) {
        console.error("Erro ao buscar dados do artista:", error);
        artistHeaderName.textContent = "Erro ao carregar artista";
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Erro ao carregar conteúdo do artista.</p>`;
        return;
    }
    
    // Passo 2: Buscar Playlists (Stations) da artista
    try {
        const playlistsQuery = query(collection(db, "playlists"), where('uidars', '==', artistUid));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsSnapshot.forEach(doc => {
            const playlistData = doc.data();
            artistContent.push({ id: doc.id, type: 'playlist', name: playlistData.name, ...playlistData });
        });
    } catch (error) {
        console.error("Erro ao buscar stations da artista:", error);
    }

    // Passo 3: Buscar Álbuns da artista
    try {
        const albumsQuery = query(collection(db, "albuns"), where('uidars', '==', artistUid));
        const albumsSnapshot = await getDocs(albumsQuery);
        albumsSnapshot.forEach(doc => {
            const albumData = doc.data();
            artistContent.push({ id: doc.id, type: 'album', name: albumData.album, ...albumData });
        });
    } catch (error) {
        console.error("Erro ao buscar álbuns da artista:", error);
    }

// Ordenar por DATA COMPLETA (mais recente primeiro)
artistContent.sort((a, b) => {
    const parseDate = (dateStr) => {
        // Se a data vier do Firebase como Timestamp, converte para objeto Date
        if (dateStr && typeof dateStr.toDate === 'function') {
            return dateStr.toDate();
        }
        // Se vier como String "DD/MM/AAAA"
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(0); // Fundo da lista se não houver data
    };

    // Altere 'data' para o nome exato do campo que você usa no Firestore
    const dA = parseDate(a.data || a.ano || a.dataLancamento);
    const dB = parseDate(b.data || b.ano || b.dataLancamento);

    return dB - dA; // Mais recente primeiro
});
    // Oculta a mensagem de carregamento
    if (loadingMessage) loadingMessage.style.display = 'none';

    // Limpa a lista existente antes de renderizar
    if (listContainer) listContainer.innerHTML = '';
    
    if (artistContent.length === 0) {
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum álbum ou playlist encontrado para ${artistData.nomeArtistico || artistData.apelido}.</p>`;
    } else {
        artistContent.forEach(item => {
            let card;
            if (item.type === 'album') {
                card = createAlbumCard(item, item.id);
            } else { // playlist ou station
                card = createPlaylistCard(item, item.id);
            }
            if (listContainer) listContainer.appendChild(card);
        });
    }

    // Adicione a lógica de scroll, drag e visibilidade das setas (a mesma que já temos)
    const listWrapper = listContainer?.parentElement;
    const btnLeft = document.getElementById('taylor-swift-scroll-left');
    const btnRight = document.getElementById('taylor-swift-scroll-right');
    
    if (listWrapper && listContainer && btnLeft && btnRight) {
        const updateArrowVisibility = () => {
            const scrollLeft = listContainer.scrollLeft;
            const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
            btnLeft.classList.toggle('hidden', scrollLeft <= 0);
            btnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 1);
        };

        listWrapper.addEventListener('mouseenter', updateArrowVisibility);
        listWrapper.addEventListener('mouseleave', () => {
            btnLeft.classList.add('hidden');
            btnRight.classList.add('hidden');
        });
        listContainer.addEventListener('scroll', updateArrowVisibility);
        window.addEventListener('resize', updateArrowVisibility);

        btnLeft.addEventListener('click', () => listContainer.scrollBy({ left: -300, behavior: 'smooth' }));
        btnRight.addEventListener('click', () => listContainer.scrollBy({ left: 300, behavior: 'smooth' }));
    }
}



async function setupMusicPage(musicId) {
    if (!musicId) return;

    try {
        const docRef = doc(db, "musicas", musicId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            
            // 1. Preenchimento do Header
            document.getElementById('album-title-detail').textContent = data.title;
            document.getElementById('artist-name-detail').textContent = data.artistName || "Artista";
            document.getElementById('album-cover-detail').src = data.cover;
            document.getElementById('album-cover-bg').style.backgroundImage = `url(${data.cover})`;
            
            // Exibe o total de streams formatado (ex: 1.500.200 streams)
            const streamsEl = document.getElementById('music-streams-count');
            if (streamsEl) {
                streamsEl.textContent = `${(data.streams || 0).toLocaleString()} streams`;
            }

            if (data.explicit) {
                document.getElementById('explicit-badge')?.classList.remove('hidden');
            }

            // 2. Lógica de Bloqueio
            const now = new Date();
            const scheduledDate = data.scheduledTime && data.scheduledTime !== "Imediato" 
                                  ? new Date(data.scheduledTime) : null;
            const isLocked = scheduledDate && scheduledDate > now;

            // 3. Renderização da Lista
            const tracksContainer = document.getElementById('tracks-container');
            if (tracksContainer) {
                const lockClass = isLocked ? "opacity-30 pointer-events-none" : "hover:bg-white/10 cursor-pointer";
                
                tracksContainer.innerHTML = `
                    <div class="track-item ${lockClass}">
                        <div class="track-number-display text-gray-500 text-xs">1</div>
                        <img src="${data.cover}" class="track-cover ${isLocked ? 'grayscale' : ''}">
                        <div class="track-info-container">
                            <div class="flex items-center gap-1.5 overflow-hidden">
                                <span class="track-name text-white">${data.title}</span>
                                ${data.explicit ? '<span class="explicit-tag">E</span>' : ''}
                            </div>

                        </div>
                        <div class="track-duration text-gray-400 text-xs">
                            ${isLocked ? "<i class='bx bxs-lock-alt text-[10px]'></i>" : (data.duration || '0:00')}
                        </div>
                    </div>
                `;

                if (!isLocked) {
                    tracksContainer.querySelector('.track-item').onclick = () => {
                        checkAndResetMonthlyStreams(musicId); // Incrementa o contador
                        window.playTrackGlobal(data);
                    };
                }
            }

            // 4. Controle do Botão Play Principal
            const mainPlayBtn = document.getElementById('main-play-btn');
            if (mainPlayBtn) {
                if (isLocked) {
                    mainPlayBtn.style.opacity = "0.3";
                    mainPlayBtn.style.cursor = "default";
                    mainPlayBtn.onclick = null;
                    if (document.getElementById('countdown-wrapper')) {
                        document.getElementById('countdown-wrapper').classList.remove('hidden');
                        iniciarCronometroMusica(scheduledDate, musicId);
                    }
                } else {
                    mainPlayBtn.style.opacity = "1";
                    mainPlayBtn.style.cursor = "pointer";
                    mainPlayBtn.onclick = () => {
                        checkAndResetMonthlyStreams(musicId); // Incrementa o contador
                        window.playTrackGlobal(data);
                    };
                }
            }
        }
    } catch (error) {
        console.error("Erro no setupMusicPage:", error);
    }
}

// Função auxiliar para o Countdown
function iniciarCronometroMusica(targetDate) {
    const display = document.getElementById('countdown-display');
    if (!display) return;

    const interval = setInterval(() => {
        const diff = targetDate - new Date();
        if (diff <= 0) {
            clearInterval(interval);
            display.innerHTML = "<h2 class='text-[#00FF5B] font-bold'>LANÇAMENTO DISPONÍVEL!</h2>";
            setTimeout(() => loadContent('music', musicId), 2000); // Recarrega a SPA
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        display.innerHTML = `
            <div class="countdown-segment"><span class="countdown-value">${d}</span><span class="countdown-label">Dias</span></div>
            <div class="countdown-separator"></div>
            <div class="countdown-segment"><span class="countdown-value">${h}</span><span class="countdown-label">Horas</span></div>
            <div class="countdown-separator"></div>
            <div class="countdown-segment"><span class="countdown-value">${m}</span><span class="countdown-label">Min</span></div>
            <div class="countdown-separator"></div>
            <div class="countdown-segment"><span class="countdown-value">${s}</span><span class="countdown-label">Seg</span></div>
        `;
    }, 1000);
}




// ============================================
// ⭐ FUNÇÕES PARA A PÁGINA 'LIKED' ⭐
// ============================================

/**
 * Ponto de entrada para a página de Curtidas.
 */
function setupLikedPage() {
    // ⚠️ CRÍTICO: Usa window.currentArtistUid, que é definido em checkAuthAndPermissions.
    // É o UID do usuário logado.
    const userUid = window.currentArtistUid; 
    
    if (!userUid) {
        document.getElementById('content-area').innerHTML = '<p class="text-red-500 text-center p-10">Erro de autenticação: UID do usuário ausente.</p>';
        return;
    }

    loadLikedItems(userUid);
}

async function loadMyLikedItems(userUid) {
    const container = document.getElementById('my-liked-items-list');
    const loadingMessage = document.getElementById('my-liked-loading-message');

    if (!container) return;

    if (!userUid) {
        // Usuário deslogado: limpa a área e mostra a mensagem
        container.innerHTML = `<div id="my-liked-loading-message" class="col-span-full text-gray-400 text-center p-5">Faça login para ver suas curtidas.</div>`;
        return;
    }

    // Se estiver carregando, mostra a mensagem
    if (loadingMessage) loadingMessage.textContent = 'Carregando seus itens curtidos...';

    try {
        // Consulta ao Firestore: /usuarios/{userUid}/curtidas
        const curtidasRef = collection(db, "usuarios", userUid, "curtidas");
        const q = query(curtidasRef, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);

        if (loadingMessage) loadingMessage.remove(); 
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="col-span-full text-gray-500 text-center p-5">Você ainda não curtiu nenhum item.</div>';
            return;
        }
        
        // ... (o resto da lógica de busca de detalhes e renderização do item) ...
        
        const itemPromises = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const itemId = data.itemId;
            const itemType = data.type; 

            let itemData = null;
            let collectionName = itemType === 'album' ? 'albuns' : (itemType === 'music' ? 'musicas' : (itemType === 'playlist' ? 'playlists' : null));
            
            if (collectionName) {
                try {
                    const itemDocRef = doc(db, collectionName, itemId);
                    const itemDocSnap = await getDoc(itemDocRef);
                    if (itemDocSnap.exists()) {
                        itemData = itemDocSnap.data();
                    }
                } catch (e) {
                    console.error(`Erro ao buscar ${itemType} ${itemId}:`, e);
                }
            }
            
            return {
                id: itemId,
                type: itemType,
                data: itemData
            };
        });

        const likedItems = (await Promise.all(itemPromises)).filter(item => item.data !== null);

        container.innerHTML = ''; 
        likedItems.forEach(item => {
            const card = createLikedItemCard(item);
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar itens curtidos na home:", error);
        container.innerHTML = `<div class="col-span-full text-red-500 text-center p-5">Erro ao carregar suas curtidas.</div>`;
    }
}

/**
 * CRIA O CARD RETANGULAR DA BIBLIOTECA (Capa Esquerda, Título Direita)
 * ⭐️ CORRIGIDO: Remove 'window.' da chamada loadContent para resolver o erro de TypeError.
 */
function createLikedItemCard(item) {
    const card = document.createElement('a'); 
    
    // Define o tipo de item para ser passado como 'pageName' para o loadContent
    const itemType = item.type === 'album' ? 'album' : (item.type === 'playlist' ? 'playlist' : 'music');
    
    // 1. Usa '#' para evitar navegação padrão
    card.href = "#"; 

    // 2. ⭐️ CORREÇÃO: Adiciona um listener que chama loadContent DIRETAMENTE
    card.addEventListener('click', (event) => {
        event.preventDefault(); // Impede que o link tente navegar
        
        // Chamada CORRIGIDA: Usa loadContent(itemType, item.id)
        // Isso resolve o Uncaught TypeError, pois loadContent é acessível no escopo global.
        loadContent(itemType, item.id); 
    });

    // Classe CSS Pura para o Layout Retangular
    card.className = 'library-item-card';

    let title = 'Item Desconhecido';
    let subtitle = '';
    let coverUrl = './assets/default-cover.png'; 
    
    // Para este layout, o subtítulo é o que identifica o tipo e autor (Ex: Álbum • Dua Lipa)
    if (item.type === 'album') {
        title = item.data.album || 'Álbum Desconhecido';
        subtitle = `Álbum • ${item.data.artist || 'Artista'}`; 
        coverUrl = item.data.cover || coverUrl;
    } else if (item.type === 'playlist') {
        title = item.data.name || 'Playlist Desconhecida';
        subtitle = `Playlist • ${item.data.author || 'Você'}`;
        coverUrl = item.data.cover || coverUrl;
    } 

    // HTML do card no formato Retangular (Flex horizontal)
    card.innerHTML = `
        <div class="card-cover-library-wrapper">
            <img src="${coverUrl}" alt="${title}" class="card-cover-library-image">
            
            ${
                 (title === 'Músicas Curtidas' && item.type === 'playlist')
                 ? `
                 <div class="purple-overlay-library">
                   <svg class="heart-icon-library" viewBox="0 0 24 24" fill="white">
                     <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                   </svg>
                 </div>`
                 : ''
            }
        </div>
        
        <div class="card-info-library">
            <p class="card-title-library" title="${title}">${title}</p>
        </div>
        `;

    return card;
}

function checkAuthAndLoadLikedItems() {
    // Presume que a função getAuth() está disponível globalmente ou no seu import
    const authInstance = getAuth(); 

    onAuthStateChanged(authInstance, (user) => {
        if (user) {
            // Usuário logado: Passa o UID diretamente para o loader
            loadMyLikedItems(user.uid);
        } else {
            // Usuário deslogado: Passa 'null' para limpar a área
            loadMyLikedItems(null); 
        }
    });
}

// Função única para validar e mostrar o card
async function validarCardArtista() {
    if (!currentUserUid) return;

    try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUserUid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Verifica se é a STRING "true"
            if (data.artista === "true") {
                // Tenta encontrar o card repetidamente por 3 segundos (timing safe)
                let tentativas = 0;
                const verificarNoDOM = setInterval(() => {
                    const card = document.querySelector('.artist-promo-container');
                    if (card) {
                        card.style.setProperty('display', 'block', 'important');
                        console.log("✅ Card de artista exibido na Library");
                        clearInterval(verificarNoDOM);
                    }
                    tentativas++;
                    if (tentativas > 30) clearInterval(verificarNoDOM); // Para após 3s
                }, 100);
            }
        }
    } catch (e) {
        console.error("Erro ao validar artista:", e);
    }
}

// Escuta a mudança de estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUid = user.uid;
        // Se a página atual já for a library ao logar, valida
        validarCardArtista();
        
        if (typeof populateUserProfile === "function") populateUserProfile(user);
        hideLoadingAndShowContent();
    } else {
        window.location.href = "/index";
    }
});


// 3. Listener de estado de autenticação
console.log("FIREBASE: Aguardando o estado de autenticação...");
onAuthStateChanged(auth, (user) => {
    populateUserProfile(user);
});



/**
 * Carrega álbuns e playlists com o gênero "Sertanejo" na seção da Home,
 * e configura a rolagem lateral usando a lógica de visibilidade de setas.
 */
async function loadSertanejoSection() {
    const listContainer = document.getElementById('sertanejo-list');
    const loadingMessage = document.getElementById('sertanejo-loading-message');
    
    if (!listContainer) return;

    try {
        const genre = "Sertanejo";
        const limitCount = 5; 
        
        // 1. Consultas simultâneas para álbuns e playlists
        const albunsQuery = query(
            collection(db, "albuns"), 
            where("category", "array-contains", genre),
            limit(limitCount)
        );
        
        const playlistsQuery = query(
            collection(db, "playlists"), 
            where("genres", "array-contains", genre),
            limit(limitCount)
        );
        
        const [albunsSnapshot, playlistsSnapshot] = await Promise.all([
            getDocs(albunsQuery),
            getDocs(playlistsQuery)
        ]);

        // 2. Combinação e Preparação dos Dados
        let combinedItems = [];
        
        // Processa álbuns
        albunsSnapshot.docs.forEach(docSnap => {
            combinedItems.push({ 
                id: docSnap.id, 
                type: 'album', 
                ...docSnap.data() 
            });
        });

        // Processa playlists
        playlistsSnapshot.docs.forEach(docSnap => {
            combinedItems.push({ 
                id: docSnap.id, 
                type: 'playlist', 
                ...docSnap.data() 
            });
        });
        
        // (Opcional) Chame sua função shuffleArray(combinedItems) aqui para misturar os resultados.
        
        if (loadingMessage) loadingMessage.remove();

        if (combinedItems.length === 0) {
            listContainer.innerHTML = '<div class="loading-text">Nada encontrado</div>';
            
            // Oculta a seção se não houver conteúdo
            listContainer.closest('.section').style.display = 'none';
            return;
        }

        // 3. Renderização dos Cards
        listContainer.innerHTML = '';
        combinedItems.forEach(item => {
            // Usa a função de criação de card da Home (createAlbumCard)
            const card = createAlbumCard(item); 
            listContainer.appendChild(card);
        });
        
        
        // 4. ⭐ Lógica de scroll, drag e visibilidade das setas para a seção SERTANEJO
        const listWrapper = listContainer?.parentElement; // Será o div.section-scroll
        const btnLeft = document.getElementById('sertanejo-scroll-left');
        const btnRight = document.getElementById('sertanejo-scroll-right');
        
        if (listWrapper && listContainer && btnLeft && btnRight) {
            const updateArrowVisibility = () => {
                const scrollLeft = listContainer.scrollLeft;
                const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
                
                // Class 'hidden' deve ser uma classe CSS que oculta o elemento (ex: display: none; ou visibility: hidden;)
                btnLeft.classList.toggle('hidden', scrollLeft <= 0);
                // Usamos '- 1' por margem de erro
                btnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 1);
            };

            // Eventos de mouse para o wrapper (section-scroll)
            listWrapper.addEventListener('mouseenter', updateArrowVisibility);
            listWrapper.addEventListener('mouseleave', () => {
                btnLeft.classList.add('hidden');
                btnRight.classList.add('hidden');
            });
            
            // Evento de scroll (para rolagem manual) e redimensionamento
            listContainer.addEventListener('scroll', updateArrowVisibility);
            window.addEventListener('resize', updateArrowVisibility);

            // Botões de clique
            btnLeft.addEventListener('click', () => listContainer.scrollBy({ left: -300, behavior: 'smooth' }));
            btnRight.addEventListener('click', () => listContainer.scrollBy({ left: 300, behavior: 'smooth' }));
            
            // Checagem inicial
            updateArrowVisibility();
        }
        
    } catch (error) {
        console.error("Erro ao carregar seção Sertanejo:", error);
        if (listContainer) {
            listContainer.innerHTML = '<div class="loading-text text-red-500">Erro ao carregar a seção.</div>';
        }
    }

    // ⚠️ VOCÊ PRECISA FAZER ESTA VERIFICAÇÃO NA SUA FUNÇÃO createAlbumCard

/**
 * Cria um card quadrado da Home Page, capaz de representar tanto um Álbum quanto uma Playlist.
 * @param {object} item O objeto de dados do item, contendo id, type, cover, name/album, genres, etc.
 */
function createAlbumCard(item) {
    const card = document.createElement('div');
    
    // Define a URL de capa, usando uma imagem padrão se o campo 'cover' estiver vazio
    const coverUrl = item.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa';
    
    // 1. Define o Título e Subtítulo baseados no TIPO
    let title = 'Item Desconhecido';
    let subtitle = 'Conteúdo';

    if (item.type === 'album') {
        // Título do Álbum: Usa 'album' se existir, caso contrário, usa 'name'.
        title = item.album || item.name || 'Álbum Sem Nome'; 
        // Subtítulo do Álbum: Nome do artista
        subtitle = item.artist || 'Artista Desconhecido'; 
    } else if (item.type === 'playlist') {
        // Título da Playlist: Usa 'name'.
        title = item.name || 'Playlist Sem Nome';
        // Subtítulo da Playlist: Junta os gêneros ou usa "Playlist"
        subtitle = item.genres?.join(', ') || 'Playlist'; 
    }

    // 2. Lógica de clique (usa o seu sistema de loadContent)
    card.addEventListener('click', () => {
        // Chama o loadContent(pageName, id) com o tipo correto ('album' ou 'playlist') e o ID
        loadContent(item.type, item.id);
    });

    // Manteve o estilo de card original do usuário
    card.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';

    // 💡 Adiciona o cálculo e formatação dos streams (se a função formatNumber estiver definida)
    const formattedStreams = typeof formatNumber === 'function' && item.streams ? formatNumber(item.streams) : (item.streams || '0');


    // 3. HTML Final
    card.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
            <img src="${coverUrl}" 
                alt="${title}" 
                class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
            
            </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate" title="${title}">${title}</h3>
            <p class="text-gray-400 text-xs truncate" title="${subtitle}">${subtitle}</p>
        </div>
    `;
    return card;
}
}

function setGreeting() {
    const greetingElement = document.getElementById('greeting-title');
    
    // Se o elemento não existir (porque você mudou de página), sai da função sem erro
    if (!greetingElement) return; 

    const now = new Date();
    const hour = now.getHours();
    let greetingText = '';

    if (hour >= 5 && hour < 12) greetingText = 'Bom Dia';
    else if (hour >= 12 && hour < 18) greetingText = 'Boa Tarde';
    else greetingText = 'Boa Noite';

    greetingElement.textContent = greetingText;
}
async function fetchAndRenderNewSingles() {
    const listContainer = document.getElementById('new-singles-list');
    if (!listContainer) return;

    try {
        const musicasRef = collection(db, "musicas");

// 1. Aumente o tempo para teste (ex: 7 dias = 168 horas)
const tempoLimite = new Date();
tempoLimite.setHours(tempoLimite.getHours() - 72); 

// 2. Query ajustada
const q = query(
    musicasRef, 
    where("single", "==", "true"), // Mantido como string, conforme seu print
    where("status", "==", "publico"), // Garante que só pega as públicas
    where("timestamp", ">=", tempoLimite),
    orderBy("timestamp", "desc"), 
    limit(20)
);

        const querySnapshot = await getDocs(q);
        listContainer.innerHTML = '';

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p class="text-gray-500 p-4 text-xs">Nenhum lançamento recente.</p>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            
    const track = { id: docSnap.id, ...docSnap.data() };
    
    // --- NOVA LÓGICA DE DATA MAIS ROBUSTA ---
    const now = new Date();
let releaseDate;
if (track.timestamp && track.timestamp.toDate) {
    releaseDate = track.timestamp.toDate();
} else if (track.scheduledTime && track.scheduledTime !== "Imediato") {
    releaseDate = new Date(track.scheduledTime);
} else {
    releaseDate = new Date(); // Se for "Imediato", considera como "agora"
}
    
    // Verificação de segurança
    const isFuture = releaseDate > now;
    // ---------------------------------------

    const card = document.createElement('div');
    card.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4 group';
    
    card.setAttribute('data-navigate', 'music');
    card.setAttribute('data-id', track.id);

    card.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md overflow-hidden shadow-lg bg-[#121212]">
            <img src="${track.cover || './assets/default-cover.png'}" 
                 class="absolute top-0 left-0 w-full h-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105 ${isFuture ? 'opacity-50 blur-[1px]' : ''}"
                 onerror="this.src='./assets/default-cover.png'">
            
            ${isFuture ? `
                <div class="absolute top-2 right-2 bg-[#00FF5B] text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">
                    PRÉ-SALVE
                </div>
            ` : ''}

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <i class='bx ${isFuture ? 'bx-time-five' : 'bx-play'} text-black text-2xl ${!isFuture ? 'ml-1' : ''}'></i>
                </div>
            </div>
        </div>

        <div class="mt-3 w-full">
            <h3 class="text-sm font-bold text-white truncate flex items-center gap-1">
                ${track.title}
                ${(track.explicit === true || track.explicit === "true") ? '<span class="explicit-tag" style="font-size:7px; padding: 1px 3px; scale: 0.9;">E</span>' : ''}
            </h3>
            <p class="text-gray-400 text-[11px] font-medium truncate mt-0.5">${track.artistName || 'Artista'}</p>
            ${isFuture ? `<p class="text-[#00FF5B] text-[9px] font-bold mt-1 uppercase tracking-tighter">Lançamento agendado</p>` : ''}
        </div>
    `;

    listContainer.appendChild(card);

    
});

        // Inicializa botões de scroll se a função existir
        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('singles-home-scroll-left', 'singles-home-scroll-right', 'new-singles-list');
        }

    } catch (error) {
        console.error("Erro crítico ao renderizar singles:", error);
        listContainer.innerHTML = '<p class="text-red-500 p-4 text-xs">Erro ao carregar lançamentos.</p>';
    }
}



// Função auxiliar para os botões de scroll (caso você não tenha uma genérica)
function setupScrollButtons(leftBtnId, rightBtnId, containerId) {
    const leftBtn = document.getElementById(leftBtnId);
    const rightBtn = document.getElementById(rightBtnId);
    const container = document.getElementById(containerId);

    if (leftBtn && rightBtn && container) {
        leftBtn.onclick = () => container.scrollBy({ left: -300, behavior: 'smooth' });
        rightBtn.onclick = () => container.scrollBy({ left: 300, behavior: 'smooth' });
    }
}

// ⭐ FUNÇÃO PARA GÊNERO FORRÓ: Mix de Álbuns, Playlists e Músicas Variadas ⭐
async function setupForroGenreSection() {
    const listContainer = document.getElementById('forro-genre-listt'); // ID conforme seu HTML
    if (!listContainer) return;

    let genreContent = [];
    let seenArtists = new Set(); // Para garantir um artista por música

    try {
        // 1. BUSCAR PLAYLISTS (STATIONS)
        const playlistsQuery = query(
            collection(db, "playlists"), 
            where('genres', 'array-contains', 'Forró')
        );
        const playlistsSnap = await getDocs(playlistsQuery);
        playlistsSnap.forEach(doc => {
            genreContent.push({ id: doc.id, type: 'playlist', ...doc.data() });
        });

        // 2. BUSCAR ÁLBUNS
        const albumsQuery = query(
            collection(db, "albuns"), 
            where('genre', '==', 'Forró')
        );
        const albumsSnap = await getDocs(albumsQuery);
        albumsSnap.forEach(doc => {
            genreContent.push({ id: doc.id, type: 'album', ...doc.data() });
        });

        // 3. BUSCAR MÚSICAS (Limite de 30, uma por artista)
        const songsQuery = query(
            collection(db, "musicas"), 
            where('genre', '==', 'Forró'), 
            orderBy('timestamp', 'desc'), 
            limit(60) // Buscamos mais para filtrar os artistas repetidos
        );
        const songsSnap = await getDocs(songsQuery);
        
        let songsAdded = 0;
        songsSnap.forEach(doc => {
            const songData = doc.data();
            const artistId = songData.artist || songData.uidars;

            // Só adiciona se o artista ainda não apareceu E não atingiu 30 músicas
            if (!seenArtists.has(artistId) && songsAdded < 30) {
                seenArtists.add(artistId);
                genreContent.push({ id: doc.id, type: 'track', ...songData });
                songsAdded++;
            }
        });

        // Limpa skeletons antes de renderizar
        listContainer.innerHTML = '';

        if (genreContent.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-500 p-4">Nenhum conteúdo de Forró encontrado.</p>';
            return;
        }

        // 4. RENDERIZAR OS CARDS
        genreContent.forEach(item => {
            let card;
            if (item.type === 'album') {
                // Tenta usar sua função global de card de álbum
                card = typeof createAlbumCard === 'function' ? createAlbumCard(item, item.id) : createDefaultCard(item);
            } else if (item.type === 'playlist') {
                // Tenta usar sua função global de card de playlist
                card = typeof createPlaylistCard === 'function' ? createPlaylistCard(item, item.id) : createDefaultCard(item);
            } else {
                // Para músicas individuais
                card = createDefaultCard(item);
            }
            if (card) listContainer.appendChild(card);
        });

        // Configura os botões de scroll
        setupScrollButtons('forro-scroll-left', 'forro-scroll-right', 'forro-genre-listt');

    } catch (error) {
        console.error("Erro ao carregar seção de Forró:", error);
    }
}

// Função de fallback para criar card caso as globais falhem
function createDefaultCard(item) {
    const div = document.createElement('div');
    div.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4 group';
    div.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md overflow-hidden shadow-lg bg-zinc-900">
            <img src="${item.cover || item.albumCover || './assets/default-cover.png'}" 
                 class="absolute top-0 left-0 w-full h-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div class="w-10 h-10 bg-[#1ed760] rounded-full flex items-center justify-center shadow-2xl">
                    <i class='bx bx-play text-black text-2xl ml-0.5'></i>
                </div>
            </div>
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${item.title || item.name || item.album}</h3>
            <p class="text-gray-400 text-xs truncate">${item.artistName || 'Tune'}</p>
        </div>
    `;
    div.onclick = () => {
        if (item.type === 'track' && window.playTrackGlobal) {
            window.playTrackGlobal(item);
        } else {
            // Se for álbum ou playlist, abre o conteúdo
            loadContent(item.type, item.id);
        }
    };
    return div;
}
// Substitua pelo ID da MÚSICA que você quer destacar
const MUSICA_DESTAQUE_ID = "BxAZfEhOImIqolsC3HqJ"; 

async function loadBannerAlbum() {
    const banner = document.getElementById('new-release-banner');
    const coverImg = document.getElementById('banner-cover');
    
    if (!banner || !coverImg) return;

    try {
        // Busca na coleção de MÚSICAS usando o ID de destaque
        const musicRef = doc(db, "musicas", MUSICA_DESTAQUE_ID);
        const musicSnap = await getDoc(musicRef);

        if (musicSnap.exists()) {
            const musicData = musicSnap.data();
            
            // 1. Preenche os textos usando os campos de música (title e artistName)
            document.getElementById('banner-title').textContent = musicData.title;
            document.getElementById('banner-artist-name').textContent = musicData.artistName || "Artista";

            // 2. Configura a imagem para extração de cor (CORS)
            coverImg.crossOrigin = "Anonymous";
            
            const extrairCor = () => {
                try {
                    const colorThief = new ColorThief();
                    const color = colorThief.getColor(coverImg);
                    const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                    banner.style.background = `linear-gradient(135deg, ${rgb} 0%, #121212 100%)`;
                } catch (e) {
                    banner.style.background = `linear-gradient(135deg, #282828 0%, #121212 100%)`;
                }
            };

            if (coverImg.complete) {
                extrairCor();
            } else {
                coverImg.onload = extrairCor;
            }

            // Define a capa da música
            coverImg.src = musicData.cover || "./assets/default-cover.png";

            // 3. Busca foto do artista (usando o UID do artista da música)
            const artistId = musicData.artist || musicData.uidars;
            if (artistId) {
                const artistRef = doc(db, "usuarios", artistId);
                const artistSnap = await getDoc(artistRef);
                if (artistSnap.exists()) {
                    const artistImg = document.getElementById('banner-artist-img');
                    if (artistImg) artistImg.src = artistSnap.data().foto || "/assets/default-artist.png";
                }
            }

            // 4. Ação de Clique: Tocar a música agora
            banner.onclick = (e) => {
                if (e.target.closest('.action-btn')) return;
                
                // Chama seu player global passando os dados da música
                if (window.playTrackGlobal) {
                    window.playTrackGlobal({
                        id: MUSICA_DESTAQUE_ID,
                        ...musicData
                    });
                }
            };

            banner.classList.add('loaded');
            banner.style.display = 'block';
        }
    } catch (error) {
        console.error("Erro ao carregar banner de música:", error);
    }
}



// ⭐ FUNÇÃO PARA CARREGAR ARTISTAS COM PRIORIDADE CLOUDINARY
async function setupArtistsCarouselPriority() {
    const listContainer = document.getElementById('artists-list');
    const loadingMessage = document.getElementById('artists-loading-message');
    if (!listContainer) return;

    try {
        // Busca os usuários que são artistas (limite de 40 para ordenar)
        const musicasRef = collection(db, "usuarios");
        const q = query(musicasRef, where("artista", "==", "true"), limit(40));
        const querySnapshot = await getDocs(q);
        
        let artistas = [];
        querySnapshot.forEach(doc => {
            artistas.push({ id: doc.id, ...doc.data() });
        });

        // ⭐ ORDENAÇÃO: Cloudinary primeiro, Firebase/Outros depois
        artistas.sort((a, b) => {
            const aIsCloudinary = (a.foto || "").includes("cloudinary.com") ? 1 : 0;
            const bIsCloudinary = (b.foto || "").includes("cloudinary.com") ? 1 : 0;
            return bIsCloudinary - aIsCloudinary; // Retorna 1 (a vem primeiro) ou 0
        });

        // Limpa o container e esconde o loading
        if (loadingMessage) loadingMessage.style.display = 'none';
        listContainer.innerHTML = '';

        // Renderiza apenas os 20 primeiros após a ordenação
        artistas.slice(0, 20).forEach(docData => {
            const card = createArtistCard(docData, docData.id);
            listContainer.appendChild(card);
        });

        // Ativa os botões de scroll (Certifique-se que essa função existe no seu código)
        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('artists-scroll-left', 'artists-scroll-right', 'artists-list');
        }

    } catch (error) {
        console.error("Erro ao carregar artistas prioritários:", error);
    }
}

// 1. Inicialização do Cache (Coloque no topo do seu arquivo JS)
window.__HOME_CACHE__ = window.__HOME_CACHE__ || { loaded: false, html: null, scrollPosition: 0 };
async function setupHomePage() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (window.__HOME_CACHE__.loaded && window.__HOME_CACHE__.html) {
        console.log("🏠 Restaurando Home do Cache...");
        contentArea.innerHTML = window.__HOME_CACHE__.html;
        rebindHomeUI(); 
        setGreeting();
        if (window.__HOME_CACHE__.scrollPosition) window.scrollTo(0, window.__HOME_CACHE__.scrollPosition);
        return;
    }

    try {
        setGreeting();
        await loadBannerAlbum();

        // 4. BLOCO 1: Aqui a ordem está correta
        await Promise.all([
            fetchAndRenderNewSingles(), 
            setupArtistsCarouselPriority(), // Prioridade Cloudinary carregada aqui
            setupContentCarousel(
                'albums-list', 'albums-scroll-left', 'albums-scroll-right', 
                'albums-loading-message', 'albuns', 
                [orderBy('date', 'desc'), limit(15)], createAlbumCard
            ),
            setupForroGenreSection(),   
            setupPopSection()
        ]);

        // 5. BLOCO 2: REMOVIDA A DUPLICATA DE ARTISTAS DAQUI
        Promise.all([
            loadTopStreamedPlaylists(),
            loadSertanejoSection(),
            setupLatinSection(),
            setupContentCarousel(
                'charts-list', 'charts-scroll-left', 'charts-scroll-right', 
                'charts-loading-message', 'playlists', 
                [where('category', '==', 'Charts'), limit(12)], createPlaylistCard
            ),
            // REPETIÇÃO REMOVIDA: setupContentCarousel de 'artists-list' não deve estar aqui!
            setupContentCarousel(
                'stations-list', 'stations-scroll-left', 'stations-scroll-right', 
                'stations-loading-message', 'playlists', 
                [where('category', '==', 'Stations'), limit(12)], createPlaylistCard
            ),
            setupContentCarousel(
                'playlist-genres-list', 'playlist-genres-scroll-left', 'playlist-genres-scroll-right', 
                'playlist-genres-loading-message', 'playlists', 
                [where('category', '==', 'Playlist Genres'), limit(12)], createPlaylistCard
            )
        ]);

        checkAuthAndLoadLikedItems();
        loadMyLikedItems();

        setTimeout(() => {
            if (contentArea.innerHTML.length > 500) {
                window.__HOME_CACHE__.html = contentArea.innerHTML;
                window.__HOME_CACHE__.loaded = true;
                console.log("✅ Cache da Home gerado corretamente.");
            }
        }, 3000);

    } catch (error) {
        console.error("Erro crítico ao carregar a Home:", error);
    }
}


// --- Inicialização da Aplicação ---

window.addEventListener('DOMContentLoaded', () => {
    // 1. Lógica para os cliques na navegação principal (latNav e botomIcon)
const navLinks = document.querySelectorAll('#latNav .nav-link, #mobile-nav-bar .nav-link'); 

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // bloqueia por padrão
            const page = link.dataset.page;

            // 🚨 exceção para o TuneTeam
            if (page === "tuneteam") {
                window.location.href = "tuneteam.html"; 
                return; // para aqui
            }

            // resto continua no loadContent
            if (page) {
                // Chama loadContent para a página principal (sem ID)
                loadContent(page);
                navLinks.forEach(l => l.classList.remove('ativo'));
                link.classList.add('ativo');
            }
        });
    });

    // 2. Lógica de Roteamento de Inicialização (Lê a URL na carga)
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('page'); // Ex: 'album', 'artist', 'home'
    const initialId = urlParams.get('id');     // Ex: ID do documento

    // Verifica se estamos em uma página de detalhes (album.html, artist.html, etc.)
    const path = window.location.pathname;
    const pageFileName = path.substring(path.lastIndexOf('/') + 1).replace('.html', ''); // Ex: 'album'

    // Prioriza o nome do arquivo, se for uma página de detalhe
    let currentPage = initialPage || 'home';
    let currentId = initialId;

    // Se o nome do arquivo (sem .html) for uma página detalhada, usa ele como base.
    if (['album', 'artist', 'playlist'].includes(pageFileName)) {
        currentPage = pageFileName;
        // O ID já foi lido da URL acima (urlParams.get('id'))
    }
    
    // Chama o roteador principal, passando a página e o ID (se houver)
    loadContent(currentPage, currentId);
    
});

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const fotoUrlInput = document.getElementById('fotoUrl');
    const previewFoto = document.getElementById('previewFoto');

    fotoUrlInput.addEventListener('input', (event) => {
        const url = event.target.value;
        if (url && url.startsWith('http')) {
            previewFoto.src = url;
        } else {
            previewFoto.src = 'assets/artistpfp.png';
        }

    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        if (senha !== confirmarSenha) {
            alert('As senhas não coincidem. Por favor, verifique.');
            return;
        }

        const nome = document.getElementById('nome').value;
        const user = document.getElementById('user').value;
        const email = document.getElementById('email').value;
        const gravadora = document.getElementById('gravadora').value;
        const bio = document.getElementById('bio').value;
        const foto_url = fotoUrlInput.value || 'assets/artistpfp.png';
        const tipo = 'artista';

        const novoArtista = {
            nome_artistico: nome,
            nome_usuario: user,
            email: email,
            gravadora: gravadora,
            senha: senha,
            bio: bio,
            foto_url: foto_url,
            tipo: tipo,
            data_cadastro: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const userDocRef = db.collection('artistas').doc(user);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                alert('Este nome de usuário já está em uso. Por favor, escolha outro.');
                return;
            }

            await userDocRef.set(novoArtista);

            alert('Conta de artista criada com sucesso!');
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Erro ao criar a conta:', error);
            alert(`Ocorreu um erro: ${error.message}`);
        }
    });
});

function getArtistIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadArtistData(artistId) {
  if (!artistId) {
    document.getElementById('artist-name').textContent = "ID do Artista Ausente";
    return;
  }

  try {
    const artistRef = doc(db, "usuarios", artistId);
    const artistSnap = await getDoc(artistRef);

    if (!artistSnap.exists() || artistSnap.data().artista !== "true") {
      document.getElementById('artist-name').textContent = "Artista Não Encontrado";
      return;
    }

    const artistData = artistSnap.data();

    document.getElementById('artist-name').textContent = artistData.apelido || "Nome Desconhecido";
    document.getElementById('artist-listeners').textContent = `${new Intl.NumberFormat('pt-BR').format(artistData.ouvintesMensais || 0)} ouvintes mensais`;

    // Define imagem de fundo
    const artistCoverBg = document.getElementById('artist-cover-bg');
    if (artistData.foto) {
      artistCoverBg.style.backgroundImage = `url('${artistData.foto}')`;
      artistCoverBg.style.backgroundSize = 'cover';
      artistCoverBg.style.backgroundPosition = 'center';
      artistCoverBg.style.backgroundRepeat = 'no-repeat';
    }

    // Carrega os álbuns do artista
    await loadArtistAlbums(artistId);

  } catch (error) {
    console.error("Erro ao carregar dados do artista:", error);
    document.getElementById('artist-name').textContent = "Erro ao carregar artista";
  }
}

async function loadArtistAlbums(artistId) {
    const albumsContainer = document.getElementById('albums-container');
    const albumsSection = document.getElementById('albums-section');
    
    if (!albumsContainer) return;
    
    albumsContainer.innerHTML = "";

    try {
        const q = query(collection(db, "albuns"), where('uidars', '==', artistId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            if (albumsSection) albumsSection.classList.add('hidden');
            return;
        }

        if (albumsSection) albumsSection.classList.remove('hidden');

        // 1. Transformar em Array
        const albumsList = [];
        querySnapshot.forEach(doc => {
            albumsList.push({ id: doc.id, ...doc.data() });
        });

        // 2. ORDENAÇÃO PELO FORMATO "YYYY-MM-DD" (MAIS RECENTE PRIMEIRO)
        albumsList.sort((a, b) => {
            // Criar objetos Date diretamente (o JS entende o formato 2020-12-11 nativamente)
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            
            return dateB - dateA; // Data maior (mais nova) vem primeiro
        });

        // 3. Renderizar
        albumsList.forEach(album => {
            const card = document.createElement('div');
            card.className = "scroll-item flex-shrink-0 w-40 cursor-pointer group";
            
            // Formatando a data para exibição (opcional: mostrar apenas o ano no card)
            const anoExibicao = album.date ? album.date.split('-')[0] : '2024';

            card.innerHTML = `
                <div class="relative aspect-square rounded-md overflow-hidden bg-[#282828] shadow-lg mb-3">
                    <img src="${album.cover}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105">
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div class="w-10 h-10 bg-[#1ed760] rounded-full flex items-center justify-center shadow-xl translate-y-2 group-hover:translate-y-0 transition-all">
                            <i class='bx bx-play text-black text-2xl ml-0.5'></i>
                        </div>
                    </div>
                </div>
                <h3 class="text-white font-bold text-sm truncate">${album.album}</h3>
                <p class="text-gray-400 text-xs mt-1">${anoExibicao}</p>
            `;
            
            card.onclick = () => loadContent('album', album.id);
            albumsContainer.appendChild(card);
        });

        setupScrollArrows('albums-container');

    } catch (error) {
        console.error("Erro ao carregar álbuns:", error);
    }
}

async function loadArtistStations(artistId) {
  if (!artistId) {
    console.warn("artistId vazio");
    return;
  }

  const stationsContainer = document.getElementById('stations-container');
  if (!stationsContainer) {
    console.error("Elemento #stations-container não encontrado");
    return;
  }

  stationsContainer.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Estações';
  title.className = 'text-2xl font-bold mb-4 mt-8';
  stationsContainer.appendChild(title);

  try {
    console.log("Buscando estações com uidars =", artistId);

    const q = query(
      collection(db, 'playlists'),
      where('category', '==', 'Stations'),
      where('uidars', '==', artistId)
    );

    const querySnapshot = await getDocs(q);
    console.log("Estações encontradas:", querySnapshot.size);

    if (querySnapshot.empty) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-gray-400';
      emptyMsg.textContent = 'Nenhuma estação encontrada para este artista.';
      stationsContainer.appendChild(emptyMsg);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';
    stationsContainer.appendChild(grid);

   querySnapshot.forEach(docSnap => {
    const station = docSnap.data();
    const stationId = docSnap.id;
    const card = document.createElement('div');
    card.className = 'cursor-pointer flex flex-col items-start group';

    card.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md overflow-hidden shadow-lg">
            <img src="${station.cover}" class="absolute top-0 left-0 w-full h-full object-cover transition-transform group-hover:scale-105" />
        </div>
        <div class="mt-2">
            <h3 class="text-sm font-semibold text-white truncate">${station.name}</h3>
            <p class="text-gray-400 text-xs">Estação</p>
        </div>
    `;

    // ⭐ MUDANÇA AQUI: Redireciona para a página de playlist com o ID da estação
    card.addEventListener('click', () => {
        navigateTo('playlist', stationId);
    });

    grid.appendChild(card);
});
  } catch (error) {
    console.error("Erro ao carregar estações:", error);
    const errorMsg = document.createElement('p');
    errorMsg.className = 'text-red-500';
    errorMsg.textContent = 'Erro ao carregar estações.';
    stationsContainer.appendChild(errorMsg);
  }
}

// album.js
function playTrack(track) {
    // Salva a música no localStorage
    localStorage.setItem("currentTrack", JSON.stringify(track));
    // Redireciona para a página do player
    window.location.href = "menu.html";
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTrack = JSON.parse(localStorage.getItem('currentTrack'));
    if(savedTrack) {
        playTrackGlobal(savedTrack);
    }
});


function playTrackGlobal(track) {
    const playerAudio = document.getElementById("player-audio");
    const playerCover = document.getElementById("player-cover");
    const playerTitle = document.getElementById("player-title");
    const playerArtist = document.getElementById("player-artist");

    playerAudio.src = track.audioUrl;
    playerCover.src = track.cover;
    playerTitle.textContent = track.title;
    playerArtist.textContent = track.artist;
    playerAudio.play();
}

// Add mouse movement interactivity to glass button
document.addEventListener('DOMContentLoaded', function() {
  // Get all glass elements
  const glassElements = document.querySelectorAll('.glass-button');
  
  // Add mousemove effect for each glass element
  glassElements.forEach(element => {
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);
  });
  
  // Handle mouse movement over glass elements
  function handleMouseMove(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    
    // Add highlight effect
    const specular = this.querySelector('.glass-specular');
    if (specular) {
      specular.style.background = `radial-gradient(
        circle at ${x}px ${y}px,
        rgba(255,255,255,0.15) 0%,
        rgba(255,255,255,0.05) 30%,
        rgba(255,255,255,0) 60%
      )`;
    }
  }
  
  // Reset effects when mouse leaves
  function handleMouseLeave() {
    const filter = document.querySelector('#glass-distortion feDisplacementMap');
    if (filter) {
      filter.setAttribute('scale', '77');
    }
    
    const specular = this.querySelector('.glass-specular');
    if (specular) {
      specular.style.background = 'none';
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  handleInitialRoute();
});

// Este "vigia" nunca morre, não importa quantas vezes você mude o conteúdo
document.body.addEventListener('click', (e) => {
    // Verifica se o clique foi em um elemento com data-navigate ou dentro de um
    const target = e.target.closest('[data-navigate]');
    
    if (target) {
        e.preventDefault();
        const page = target.getAttribute('data-navigate');
        const id = target.getAttribute('data-id');
        
        console.log("Navegando para:", page, "ID:", id);
        
        // Se a função loadContent estiver disponível globalmente
        if (typeof loadContent === 'function') {
            loadContent(page, id);
        }
    }
});