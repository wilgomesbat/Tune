import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, serverTimestamp,  collection, doc, getDoc, updateDoc, setDoc, query, where, onSnapshot, orderBy, getDocs, limit, addDoc, increment, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref as databaseRef, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ================================
// 2️⃣ CONFIGURAÇÃO DO FIREBASE
// ================================
const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const getElement = (id) => document.getElementById(id);
let currentUserId = null; 
let currentEditingPlaylistId = null;
let currentUserIsAdmin = false;


// Variáveis de Paginação e Busca para ARTISTAS
const ARTISTS_PER_PAGE = 20;
let currentArtistPage = 1;
let allArtistsData = []; 
let artistSearchTimeout; 


const YT_API_KEY = 'AIzaSyCTy9IM54bO4CQudHJgnO_YNUSBtPrMzlU';

// ===============================
// BLOQUEIO GLOBAL
// ===============================
function lockNonAdmin() {
    // trava scroll
    document.documentElement.style.overflow = "hidden";

    // bloqueia TODOS os cliques fora do overlay
    document.addEventListener("click", blockInteraction, true);
    document.addEventListener("keydown", blockInteraction, true);

    function blockInteraction(e) {
        const overlay = document.getElementById("no-access-overlay");
        if (!overlay || !overlay.contains(e.target)) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    // impede navegação por links internos
    document.querySelectorAll("a").forEach(a => {
        a.addEventListener("click", e => e.preventDefault());
    });
}

// ===============================
// OVERLAY
// ===============================
function renderNoAccess(titleText) {
    const overlay = document.getElementById("no-access-overlay");
    const title = document.getElementById("noAccessTitle");

    title.textContent = titleText || "Acesso restrito ao Tune Team";
    overlay.classList.remove("hidden");

    lockNonAdmin();
}

// ===============================
// AUTH STATE
// ===============================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    currentUserId = user.uid;

    try {
        const userDocRef = doc(db, "usuarios", currentUserId);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            currentUserIsAdmin = false;
            renderNoAccess("Conta não encontrada");
            return;
        }

        const userData = docSnap.data();
        const nivelAdmin = Number(userData.niveladmin) || 0;
        currentUserIsAdmin = nivelAdmin >= 1;

        if (!currentUserIsAdmin) {
            renderNoAccess("Acesso restrito ao Tune Team");
            return;
        }

        // ===============================
        // ✅ SOMENTE ADMIN PASSA DAQUI
        // ===============================
        console.log("⭐ Admin liberado");
        
        // initDashboard();
        // loadUsers();
        // loadArtists();

    } catch (error) {
        console.error(error);
        renderNoAccess("Erro ao validar permissões");
    }
});




// ================================\
// 3️⃣ CONTROLE DE ABAS (Simplificado)
// ===============================\

function activateTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active-tab'));

    const contentEl = getElement(tabId.replace('tab', 'tabContent'));
    const buttonEl = getElement(tabId);
    
    if (contentEl) contentEl.classList.remove('hidden');
    if (buttonEl) buttonEl.classList.add('active-tab');
    
    // Como só há uma aba principal, sempre carrega as playlists
    if (tabId === 'tabPlaylists') {
        loadPlaylists();
    }
}

function setupTabListeners() {
    const tabPlaylists = getElement('tabPlaylists');
    const btnBackToPlaylists = getElement('btnBackToPlaylists');

    // Listener de aba principal
    if (tabPlaylists) tabPlaylists.onclick = () => activateTab('tabPlaylists');
    
    // Listener de voltar no editor
    if (btnBackToPlaylists) btnBackToPlaylists.onclick = () => activateTab('tabPlaylists');
}


// ================================\
// 4️⃣ FUNÇÕES DE EDIÇÃO
// ===============================\

// --- ABRIR EDITOR DE PLAYLIST ---
function openPlaylistEditor(playlistId, playlistData) {
    if (!playlistId || !playlistData) {
        showToastError("Dados da playlist incompletos.");
        return;
    }
    
    currentEditingPlaylistId = playlistId; 

    // Mudar para a aba do editor
    const tabContentPlaylistList = getElement("tabContentPlaylistList");
    const playlistEditor = getElement("playlistEditor");
    
    // Esconde a lista e mostra o editor
    if (tabContentPlaylistList) tabContentPlaylistList.classList.add("hidden");
    if (playlistEditor) playlistEditor.classList.remove("hidden");

    // Preencher campos de exibição
    const editorTitle = getElement("editorTitle");
    const editorMeta = getElement("editorMeta");
    const editorNameInput = getElement("editorPlaylistNameInput");
    const editorCategoryInput = getElement("editorPlaylistCategoryInput");

    if (editorTitle) editorTitle.textContent = playlistData.name;
    if (editorMeta) editorMeta.textContent = `Categoria: ${playlistData.category || "Sem categoria"} | Criador (UID): ${playlistData.uidars ? playlistData.uidars.substring(0, 8) + '...' : 'N/A'}`;

    // Preencher INPUTS de edição
    if (editorNameInput) editorNameInput.value = playlistData.name;
    if (editorCategoryInput) editorCategoryInput.value = playlistData.category || "";

    // Carregar as músicas da playlist
    loadPlaylistMusics(playlistId);
}

// --- SALVAR EDIÇÃO DE METADADOS ---
async function savePlaylistChanges() {
    if (!currentEditingPlaylistId) {
        showToastError("Erro: Playlist não selecionada para edição.");
        return;
    }

    const newName = getElement("editorPlaylistNameInput")?.value.trim();
    const newCategory = getElement("editorPlaylistCategoryInput")?.value.trim();

    if (!newName) {
        showToastError("O nome da playlist não pode estar vazio.");
        return;
    }

    const playlistRef = doc(db, "playlists", currentEditingPlaylistId);

    try {
        await updateDoc(playlistRef, {
            name: newName,
            category: newCategory,
        });

        showToastSuccess("Playlist atualizada com sucesso!");
        
        // Atualiza a visualização do editor
        if(getElement("editorTitle")) getElement("editorTitle").textContent = newName;
        if(getElement("editorMeta")) getElement("editorMeta").textContent = `Categoria: ${newCategory || "Sem categoria"}`;

    } catch (error) {
        console.error("Erro ao salvar alterações da playlist:", error);
        showToastError("Erro ao salvar alterações da playlist.");
    }
}


// ================================\
// 5️⃣ FUNÇÃO DE LISTAGEM (TODAS AS PLAYLISTS)
// ===============================\

function loadPlaylists() {
    const container = getElement('playlist-list-container');
    if (!container) return; 

    container.innerHTML = '<p class="text-center text-gray-500 p-8">Carregando todas as playlists...</p>';

    const q = query(
        collection(db, "playlists"), 
        orderBy("name", "desc")
    );

    onSnapshot(q, (querySnapshot) => {
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = 
                '<p class="text-center text-gray-500 p-8">Nenhuma playlist encontrada.</p>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const playlistId = docSnap.id;
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center p-4 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 transition text-black';
            el.innerHTML = `
                <div>
                    <h3 class="font-bold text-lg">${data.name}</h3>
                    <p class="text-sm text-gray-500">
                        ${data.category || 'Sem Categoria'} | Criador: ${data.uidars ? data.uidars.substring(0, 8) + '...' : 'Desconhecido'}
                    </p>
                </div>
                <button class="edit-btn px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition" 
                        data-id="${playlistId}">
                    Editar
                </button>
            `;
            
            el.querySelector('.edit-btn').addEventListener('click', () => {
                openPlaylistEditor(playlistId, data);
            });

            container.appendChild(el);
        });
    }, (error) => {
        console.error("Erro ao carregar playlists:", error);
        container.innerHTML = '<p class="text-center text-red-500 p-8">Erro ao carregar dados. Verifique a console.</p>';
    });
}


// ================================\
// 6️⃣ FUNÇÕES DE MÚSICAS
// ===============================\

// --- LISTAR MÚSICAS DA PLAYLIST NO EDITOR ---
function loadPlaylistMusics(playlistId) {
    const container = getElement('playlistMusicList');
    if (!container) return;
    
    container.innerHTML = '<p class="text-center text-gray-500 p-8">Carregando músicas...</p>';

    const q = query(
        collection(db, `playlists/${playlistId}/musicas`),
        orderBy("trackNumber", "asc")
    );

    onSnapshot(q, (querySnapshot) => {
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = 
                '<p class="text-center text-gray-500 p-8">Esta playlist está vazia. Adicione músicas!</p>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const musicId = docSnap.id;
            
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center p-3 border-b border-gray-200 text-black';
            el.innerHTML = `
                <div class="flex-grow">
                    <span class="font-medium text-blue-600 mr-3">${data.trackNumber}.</span>
                    <span class="font-medium">${data.title}</span> 
                    <span class="text-gray-500"> - ${data.artist}</span>
                </div>
                <button class="remove-music-btn px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition" 
                        data-id="${musicId}">
                    Remover
                </button>
            `;
            
            el.querySelector('.remove-music-btn').addEventListener('click', () => {
                removeMusicFromPlaylist(playlistId, musicId, data.title);
            });

            container.appendChild(el);
        });
    });
}

// --- REMOVER MÚSICA DA PLAYLIST ---
async function removeMusicFromPlaylist(playlistId, musicDocId, musicTitle) {
    if (!confirm(`Tem certeza que deseja remover "${musicTitle}" desta playlist?`)) {
        return;
    }
    
    try {
        const musicRef = doc(db, `playlists/${playlistId}/musicas`, musicDocId);
        await deleteDoc(musicRef);
        
        showToastSuccess(`Música "${musicTitle}" removida com sucesso!`);
    } catch (error) {
        console.error("Erro ao remover música:", error);
        showToastError("Erro ao remover música da playlist.");
    }
}

