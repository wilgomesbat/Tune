// 1. Import do player (mantenha como está)
import { loadTrack } from './player.js'; 

// 2. Importe apenas as FUNÇÕES que você vai usar do Firebase (sem inicializar nada aqui)
import { 
    getFirestore, serverTimestamp, deleteDoc, collection, addDoc, query, 
    onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, limit, where, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 3. IMPORTANTE: Importe as INSTÂNCIAS do seu novo arquivo de configuração
// Isso garante que todo o site use a mesma conexão
import { db, auth } from './firebase-config.js';


async function loadContent(pageName, id = null, shouldPushState = true) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea || !pageName) return;

    // --- A) TRAVA DE CACHE (ECONOMIA DE CLOUD) ---
    if (pageName === 'home' && window.__HOME_CACHE__.loaded && window.__HOME_CACHE__.html) {
        console.log("🏠 Restaurando Home do cache global (0 leituras Cloud)");
        contentArea.innerHTML = window.__HOME_CACHE__.html;
        
        rebindHomeUI(); // Reativa os cliques nos botões
        
        if (shouldPushState) updateBrowserHistory(pageName, id);
        return; 
    }

    try {
        // --- B) BUSCA DO ARQUIVO HTML ---
        const response = await fetch(`/pages/${pageName}.html`); 
        
        if (!response.ok) {
            throw new Error(`Página ${pageName} não encontrada no servidor.`);
        }

        const html = await response.text();
        contentArea.innerHTML = html;

        // --- C) GESTÃO DE HISTÓRICO ---
        if (shouldPushState) {
            updateBrowserHistory(pageName, id);
        }

        // --- D) SETUP DAS PÁGINAS ---
        setTimeout(() => {
            console.log(`🛠️ Executando setup para: ${pageName}`);
            
            const safeSetup = (fn, param = null) => {
                try { if (typeof fn === 'function') fn(param); } 
                catch (e) { console.error(`Erro no setup de ${pageName}:`, e); }
            };

         // Dentro da sua função de navegação/load (provavelmente loadContent ou similar)
switch (pageName) {
    case 'home':         safeSetup(setupHomePage); break;
    case 'music':        safeSetup(setupMusicPage, id); break;
    case 'album':        safeSetup(setupAlbumPage, id); break;
    case 'artist':       safeSetup(setupArtistPage, id); break;
    case 'playlist':     safeSetup(setupPlaylistPage, id); break;
    case 'liked':        safeSetup(setupLikedPage); break;
    case 'library':  
        safeSetup(setupLibraryPage, id); 
        if (typeof checkAuthAndLoadLikedItems === 'function') checkAuthAndLoadLikedItems();
        break;
    case 'loginartists': safeSetup(setupLoginartistsPage, id); break;
    case 'banida':       console.warn("Usuário acessando tela de banimento."); break;
    case 'search': 
        import('./search.js').then(m => m.setupSearchPage()).catch(e => console.error(e));
        break;

   case 'artists': 
    // Garante que o HTML já existe antes de tentar preencher o grid
    setTimeout(() => {
        if (typeof window.renderAllArtistsGrid === 'function') {
            window.renderAllArtistsGrid();
        }
    }, 100); 
    break;

    default:
        console.warn(`Nenhum setup específico encontrado para: ${pageName}`);
}

// Verificação de status do artista após o carregamento
if (window.currentUserUid) {
    verificarStatusArtista(window.currentUserUid);
}

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);

// No catch do seu loadContent no main.js:
} catch (error) {
    console.error("❌ Erro ao carregar conteúdo:", error);
    
    // Em vez de reiniciar o site, apenas mostre um erro na tela ou carregue a home
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = `<h2>Página não encontrada</h2><p>${error.message}</p>`;
    }

    // REMOVA ISSO: window.location.href = "https://tunedks.com"; 
}
}

window.loadContent = loadContent;

// --- ROTEAMENTO CORRIGIDO ---
function initializeRouting() {
    
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    let page = 'home';
    let id = null;

   const pathParts = pathname.split('/').filter(p => p !== "" && p !== "menu.html" && p !== "index.html");

    if (pathParts.length > 0) {
        page = pathParts[0]; // 'album', 'playlist', etc.
        id = pathParts[1] || null; // o ID longo
    } else if (urlParams.has('page')) {
        page = urlParams.get('page');
        id = urlParams.get('id');
    }

    if (page.includes('.html')) page = page.replace('.html', '');
    if (!page || page === 'undefined' || page === 'null') page = 'home';

    console.log(`🚀 Roteamento inicial: [${page}] com ID [${id}]`);
    
    // Pequeno delay para garantir que o Firebase e o DOM estejam prontos
    setTimeout(() => {
        if (typeof window.loadContent === 'function') {
            window.loadContent(page, id, false);
        }
    }, 100);
}

onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const isAtLogin = path === "/" || path.includes("index.html") || path === "/index";

    if (!user) {
        console.warn("Usuário não logado.");
        if (!isAtLogin) {
            console.log("Proteção: Redirecionando para raiz");
            window.location.href = "/"; 
        }
        return;
    }

    // --- VERIFICAÇÃO DE STATUS (BLOQUEIO POR SPAM) ---
    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            if (userData.status === "suspenso") {
                const agora = new Date();
                const expira = userData.suspensaoAte?.toDate();

                if (expira && agora < expira) {
                    // SE AINDA ESTIVER SUSPENSO: Trava a navegação global
                    renderizarTelaBloqueioTune(expira);
                    return; // Interrompe a execução para não carregar o site
                } else {
                    // SE O TEMPO PASSOU: Reativa a conta automaticamente
                    await updateDoc(userRef, { status: "ativo" });
                }
            }
        }
    } catch (error) {
        console.error("Erro ao verificar status de suspensão:", error);
    }

    // --- USUÁRIO LOGADO E ATIVO ---
    console.log("✅ Usuário autenticado e ativo:", user.uid);
    window.currentUserUid = user.uid;

    if (isAtLogin) {
        window.loadContent('home', null, false);
    } else {
        initializeRouting();
    }

    verificarStatusArtista(user.uid);
});

function renderizarTelaBloqueioTune(dataExpira) {
    const minutosRestantes = Math.ceil((dataExpira - new Date()) / 60000);
    
    // Verifica se o modal já existe para não duplicar
    if (document.getElementById('ban-popup-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ban-popup-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100000;
        background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(15px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; font-family: 'Nationale Regular', sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: #0a0a0a; border: 1px solid #1a1a1a; padding: 50px 40px; border-radius: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 1);">
            

            <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(244, 67, 54, 0.1); color: #f44336; padding: 10px 20px; border-radius: 100px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border: 1px solid rgba(244, 67, 54, 0.2); margin-bottom: 24px;">
                                Acesso Suspenso
            </div>


            <h1 style="font-family: 'Nationale Black'; font-size: 26px; color: #fff; margin-bottom: 12px; text-transform: uppercase;">Conta Suspensa</h1>
            <p style="color: #888; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                Identificamos uma atividade irregular de cliques na sua conta. Para proteger os nossos artistas, o seu acesso foi restringido temporariamente.
            </p>

            <div style="background: #111; border: 1px solid #222; padding: 20px; border-radius: 16px; margin-bottom: 30px;">
                <p style="font-size: 10px; color: #444; text-transform: uppercase; margin-bottom: 5px; font-weight: bold;">Poderá voltar em</p>
                <span style="font-size: 24px; font-weight: bold; color: #fff;">${minutosRestantes} minutos</span>
            </div>

            <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px;">
                <a href="termos.html" style="color: #555; text-decoration: none; font-size: 12px; font-weight: bold;">Termos de Uso</a>
                <a href="https://x.com/tunedks" style="color: #555; text-decoration: none; font-size: 12px; font-weight: bold;">Suporte</a>
            </div>

           
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden'; // Impede o scroll ao fundo
    
    // Opcional: Recarregar automaticamente quando o tempo acabar
    setTimeout(() => window.location.reload(), (minutosRestantes * 60000));
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

// -------------------------------
// ☁️ Cloudinary (UPLOAD FRONT)
// -------------------------------
const CLOUD_NAME = "dykhzs0q0";
const UPLOAD_PRESET = "tunestrg";


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
    
    listarMusicasArtista();
    listarAlbunsArtista();
}

function setupAddMusicPage() {
    
    carregarAlbunsNoSelect();
}

function setupAddAlbumPage() {
   
}




function handleInitialRoute() {
    const params = new URLSearchParams(window.location.search);

    const page = params.get('page') || 'home';
    const id = params.get('id');

    loadContent(page, id);
}

async function verificarStatusArtista(uid) {
    // Tenta encontrar o container. Se for SPA, ele pode demorar a aparecer no DOM
    let promoContainer = document.querySelector('.artist-promo-container');
    
    // Se não achar de primeira, espera 100ms e tenta de novo (máximo 5 vezes)
    if (!promoContainer) {
        let tentativas = 0;
        const interval = setInterval(async () => {
            promoContainer = document.querySelector('.artist-promo-container');
            tentativas++;
            
            if (promoContainer || tentativas > 5) {
                clearInterval(interval);
                if (promoContainer) processarExibicao(promoContainer, uid);
            }
        }, 100);
        return;
    }

    processarExibicao(promoContainer, uid);
}

// Função auxiliar para processar a lógica
async function processarExibicao(container, uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.artista === true || userData.artista === "true") {
                console.log("🎨 Exibindo banner promo para artista.");
                container.style.setProperty('display', 'block', 'important');
            } else {
                container.style.display = 'none';
            }
        }
    } catch (e) { console.error(e); }
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
      
        // Fallbacks: usa o que está no Auth ou o valor padrão
        nomeArtistico = user.displayName || 'Artista Desconhecido';
        apelido = uid;
        profilePicURL = user.photoURL || DEFAULT_PROFILE_PIC;
    }
} catch (error) {
           
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
    
    // Supondo que artistCache já esteja definido globalmente (ex: const artistCache = {};)
    if (typeof artistCache !== 'undefined' && artistCache[artistUid]) {
        return artistCache[artistUid];
    }
    
    try {
        const artistRef = doc(db, "usuarios", artistUid);
        // CORREÇÃO: Nomeamos a variável como artistSnap para coincidir com o uso abaixo
        const artistSnap = await getDoc(artistRef);

        if (artistSnap.exists()) {
            const data = artistSnap.data();
            // AJUSTE: Usando a chave 'nomeArtistico' conforme seu banco
            const name = data.nomeArtistico || data.displayName || data.name || "Artista";
            
            if (typeof artistCache !== 'undefined') {
                artistCache[artistUid] = name;
            }
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
            return '<span style="color: #77e09e; font-size: 10px; display: block; line-height: 1;">▲</span>';
        } else {
            // NÃO reproduzida nas últimas 7h: Vermelha (Caindo)
            return '<span style="color: #af7474; font-size: 10px; display: block; line-height: 1;">▼</span>';
        }
    } catch (e) {
        console.error("Erro ao calcular tendência:", e);
        return '';
    }
}