// --- ABRIR MODAL E CARREGAR OPÇÕES DE MÚSICAS ---
async function openAddMusicModal() {
    if (!currentEditingPlaylistId) {
        showToastError("Erro: Selecione uma playlist para adicionar música.");
        return;
    }
    
    const modal = getElement("addMusicModal");
    const select = getElement("modalMusicSelect");
    
    if (modal) modal.classList.remove("hidden");
    if (!select) return; 
    
    select.innerHTML = '<option>Carregando...</option>';
    select.disabled = true;

    try {
        const q = query(collection(db, "musicas"), orderBy("title", "asc"));
        const musicSnapshot = await getDocs(q);
        
        select.innerHTML = '';
        select.disabled = false;

        if (musicSnapshot.empty) {
            select.innerHTML = '<option value="">Nenhuma música disponível</option>';
            select.disabled = true;
            showToastError("Não há músicas cadastradas na biblioteca.");
            return;
        }

        select.innerHTML = '<option value="">-- Selecione uma Música --</option>';
        musicSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id; 
            option.textContent = `${data.title} - ${data.artist}`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error("Erro ao carregar músicas:", error);
        select.innerHTML = '<option value="">Erro ao carregar músicas</option>';
        showToastError("Erro ao carregar músicas para o modal.");
    }
}

// --- ADICIONAR MÚSICA À PLAYLIST (EXECUÇÃO) ---
async function handleAddMusicToPlaylist() {
    if (!currentEditingPlaylistId) {
        showToastError("Erro: Playlist não selecionada.");
        return;
    }

    const musicSelect = getElement("modalMusicSelect");
    const trackInput = getElement("modalMusicTrack");
    const modal = getElement("addMusicModal");

    const musicId = musicSelect?.value;
    const trackNumber = parseInt(trackInput?.value);
    
    if (!musicId || musicId === '') {
        showToastError("Selecione uma música.");
        return;
    }
    if (isNaN(trackNumber) || trackNumber < 1) {
        showToastError("Informe um número de faixa válido (maior que zero).");
        return;
    }
    
    let musicData;
    try {
        const musicSnap = await getDoc(doc(db, "musicas", musicId));
        if (!musicSnap.exists()) {
            showToastError("Música selecionada não encontrada.");
            return;
        }
        musicData = musicSnap.data();
    } catch (error) {
        console.error("Erro ao buscar dados da música:", error);
        showToastError("Erro ao buscar dados da música.");
        return;
    }

    try {
        await addDoc(collection(db, `playlists/${currentEditingPlaylistId}/musicas`), {
            title: musicData.title,
            artist: musicData.artist,
            audioURL: musicData.audioURL || '', 
            cover: musicData.cover || '',
            trackNumber: trackNumber,
        });

        showToastSuccess(`Música "${musicData.title}" adicionada com sucesso!`);
        if (modal) modal.classList.add("hidden");
        
    } catch (error) {
        console.error("Erro ao adicionar música à playlist:", error);
        showToastError("Erro ao adicionar música. Verifique o console.");
    }
}


// ===================================
// 7️⃣ FUNÇÃO EXPORTADA DE SETUP
// ===================================

/**
 * Função para configurar todos os ouvintes e carregar dados APÓS o HTML da playlist ser injetado.
 * Esta função DEVE ser chamada do script de navegação principal.
 */
export function setupEditPlaylistsPage() {
    console.log("Sistema de Playlist iniciado: Editando.");
    
    // 1. Configura os ouvintes das abas e o botão "Voltar"
    setupTabListeners(); 
    
    // Listener de Edição 
    const btnSavePlaylist = getElement("btnSavePlaylist");
    if (btnSavePlaylist) btnSavePlaylist.onclick = savePlaylistChanges;
    
    // Listeners do Modal de Adicionar Música
    const btnOpenAddMusic = getElement("btnOpenAddMusic");
    const modalConfirmAddMusic = getElement("modalConfirmAddMusic");
    const modalCancelAddMusic = getElement("modalCancelAddMusic");
    const addMusicModal = getElement("addMusicModal");

    if (btnOpenAddMusic) btnOpenAddMusic.onclick = openAddMusicModal;
    if (modalConfirmAddMusic) modalConfirmAddMusic.onclick = handleAddMusicToPlaylist;
    if (modalCancelAddMusic) modalCancelAddMusic.onclick = () => {
        if (addMusicModal) addMusicModal.classList.add("hidden");
    };
    
    // 2. Inicia o carregamento da lista de playlists
    loadPlaylists(); 
    
    console.log("✔ Setup para Gerenciamento de Playlists (editplaylist) concluído.");
}

async function refreshGlobalRanking() {
    console.log("Botão clicado! Iniciando processo..."); // TESTE DE CLIQUE
    
    const btn = document.getElementById('btn-update-ranking');
    const status = document.getElementById('ranking-status');
    
    if (!btn) {
        console.error("Botão não encontrado no DOM!");
        return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Processando...";

    try {
        // 1. Busca músicas por streams
        const q = query(collection(db, "musicas"), orderBy("streamsMensal", "desc"), limit(100));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            console.warn("Nenhuma música encontrada para ranquear.");
            return;
        }

        const batch = writeBatch(db);
        let rank = 1;

        snap.forEach((musicDoc) => {
            batch.update(musicDoc.ref, { posicaoGlobal: Number(rank) });
            rank++;
        });

        // 2. IDs das Playlists
        const chartsToUpdate = ["vMFKkV505sBl2heeBedd", "qdLLORT2auk5K5PRTnu3"]; 
        chartsToUpdate.forEach(id => {
            batch.update(doc(db, "playlists", id), { 
                lastUpdateChart: serverTimestamp(),
                refreshTrigger: Math.random() 
            });
        });

        await batch.commit();
        console.log("Batch commitado com sucesso!");
        
        if (status) {
            status.style.color = "#1DB954";
            status.textContent = "✅ Sucesso! Ranking atualizado.";
        }
        alert("Ranking Atualizado!");

    } catch (error) {
        console.error("ERRO NO FIREBASE:", error);
        alert("Erro: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "🔄 Atualizar Ranking Top 100";
    }
}

// ESTA PARTE É O QUE FAZ O BOTÃO FUNCIONAR:
document.addEventListener('DOMContentLoaded', () => {
    const btnRank = document.getElementById('btn-update-ranking');
    if (btnRank) {
        console.log("Ouvinte de clique adicionado ao botão.");
        btnRank.addEventListener('click', refreshGlobalRanking);
    } else {
        console.error("Não foi possível encontrar o botão para adicionar o evento.");
    }
});
// ====================================================
// ⭐ LISTA SEPARADA: MÚSICAS EM ALTA POR STREAMS ⭐
// ====================================================

async function fetchAndRenderTopSongsList() {
    const loadingMessage = document.getElementById('loadingTopSongsList');
    const songsListContainer = document.getElementById('topSongsRankingList');
    
    if (!songsListContainer || !loadingMessage) return;

    songsListContainer.innerHTML = ''; 
    loadingMessage.style.display = 'block';

    try {
        // 1. QUERY: Buscar na coleção 'musicas', ordenar por streams (descendente)
        const q = query(
            collection(db, "musicas"), 
            orderBy("streams", "desc"), 
            limit(10) // Top 10 Músicas
        );

        const snapshot = await getDocs(q);
        const topSongs = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || 'Título Desconhecido',
            cover: doc.data().cover || './assets/default-cover.png',
            streams: doc.data().streams || 0,
            duration: doc.data().duration || 'N/A'
        }));

        loadingMessage.style.display = 'none';

        if (topSongs.length === 0 || topSongs.every(song => song.streams === 0)) {
            songsListContainer.innerHTML = '<p class="text-gray-400 p-4">Nenhuma música com streams > 0 encontrada.</p>';
            return;
        }

        // 2. RENDERIZAR A LISTA DE MÚSICAS
        topSongs.forEach((song, index) => {
            const songItem = document.createElement('div');
            songItem.className = 'flex items-center justify-between p-3 hover:bg-gray-700 transition-colors duration-200';
            
            const formattedStreams = new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(song.streams);

            songItem.innerHTML = `
                <div class="flex items-center space-x-4">
                    <span class="text-gray-400 font-bold w-4">${index + 1}</span>
                    <img src="${song.cover}" alt="Capa" class="w-10 h-10 object-cover rounded shadow-md">
                    <div>
                        <p class="text-white font-semibold truncate max-w-[250px]">${song.title}</p>
                        
                    </div>
                </div>
                
                <p class="text-white font-medium">${formattedStreams} streams</p>
            `;
            songsListContainer.appendChild(songItem);
        });

    } catch (error) {
        console.error("Erro ao buscar a lista de Top Músicas:", error);
        songsListContainer.innerHTML = '<p class="text-red-500 p-4">Erro ao carregar lista de Top Músicas.</p>';
    }
}