// Função para formatar números (ex: 100k, 1.2m)
function formatNumber(num) {
    if (!num) return "0";
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'b';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
}

export async function setupArtistPage(artistUid) {
    if (!artistUid) return;

    try {
        // 1. CARREGAR PERFIL, BIO E FOTOS
        const artistDoc = await getDoc(doc(db, "usuarios", artistUid));
        if (artistDoc.exists()) {
            const data = artistDoc.data();
            document.getElementById('artist-name').innerText = data.nomeArtistico || "Artista";
            
            const headerEl = document.getElementById('artist-header');
            if (headerEl && data.foto) headerEl.style.setProperty('--bg-img', `url('${data.foto}')`);

            const aboutCard = document.getElementById('artist-about-card');
            if (aboutCard && data.foto) aboutCard.style.backgroundImage = `url('${data.foto}')`;
            
            const bioTextEl = document.getElementById('artist-bio-text');
            if (bioTextEl) bioTextEl.innerText = data.bio || `${data.nomeArtistico} é um destaque no Tune.`;
        }

        // 2. CÁLCULO DOS NÚMEROS (Streams vs Ouvintes)
        const musicasRef = collection(db, "musicas");
        const qArtistMusics = query(musicasRef, where("artist", "==", artistUid));
        const artistMusicsSnap = await getDocs(qArtistMusics);
        
        let totalAllTimeStreams = 0;
        let totalMonthlyListeners = 0; 

        artistMusicsSnap.forEach(d => {
            const mData = d.data();
            totalAllTimeStreams += Number(mData.streams || 0);
            totalMonthlyListeners += Number(mData.ouvintesMensais || 0);
        });

        // --- AQUI ESTÁ A INVERSÃO QUE VOCÊ PEDIU ---

        // A) NO TOPO (Header): Colocamos os OUVINTES MENSAIS
        const listenersHeaderEl = document.getElementById('total-streams'); // O ID no HTML é total-streams, mas agora injetamos ouvintes
        if (listenersHeaderEl) {
            listenersHeaderEl.innerText = formatNumber(totalMonthlyListeners);
            // Se quiser mudar o texto de "streams" para "ouvintes" no HTML, 
            // você pode selecionar o parágrafo .stats e mudar também.
            const statsText = document.querySelector('.artist-header .stats');
            if(statsText) statsText.innerHTML = `<span id="total-streams">${formatNumber(totalMonthlyListeners)}</span> ouvintes mensais`;
        }

        // B) NO CARD SOBRE (Baixo): Colocamos o TOTAL DE STREAMS
        const monthlyEl = document.getElementById('artist-monthly-listeners'); // O ID aponta para ouvintes, mas injetamos STREAMS totais
        if (monthlyEl) {
            monthlyEl.innerText = `${formatNumber(totalAllTimeStreams)} streams no total`;
        }

        // 3. RANKING GLOBAL (Mantido por Ouvintes Mensais)
        await calculateGlobalRanking(artistUid);

        // 4. CARREGAR CONTEÚDO RESTANTE
        await Promise.all([
            loadTopSongs(artistUid),
            loadArtistAlbums(artistUid),
            loadArtistSingles(artistUid),
            loadArtistStations(artistUid),
            checkFollowStatus(artistUid)
        ]);

    } catch (error) {
        console.error("Erro no setup da página:", error);
    }
}

/**
 * FUNÇÃO DE RANKING: Calcula a posição do artista no mundo
 */
async function calculateGlobalRanking(artistUid) {
    try {
        const allMusicsSnap = await getDocs(collection(db, "musicas"));
        const artistTotals = {};

        // Agrupa streamsMensal por artista
        allMusicsSnap.forEach(doc => {
            const data = doc.data();
            const uid = data.artist;
            const sm = Number(data.streamsMensal || 0);
            artistTotals[uid] = (artistTotals[uid] || 0) + sm;
        });

        // Transforma em array, ordena do maior para o menor e pega o index
        const sortedArtists = Object.entries(artistTotals)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const position = sortedArtists.indexOf(artistUid) + 1;

        const badge = document.getElementById('ranking-badge');
        const rankingNum = document.getElementById('ranking-number');
        
        if (position > 0 && badge) {
            rankingNum.innerText = `#${position}`;
            badge.classList.remove('hidden'); // Só mostra se estiver no ranking
        }
    } catch (e) {
        console.error("Erro Ranking:", e);
    }
}

async function loadArtistStations(artistUid) {
    const container = document.getElementById('artist-stations-list');
    if (!container) return;

    try {
        const q = query(collection(db, "playlists"), where("uidars", "==", artistUid), limit(10));
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        if (snap.empty) {
            const section = container.closest('.section');
            if (section) section.style.display = 'none';
            return;
        }

        snap.forEach((doc) => {
            const data = doc.data();
            const stationCard = document.createElement('div');
            stationCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4 group';
            
            // CARREGAMENTO SPA USANDO SUA FUNÇÃO loadContent
            stationCard.onclick = () => {
                if (typeof loadContent === 'function') {
                    loadContent('playlist', doc.id);
                } else {
                    console.error("Função loadContent não encontrada!");
                }
            };

            stationCard.innerHTML = `
                <div class="relative w-full pb-[100%] rounded-md overflow-hidden">
                    <img src="${data.cover || '/assets/default-cover.png'}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg transition-transform duration-300 group-hover:scale-105">
                </div>
                <div class="mt-2 w-full">
                    <h3 class="text-sm font-semibold text-white truncate group-hover:underline">${data.name || 'Station'}</h3>
                    <p class="text-gray-400 text-xs truncate">Playlist</p>
                </div>`;
            container.appendChild(stationCard);
        });

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('stations-scroll-left', 'stations-scroll-right', 'artist-stations-list');
        }
    } catch (e) { console.error("Erro Stations:", e); }
}

/**
 * MÚSICAS POPULARES (TOP 5)
 */
async function loadTopSongs(artistUid) {
    const container = document.getElementById('popular-songs-list');
    if (!container) return;

    try {
        const q = query(collection(db, "musicas"), where("artist", "==", artistUid), orderBy("streams", "desc"), limit(5));
        const snap = await getDocs(q);
        
        container.innerHTML = '';
        snap.forEach((doc) => {
            const song = doc.data();
            container.innerHTML += `
                <div class="song-item" onclick="playMusic('${doc.id}')">
                    <img src="${song.cover}" class="song-cover">
                    <div class="song-info-main">
                        <span class="song-title">${song.title}</span>
                        ${song.explicit ? '<span class="explicit-badge">E</span>' : ''}
                    </div>
                    <div class="song-streams-count">${formatNumber(song.streams)}</div>
                </div>`;
        });
    } catch (e) { console.error("Erro Populares:", e); }
}

async function loadArtistAlbums(artistUid) {
    const container = document.getElementById('artist-albums-list');
    if (!container) return;

    try {
        // Ordenação adicionada: date (desc) para os mais recentes primeiro
        const q = query(
            collection(db, "albuns"), 
            where("uidars", "==", artistUid),
            orderBy("date", "desc") 
        );
        const snap = await getDocs(q);
        
        container.innerHTML = '';
        
        snap.forEach((doc) => {
            const data = doc.data();
            const albumCard = document.createElement('div');
            albumCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
            albumCard.setAttribute('data-navigate', 'album');
            albumCard.setAttribute('data-id', doc.id);

            albumCard.innerHTML = `
                <div class="relative w-full pb-[100%] rounded-md">
                    <img src="${data.cover || '/assets/default-cover.png'}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
                </div>
                <div class="mt-2 w-full">
                    <h3 class="text-sm font-semibold text-white truncate">${data.album}</h3>
                    <p class="text-gray-400 text-xs truncate">${data.date ? data.date.split('-')[0] : 'Álbum'}</p>
                </div>
            `;
            container.appendChild(albumCard);
        });

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('albums-scroll-left', 'albums-scroll-right', 'artist-albums-list');
        }

    } catch (e) { console.error("Erro Álbuns:", e); }
}

async function loadArtistSingles(artistUid) {
    const container = document.getElementById('artist-singles-list');
    if (!container) return;

    try {
        // Ordenação adicionada: timestamp (desc) para os lançamentos mais recentes
        const q = query(
            collection(db, "musicas"), 
            where("artist", "==", artistUid),
            where("single", "==", "true"),
            orderBy("timestamp", "desc")
        );
        const snap = await getDocs(q);

        container.innerHTML = '';
        snap.forEach((doc) => {
            const data = doc.data();
            if (data.album === "Single") {
                const singleCard = document.createElement('div');
                singleCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
                singleCard.onclick = () => playMusic(doc.id);

                singleCard.innerHTML = `
                    <div class="relative w-full pb-[100%] rounded-md">
                        <img src="${data.cover || '/assets/default-cover.png'}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
                    </div>
                    <div class="mt-2 w-full">
                        <div class="flex items-center gap-1">
                            <h3 class="text-sm font-semibold text-white truncate">${data.title}</h3>
                            ${(data.explicit === true || data.explicit === "true") ? '<span class="explicit-badge-small">E</span>' : ''}
                        </div>
                        <p class="text-gray-400 text-xs truncate">Single</p>
                    </div>
                `;
                container.appendChild(singleCard);
            }
        });

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('singles-scroll-left', 'singles-scroll-right', 'artist-singles-list');
        }

    } catch (e) { console.error("Erro Singles:", e); }
}

async function checkFollowStatus(artistUid) {
    const user = auth.currentUser;
    if (!user) return;
    
    const followRef = doc(db, `usuarios/${user.uid}/seguindo`, artistUid);
    const docSnap = await getDoc(followRef);
    
    const followBtn = document.querySelector('.btn-seguir-pill');
    const followText = followBtn.querySelector('.follow-text');
    const followIcon = followBtn.querySelector('.icon-asset');

    if (docSnap.exists()) {
        followBtn.classList.add('following');
        if (followText) followText.innerText = "Seguindo";
        if (followIcon) followIcon.src = "/assets/cancel_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg"; // Ícone de check se tiver
    } else {
        followBtn.classList.remove('following');
        if (followText) followText.innerText = "Seguir";
        if (followIcon) followIcon.src = "/assets/add_circle_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
    }
}

async function toggleFollow(artistUid) {
    const user = auth.currentUser;
    if (!user) return alert("Inicia sessão para seguir!");

    // Referência do documento na subcoleção 'seguindo' do usuário logado
    const followRef = doc(db, `usuarios/${user.uid}/seguindo`, artistUid);
    
    try {
        const docSnap = await getDoc(followRef);

        if (docSnap.exists()) {
            // Se já segue, remove
            await deleteDoc(followRef);
            console.log("Deixou de seguir");
        } else {
            // Se não segue, adiciona
            await setDoc(followRef, { 
                artistId: artistUid, 
                dataSeguida: serverTimestamp() 
            });
            console.log("Começou a seguir");
        }

        // CHAMA A ATUALIZAÇÃO VISUAL APÓS A MUDANÇA
        await checkFollowStatus(artistUid);

    } catch (error) {
        console.error("Erro ao seguir artista:", error);
    }
}

async function playMusic(musicId) {
    try {
        const docSnap = await getDoc(doc(db, "musicas", musicId));

        if (!docSnap.exists()) return;

        const track = {
            id: musicId,
            ...docSnap.data()
        };

        if (typeof window.playTrackGlobal === 'function') {
            window.playTrackGlobal(track);
        }

    } catch (e) {
        console.error("Erro ao tocar música:", e);
    }
}

window.setupArtistPage = setupArtistPage;
window.playMusic = playMusic;
async function setupPlaylistPage(playlistId) {
    // 1. Captura de elementos do DOM
    const playlistImgDetail = document.getElementById("playlist-cover-detail");
    const playlistTitleDetail = document.getElementById("playlist-title-detail");
    const playlistDescriptionDetail = document.getElementById("playlist-description-detail");
    const tracksContainer = document.getElementById("tracks-container");
    const bgBlur = document.getElementById("bg-image-blur");
    
    const fallbackImage = 'https://i.ibb.co/HTCFR8Db/Design-sem-nome-4.png'; 

    if (!playlistId) return;

    try {
        // 2. Busca de dados da Playlist no Firebase
        const playlistRef = doc(db, "playlists", playlistId);
        const playlistSnap = await getDoc(playlistRef);

        if (!playlistSnap.exists()) {
            if (playlistTitleDetail) playlistTitleDetail.textContent = "Playlist não encontrada";
            if (tracksContainer) tracksContainer.innerHTML = `<p class="text-gray-400">Playlist não encontrada.</p>`;
            return;
        }

        const playlist = { id: playlistSnap.id, ...playlistSnap.data() };
        const coverUrl = playlist.cover || fallbackImage;
        const playlistName = playlist.name || "Sem título";

        // 3. Atualização da UI (Textos e Imagens)
        if (playlistTitleDetail) playlistTitleDetail.textContent = playlistName;
        if (playlistImgDetail) playlistImgDetail.src = coverUrl;
        if (playlistDescriptionDetail) {
            playlistDescriptionDetail.textContent = playlist.category === "Stations" 
                ? "Baseada nas músicas deste artista." 
                : (playlist.description || "");
        }

        if (bgBlur) {
            bgBlur.style.backgroundImage = `url('${coverUrl}')`;
        }

        // 4. Definição de Variáveis de Controle
        let tracks = [];
        const automaticTopNames = ["Top 50", "Daily Top 50", "Top 50 Brasil", "Top 50 World"]; 
        const isRecentReleases = ["Novidades da Semana", "Novidades", "Lançamentos da Semana"].includes(playlistName);
        const isAutomaticTop = automaticTopNames.includes(playlistName) && playlist.category === "Charts";
        const generosBR = ["Sertanejo", "Funk", "Pagode", "MPB", "Forró", "Arrocha"]; 

        // --- A) Lógica de Charts Automáticos (Ranking Estável 50/50) ---
        if (isAutomaticTop) {
            const isBrasilChart = playlistName.includes("Brasil");
            const isWorldChart = playlistName.includes("World");

            // Busca os 200 melhores por mensal para garantir que a base seja de sucessos reais
            const q = query(
                collection(db, "musicas"), 
                orderBy("streamsMensal", "desc"), 
                limit(200) 
            );
            
            const snap = await getDocs(q);
let rawTracks = [];

snap.forEach((d) => {
    const data = d.data();

    const sMensal = data.streamsMensal || 0;
    const sAtual = data.streams || 0;
    const fatorRecencia = calcularFatorRecencia(data.lastMonthlyStreamDate);

    const tuneScore =
        (sMensal * 0.7) +
        (sAtual * 0.2) +
        (fatorRecencia * 0.1);

    rawTracks.push({
        id: d.id,
        ...data,
        tuneScore
    });
});

// 👇 COLOCA AQUI
rawTracks.sort((a, b) => b.tuneScore - a.tuneScore);

// 👇 SÓ DEPOIS FAZ OS FILTROS
if (isBrasilChart) {
    tracks = rawTracks
        .filter(m => generosBR.includes(m.genre) || isPortuguese(m.title))
        .slice(0, 50);
}
else if (isWorldChart) {
    tracks = rawTracks
        .filter(m => !generosBR.includes(m.genre) && !isPortuguese(m.title))
        .slice(0, 50);
}
else {
    tracks = rawTracks.slice(0, 50);
}
        } 
        // --- B) Lançamentos Recentes ---
        else if (isRecentReleases) {
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
                const ids = playlist.track_ids.slice(0, 30);
                const q = query(collection(db, "musicas"), where("__name__", "in", ids));
                const snapIn = await getDocs(q);
                snapIn.forEach(d => tracks.push({ id: d.id, ...d.data() }));
            }
        }

        // 5. Ordenação Final (para playlists manuais/álbuns)
        if (!isAutomaticTop && !playlist.uidars) { 
            tracks.sort((a, b) => (a.trackNumber || 99) - (b.trackNumber || 99));
        }

        // 6. Renderização
        if (typeof renderTracksSpotifyStyle === "function") {
            renderTracksSpotifyStyle(tracks, playlist, isAutomaticTop);
        }

    } catch (error) {
        console.error("Erro ao carregar playlist:", error);
        if (tracksContainer) {
            tracksContainer.innerHTML = `<p class="text-red-500">Ocorreu um erro ao carregar as músicas.</p>`;
        }
    }
}