async function setupMaintenanceToggle() {
    const maintenanceToggle = document.getElementById('maintenanceToggle');
    const statusMessage = document.getElementById('maintenanceStatusMessage');

    if (!maintenanceToggle || !statusMessage) {
        return;
    }

    // ⭐ REFERÊNCIA AJUSTADA PARA A SUA ESTRUTURA: config -> status ⭐
    const appSettingsRef = doc(db, "config", "status"); 

    // 1. Carregar o estado inicial do Firebase
    try {
        statusMessage.textContent = "Carregando status de manutenção...";
        
        const docSnap = await getDoc(appSettingsRef);

        let isMaintenanceMode = false;
        
        if (docSnap.exists() && typeof docSnap.data().manutencao === 'boolean') {
            isMaintenanceMode = docSnap.data().manutencao;
        } else if (!docSnap.exists()) {
             // Se o documento status não existir, crie-o com o modo de manutenção desativado
            await setDoc(appSettingsRef, { manutencao: false });
        }
        
        maintenanceToggle.checked = isMaintenanceMode;
        
        // Atualiza a mensagem e cor
        statusMessage.textContent = isMaintenanceMode ? "Modo de manutenção ATIVO." : "Modo de manutenção INATIVO.";
        statusMessage.classList.remove('text-gray-500'); 
        statusMessage.classList.add(isMaintenanceMode ? 'text-red-500' : 'text-green-500');
        
    } catch (error) {
        console.error("Erro ao carregar o status de manutenção:", error);
        statusMessage.textContent = "Erro de conexão. Verifique o console.";
        statusMessage.classList.remove('text-gray-500');
        statusMessage.classList.add('text-red-500');
        return;
    }

    // 2. Adicionar listener para mudanças no toggle
    maintenanceToggle.addEventListener('change', async (event) => {
        const newState = event.target.checked;
        
        // Mensagem de feedback temporária
        statusMessage.textContent = newState ? "Ativando modo de manutenção..." : "Desativando modo de manutenção...";
        statusMessage.classList.remove('text-green-500', 'text-red-500');
        statusMessage.classList.add('text-yellow-400');

        try {
            // Atualiza apenas o campo 'manutencao'
            await setDoc(appSettingsRef, { manutencao: newState }, { merge: true }); 

            // Confirmação
            statusMessage.textContent = newState ? "Modo de manutenção ATIVO." : "Modo de manutenção INATIVO.";
            statusMessage.classList.remove('text-yellow-400');
            statusMessage.classList.add(newState ? 'text-red-500' : 'text-green-500');
            
        } catch (error) {
            console.error("Erro ao atualizar o status de manutenção:", error);
            statusMessage.textContent = "Erro ao atualizar. Tente novamente.";
            statusMessage.classList.remove('text-yellow-400');
            statusMessage.classList.add('text-red-500');
            // Reverte o toggle no UI se a atualização falhar
            maintenanceToggle.checked = !newState; 
        }
    });
}

// Inicialização: Garante que a função é chamada após o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    setupMaintenanceToggle();
});

export { setupMaintenanceToggle };

// ============================================
// ⭐ FUNÇÕES AUXILIARES DE TOAST (MANTIDAS) ⭐
// ============================================

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        // Cria o container se ele não existir
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        // Adicione algum CSS básico para posicionamento (ex: Tailwind classes)
        newContainer.className = 'fixed top-4 right-4 z-[9999] space-y-2'; 
        document.body.appendChild(newContainer);
    }

    const toast = document.createElement('div');
    // Você precisará definir o CSS para .toast, .success, .error e .fade-out
    toast.className = `toast p-3 rounded-lg shadow-lg text-white ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    toast.textContent = message;
    
    document.getElementById('toast-container').prepend(toast);

    // Remove o toast após 3 segundos
    setTimeout(() => {
        // Usa classes Tailwind ou CSS padrão para animação
        toast.style.transition = 'opacity 0.5s ease-out';
        toast.style.opacity = '0'; 
        
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showToastSuccess(message) {
    showToast(message, 'success');
}

function showToastError(message) {
    showToast(message, 'error');
}
// A função setupListArtistsPage deve ser definida no seu arquivo tt.js ou módulo principal

function setupListArtistsPage() {
    // --- Referências aos elementos da página ---
    const artistsGrid = document.getElementById('artistsGrid');
    const loadingMessage = document.getElementById('loadingArtists');
    const prevButton = document.getElementById('prevPageButton');
    const nextButton = document.getElementById('nextPageButton');
    const pageDisplay = document.getElementById('currentPageDisplay');
    const searchInput = document.getElementById('artistSearchInput');
    
    // Elementos do Modal de Edição de Artista
    const modal = document.getElementById('editArtistModal');
    const closeModalButton = document.getElementById('closeArtistModalButton');
    const modalCancelButton = document.getElementById('modalArtistCancelButton');
    const editForm = document.getElementById('editArtistForm');
    
    // --- Variáveis de escopo ---
    const ARTISTS_PER_PAGE = 20; 
    let currentArtistPage = 1; 
    let allArtistsData = []; 
    let artistSearchTimeout; 
    
    // --- Verificação de Elementos ---
    if (!artistsGrid || !modal) {
        console.error("ERRO: Elementos essenciais não encontrados na página listartists.");
        return;
    }

    // ========================================
    // 1. LÓGICA DE BUSCA E LISTAGEM GERAL
    // ========================================

    async function fetchAllArtistsData() {
        if (loadingMessage) {
            loadingMessage.textContent = "Carregando todos os artistas...";
            loadingMessage.style.display = 'block';
        }

try {
        // Buscamos todos que são artistas
        const q = query(
            collection(db, "usuarios"), 
            where("artista", "==", "true"),
            orderBy("nomeArtistico", "asc")
        );
        const snapshot = await getDocs(q);
            
            allArtistsData = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));

            liveSearchArtists(); 

        } catch (error) {
            console.error("Erro ao buscar todos os artistas:", error);
            artistsGrid.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar dados de artistas.</p>';
        }
    }
    
    function liveSearchArtists() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        let filteredArtists = allArtistsData;

        if (searchTerm) {
            filteredArtists = allArtistsData.filter(artist => 
                (artist.nome && artist.nome.toLowerCase().includes(searchTerm)) || 
                (artist.nomeArtistico && artist.nomeArtistico.toLowerCase().includes(searchTerm))
            );
        }
        
        const startIndex = (currentArtistPage - 1) * ARTISTS_PER_PAGE;
        const endIndex = startIndex + ARTISTS_PER_PAGE;
        const currentDocs = filteredArtists.slice(startIndex, endIndex);

        renderArtists(currentDocs, filteredArtists.length);
        
        prevButton.disabled = currentArtistPage === 1;
        nextButton.disabled = endIndex >= filteredArtists.length;
        pageDisplay.textContent = `Página ${currentArtistPage} / Total: ${filteredArtists.length}`;
    }
    
    function renderArtists(docs, totalCount) {
        artistsGrid.innerHTML = '';
        if (docs.length === 0) {
            artistsGrid.innerHTML = `<p class="text-gray-400 col-span-full">${totalCount === 0 ? 'Nenhum artista encontrado.' : 'Nenhum artista nesta página.'}</p>`;
            if (loadingMessage) loadingMessage.style.display = 'none';
            return;
        }

        docs.forEach(artist => {
            const artistCard = document.createElement('div');
            artistCard.className = 'bg-transparent rounded-lg overflow-hidden relative group flex flex-col items-center p-4'; 
            
            artistCard.innerHTML = `
                <div class="relative w-24 h-24 rounded-full overflow-hidden mb-3">
                    <img src="${artist.foto || './assets/default-profile.png'}" alt="Foto" class="w-full h-full object-cover">
                </div>
                <h4 class="text-base font-semibold text-black truncate w-full text-center">${artist.nomeArtistico || "Desconhecido"}</h4>
                <p class="text-xs text-black truncate w-full text-center">${artist.country || 'N/A'}</p>
                
                <div class="flex flex-col mt-3 space-y-2 w-full">
                    <button data-id="${artist.id}" class="copy-artist-id-btn flex items-center justify-center space-x-1 w-full py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition">
                        <i class='bx bx-copy text-lg'></i> <span id="copyArtistText-${artist.id}">Copiar ID</span>
                    </button>
                    <button data-id="${artist.id}" class="edit-artist-btn flex items-center justify-center space-x-1 w-full py-1 text-xs font-medium bg-white text-black hover:bg-gray-200 rounded transition">
                        <i class='bx bx-search-alt text-lg'></i> <span>Editar</span>
                    </button>
                </div>
            `;
            artistsGrid.appendChild(artistCard);
        });
        
        if (loadingMessage) loadingMessage.style.display = 'none';
        attachArtistActionListeners();
    }

    // ========================================
    // 2. LÓGICA DE PENDENTES E APROVAÇÃO
    // ========================================

    async function fetchPendingArtists() {
        const pendingGrid = document.getElementById('pendingArtistsGrid');
        const pendingSection = document.getElementById('pendingSection');
        if (!pendingGrid || !pendingSection) return;

        const q = query(collection(db, "usuarios"), where("aprovado", "==", "false"));
        
        try {
            const querySnapshot = await getDocs(q);
            pendingGrid.innerHTML = '';

            if (querySnapshot.empty) {
                pendingSection.classList.add('hidden');
                return;
            }

            pendingSection.classList.remove('hidden');
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const artistCard = document.createElement('div');
                artistCard.className = "bg-gray-800 p-4 rounded-lg shadow-lg border border-yellow-600 relative flex flex-col items-center text-center";
                artistCard.innerHTML = `
    <img src="${data.foto || 'assets/default-artist.png'}" class="w-20 h-20 rounded-full object-cover mb-3 border-2 border-yellow-500" onerror="this.src='assets/default-artist.png'">
    <h3 class="text-white font-bold truncate w-full">${data.nomeArtistico || 'Sem Nome'}</h3>
    <p class="text-gray-400 text-xs mb-4">${data.email || ''}</p>
    <div class="flex gap-2 w-full">
        <button onclick="approveArtist('${docSnap.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] py-2 px-1 rounded-md font-bold transition">
            APROVAR
        </button>
        <button onclick="rejectArtist('${docSnap.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] py-2 px-1 rounded-md font-bold transition">
            REPROVAR
        </button>
    </div>