function calcularFatorRecencia(lastMonthlyStreamDate) {
    if (!lastMonthlyStreamDate) return 0;

    const agora = new Date();
    const ultimaAtualizacao = lastMonthlyStreamDate.toDate 
        ? lastMonthlyStreamDate.toDate() 
        : new Date(lastMonthlyStreamDate);

    const diffDias = (agora - ultimaAtualizacao) / (1000 * 60 * 60 * 24);

    // Se foi atualizado nos últimos 7 dias → bônus máximo
    if (diffDias <= 7) return 1000;

    // Entre 7 e 30 dias → bônus médio
    if (diffDias <= 30) return 500;

    // Mais antigo → nenhum bônus
    return 0;
}

// Helper: Detecção de idioma
function isPortuguese(title) {
    if (!title) return false;
    const temAcentuacao = /[áàâãéêíóôõúç]/i.test(title);
    if (temAcentuacao) return true;
    const palavrasBR = ["o", "a", "os", "as", "do", "da", "no", "na", "com", "para", "pra", "pro", "que", "você", "te", "meu", "amanhã", "encontro"];
    const palavrasNoTitulo = title.toLowerCase().split(/\s+/);
    return palavrasNoTitulo.some(p => palavrasBR.includes(p));
}

async function toggleLike(type, itemId, buttonElement) {
    if (!currentUserUid || !itemId) {
        showToast('Você precisa estar logado para interagir.', 'error');
        return;
    }

    // --- MUDANÇA AQUI: Define o caminho como SUBCOLEÇÃO do usuário ---
    // Estrutura: usuarios / {UID} / curtidas / {ITEM_ID}
    const userCurtidasRef = collection(db, 'usuarios', currentUserUid, 'curtidas');
    const docRef = doc(userCurtidasRef, itemId);

    try {
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // --- ADICIONAR CURTIDA ---
            const title = document.getElementById('album-title-detail')?.textContent || 'Título';
            const cover = document.getElementById('album-cover-detail')?.src || '';

            await setDoc(docRef, {
                itemId: itemId, 
                id: itemId,     
                type: (type === 'music' || type === 'track') ? 'music' : 'album',
                title: title,
                cover: cover,
                timestamp: serverTimestamp()
            });

            updateLikeButtonState(buttonElement, true);
            
            if (type === 'music' || type === 'track') {
                showToast('Adicionado a Músicas Curtidas.', 'like');
            } else {
                showToast('Álbum adicionado à sua biblioteca.', 'like');
            }
            
        } else {
            // --- REMOVER CURTIDA ---
            await deleteDoc(docRef);
            updateLikeButtonState(buttonElement, false);
            showToast('', 'unlike'); 
        }
    } catch (error) {
        console.error("Erro ao processar curtida:", error);
        showToast('Erro ao salvar sua curtida.', 'error');
    }
}





function updateLikeButtonState(button, isLiked) {
    if (!button) return; // Segurança caso o botão não exista

    const img = button.querySelector('img');
    if (!img) {
        console.warn("Aviso: Imagem não encontrada dentro do botão de curtida.", button);
        return; // Impede o erro de 'src' of null
    }

    // Usando os seus SVGs de estrela para fidelidade extrema
    const iconBase = "./assets/star_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
    const iconLiked = "./assets/star_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg";

    if (isLiked) {
        img.src = iconLiked;
        button.classList.add('is-liked');
        // No PC, mantém a estrela preenchida sempre visível
        button.classList.remove('opacity-40');
        button.style.opacity = "1";
    } else {
        img.src = iconBase;
        button.classList.remove('is-liked');
        // No PC, volta a opacidade baixa para o estado "vazio"
        button.style.opacity = "0.4";
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
    if (!tracksContainer) return;
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

            const scheduledDate = track.scheduledTime && track.scheduledTime !== "Imediato" 
                                  ? new Date(track.scheduledTime) : null;
            const isLocked = scheduledDate && scheduledDate > now;

            const coverUrl = track.cover || playlist.cover || './assets/default-cover.png';
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

                <div class="flex items-center gap-3 ml-auto">
                    <button class="track-like-button p-2 transition-all active:scale-75 ${isLocked ? 'hidden' : 'opacity-0 group-hover:opacity-100'}">
                        <img src="/assets/star_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg" class="w-[20px] transition-opacity" style="opacity: 0.2;">
                    </button>
                    
                    <div class="text-gray-400 text-xs text-right font-mono min-w-[45px]">
                        ${isLocked ? '--:--' : (track.duration || '--:--')}
                    </div>
                </div>
            `;

            // 1. Sincronizar o Nome do Artista
            getArtistName(track.artist).then(name => {
                const nameField = trackRow.querySelector('.artist-name-field');
                if (nameField) nameField.textContent = name;
            });

            // 2. Sincronizar o Estado da Estrela (Like)
            const likeBtn = trackRow.querySelector('.track-like-button');
            if (!isLocked && currentUserUid && likeBtn) {
                // Usamos a mesma função de checagem universal
                checkAndSetLikeState('music', trackId, likeBtn);
                
                // Evento de clique na estrela
                likeBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // Não toca a música
                    toggleLikeMusic(track, likeBtn);
                });
            }

            // 3. Evento de Clique na Linha (Play)
            if (!isLocked) {
                trackRow.addEventListener("click", (e) => {
                    if (e.target.closest('.track-like-button')) return;

                    if (typeof window.checkAndResetMonthlyStreams === 'function') {
                        window.checkAndResetMonthlyStreams(track); 
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

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // acromático
    } else {
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


async function checkAndSetLikeState(type, itemId, buttonElement) {
    if (!currentUserUid || !itemId || !buttonElement) return;

    // Define a coleção exata: likedmusics... ou likedalbuns...
    const collectionPrefix = (type === 'music' || type === 'track') ? 'likedmusics' : 'likedalbuns';
    const collectionPath = `${collectionPrefix}${currentUserUid}`;
    
    const docRef = doc(db, collectionPath, itemId);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log(`[TUNE] ${type} curtido encontrado em: ${collectionPath}`);
            updateLikeIcon(buttonElement, true);
        } else {
            updateLikeIcon(buttonElement, false);
        }
    } catch (error) {
        console.error(`Erro ao checar curtida do ${type}:`, error);
    }
}

async function toggleLikeMusic(track, buttonElement) {
    // Pega o usuário logado na hora do clique
    const user = auth.currentUser;
    
    if (!user) {
        showToast('Você precisa estar logado para curtir.', 'error');
        return;
    }

    const uid = user.uid;
    const trackId = track.id;

    if (!trackId) {
        console.error("Erro: ID da música não encontrado no objeto track.");
        return;
    }

    // Caminho exato: likedmusicsVRxrKRgfz1b2dlNdEQCDlv1C2XV2
    const collectionPath = `likedmusics${uid}`;
    const docRef = doc(db, collectionPath, trackId);

    try {
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // --- ENVIANDO PARA A PASTA ---
            await setDoc(docRef, {
                id: trackId,
                title: track.title || 'Sem título',
                artist: track.artistName || track.artist || 'Artista',
                cover: track.cover || '',
                timestamp: serverTimestamp()
            });
            
            updateLikeIcon(buttonElement, true);
            showToast('Adicionado às curtidas', 'like');
            console.log(`✅ Música ${trackId} enviada para ${collectionPath}`);
        } else {
            // --- REMOVENDO DA PASTA ---
            await deleteDoc(docRef);
            updateLikeIcon(buttonElement, false);
            showToast('Removido das curtidas', 'unlike');
        }
    } catch (error) {
        console.error("Erro fatal ao salvar no Firestore:", error);
        // Se der erro de permissão, o problema está nas suas Regras do Firebase
    }
}

/**
 * Atualiza visualmente o ícone da estrela
 */
function updateLikeIcon(button, isLiked) {
    if (!button) return;
    const img = button.querySelector('img');
    if (!img) return;

    const starEmpty = "/assets/star_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg";
    const starFilled = "/assets/star_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg";

    img.src = isLiked ? starFilled : starEmpty;
    
    if (isLiked) {
        button.classList.add('is-liked');
        img.style.opacity = "1";
    } else {
        button.classList.remove('is-liked');
        img.style.opacity = "0.2"; // Sutil no PC até o hover
    }
}


/**
 * Configura a página do álbum com fidelidade visual extrema (Apple Music Style)
 * @param {string} albumId - ID do álbum no Firebase
 */
async function setupAlbumPage(albumId) {
    // 1. Seletores com Verificação de Segurança
    const elements = {
        mainWrapper: document.getElementById('main-wrapper'),
        bgImageLayer: document.getElementById('bg-image-layer'),
        bgOverlay: document.getElementById('bg-color-overlay'),
        cover: document.getElementById('album-cover-detail'),
        animated: document.getElementById('album-animated-detail'),
        title: document.getElementById('album-title-detail'),
        artistName: document.getElementById('artist-name-detail'),
        artistImg: document.getElementById('artist-image-detail'),
        year: document.getElementById('album-year-detail'),
        playBtn: document.getElementById('main-play-btn'),
        genre: document.getElementById('album-genre')
    };
    const albumLikeBtn = document.querySelector('.action-circle img[src*="star"]')?.parentElement;

    if (albumLikeBtn && albumId) {
        // Sincroniza estado do álbum (likedalbunsUID)
        checkAndSetLikeState('album', albumId, albumLikeBtn);

        albumLikeBtn.onclick = (e) => {
            e.preventDefault();
            // Note: Você deve ter uma função toggleLike similar a toggleLikeMusic para álbuns
            if (typeof toggleLike === 'function') toggleLike('album', albumId, albumLikeBtn);
        };
    }

    // Sai da função se os elementos essenciais não existirem
    if (!elements.cover || !elements.title || !albumId) {
        console.warn("⚠️ Abortando setupAlbumPage: Elementos essenciais não encontrados.");
        return;
    }

    try {
        // 2. Busca de dados no Firestore
        const albumRef = doc(db, 'albuns', albumId);
        const albumSnap = await getDoc(albumRef);

        if (!albumSnap.exists()) return;

        const albumData = albumSnap.data();
        const album = { id: albumSnap.id, ...albumData };

        // 3. Lógica de Agendamento e Bloqueio (isLocked)
        const scheduledDate = albumData.date ? new Date(albumData.date + "T00:00:00") : null;
        const now = new Date();
        const isLocked = scheduledDate && scheduledDate > now; // Definição da variável de bloqueio

        // 4. Configuração de Imagens e Fundo
        elements.cover.src = album.cover || './assets/default-cover.png';
        elements.cover.crossOrigin = "Anonymous";

        if (elements.bgImageLayer) {
            elements.bgImageLayer.style.backgroundImage = `url(${album.cover})`;
        }

        // Lógica de Capa Animada
        const animUrl = album.animatedCover;
        if (elements.animated && animUrl && animUrl !== "N/A") {
            elements.animated.src = animUrl;
            elements.animated.onload = () => {
                elements.animated.classList.remove('hidden');
                setTimeout(() => elements.animated.classList.replace('opacity-0', 'opacity-100'), 50);
            };
        }

        const backBtn = document.getElementById('btn-back-album');
    if (backBtn) {
        backBtn.onclick = () => window.history.back();
    }

        // 5. Cores Dinâmicas (Color Thief)
        elements.cover.onload = () => {
            try {
                const colorThief = new ColorThief();
                const color = colorThief.getColor(elements.cover);
                
                // Cor pura para o blur e cor escura (20%) para o overlay e furo do play
                const r = Math.floor(color[0] * 0.2);
                const g = Math.floor(color[1] * 0.2);
                const b = Math.floor(color[2] * 0.2);
                const darkColor = `rgb(${r}, ${g}, ${b})`;

                if (elements.bgOverlay) {
                    elements.bgOverlay.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
                }

                // Sincroniza a variável CSS do triângulo vazado (Play Hole)
                document.documentElement.style.setProperty('--dynamic-bg', darkColor);
                
                if (elements.mainWrapper) {
                    elements.mainWrapper.style.backgroundColor = 'transparent';
                }
            } catch (e) {
                console.warn("Erro ao extrair cores:", e);
            }
        };

        // 6. Preenchimento de Textos
        elements.title.textContent = album.album || "Sem título";
        if (elements.artistName) elements.artistName.textContent = album.artist || "Artista";
        if (elements.genre) elements.genre.textContent = album.genre || "Pop";
        if (elements.year) {
            elements.year.textContent = album.releaseYear || (scheduledDate ? scheduledDate.getFullYear() : '2026');
        }

        // 7. Busca e Renderização das Músicas
        const musicQuery = query(
            collection(db, 'musicas'),
            where('album', '==', albumId),
            orderBy('trackNumber')
        );

        const musicSnap = await getDocs(musicQuery);
        const tracks = [];
        musicSnap.forEach(docSnap => tracks.push({ id: docSnap.id, ...docSnap.data() }));

        // Renderiza passando isLocked para evitar o erro de referência
        renderAlbumTracksAppleStyle(tracks, isLocked);

        // 8. Configuração do Botão Play
// 8. Configuração do Botão Play
if (!isLocked && elements.playBtn && tracks.length) {
    elements.playBtn.onclick = () => {
        console.log("🚀 TUNE: Iniciando Álbum via rota confirmada");
        
        // Se a playlist funciona com playTrackGlobal, vamos usar ela aqui também
        // Ou carregarFila se você quiser que o player saiba as próximas músicas
        if (window.carregarFila) {
            window.carregarFila(tracks, 0);
        } else if (window.playTrackGlobal) {
            window.playTrackGlobal(tracks[0]);
        }
    };
}

    } catch (err) {
        console.error("Erro crítico no setupAlbumPage:", err);
    }
}

/**
 * Renderiza as faixas com fidelidade Apple Music (PC e Mobile)
 * @param {Array} tracks - Lista de objetos de música
 * @param {Boolean} isLocked - Estado de bloqueio do álbum
 */
async function renderAlbumTracksAppleStyle(tracks, isLocked) {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    container.innerHTML = ""; // Limpa antes de renderizar

    tracks.forEach((track, index) => {
        const trackRow = document.createElement("div");
        const stateClass = isLocked ? "opacity-30 cursor-default" : "hover:bg-white/10 cursor-pointer group";
        
        trackRow.className = `track-row flex items-center p-3 rounded-lg transition ${stateClass}`;
        
        trackRow.innerHTML = `
            <span class="track-number w-10 text-gray-500">${index + 1}</span>
            <div class="flex-1 min-w-0">
                <div class="track-title truncate font-bold text-white">${track.title}</div>
                <div class="track-artist truncate text-gray-400 text-sm">${track.artistName || 'Artista'}</div>
            </div>
            <div class="flex items-center gap-3 ml-auto">
                <button class="track-like-btn p-2 opacity-0 group-hover:opacity-100 transition">
                    <img src="/assets/star_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg" class="w-5" style="opacity: 0.2;">
                </button>
            </div>
        `;

        // Lógica de clique para tocar (Igual à Playlist)
        if (!isLocked) {
            // Dentro do renderAlbumTracksAppleStyle...
// Dentro do renderAlbumTracksAppleStyle no main.js
trackRow.onclick = (e) => {
    // 1. Ignora se clicar no botão de like
    if (e.target.closest('.track-like-btn')) return;
    
    // 2. PARA o evento aqui para não subir para o pai (importantíssimo!)
    e.preventDefault();
    e.stopPropagation();

    console.log("🎵 Preparando reprodução estável:", track.title);
    
    if (window.playTrackGlobal) {
        window.playTrackGlobal(track);
    }
};

            // Evento do Like
            const likeBtn = trackRow.querySelector('.track-like-btn');
            if (likeBtn && window.currentUserUid) {
                checkAndSetLikeState('music', track.id, likeBtn);
                likeBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleLikeMusic(track, likeBtn);
                };
            }
        }

        container.appendChild(trackRow);
    });
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
        loadContent(event.state.page, event.state.id, false); 
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



/**
 * Atualiza a URL do navegador de forma amigável.
 */
function updateBrowserHistory(pageName, id) {
    const isDev = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    
    // Formato de produção: /album/123 | Formato dev: ?page=album&id=123
    const cleanPath = id ? `/${pageName}/${id}` : `/${pageName}`;
    const newUrl = isDev 
        ? `?page=${pageName}${id ? `&id=${id}` : ''}` 
        : cleanPath;

    window.history.pushState({ page: pageName, id: id }, '', newUrl);
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

        const isSharkLabel = docData.gravadora?.toLowerCase() === 'shark';

    // --- 2. Lógica de Imagem ---
    let imgSrc = "/assets/artistpfp.png"; // Fallback padrão
    if (docData.foto && docData.foto !== "") {
        imgSrc = docData.foto;
    }


    card.innerHTML = `
        <div class="relative mx-auto w-24 h-24">
            <img src="${imgSrc}" alt="${docData.nomeArtistico}" 
                 class="w-24 h-24 rounded-full object-cover shadow-md">
        </div>
        <p class="text-white text-[11px] font-bold truncate mt-3 px-1">
            <span>${docData.nomeArtistico || "Artista"}</span>
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
    
    albumCard.setAttribute('data-navigate', 'album');
    albumCard.setAttribute('data-id', albumId);

    // Adicionamos o evento de clique para contar o stream diário
    albumCard.addEventListener('click', () => {
        trackAlbumDayStream(albumId);
    });

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

// Função para gerenciar o streamsDay
async function trackAlbumDayStream(albumId) {
    const albumRef = doc(db, "albuns", albumId);
    const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

    try {
        const snap = await getDoc(albumRef);
        if (snap.exists()) {
            const data = snap.data();
            
            // Se a última atualização foi em outro dia, resetamos o contador
            if (data.lastStreamDate !== hoje) {
                await updateDoc(albumRef, {
                    streamsDay: 1,
                    lastStreamDate: hoje
                });
            } else {
                // Se for o mesmo dia, incrementa
                await updateDoc(albumRef, {
                    streamsDay: increment(1)
                });
            }
        }
    } catch (e) {
        console.error("Erro ao computar stream diário:", e);
    }
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


async function setupMusicPage(musicId) {
    if (!musicId) return;

    try {
        const docRef = doc(db, "musicas", musicId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            // Unificamos o ID com os dados para evitar 'undefined' na proteção de streams
            const data = { id: snap.id, ...snap.data() }; 
            
            // 1. Preenchimento da Interface Principal
            const albumTitle = document.getElementById('album-title-detail');
            const artistNameDetail = document.getElementById('artist-name-detail');
            const detailCover = document.getElementById('album-cover-detail');
            const coverBg = document.getElementById('album-cover-bg');
            const streamsEl = document.getElementById('music-streams-count');

            if (albumTitle) albumTitle.textContent = data.title || "Sem título";
            if (artistNameDetail) artistNameDetail.textContent = data.artistName || "Artista";
            
            if (detailCover) {
                detailCover.src = data.cover;
                detailCover.setAttribute('crossorigin', 'anonymous');
            }
            
            if (coverBg) coverBg.style.backgroundImage = `url(${data.cover})`;
            
            if (streamsEl) {
                streamsEl.textContent = `${(data.streams || 0).toLocaleString()} streams`;
            }

            if (data.explicit) {
                document.getElementById('explicit-badge')?.classList.remove('hidden');
            }

            // --- INÍCIO DA LÓGICA DE COMPARTILHAMENTO ---
            const shareBtn = document.getElementById('btn-share-instagram') || document.querySelector('.btn.share');
            if (shareBtn) {
                shareBtn.onclick = async () => {
                    try { await navigator.clipboard.writeText(window.location.href); } catch (e) {}

                    const originalContent = shareBtn.innerHTML;
                    shareBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
                    
                    try {
                        let h2c = window.html2canvas;
                        if (!h2c) {
                            await new Promise((resolve, reject) => {
                                const script = document.createElement('script');
                                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                                script.onload = resolve;
                                script.onerror = reject;
                                document.head.appendChild(script);
                            });
                            h2c = window.html2canvas;
                        }

                        const storyCover = document.getElementById('story-cover');
                        const storyBg = document.getElementById('story-bg-blur');
                        const nocacheCover = data.cover + (data.cover.includes('?') ? '&' : '?') + "t=" + Date.now();
                        
                        if (storyCover) {
                            storyCover.crossOrigin = "anonymous";
                            storyCover.src = nocacheCover;
                        }
                        document.getElementById('story-title').innerText = data.title;
                        document.getElementById('story-artist').innerText = data.artistName || "Artista";
                        if (storyBg) storyBg.style.backgroundImage = `url(${nocacheCover})`;

                        await new Promise((resolve) => {
                            if (storyCover.complete) resolve();
                            else { storyCover.onload = resolve; setTimeout(resolve, 1500); }
                        });

                        const card = document.getElementById('story-share-card');
                        const canvas = await h2c(card, { useCORS: true, scale: 2, backgroundColor: "#030303" });
                        const imgData = canvas.toDataURL("image/png");

                        const modal = document.getElementById('share-preview-modal');
                        const previewContainer = document.getElementById('preview-image-container');
                        
                        previewContainer.innerHTML = `<img src="${imgData}" class="w-full h-full object-contain">`;
                        modal.classList.replace('hidden', 'flex');

                        const closeModal = () => {
                            modal.classList.replace('flex', 'hidden');
                            previewContainer.innerHTML = '';
                        };

                        document.getElementById('close-share-preview').onclick = closeModal;
                        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

                        document.getElementById('confirm-share-btn').onclick = () => {
                            canvas.toBlob(async (blob) => {
                                const file = new File([blob], 'tune-story.png', { type: 'image/png' });
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                    await navigator.share({ files: [file], title: 'TUNE' });
                                } else {
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `TUNE-${data.title}.png`;
                                    link.click();
                                }
                            });
                        };
                    } catch (err) {
                        console.error("Erro no Share:", err);
                    } finally {
                        shareBtn.innerHTML = originalContent;
                    }
                };
            }
            // --- FIM DA LÓGICA DE COMPARTILHAMENTO ---

            // 2. Lógica de Bloqueio/Agendamento
            const now = new Date();
            const scheduledDate = data.scheduledTime && data.scheduledTime !== "Imediato" 
                                  ? new Date(data.scheduledTime) : null;
            const isLocked = scheduledDate && scheduledDate > now;

            // 3. Renderização da Lista de Faixas
            const tracksContainer = document.getElementById('tracks-container');
            if (tracksContainer) {
                const lockClass = isLocked ? "opacity-30 pointer-events-none" : "hover:bg-white/10 cursor-pointer";
                
                tracksContainer.innerHTML = `
                    <div class="track-item ${lockClass}">
                        <div class="track-number-display text-gray-500 text-xs">1</div>
                        <img src="${data.cover}" crossorigin="anonymous" class="track-cover ${isLocked ? 'grayscale' : ''}">
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
                        if (window.checkAndResetMonthlyStreams) window.checkAndResetMonthlyStreams(data);
                        if (window.playTrackGlobal) window.playTrackGlobal(data);
                        else if (typeof loadTrack === 'function') loadTrack(data);
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
                    const countdown = document.getElementById('countdown-wrapper');
                    if (countdown) {
                        countdown.classList.remove('hidden');
                        if (typeof iniciarCronometroMusica === 'function') iniciarCronometroMusica(scheduledDate, musicId);
                    }
                } else {
                    mainPlayBtn.style.opacity = "1";
                    mainPlayBtn.style.cursor = "pointer";
                    mainPlayBtn.onclick = () => {
                        if (window.checkAndResetMonthlyStreams) window.checkAndResetMonthlyStreams(data);
                        if (window.playTrackGlobal) window.playTrackGlobal(data);
                        else if (typeof loadTrack === 'function') loadTrack(data);
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

async function loadTrapSection() {
    const listContainer = document.getElementById('trap-list'); // ID conforme seu HTML
    if (!listContainer) return;

    let trapContent = [];
    let seenArtists = new Set(); // Garante variedade de artistas

    try {
        // 1. BUSCAR PLAYLISTS DE TRAP
        const playlistsQuery = query(
            collection(db, "playlists"), 
            where('genres', 'array-contains', 'Trap'),
            limit(10)
        );
        const playlistsSnap = await getDocs(playlistsQuery);
        playlistsSnap.forEach(doc => {
            trapContent.push({ id: doc.id, type: 'playlist', ...doc.data() });
        });

        // 2. BUSCAR ÁLBUNS DE TRAP (Usando o campo 'category')
        const albumsQuery = query(
            collection(db, "albuns"), 
            where('category', '==', 'Trap'),
            limit(10)
        );
        const albumsSnap = await getDocs(albumsQuery);
        albumsSnap.forEach(doc => {
            trapContent.push({ id: doc.id, type: 'album', ...doc.data() });
        });

        // 3. BUSCAR MÚSICAS DE TRAP (Uma por artista para não repetir)
        const songsQuery = query(
            collection(db, "musicas"), 
            where('category', '==', 'Trap'), 
            orderBy('timestamp', 'desc'), 
            limit(40) 
        );
        const songsSnap = await getDocs(songsQuery);
        
        let songsAdded = 0;
        songsSnap.forEach(doc => {
            const songData = doc.data();
            const artistId = songData.artist || songData.uidars;

            if (!seenArtists.has(artistId) && songsAdded < 20) {
                seenArtists.add(artistId);
                trapContent.push({ id: doc.id, type: 'music', ...songData });
                songsAdded++;
            }
        });

        listContainer.innerHTML = '';

        if (trapContent.length === 0) {
            const section = listContainer.closest('.section');
            if (section) section.style.display = 'none';
            return;
        }

        // 4. RENDERIZAR OS CARDS USANDO SUAS FUNÇÕES GLOBAIS
        trapContent.forEach(item => {
            let card;
            if (item.type === 'album') {
                // Passa o objeto e o ID para evitar o erro de undefined
                card = typeof createAlbumCard === 'function' ? createAlbumCard(item, item.id) : null;
            } else if (item.type === 'playlist') {
                card = typeof createPlaylistCard === 'function' ? createPlaylistCard(item, item.id) : null;
            } else {
                // Para músicas individuais, usa o criador de card de álbum como base
                card = typeof createAlbumCard === 'function' ? createAlbumCard(item, item.id) : null;
            }
            
            if (card) listContainer.appendChild(card);
        });

        // 5. CONFIGURAR SCROLL (SETAS)
        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('trap-scroll-left', 'trap-scroll-right', 'trap-list');
        }

    } catch (error) {
        console.error("Erro ao carregar seção Trap unificada:", error);
    }
}
function setupTrapScrollLogic() {
    const listContainer = document.getElementById('trap-list');
    const btnLeft = document.getElementById('trap-scroll-left');
    const btnRight = document.getElementById('trap-scroll-right');
    const wrapper = listContainer?.closest('.section-scroll');

    if (!listContainer || !btnLeft || !btnRight) return;

    const updateArrows = () => {
        const scrollLeft = listContainer.scrollLeft;
        const maxScroll = listContainer.scrollWidth - listContainer.clientWidth;
        btnLeft.classList.toggle('hidden', scrollLeft <= 5);
        btnRight.classList.toggle('hidden', scrollLeft >= maxScroll - 5);
    };

    wrapper.addEventListener('mouseenter', updateArrows);
    wrapper.addEventListener('mouseleave', () => {
        btnLeft.classList.add('hidden');
        btnRight.classList.add('hidden');
    });

    listContainer.addEventListener('scroll', updateArrows);
    btnLeft.onclick = () => listContainer.scrollBy({ left: -300, behavior: 'smooth' });
    btnRight.onclick = () => listContainer.scrollBy({ left: 300, behavior: 'smooth' });
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

window.renderAllArtistsGrid = async function() {
    const grid = document.getElementById('all-artists-grid');
    const loader = document.getElementById('all-artists-loader');

    if (!grid) return;

    try {
        const q = query(
            collection(db, "usuarios"), 
            where("artista", "==", "true"),
            orderBy("nomeArtistico", "asc")
        );

        const querySnapshot = await getDocs(q);
        grid.innerHTML = '';

        // Foto padrão que usas no sistema
        const fotoPadrao = './assets/artistpfp.png';

        querySnapshot.forEach((docSnap) => {
            const artist = docSnap.data();
            const id = docSnap.id;
            
            // Verifica se a foto existe no banco, senão usa a padrão
            const fotoArtista = artist.foto && artist.foto !== "" ? artist.foto : fotoPadrao;

            const card = document.createElement('div');
            card.className = 'artist-grid-card';
            
            // O segredo está no atributo 'onerror'
            card.innerHTML = `
                <img src="${fotoArtista}" 
                     class="artist-grid-photo" 
                     onerror="this.onerror=null; this.src='${fotoPadrao}';"
                     alt="${artist.nomeArtistico || artist.nome}">
                <span class="artist-grid-name">${artist.nomeArtistico || artist.nome}</span>
            `;

            card.onclick = () => {
                if (typeof loadContent === 'function') {
                    loadContent('artist', id); 
                }
            };

            grid.appendChild(card);
        });

        if (loader) loader.style.display = 'none';

    } catch (error) {
        console.error("Erro ao carregar grid de artistas:", error);
    }
};


async function carregarPaginaCurtidas() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("Usuário não logado");
            return;
        }

        // 1. MAPEAMENTO DOS ELEMENTOS DO SEU HTML
        const playlistTitle = document.getElementById('playlist-title-detail');
        const playlistDesc = document.getElementById('playlist-description-detail');
        const playlistCover = document.getElementById('playlist-cover-detail');
        const bgBlur = document.getElementById('bg-image-blur');
        const tracksContainer = document.getElementById('tracks-container');

        // 2. CONFIGURAÇÃO VISUAL DA "PLAYLIST" (Gerada por JS)
        const tituloPlaylist = "Músicas Curtidas";
        const capaPlaylist = "https://i.ibb.co/HTCFR8Db/Design-sem-nome-4.png"; // Sua capa roxa

        if (playlistTitle) playlistTitle.textContent = tituloPlaylist;
        if (playlistCover) playlistCover.src = capaPlaylist;
        if (bgBlur) bgBlur.style.backgroundImage = `url(${capaPlaylist})`;
        if (playlistDesc) playlistDesc.textContent = `Sua coleção pessoal • ${user.displayName || 'Usuário'}`;

        try {
            // 3. BUSCA AS MÚSICAS CURTIDAS (Conforme a imagem do Firestore)
            // Caminho: usuarios > UID > likedmusicsUID
            const likedCollName = `likedmusics${user.uid}`;
            const q = query(collection(db, "usuarios", user.uid, likedCollName), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            const musicasParaFila = [];
            tracksContainer.innerHTML = ""; // Limpa o container

            if (querySnapshot.empty) {
                tracksContainer.innerHTML = '<p class="text-center text-white/40 py-20">Você ainda não tem músicas curtidas.</p>';
                return;
            }

            // 4. RENDERIZAÇÃO DA LISTA DE MÚSICAS
            querySnapshot.forEach((docSnap) => {
                const track = { id: docSnap.id, ...docSnap.data() };
                musicasParaFila.push(track);

                const index = musicasParaFila.length - 1;

                // Cria o item da música usando a estrutura de flex do Tailwind que você já usa
                tracksContainer.innerHTML += `
                    <div class="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg group cursor-pointer transition-all" 
                         onclick="window.carregarFila(window.listaCurtidasExecucao, ${index})">
                        
                        <div class="flex items-center gap-4">
                            <span class="text-white/40 w-6 text-center group-hover:hidden">${index + 1}</span>
                            <div class="hidden group-hover:block w-6 text-white">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                            </div>
                            
                            <img src="${track.cover || 'assets/10.png'}" class="w-12 h-12 rounded shadow-md object-cover">
                            
                            <div class="flex flex-col">
                                <span class="font-bold text-white">${track.title || "Sem título"}</span>
                                <span class="text-sm text-white/60">${track.artist || "Artista"}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-6">
                            <button class="text-white/40 hover:text-white transition">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });

            // 5. DISPONIBILIZA A LISTA PARA O PLAYER
            window.listaCurtidasExecucao = musicasParaFila;

            // Configura o botão principal "REPRODUZIR" do cabeçalho
            const btnPlayHeader = document.querySelector('.btn-play');
            if (btnPlayHeader) {
                btnPlayHeader.onclick = () => window.carregarFila(window.listaCurtidasExecucao, 0);
            }

        } catch (error) {
            console.error("Erro ao carregar músicas do Firestore:", error);
        }
    });
}