`;
                pendingGrid.appendChild(artistCard);
            });
        } catch (error) {
            console.error("Erro ao buscar pendentes:", error);
        }
    }

    // Função anexada ao window para ser acessível pelo onclick
    window.approveArtist = async function(artistId) {
        if (!confirm("Deseja aprovar a conta deste artista?")) return;
        try {
            await updateDoc(doc(db, "usuarios", artistId), { aprovado: "true" });
            showToastSuccess("Artista aprovado com sucesso! ✅");
            fetchPendingArtists();
            fetchAllArtistsData(); 
        } catch (error) {
            showToastError("Erro ao aprovar conta.");
        }
    };

    // Função para reprovar e remover status de artista
window.rejectArtist = async function(artistId) {
    if (!confirm("Deseja REPROVAR este usuário? Ele deixará de ser listado como artista.")) return;
    
    try {
        const userRef = doc(db, "usuarios", artistId);
        await updateDoc(userRef, { 
            aprovado: "rejected", // ou "false", dependendo da sua lógica de filtro
            artista: false 
        });

        showToastSuccess("Cadastro reprovado com sucesso! ❌");
        
        // Atualiza as listas na tela
        fetchPendingArtists();
        if (typeof fetchAllArtistsData === 'function') fetchAllArtistsData(); 
        
    } catch (error) {
        console.error("Erro ao reprovar:", error);
        showToastError("Erro ao reprovar conta.");
    }
};

    // ========================================
    // 3. MODAL DE EDIÇÃO E BANIMENTO
    // ========================================

    async function openEditArtistModal(artistId) {
        editForm.reset();
        modal.style.display = 'flex';
        
        const banStatusText = document.getElementById('banStatusText');
        const oldToggleBanButton = document.getElementById('toggleBanButton');
        
        const newToggleBanButton = oldToggleBanButton.cloneNode(true);
        oldToggleBanButton.parentNode.replaceChild(newToggleBanButton, oldToggleBanButton);

        try {
            const docSnap = await getDoc(doc(db, "usuarios", artistId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('artistDocId').value = artistId; 
                document.getElementById('modalArtistTitle').textContent = `Editar: ${data.nome || 'N/A'}`;
                document.getElementById('modalArtistName').value = data.nomeArtistico || '';
                document.getElementById('modalArtistPhoto').value = data.foto || '';

                
                // Interface de Banimento
                const isBanned = data.banido === "true"; 
                banStatusText.textContent = isBanned ? "Status: BANIDO 🚫" : "Status: ATIVO ✅";
                banStatusText.className = isBanned ? 'text-red-500 font-semibold' : 'text-green-500 font-semibold';
                newToggleBanButton.textContent = isBanned ? "DESBANIR" : "BANIR";
                newToggleBanButton.className = `py-2 px-4 rounded-full font-bold text-white ${isBanned ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`;
                
                newToggleBanButton.onclick = () => toggleBanStatus(artistId, data.banido);
            }
        } catch (e) { console.error(e); }
    }

    async function toggleBanStatus(artistId, currentBanStatus) {
        const newStatus = currentBanStatus === "true" ? "false" : "true";
        if (!confirm(newStatus === "true" ? "Banir este artista?" : "Desbanir este artista?")) return;

        try {
            await updateDoc(doc(db, "usuarios", artistId), { banido: newStatus });
            showToastSuccess("Status alterado!");
            openEditArtistModal(artistId); 
            fetchAllArtistsData(); 
        } catch (e) { showToastError("Erro na operação."); }
    }

    // ========================================
    // 4. LISTENERS DE INTERAÇÃO
    // ========================================

    function attachArtistActionListeners() {
        document.querySelectorAll('.edit-artist-btn').forEach(btn => {
            btn.onclick = (e) => openEditArtistModal(e.currentTarget.dataset.id);
        });
        document.querySelectorAll('.copy-artist-id-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                navigator.clipboard.writeText(id);
                showToastSuccess("ID Copiado!");
            };
        });
    }

    searchInput.addEventListener('input', () => {
        currentArtistPage = 1; 
        clearTimeout(artistSearchTimeout);
        artistSearchTimeout = setTimeout(liveSearchArtists, 300);
    });

    prevButton.onclick = () => { if (currentArtistPage > 1) { currentArtistPage--; liveSearchArtists(); } };
    nextButton.onclick = () => { currentArtistPage++; liveSearchArtists(); };

    // Fechar Modal
    const closeFn = () => modal.style.display = 'none';
    closeModalButton.onclick = closeFn;
    modalCancelButton.onclick = closeFn;

    // Salvar Edição
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('artistDocId').value;
        const data = {
            nome: document.getElementById('modalArtistName').value.trim(),
            foto: document.getElementById('modalArtistPhoto').value.trim(),
            country: document.getElementById('modalArtistCountry').value.trim() || null
        };
        try {
            await updateDoc(doc(db, "usuarios", id), data);
            showToastSuccess("Atualizado!");
            closeFn();
            fetchAllArtistsData();
        } catch (e) { showToastError("Erro ao salvar."); }
    };

    // INICIALIZAÇÃO
    fetchAllArtistsData();
    fetchPendingArtists();
}
// ============================================
// ⭐ FUNÇÃO DE SETUP PARA PÁGINA DE PLAYLIST (ATUALIZADA) ⭐
// ============================================
function setupAddPlaylistPage() {
    const playlistForm = document.getElementById("playlistForm");
    
    // ⭐ REFERÊNCIAS DE ELEMENTOS ⭐
    const categorySelect = document.getElementById("category");
    const stationSearchSection = document.getElementById("artistStationSearchSection");
    
    const artistSearchInput = document.getElementById("artistSearch");
    const selectedArtistUidInput = document.getElementById("selectedArtistUid"); 
    const artistSearchResultsDiv = document.getElementById("artistSearchResults");
    const selectedArtistDisplay = document.getElementById("selectedArtistDisplay");

    const cancelButton = document.getElementById("cancelButton");

    let artistSearchTimeout; 
    
    // --- LÓGICA DE EXIBIÇÃO DA BUSCA ---
    if (categorySelect && stationSearchSection) {
        const toggleArtistSearch = () => {
            // APENAS 'Stations' ativa a busca de artista. 
            // 'Playlist Genres' e outras categorias ocultam a seção.
            if (categorySelect.value === 'Stations') {
                stationSearchSection.classList.remove('hidden');
            } else {
                stationSearchSection.classList.add('hidden');
                
                // Limpa os campos de artista para não enviar dados residuais
                selectedArtistUidInput.value = '';
                if(artistSearchInput) artistSearchInput.value = '';
                if(selectedArtistDisplay) selectedArtistDisplay.textContent = 'Artista Selecionado: Nenhum';
                if(artistSearchResultsDiv) artistSearchResultsDiv.classList.add('hidden');
            }
        };
        
        categorySelect.addEventListener('change', toggleArtistSearch);
        toggleArtistSearch(); 
    }

    // --- LÓGICA DE BUSCA DE ARTISTA (Exclusiva para Stations) ---
    if (artistSearchInput && artistSearchResultsDiv) {
        artistSearchInput.addEventListener('input', () => {
            clearTimeout(artistSearchTimeout);
            const searchTerm = artistSearchInput.value.trim();

            if (searchTerm.length < 3) {
                artistSearchResultsDiv.classList.add('hidden');
                return;
            }

            artistSearchTimeout = setTimeout(() => {
                fetchArtistsForSearch(searchTerm);
            }, 350);
        });
        
        document.addEventListener('click', (e) => {
            if (!artistSearchInput.contains(e.target) && !artistSearchResultsDiv.contains(e.target)) {
                artistSearchResultsDiv.classList.add('hidden');
            }
        });
    }

    async function fetchArtistsForSearch(searchTerm) {
        artistSearchResultsDiv.innerHTML = '<p class="p-3 text-gray-400">Buscando...</p>';
        artistSearchResultsDiv.classList.remove('hidden');

        try {
            const endTerm = searchTerm + '\uf8ff';
            const q = query(
                collection(db, "usuarios"),
                where("artista", "==", "true"),
                where("nomeArtistico", ">=", searchTerm),
                where("nomeArtistico", "<=", endTerm),
                limit(10)
            );

            const snapshot = await getDocs(q);
            renderArtistSearchResults(snapshot.docs);

        } catch (error) {
            console.error("Erro ao buscar artistas:", error);
            artistSearchResultsDiv.innerHTML = '<p class="p-3 text-red-400">Erro na busca de artistas.</p>';
        }
    }
    
    function renderArtistSearchResults(docs) {
        if (docs.length === 0) {
            artistSearchResultsDiv.innerHTML = '<p class="p-3 text-gray-400">Nenhum artista encontrado.</p>';
            return;
        }

        artistSearchResultsDiv.innerHTML = '';
        docs.forEach(doc => {
            const artistData = doc.data();
            const artistId = doc.id;
            const name = artistData.nomeArtistico || artistData.apelido || 'Nome Indisponível';
            
            const artistItem = document.createElement('div');
            artistItem.className = 'p-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0';
            artistItem.innerHTML = `<p class="text-white font-medium">${name}</p>`;
            
            artistItem.setAttribute('data-artist-id', artistId); 
            artistItem.setAttribute('data-artist-name', name);
            
            artistItem.addEventListener('click', handleArtistSelection);
            artistSearchResultsDiv.appendChild(artistItem);
        });
        artistSearchResultsDiv.classList.remove('hidden');
    }

    function handleArtistSelection(e) {
        const target = e.currentTarget;
        const artistId = target.getAttribute('data-artist-id');
        const artistName = target.getAttribute('data-artist-name');

        selectedArtistUidInput.value = artistId; 
        if(artistSearchInput) artistSearchInput.value = artistName;
        selectedArtistDisplay.textContent = `Artista Selecionado: ${artistName}`;
        artistSearchResultsDiv.classList.add('hidden');
    }

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    if (playlistForm) {
        playlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const playlistName = playlistForm.playlistName.value.trim();
            const playlistCover = playlistForm.playlistCover.value.trim();
            const category = playlistForm.category.value;
            const genres = playlistForm.genres.value.split(',').map(g => g.trim()).filter(g => g);
            const artistUid = selectedArtistUidInput.value; 

            if (!playlistName || !playlistCover || !category) {
                showToastError("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
            
            // Validação: Somente 'Stations' exige o UID do artista.
            // 'Playlist Genres' segue o fluxo normal sem essa exigência.
            if (category === 'Stations' && !artistUid) {
                 showToastError("Ao selecionar 'Stations', você deve buscar e selecionar um Artista.");
                 return;
            }

            try {
                const playlistData = {
                    name: playlistName,
                    cover: playlistCover,
                    category, // Aqui será salvo como 'Playlist Genres' se selecionado
                    genres,
                    uidars: artistUid || null, 
                    dataCriacao: new Date()
                };
                
                await addDoc(collection(db, "playlists"), playlistData);

                showToastSuccess("Playlist salva com sucesso!");
                playlistForm.reset();
                
                // Reset de estados visuais
                if(artistSearchInput) artistSearchInput.value = "";
                if(selectedArtistUidInput) selectedArtistUidInput.value = "";
                if(selectedArtistDisplay) selectedArtistDisplay.textContent = 'Artista Selecionado: Nenhum';
                toggleArtistSearch(); 
                
            } catch (error) {
                console.error("Erro ao salvar a playlist:", error);
                showToastError("Erro ao salvar a playlist.");
            }
        });
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            loadContent('dashboard');
        });
    }
}


function setupAddAlbumPage() {
    const albumForm = document.querySelector("#combinedForm");
    const btnPreview = document.getElementById("btnPreviewTracks");
    const trackStatus = document.getElementById("trackStatus");
    const previewContainer = document.getElementById("previewContainer");
    const trackListPreview = document.getElementById("trackListPreview");

    let importedTracks = []; 

    if (!albumForm) return;

    // --- 1. BUSCA DE FAIXAS NA PLAYLIST DO YT ---
    btnPreview.addEventListener('click', async () => {
        const url = document.getElementById("ytPlaylistUrl").value.trim();
        const playlistId = url.match(/[&?]list=([^&]+)/i)?.[1];

        if (!playlistId) {
            alert("Por favor, cole um link de playlist válido do YouTube.");
            return;
        }

        try {
            trackStatus.innerText = "⏳ Acessando YouTube...";
            
            const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YT_API_KEY}`, {
                referrerPolicy: "no-referrer-when-downgrade"
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error.message);

            if (data.items) {
                importedTracks = data.items;
                trackListPreview.innerHTML = "";
                previewContainer.classList.remove("hidden");

                importedTracks.forEach((item, index) => {
                    const li = document.createElement("li");
                    li.innerHTML = `<span class="text-red-600 font-bold">${index + 1}.</span> ${item.snippet.title}`;
                    trackListPreview.appendChild(li);
                });

                trackStatus.innerHTML = `<span class="text-green-500 font-bold">✅ ${importedTracks.length} faixas detectadas.</span>`;
            }
        } catch (e) {
            console.error(e);
            trackStatus.innerHTML = `<span class="text-red-500 font-bold">❌ Erro: ${e.message}</span>`;
        }
    });

    // --- 2. SALVAMENTO EM MASSA (BATCH) ---
    albumForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Dados do Formulário
        const currentItemName = albumForm.itemName.value.trim();
        const currentItemCover = albumForm.itemCover.value.trim();
        const currentReleaseDate = albumForm.releaseDate.value.trim();
        const currentDuration = albumForm.duration.value.trim();
        const selectedGenre = document.getElementById("mainGenre").value.trim() || "Pop";
        const artistName = document.getElementById("artistName").value.trim();
        const artistUid = document.getElementById("artistUid").value.trim();

        if (importedTracks.length === 0) {
            alert("Você precisa carregar as faixas da playlist antes de salvar.");
            return;
        }

        try {
            const batch = writeBatch(db);

            // Criar Documento do Álbum (Esquema Antigo)
            const albumRef = doc(collection(db, "albuns"));
            batch.set(albumRef, {
                album: currentItemName,
                cover: currentItemCover,
                date: currentReleaseDate,
                duration: currentDuration,
                artist: artistName,
                uidars: artistUid || null,
                country: "N/A", 
                label: "N/A"
            });

            // Criar Documentos das Músicas (Esquema Antigo)
            importedTracks.forEach((track, index) => {
                const musicRef = doc(collection(db, "musicas"));
                batch.set(musicRef, {
                    album: albumRef.id,                   // ID do Documento do Álbum
                    artist: artistUid || null,            // UID do Artista (string)
                    audioURL: track.snippet.resourceId.videoId, // ID do vídeo (string)
                    cover: currentItemCover,              // Capa manual do álbum
                    duration: "0:00",                     // Padrão
                    explicit: false,
                    genre: selectedGenre,
                    releaseDate: currentReleaseDate,
                    streams: 0,
                    streamsMensal: 0,
                    timestamp: new Date().toISOString(),
                    title: track.snippet.title,
                    trackNumber: index + 1
                });
            });

            await batch.commit();
            
            showToastSuccess("Álbum e faixas salvas com sucesso no banco de dados!");
            albumForm.reset();
            previewContainer.classList.add("hidden");
            importedTracks = [];
            trackStatus.innerText = "Aguardando nova importação...";

        } catch (error) {
            console.error("Erro ao realizar batch:", error);
            showToastError("Erro ao salvar. Verifique o console.");
        }
    });
}