async function loadHomeFavorites() {
    const grid = document.getElementById('favorites-grid');
    const container = document.getElementById('favorites-grid-container');
    
    // currentUserUid deve estar definido globalmente no seu tunearts.js
    if (!currentUserUid || !grid) return;

    try {
        // Busca na subcoleção unificada dentro do documento do usuário
        const favoritesRef = collection(db, 'usuarios', currentUserUid, 'curtidas');
        
        // Ordena por data de curtida
        const favQuery = query(favoritesRef, orderBy("timestamp", "desc"), limit(6));
        const favSnap = await getDocs(favQuery);

        // Se estiver vazio, esconde o container e para
        if (favSnap.empty) {
            if (container) container.style.display = 'none';
            return;
        }

        let hasValidItems = false;
        grid.innerHTML = '';

        favSnap.forEach(docSnap => {
            const item = docSnap.data();
            const itemId = docSnap.id;

            // --- VALIDAÇÃO CRÍTICA ---
            // Só renderiza se tiver título e capa. Se estiver undefined, ignora.
            if (!item.title || !item.cover) {
                
                return; 
            }

            hasValidItems = true;
            const div = document.createElement('div');
            div.className = 'fav-item group';

            div.innerHTML = `
                <img src="${item.cover}" class="fav-img" onerror="this.src='./assets/default-cover.png'">
                <div class="fav-text-container">
                    <span class="fav-text">${item.title}</span>
                </div>
            `;

            div.onclick = () => {
                const pageType = item.type === 'music' ? 'music' : 'album';
                if (typeof loadContent === 'function') {
                    loadContent(pageType, itemId);
                } else {
                    window.location.href = `${pageType}.html?id=${itemId}`;
                }
            };

            grid.appendChild(div);
        });

        // Se depois do loop nenhum item foi válido, esconde o container
        if (container) {
            container.style.display = hasValidItems ? 'block' : 'none';
        }

    } catch (e) {
        console.error("Erro ao carregar favoritos:", e);
    }
}