// Adicione ao final do seu tt.js
async function zerarStreamsGlobais() {
    const confirmacao = confirm("Deseja realmente ZERAR todos os streams?");
    if (!confirmacao) return;

    try {
        // No Firestore, sua coleção se chama "musicas" (visto no seu tt.js)
        const musicasRef = collection(db, "musicas");
        const querySnapshot = await getDocs(musicasRef);
        
        const batch = writeBatch(db);

        querySnapshot.forEach((docSnap) => {
            const docRef = doc(db, "musicas", docSnap.id);
            // O campo no banco deve ser "streams" (minúsculo)
            batch.update(docRef, { streams: 0 });
        });

        await batch.commit();
        alert("Streams zerados com sucesso!");
        window.location.reload();
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao zerar. Verifique o console.");
    }
}

// Garante que o HTML encontre a função
window.zerarStreamsGlobais = zerarStreamsGlobais;

// No final do arquivo, dentro ou fora do onAuthStateChanged
document.getElementById('btn-zerar-streams')?.addEventListener('click', zerarStreamsGlobais);

// Função para zerar apenas o Mensal
async function zerarStreamsMensais() {
    const confirmacao = confirm("Deseja zerar os STREAMS MENSAIS de todas as músicas?");
    if (!confirmacao) return;

    try {
        const musicasRef = collection(db, "musicas");
        const querySnapshot = await getDocs(musicasRef);
        const batch = writeBatch(db);

        querySnapshot.forEach((docSnap) => {
            const docRef = doc(db, "musicas", docSnap.id);
            // Aqui alteramos apenas o campo mensal
            batch.update(docRef, { streamsMensal: 0 });
        });

        await batch.commit();
        alert("Streams Mensais zerados com sucesso!");
        window.location.reload();
    } catch (error) {
        console.error("Erro ao zerar mensal:", error);
        alert("Erro ao zerar streams mensais.");
    }
}

window.zerarStreamsMensais = zerarStreamsMensais;
// --- CONFIGURAÇÕES GERAIS ---

const ALBUMS_PER_PAGE = 20;
let currentPage = 1;
let importedTracks = []; 

// --- FUNÇÃO GLOBAL PARA O ONCLICK DO HTML FUNCIONAR ---
window.openEditModal = async (albumId) => {
    const modal = document.getElementById('editAlbumModal');
    try {
        const snap = await getDoc(doc(db, "albuns", albumId));
        if (!snap.exists()) return;
        const data = snap.data();

        // Preenche os campos do modal
        document.getElementById('albumDocId').value = albumId;
        document.getElementById('modalItemName').value = data.album || '';
        document.getElementById('modalItemCover').value = data.cover || '';
        document.getElementById('modalReleaseDate').value = data.date || '';
        document.getElementById('modalDuration').value = data.duration || '';
        document.getElementById('modalArtistName').value = data.artist || '';
        document.getElementById('modalArtistUid').value = data.uidars || '';
        document.getElementById('modalCountry').value = data.country || '';
        document.getElementById('modalLabel').value = data.label || '';

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (e) { console.error("Erro ao abrir modal:", e); }
};

async function setupEditAlbumsPage() {
    const albumsGrid = document.getElementById('albumsGrid');
    const modal = document.getElementById('editAlbumModal');
    const searchInput = document.getElementById('albumSearchInput');
    
    if (!albumsGrid) return;

    // --- 1. CARREGAMENTO DOS CARDS (TODOS OS STATUS) ---
    async function fetchAlbums() {
        albumsGrid.innerHTML = '<p class="text-gray-400 col-span-full text-center py-10">Carregando acervo...</p>';

        try {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const snapshot = await getDocs(query(collection(db, "albuns"), orderBy("date", "desc")));
            
            let allDocs = snapshot.docs;

            // Filtro de busca
            if (searchTerm) {
                allDocs = allDocs.filter(d => {
                    const data = d.data();
                    return data.album?.toLowerCase().includes(searchTerm) || 
                           data.artist?.toLowerCase().includes(searchTerm);
                });
            }

            albumsGrid.innerHTML = ''; 

            allDocs.forEach(docSnap => {
                const album = docSnap.data();
                const isPendente = album.status !== "Aprovado";
                
                // Cache Buster para atualizar a imagem visualmente na hora
                const imageUrl = album.cover ? `${album.cover}?t=${new Date().getTime()}` : '';

                const card = document.createElement('div');
                card.className = `bg-black rounded-lg overflow-hidden border ${isPendente ? 'border-amber-500/50' : 'border-gray-900'} relative group shadow-lg`;
                card.innerHTML = `
                    <div class="relative h-44 overflow-hidden">
                        <img src="${imageUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isPendente ? 'opacity-50' : ''}">
                        ${isPendente ? '<span class="absolute top-2 left-2 bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded">PENDENTE</span>' : ''}
                        <button onclick="openEditModal('${docSnap.id}')" class="absolute bottom-2 right-2 bg-white text-black w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-all transform hover:scale-110 z-20">
                            <i class='bx bxs-pencil text-xl'></i>
                        </button>
                    </div>
                    <div class="p-3">
                        <h4 class="text-white text-xs font-bold truncate uppercase">${album.album || "Sem Nome"}</h4>
                        <p class="text-gray-500 text-[10px] truncate">${album.artist || "Artista"}</p>
                    </div>`;
                albumsGrid.appendChild(card);
            });

        } catch (error) { console.error("Erro ao listar álbuns:", error); }
    }

    // --- 2. SALVAR ALTERAÇÕES (FIREBASE BATCH) ---
    const editForm = document.getElementById('editAlbumForm');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const albumId = document.getElementById('albumDocId').value;
            const newCover = document.getElementById('modalItemCover').value.trim();
            const btnSalvar = editForm.querySelector('button[type="submit"]');

            btnSalvar.disabled = true;
            btnSalvar.innerText = "Salvando...";

            const batch = writeBatch(db);
            const albumRef = doc(db, "albuns", albumId);

            const updatedData = {
                album: document.getElementById('modalItemName').value,
                cover: newCover,
                date: document.getElementById('modalReleaseDate').value,
                duration: document.getElementById('modalDuration').value,
                artist: document.getElementById('modalArtistName').value,
                uidars: document.getElementById('modalArtistUid').value,
                country: document.getElementById('modalCountry').value,
                label: document.getElementById('modalLabel').value,
                status: "Aprovado" // Ao salvar manualmente, ele aprova o álbum
            };

            // 1. Atualiza o Álbum
            batch.update(albumRef, updatedData);

            // 2. Sincroniza a capa com todas as músicas deste álbum
            try {
                const qMusicas = query(collection(db, "musicas"), where("album", "==", albumId));
                const musicSnap = await getDocs(qMusicas);
                musicSnap.forEach(mDoc => {
                    batch.update(mDoc.ref, { cover: newCover });
                });
            } catch (err) { console.warn("Erro ao buscar músicas vinculadas."); }

            try {
                await batch.commit();
                modal.classList.add('hidden');
                fetchAlbums(); // Atualiza a lista na tela sem recarregar a página
                alert("Álbum e músicas atualizados com sucesso!");
            } catch (err) { alert("Erro ao salvar: " + err.message); }
            finally {
                btnSalvar.disabled = false;
                btnSalvar.innerText = "Salvar Alterações";
            }
        };
    }

    // --- 3. IMPORTAÇÃO YOUTUBE (FAIXAS) ---
    const btnFinalizeImport = document.getElementById('btnFinalizeImport');
    if (btnFinalizeImport) {
        btnFinalizeImport.onclick = async () => {
            const albumId = document.getElementById('albumDocId').value;
            const cover = document.getElementById('modalItemCover').value;
            const batch = writeBatch(db);

            importedTracks.forEach((t, i) => {
                const mRef = doc(collection(db, "musicas"));
                batch.set(mRef, {
                    album: albumId,
                    artist: document.getElementById('modalArtistUid').value,
                    artistName: document.getElementById('modalArtistName').value,
                    audioURL: t.snippet.resourceId.videoId,
                    cover: cover,
                    title: t.snippet.title,
                    trackNumber: i + 1,
                    streams: 0,
                    timestamp: serverTimestamp()
                });
            });

            await batch.commit();
            document.getElementById('importPlaylistModal').classList.add('hidden');
            alert("Músicas importadas com sucesso!");
        };
    }

    // --- BOTÕES DE FECHAR ---
    const closeBtn = document.getElementById('closeModalButton');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    
    const cancelBtn = document.getElementById('modalCancelButton');
    if (cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');

    if (searchInput) searchInput.oninput = () => fetchAlbums();

    fetchAlbums();
}

// Inicializa a página
setupEditAlbumsPage();
// Adicione esta função ao seu arquivo tt.js
async function setupAddSinglePage() {
    const singleForm = document.getElementById('singleMusicForm');
    if (!singleForm) return;

    singleForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btnSubmitSingle');
        const statusMsg = document.getElementById('singleStatus');

        // Impede cliques duplos
        btn.disabled = true;
        btn.innerText = "ENVIANDO AO FIRESTORE...";

        // Captura dos valores
        const title = document.getElementById('sTitle').value;
        const artistUid = document.getElementById('sArtistUid').value; // O UID do artista

        const singleData = {
            title: title,
            artist: artistUid, // IMPORTANTE: Para a busca na página do artista funcionar
            artistName: document.getElementById('sArtistName').value, 
            audioURL: document.getElementById('sAudioURL').value,
            cover: document.getElementById('sCoverURL').value,
            genre: document.getElementById('sGenre').value || "Indefinido",
            duration: document.getElementById('sDuration').value || "0:00",
            explicit: document.getElementById('sExplicit').checked ? "true" : "false",
            
            // Chaves para a lógica que criamos na página do artista
            single: "true", 
            album: "Single",
            streams: 0,
            streamsMensal: 0,
           // No seu objeto singleData:
           timestamp: new Date() // Isso cria um objeto de data padrão do JavaScript
        };

        try {
            // EFETUANDO O ENVIO REAL (Importe o addDoc e collection no topo do tt.js)
            const musicasRef = collection(db, "musicas");
            await addDoc(musicasRef, singleData);

            console.log("✅ Single enviado com sucesso:", singleData);

            // Feedback Visual de Sucesso
            statusMsg.innerHTML = `
                <div class="bg-green-900/30 border border-green-500 p-4 rounded-lg text-center">
                    <p class="text-green-500 font-bold text-lg">✅ Lançamento Concluído!</p>
                    <p class="text-gray-300 text-sm">O single "${title}" já está disponível.</p>
                </div>
            `;
            statusMsg.classList.remove('hidden');
            
            singleForm.reset();

        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
            statusMsg.innerHTML = `<p class="text-red-500 font-bold bg-red-900/20 p-3 rounded">❌ Erro ao enviar: ${error.message}</p>`;
            statusMsg.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerText = "LANÇAR SINGLE AGORA";
        }
    });

    // --- Proteção contra elementos nulos ---
const closeModalBtn = document.getElementById('closeModalButton');
if (closeModalBtn) {
    closeModalBtn.onclick = () => modal.classList.add('hidden');
}

const cancelModalBtn = document.getElementById('modalCancelButton');
if (cancelModalBtn) {
    cancelModalBtn.onclick = () => modal.classList.add('hidden');
}
}