// 2. Inicialização do Cache
window.__HOME_CACHE__ = window.__HOME_CACHE__ || { loaded: false, html: null, scrollPosition: 0 };

async function setupArtistsCarouselPriority() {
    const listContainer = document.getElementById('artists-list');
    const loadingMessage = document.getElementById('artists-loading-message');
    if (!listContainer) return;

    const GLOBAL_LEGENDS = [
         "Legendaryture", "Taylor Swift", "Marina", "Ariana Grande", "Rihanna", 
        "Madonna",  "Luan Santana"
    ].map(name => name.toLowerCase().trim());

    try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("artista", "==", "true"), limit(100));
        
        const querySnapshot = await getDocs(q);
        let artistas = [];
        
        querySnapshot.forEach(docSnap => {
            // ESSENCIAL: Garantir que o ID do documento esteja no objeto
            artistas.push({ 
                id: docSnap.id, 
                uid: docSnap.id, // Alguns setups usam uid em vez de id
                ...docSnap.data() 
            });
        });

        // ⭐ ORDENAÇÃO
        artistas.sort((a, b) => {
            const nomeA = (a.nomeArtistico || "").toLowerCase().trim();
            const nomeB = (b.nomeArtistico || "").toLowerCase().trim();

            const aIsLegend = GLOBAL_LEGENDS.includes(nomeA) ? 1 : 0;
            const bIsLegend = GLOBAL_LEGENDS.includes(nomeB) ? 1 : 0;
            if (bIsLegend !== aIsLegend) return bIsLegend - aIsLegend;

            const aIsVerified = a.verificado === "true" ? 1 : 0;
            const bIsVerified = b.verificado === "true" ? 1 : 0;
            if (bIsVerified !== aIsVerified) return bIsVerified - aIsVerified;

            const aIsCloudinary = (a.foto || "").includes("cloudinary.com") ? 1 : 0;
            const bIsCloudinary = (b.foto || "").includes("cloudinary.com") ? 1 : 0;
            return bIsCloudinary - aIsCloudinary;
        });

        if (loadingMessage) loadingMessage.style.display = 'none';
        listContainer.innerHTML = '';

        // Filtra e Renderiza
        const artistasFiltrados = artistas.filter(art => 
            art.verificado === "true" || GLOBAL_LEGENDS.includes((art.nomeArtistico || "").toLowerCase().trim())
        );

        artistasFiltrados.slice(0, 20).forEach(docData => {
            // Passamos docData.id explicitamente como segundo argumento
            const card = createArtistCard(docData, docData.id);
            listContainer.appendChild(card);
        });

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('artists-scroll-left', 'artists-scroll-right', 'artists-list');
        }

    } catch (error) {
    
    }
}

async function loadTopArtists() {
    const container = document.getElementById('top-artists-list');
    if (!container) return;

    // 1. LIMPEZA IMEDIATA: Remove o conteúdo antes de qualquer busca assíncrona
    container.innerHTML = ''; 

    try {
        // Busca as músicas (usando o campo 'artist' que vimos na sua imagem do Firebase)
        const songsQuery = query(collection(db, "musicas"), orderBy("streams", "desc"), limit(40));
        const songsSnap = await getDocs(songsQuery);
        
        const uniqueArtistUIDs = new Set();
        songsSnap.forEach(doc => {
            const data = doc.data();
            if (data.artist) uniqueArtistUIDs.add(data.artist);
        });

        const topUIDs = Array.from(uniqueArtistUIDs).slice(0, 10);
        const artistSnaps = await Promise.all(topUIDs.map(uid => getDoc(doc(db, "usuarios", uid))));

        const fragment = document.createDocumentFragment();
        artistSnaps.forEach(snap => {
            if (snap.exists()) {
                const card = createArtistCard(snap.data(), snap.id);
                fragment.appendChild(card);
            }
        });

        // 2. VERIFICAÇÃO DE SEGURANÇA: Só insere se o container continuar vazio
        if (container.children.length === 0) {
            container.appendChild(fragment);
        }

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('top-artists-scroll-left', 'top-artists-scroll-right', 'top-artists-list');
        }

    } catch (error) {
       
    }
}
async function setupFanArtistSection() {
    const listContainer = document.getElementById('fan-albums-list');
    const sectionWrapper = document.getElementById('fan-section');
    
    if (!listContainer || !sectionWrapper) return;

    try {
        // 1. BUSCAR ARTISTAS ONDE A CHAVE É A STRING "true"
        const artistsQuery = query(
            collection(db, "usuarios"), 
            where('artista', '==', "true") // Filtro exato para string
        );
        const artistsSnap = await getDocs(artistsQuery);

        if (artistsSnap.empty) {
          
            sectionWrapper.style.display = 'none';
            return;
        }

        // 2. TRANSFORMAR SNAPSHOT EM LISTA E SORTEAR
        const artistsList = [];
        artistsSnap.forEach(doc => {
            artistsList.push({ id: doc.id, ...doc.data() });
        });

        const randomArtist = artistsList[Math.floor(Math.random() * artistsList.length)];
        const ARTISTA_ID = randomArtist.id;

        // 3. ATUALIZAR INTERFACE (Usando seus campos específicos)
        const nameDisplay = document.getElementById('fan-artist-name');
        const imgDisplay = document.getElementById('fan-artist-img');

        // Prioriza nomeArtistico, depois nome, depois o campo artist
        nameDisplay.textContent = randomArtist.nomeArtistico || randomArtist.nome || randomArtist.artist || "Artista";
        imgDisplay.src = randomArtist.foto || "/assets/default-artist.png";

        // 4. BUSCAR ÁLBUNS DO ARTISTA SORTEADO
        const albumsQuery = query(
            collection(db, "albuns"), 
            where('uidars', '==', ARTISTA_ID),
            limit(20)
        );
        
        const albumsSnap = await getDocs(albumsQuery);

        // Limpa o container para remover skeletons
        listContainer.innerHTML = '';

        if (albumsSnap.empty) {
            // Se o artista sorteado não tiver álbuns, a seção permanece oculta
            sectionWrapper.style.display = 'none';
            return;
        }

        // 5. RENDERIZAR USANDO SUA FUNÇÃO GLOBAL createAlbumCard
        albumsSnap.forEach(doc => {
            const albumData = doc.data();
            const albumId = doc.id;
            
            let card;
            if (typeof createAlbumCard === 'function') {
                // Mantém o trackAlbumDayStream e toda sua lógica original
                card = createAlbumCard(albumData, albumId);
            } else {
                // Fallback de segurança
                card = createDefaultCard({ type: 'album', id: albumId, ...albumData });
            }
            
            if (card) listContainer.appendChild(card);
        });

        // 6. EXIBIR SEÇÃO E ATIVAR SCROLL PADRONIZADO
        sectionWrapper.style.display = 'block';

        if (typeof setupScrollButtons === 'function') {
            setupScrollButtons('fan-scroll-left', 'fan-scroll-right', 'fan-albums-list');
        }

    } catch (error) {
        console.error("Erro ao carregar seção Para Fãs Dinâmica:", error);
        sectionWrapper.style.display = 'none';
    }
}

// Chamada da função
setupFanArtistSection();

// 1. Inicialização do Cache (Coloque no topo do seu arquivo JS)
window.__HOME_CACHE__ = window.__HOME_CACHE__ || { loaded: false, html: null, scrollPosition: 0 };
async function setupHomePage() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (window.__HOME_CACHE__.loaded && window.__HOME_CACHE__.html) {
       
        contentArea.innerHTML = window.__HOME_CACHE__.html;
        rebindHomeUI(); 
        setGreeting();
        if (window.__HOME_CACHE__.scrollPosition) window.scrollTo(0, window.__HOME_CACHE__.scrollPosition);
        return;
    }

    try {
        setGreeting();
       
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
            setupPopSection(),
            setupFanArtistSection(),
            carregarPaginaCurtidas(),
            loadHomeFavorites(),
            loadTopArtists()
        ]);

        // 5. BLOCO 2: REMOVIDA A DUPLICATA DE ARTISTAS DAQUI
        Promise.all([
            loadTopStreamedPlaylists(),
            loadTrapSection(),
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

            // Dentro de setupHomePage -> Bloco 2
setupContentCarousel(
    'top-albums-day-list', 
    'top-albums-day-left', 
    'top-albums-day-right', 
    'top-albums-day-loading', 
    'albuns', 
    [orderBy('streamsDay', 'desc'), limit(12)], 
    createAlbumCard
),
            
            setupContentCarousel(
                'playlist-genres-list', 'playlist-genres-scroll-left', 'playlist-genres-scroll-right', 
                'playlist-genres-loading-message', 'playlists', 
                [where('category', '==', 'Playlist Genres'), limit(18)], createPlaylistCard
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

document.addEventListener("DOMContentLoaded", () => {
    initializeRouting();
});