async function setupLogsPage() {
    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;

    console.log("Monitorando logs e buscando apelidos...");
    logsContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando atividades...</p>';

    const logsRef = collection(db, "logs");
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(50));

    // Escuta os logs
    onSnapshot(q, (snapshot) => {
        logsContainer.innerHTML = ''; 
        
        snapshot.forEach(async (docSnap) => {
            const log = docSnap.data();
            const logId = docSnap.id;
            
            // Criamos o elemento do log imediatamente com um "Carregando..." no nome
            const logItem = document.createElement('div');
            logItem.id = `log-${logId}`;
            logItem.className = "flex items-center justify-between p-3 mb-2 bg-[#121212] rounded border-l-4 " + 
                                (log.type === 'Música' ? 'border-green-500' : 'border-blue-500');

            // Formatação da hora
            const timestamp = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date();
            const hora = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // HTML Inicial
            logItem.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-xl">${log.type === 'Música' ? '🎵' : '💿'}</span>
                    <div>
                        <p class="text-white text-sm font-bold user-name-field">Buscando apelido...</p>
                        <p class="text-gray-400 text-xs">Clicou em: <b class="text-gray-200">${log.itemTitle}</b></p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-600 font-mono mb-1">${log.userId || 'sem-id'}</p>
                    <span class="text-xs text-gray-500 font-mono">${hora}</span>
                </div>
            `;
            logsContainer.appendChild(logItem);

            // --- BUSCA O APELIDO PELA CHAVE UID ---
            if (log.userId && log.userId !== "deslogado") {
                try {
                    const userRef = doc(db, "usuarios", log.userId);
                    const userSnap = await getDoc(userRef);
                    
                    const nameField = logItem.querySelector('.user-name-field');
                    if (userSnap.exists() && userSnap.data().apelido) {
                        nameField.textContent = userSnap.data().apelido;
                    } else {
                        // Se não achar apelido, usa o nome que foi gravado no log originalmente
                        nameField.textContent = log.userName || "Usuário desconhecido";
                    }
                } catch (err) {
                    console.error("Erro ao buscar apelido:", err);
                }
            } else {
                logItem.querySelector('.user-name-field').textContent = "Visitante";
            }
        });
    });
}

// ============================================
// ⭐ SETUP DA PÁGINA addmusic (VERSÃO COMPLETA E CORRIGIDA) ⭐
// ============================================

function setupAddMusicPage() {
    const albumSelectionForm = document.getElementById('albumSelectionForm');
    const albumSearchInput = document.getElementById('albumSearch');
    const albumIdInput = document.getElementById('albumId');
    const artistIdInput = document.getElementById('artistId');
    const defaultCoverInput = document.getElementById('defaultCover');
    const quantityInput = document.getElementById('quantity');
    const searchResultsDiv = document.getElementById('albumSearchResults');
    const selectedAlbumDisplay = document.getElementById('selectedAlbumDisplay');
    const generateFormsButton = document.getElementById('generateFormsButton');
    const musicFormsContainer = document.getElementById('musicFormsContainer');

    let musicDataArray = [];

    let albumSearchTimeout;

    // ========================================
    // 🔎 BUSCA DE ÁLBUNS
    // ========================================
    albumSearchInput.addEventListener('input', () => {
        clearTimeout(albumSearchTimeout);
        const searchTerm = albumSearchInput.value.trim();

        if (searchTerm.length < 3) {
            searchResultsDiv.classList.add('hidden');
            return;
        }

        albumSearchTimeout = setTimeout(() => {
            fetchAlbumsForSearch(searchTerm);
        }, 350);
    });

    async function fetchAlbumsForSearch(searchTerm) {
        searchResultsDiv.innerHTML = '<p class="p-3 text-gray-400">Buscando...</p>';
        searchResultsDiv.classList.remove('hidden');

        try {
            const endTerm = searchTerm + "\uf8ff";

            const q = query(
                collection(db, "albuns"),
                where("album", ">=", searchTerm),
                where("album", "<=", endTerm),
                limit(10)
            );

            const snapshot = await getDocs(q);
            renderSearchResults(snapshot.docs);

        } catch (error) {
            console.error("Erro ao buscar álbuns:", error);
            searchResultsDiv.innerHTML = '<p class="p-3 text-red-400">Erro na busca.</p>';
        }
    }

    function renderSearchResults(docs) {
        if (docs.length === 0) {
            searchResultsDiv.innerHTML = '<p class="p-3 text-gray-400">Nenhum álbum encontrado.</p>';
            return;
        }

        searchResultsDiv.innerHTML = '';

        docs.forEach(doc => {
            const albumData = doc.data();
            const albumId = doc.id;

            const albumItem = document.createElement('div');
            albumItem.className = 'p-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0';
            albumItem.innerHTML = `
                <p class="text-white font-medium">${albumData.album || 'Nome Indisponível'}</p>
                <p class="text-xs text-gray-400">${albumData.artist || 'Artista Desconhecido'}</p>
            `;

            albumItem.setAttribute('data-album-id', albumId);
            albumItem.setAttribute('data-artist-id', albumData.uidars || '');
            albumItem.setAttribute('data-album-name', albumData.album || '');
            albumItem.setAttribute('data-album-cover', albumData.cover || '');

            albumItem.addEventListener('click', handleAlbumSelection);
            searchResultsDiv.appendChild(albumItem);
        });

        searchResultsDiv.classList.remove('hidden');
    }

    document.addEventListener('click', (e) => {
        if (!albumSearchInput.contains(e.target) && !searchResultsDiv.contains(e.target)) {
            searchResultsDiv.classList.add('hidden');
        }
    });

    // ========================================
    // 🎯 SELEÇÃO DE ÁLBUM
    // ========================================

    function handleAlbumSelection(e) {
        const target = e.currentTarget;

        const albumId = target.getAttribute('data-album-id');
        const artistId = target.getAttribute('data-artist-id');
        const albumName = target.getAttribute('data-album-name');
        const albumCover = target.getAttribute('data-album-cover');

        albumIdInput.value = albumId;
        artistIdInput.value = artistId;
        albumSearchInput.value = albumName;
        defaultCoverInput.value = albumCover;

        selectedAlbumDisplay.textContent = `Álbum Selecionado: ${albumName} (ID: ${albumId.substring(0, 6)}...)`;

        searchResultsDiv.classList.add('hidden');
        showToastSuccess(`Álbum '${albumName}' selecionado.`);
    }

    // ========================================
    // 🧾 GERAR FORMULÁRIOS DAS MÚSICAS
    // ========================================

    generateFormsButton.addEventListener('click', () => {
        const albumId = albumIdInput.value;
        const artistId = artistIdInput.value;
        const quantity = parseInt(quantityInput.value);

        if (!albumId || !artistId) {
            showToastError("Selecione um álbum primeiro.");
            return;
        }

        if (isNaN(quantity) || quantity < 1 || quantity > 50) {
            showToastError("Quantidade deve ser entre 1 e 50.");
            return;
        }

        musicFormsContainer.innerHTML = '';
        musicDataArray = [];

        for (let i = 1; i <= quantity; i++) {
            musicDataArray.push({});
            const html = createMusicFormHTML(i, defaultCoverInput.value);
            musicFormsContainer.insertAdjacentHTML('beforeend', html);
        }

        musicFormsContainer.insertAdjacentHTML('beforeend', `
            <button id="submitAllButton" class="btn btn-primary w-full mt-6 py-4 font-bold">
                SALVAR TODAS AS ${quantity} MÚSICAS
            </button>
        `);

        attachDynamicFormListeners(quantity);
    });

    // ========================================
    // 🏗️ HTML DAS FICHAS
    // ========================================

    function createMusicFormHTML(index, coverDefault) {
        const today = new Date().toISOString().substring(0, 10);

        return `
            <div class="music-card-form bg-gray-900 p-6 mt-6 rounded-lg" data-index="${index}">
                <h3 class="text-xl text-white font-bold mb-4">Música #${index}</h3>

                <label class="form-label">Título</label>
                <input data-field="title" class="form-input" placeholder="Título da Música" />

                <label class="form-label mt-3">Número da Faixa</label>
                <input data-field="trackNumber" type="number" class="form-input" value="${index}" />

                <label class="form-label mt-3">URL do Áudio</label>
                <input data-field="audioURL" class="form-input" type="url" placeholder="https://firebasestorage.googleapis.com/..." />

                <label class="form-label mt-3">Capa</label>
                <input data-field="cover" class="form-input" type="url" value="${coverDefault}" />

                <label class="form-label mt-3">Gênero</label>
                <input data-field="genre" class="form-input" placeholder="Pop" />

                <label class="form-label mt-3">Duração</label>
                <input data-field="duration" class="form-input" placeholder="2:45" />

                <label class="flex items-center gap-2 mt-3 text-white">
                    <input data-field="explicit" type="checkbox" /> Conteúdo Explícito
                </label>

                <label class="form-label mt-3">Data de Lançamento</label>
                <input data-field="releaseDate" class="form-input" type="date" value="${today}" />

                <label class="form-label mt-3">Streams Iniciais</label>
                <input data-field="streams" type="number" class="form-input" value="0" />
            </div>
        `;
    }

    // ========================================
    // 🎛️ CAPTURA DOS VALORES
    // ========================================

    function attachDynamicFormListeners(quantity) {
        document.querySelectorAll('.music-card-form').forEach(form => {
            const index = parseInt(form.getAttribute('data-index'));

            form.querySelectorAll('[data-field]').forEach(input => {
                input.addEventListener('input', (e) => {
                    let value = e.target.value;

                    if (e.target.type === 'checkbox') {
                        value = e.target.checked;
                    } else if (e.target.type === 'number') {
                        value = parseInt(value) || 0;
                    }

                    musicDataArray[index - 1][e.target.dataset.field] = value;
                });

                input.dispatchEvent(new Event('input'));
            });
        });

        document.getElementById('submitAllButton').addEventListener('click', async () => {
            await submitAllMusicForms(quantity);
        });
    }

    // ========================================
    // 🚀 SALVAR TUDO NO FIRESTORE
    // ========================================

    async function submitAllMusicForms(quantity) {
        const albumId = albumIdInput.value;
        const artistId = artistIdInput.value;
        const defaultCover = defaultCoverInput.value;

        let musics = [];

        for (let i = 0; i < quantity; i++) {
            const data = musicDataArray[i];

            if (!data.title || !data.audioURL || !data.trackNumber) {
                showToastError(`Música #${i + 1} está incompleta.`);
                return;
            }

            musics.push({
                ...data,
                album: albumId,
                artist: artistId,
                cover: data.cover || defaultCover,
                explicit: data.explicit || false,
                streams: data.streams || 0,
                timestamp: new Date().toISOString()
            });
        }

        try {
            const batch = writeBatch(db);
            const musicRef = collection(db, "musicas");

            musics.forEach(music => {
                batch.set(doc(musicRef), music);
            });

            await batch.commit();
            showToastSuccess(`${quantity} músicas salvas com sucesso!`);

            musicFormsContainer.innerHTML = '';
            albumSelectionForm.reset();
            selectedAlbumDisplay.textContent = 'Álbum Selecionado: Nenhum';

        } catch (error) {
            console.error(error);
            showToastError("Erro ao salvar músicas.");
        }
    }
}





// ===================================
// ⭐ CARREGAMENTO DE PÁGINAS ⭐
// ===================================

const elements = {
    contentArea: document.getElementById('feed'),
};

async function loadContent(pageName) {
    if (!elements.contentArea) {
        console.error("Content area not found!");
        return;
    }

    const btnRank = document.getElementById('btn-update-ranking');
    if (btnRank) {
        console.log("Ouvinte de clique adicionado ao botão de Ranking.");
        btnRank.onclick = refreshGlobalRanking; 
    }


    const filePath = `./tuneteam/${pageName}.html`;

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }

        const html = await response.text();
        elements.contentArea.innerHTML = html;

        if (pageName === 'dashboard') {
            setupDashboardPage();
        } else if (pageName === 'addplaylist') {
            setupAddPlaylistPage(); 
        } else if (pageName === 'editplaylist') { // ⬅️ ADICIONE ESTA CONDIÇÃO
            setupEditPlaylistsPage();             // ⬅️ CHAME A FUNÇÃO AQUI
        } else if (pageName === 'ttaddalbum') {
            setupAddAlbumPage(); 
        } else if (pageName === 'additem') {
            setupAddAlbumPage();
        } else if (pageName === 'editalbums') {
            setupEditAlbumsPage();
        } else if (pageName === 'listartists') {
            setupListArtistsPage();
        } else if (pageName === 'settings') {
            setupMaintenanceToggle(); 
            // Você pode chamar outras funções de setup de configurações aqui se houver
        } else if (pageName === 'addmusic') {
            setupAddMusicPage();
        } else if (pageName === 'addsingle') {
            setupAddSinglePage();
        } else if (pageName === 'logs') {
            setupLogsPage();
        }
        
        window.history.pushState({ page: pageName }, '', `?page=${pageName}`);

    } catch (error) {
        console.error("Error loading page content:", error);
        elements.contentArea.innerHTML = `<p class="text-red-500 text-center">Error loading page: ${pageName}.html</p>`;
    }
}


// ============================================
// ⭐ OUVINTES DE EVENTOS DE NAVEGAÇÃO E INICIALIZAÇÃO ⭐
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.getAttribute('data-page');
            if (pageName) {
                loadContent(pageName);
            }
        });
    });

    // Este código roda apenas uma vez quando o site abre
document.addEventListener('click', (e) => {
    // Procura se o clique foi em algo com data-navigate ou se o pai do que foi clicado tem
    const target = e.target.closest('[data-navigate]');
    
    if (target) {
        e.preventDefault();
        const page = target.dataset.navigate;
        const id = target.dataset.id || null;
        
        console.log("Navegando via delegação:", page, id);
        loadContent(page, id); // Chame sua função de carregar conteúdo aqui
    }
});

    // Verifica a URL para carregar a página correta no início
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('page') || 'dashboard'; 
    loadContent(initialPage);

    // ===============================
    // ⭐ CORREÇÃO DO EDIT PLAYLIST ⭐
    // ===============================

    const tabPlaylists = document.getElementById("tabPlaylists");
    const tabAddPlaylist = document.getElementById("tabAddPlaylist");

    if (tabPlaylists && tabAddPlaylist) {
        tabPlaylists.onclick = () => showTab("list");
        tabAddPlaylist.onclick = () => showTab("add");
    } else {
        console.warn("Elementos de aba do editor de playlist ainda não existem.");
    }
});




// ----------------------------------------------------
// (Restante do código de Autenticação e Dashboard...)
// ----------------------------------------------------

const globalElements = {
    adminList: document.getElementById("admin-list"),
    warningModal: document.getElementById("warning-modal"),
    warningMessage: document.getElementById("warning-message"),
    // Adicione outros elementos estáticos aqui, se necessário
};


async function updateUserStatus(userId, isOnline) {
    const userDocRef = doc(db, "usuarios", userId);
    const rtdbRef = databaseRef(rtdb, `status/${userId}`);

    try {
        await set(rtdbRef, { isOnline, lastSeen: serverTimestamp() });
        await updateDoc(userDocRef, { online: isOnline, lastSeen: new Date() });
        console.log(`Admin status ${userId} => ${isOnline}`);
    } catch (error) {
        console.error("Error updating admin status:", error);
    }
}

function setupOnlineStatusManagement(user) {
    if (!user) return;
    const userId = user.uid;
    const rtdbRef = databaseRef(rtdb, `status/${userId}`);

    onDisconnect(rtdbRef).set({ isOnline: false, lastSeen: serverTimestamp() });
    set(rtdbRef, { isOnline: true, lastSeen: serverTimestamp() });
}

function monitorAdminsStatus() {
    const statusRef = databaseRef(rtdb, 'status');
    onValue(statusRef, (snapshot) => {
        const statuses = snapshot.val() || {};
        document.querySelectorAll(".admin-item").forEach(el => {
            const userId = el.dataset.userId;
            const indicator = el.querySelector(".status-indicator");
            if (!indicator) return;
            if (statuses[userId]?.isOnline) {
                indicator.classList.add('bg-green-500');
                indicator.classList.remove('bg-gray-500');
            } else {
                indicator.classList.add('bg-gray-500');
                indicator.classList.remove('bg-green-500');
            }
        });
    });
}

async function fetchAdmins() {
    if (!globalElements.adminList) return;
    const adminLoading = document.getElementById("admin-loading");
    if (adminLoading) {
        adminLoading.style.display = 'block';
        adminLoading.textContent = "Carregando administradores...";
    }
    try {
        const q = query(collection(db, "usuarios"), where("niveladmin", "==", 1));
        onSnapshot(q, (snapshot) => {
            globalElements.adminList.innerHTML = '';
            if (snapshot.empty) {
                globalElements.adminList.innerHTML = '<p class="text-gray-500">Nenhum administrador encontrado.</p>';
            }
            snapshot.forEach((docSnap) => {
                const user = docSnap.data();
                const userId = docSnap.id;
                const adminEl = document.createElement('div');
                adminEl.className = "flex items-center gap-2 text-white p-1 rounded-md cursor-pointer admin-item";
                adminEl.dataset.userId = userId;
                adminEl.innerHTML = `
                    <div class="relative w-10 h-10">
                        <img class="w-full h-full rounded-full object-cover" 
                            src="${user.foto || './assets/default-profile.png'}" 
                            alt="Foto de perfil">
                        <span class="status-indicator absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 bg-gray-500"></span>
                    </div>
                `;
                globalElements.adminList.appendChild(adminEl);
            });
            if (adminLoading) adminLoading.style.display = 'none';
            monitorAdminsStatus();
        });
    } catch (error) {
        console.error("Error fetching administrators:", error);
        if (globalElements.adminList) globalElements.adminList.innerHTML = '<p class="text-red-500">Error loading administrators.</p>';
        if (adminLoading) adminLoading.style.display = 'none';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Redirecionar para login se necessário
        return;
    }
    const docRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.warn("User document not found.");
        return;
    }
    const userData = docSnap.data();
    if (userData.niveladmin !== 1) {
        // Redirecionar se não for admin
        return;
    }
    if (document.getElementById("adminPhoto") && userData.foto) {
        document.getElementById("adminPhoto").src = userData.foto;
    } 
    setupOnlineStatusManagement(user);
    fetchAdmins();
});

// Funções de Contadores do Dashboard
function formatNumber(num) {
    if (typeof num === 'number') {
        return num.toLocaleString('pt-BR');
    }
    return num;
}



function setupCounterListeners() {
    const updateCounter = (element, collectionName, queryOptions = {}) => {
        const counterRef = collection(db, collectionName);
        const queryArray = Object.entries(queryOptions).map(([key, value]) => value);
        const q = query(counterRef, ...queryArray);
        onSnapshot(q, (querySnapshot) => {
            const count = querySnapshot.size;
            if (element) {
                element.textContent = formatNumber(count);
            }
        }, (error) => {
            console.error(`Error listening to collection ${collectionName}:`, error);
            if (element) {
                element.textContent = 'Error';
            }
        });
    };

    updateCounter(document.getElementById("total-albums"), "albuns");
    updateCounter(document.getElementById("total-artists"), "usuarios", { where: where("artista", "==", "true") });
    updateCounter(document.getElementById("total-musics"), "musicas");

    const accessesDocRef = doc(db, "contagem", "numeros");
    const updateAccessCount = async () => {
        try {
            const docSnap = await getDoc(accessesDocRef);
            if (docSnap.exists()) {
                await updateDoc(accessesDocRef, { acessos: increment(1) });
                const currentAccesses = (docSnap.data().acessos || 0) + 1;
                if (document.getElementById("total-accesses")) {
                    document.getElementById("total-accesses").textContent = formatNumber(currentAccesses);
                }
            } else {
                await setDoc(accessesDocRef, { acessos: 1 });
                if (document.getElementById("total-accesses")) {
                    document.getElementById("total-accesses").textContent = '1';
                }
            }
        } catch (error) {
            console.error("Error updating access count:", error);
            if (document.getElementById("total-accesses")) {
                document.getElementById("total-accesses").textContent = 'Error';
            }
        }
    };
    updateAccessCount();
}


function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return "Data indisponível";
    }
    try {
        const date = timestamp.toDate();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return "Erro na data";
    }
}

function fetchAndRenderRecentArtists() {
    const artistsList = document.getElementById('artists-list');
    if (!artistsList) return;
    
    artistsList.innerHTML = '<p class="text-center text-gray-400">Carregando artistas...</p>';

    const q = query(collection(db, "usuarios"), where("niveladmin", "==", 2), orderBy("dataCriacao", "desc"), limit(5));
    onSnapshot(q, (querySnapshot) => {
        artistsList.innerHTML = '';
        if (querySnapshot.empty) {
            artistsList.innerHTML = '<p class="text-gray-500">Nenhum artista recente encontrado.</p>';
            return;
        }
        querySnapshot.forEach(doc => {
            const artist = doc.data();
            const date = artist.dataCriacao ? formatDate(artist.dataCriacao) : 'N/A';
            const artistEl = document.createElement('div');
            artistEl.className = 'flex items-center gap-4 bg-gray-900 p-4 rounded-lg shadow-inner';
            artistEl.innerHTML = `
                <img src="${artist.foto || './assets/default-profile.png'}" alt="Foto de ${artist.nome}" class="w-12 h-12 rounded-full object-cover">
                <div>
                    <h3 class="font-bold text-white">${artist.nome}</h3>
                    <p class="text-sm text-gray-400">Entrou em ${date}</p>
                </div>
            `;
            artistsList.appendChild(artistEl);
        });
    });
}

function setupDashboardPage() {
    setupCounterListeners();
    fetchAndRenderRecentArtists();
    fetchAndRenderTopSongsList();
}

