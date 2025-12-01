import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, updateDoc, setDoc, query, where, onSnapshot, orderBy, getDocs, limit, addDoc, increment, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref as databaseRef, set, onDisconnect, serverTimestamp, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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

let currentUserId = null; 
let currentEditingPlaylistId = null;

// Variáveis de Paginação e Busca para ARTISTAS
const ARTISTS_PER_PAGE = 20;
let currentArtistPage = 1;
let allArtistsData = []; 
let artistSearchTimeout; 

// Inicializa a autenticação uma vez ao carregar o módulo
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        console.log("✔ Usuário autenticado:", currentUserId);
    } else {
        currentUserId = null;
        console.log("❌ Nenhum usuário logado. A edição de playlists pode ser limitada.");
    }
});

/**
 * Helper para obter elementos DOM com verificação de segurança.
 */
function getElement(id) {
    const el = document.getElementById(id);
    // Removemos o console.warn para evitar poluição no log, pois a falta é esperada
    // antes do seu script principal chamar setupEditPlaylistsPage.
    return el; 
}




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
    // Referências aos elementos da página
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
    
    // Variáveis de escopo
    const ARTISTS_PER_PAGE = 20; // Reutilizando a constante global ou definindo aqui
    let currentArtistPage = 1; // Reutilizando a variável global ou definindo aqui
    let allArtistsData = []; 
    let artistSearchTimeout; 
    
    // --- Verificação de Elementos ---
    if (!artistsGrid || !modal) {
        console.error("ERRO: Elementos essenciais (Grid ou Modal de Artista) não encontrados na página listartists.");
        return;
    }

    // ========================================
    // LÓGICA DE BANIMENTO DE CONTA (NOVA FUNÇÃO)
    // ========================================

    async function toggleBanStatus(artistId, currentStatus) {
        const docRef = doc(db, "usuarios", artistId);
        // O campo 'banido' é string ("false", "true") na sua base
        const newStatus = currentStatus === "true" ? "false" : "true";
        const actionText = newStatus === "true" ? "Banir" : "Desbanir";
        
        if (!confirm(`Tem certeza que deseja ${actionText} o artista?`)) {
            return;
        }

        try {
            await updateDoc(docRef, {
                banido: newStatus 
            });
            
            showToastSuccess(`Artista ${newStatus === "true" ? "banido" : "desbanido"} com sucesso!`);
            
            // Recarrega os dados do modal para refletir o novo status
            openEditArtistModal(artistId); 
            // Recarrega a listagem geral (opcional, mas recomendado)
            fetchAllArtistsData(); 
            
        } catch (error) {
            console.error(`Erro ao tentar ${actionText} o artista:`, error);
            showToastError(`Erro ao ${actionText.toLowerCase()} o artista. Tente novamente.`);
        }
    }
    
    // ========================================
    // LÓGICA DE BUSCA E PAGINAÇÃO DE ARTISTAS
    // ========================================

    async function fetchAllArtistsData() {
        loadingMessage.textContent = "Carregando todos os artistas para busca...";
        loadingMessage.style.display = 'block';

        try {
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
    
    // Filtra, pagina e renderiza os artistas com base no termo de busca
    function liveSearchArtists() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        // 1. FILTRAR
        let filteredArtists = allArtistsData;
        if (searchTerm) {
            filteredArtists = allArtistsData.filter(artist => 
                (artist.nome && artist.nome.toLowerCase().includes(searchTerm)) || 
                (artist.nomeArtistico && artist.nomeArtistico.toLowerCase().includes(searchTerm))
            );
        }
        
        // 2. PAGINAR DADOS FILTRADOS
        const startIndex = (currentArtistPage - 1) * ARTISTS_PER_PAGE;
        const endIndex = startIndex + ARTISTS_PER_PAGE;
        const currentDocs = filteredArtists.slice(startIndex, endIndex);

        // 3. RENDERIZAR
        renderArtists(currentDocs, filteredArtists.length);
        
        // 4. ATUALIZAR PAGINAÇÃO
        prevButton.disabled = currentArtistPage === 1;
        nextButton.disabled = endIndex >= filteredArtists.length;
        pageDisplay.textContent = `Página ${currentArtistPage} / Total: ${filteredArtists.length}`;
    }
    
    function renderArtists(docs, totalCount) {
        artistsGrid.innerHTML = '';
        if (docs.length === 0) {
            artistsGrid.innerHTML = `<p class="text-gray-400 col-span-full">${totalCount === 0 ? 'Nenhum artista encontrado.' : 'Nenhum artista nesta página.'}</p>`;
        }

        docs.forEach(artist => {
            const artistId = artist.id;
            const artistName = artist.nomeArtistico || "Nome Desconhecido";
            const artistPhoto = artist.foto || './assets/default-profile.png';
            const artistCountry = artist.country || 'N/A';

            const artistCard = document.createElement('div');
            artistCard.className = 'bg-transparent rounded-lg overflow-hidden relative group flex flex-col items-center p-4'; 
            
            artistCard.innerHTML = `
                <div class="relative w-24 h-24 rounded-full overflow-hidden mb-3">
                    <img src="${artistPhoto}" alt="Foto de ${artistName}" class="w-full h-full object-cover">
                </div>
                
                <h4 class="text-base font-semibold text-black truncate w-full text-center" title="${artistName}">${artistName}</h4>
                <p class="text-xs text-black truncate w-full text-center">${artistCountry}</p>
                
                <div class="flex flex-col mt-3 space-y-2 w-full">
                    <button 
                        data-id="${artistId}" 
                        class="copy-artist-id-btn flex items-center justify-center space-x-1 
                               w-full py-1 text-xs font-medium text-gray-300 
                               bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
                    >
                        <i class='bx bx-copy text-lg'></i>
                        <span id="copyArtistText-${artistId}">Copiar ID</span>
                    </button>

                    <button 
                        data-id="${artistId}" 
                        class="edit-artist-btn flex items-center justify-center space-x-1 
                               w-full py-1 text-xs font-medium 
                               bg-white text-black 
                               hover:bg-gray-200 rounded transition-colors duration-200"
                    >
                        <i class='bx bx-search-alt text-lg'></i>
                        <span>Editar</span>
                    </button>
                </div>
            `;
            artistsGrid.appendChild(artistCard);
        });
        
        loadingMessage.style.display = 'none';
        attachArtistActionListeners();
    }
    
    // ========================================
    // LÓGICA DE EVENT LISTENERS (Busca, Paginação, Ações)
    // ========================================

    // Handler para o campo de busca de artistas (debounce)
    searchInput.addEventListener('input', () => {
        currentArtistPage = 1; 
        clearTimeout(artistSearchTimeout);
        artistSearchTimeout = setTimeout(() => {
            liveSearchArtists();
        }, 300);
    });
    
    // Botões de Paginação de Artistas
    prevButton.addEventListener('click', () => {
        if (currentArtistPage > 1) {
            currentArtistPage--;
            liveSearchArtists(); 
        }
    });

    nextButton.addEventListener('click', () => {
        currentArtistPage++;
        liveSearchArtists(); 
    });

    // Funções de Ação (Copia ID)
    function handleCopyArtistId(artistId) {
        navigator.clipboard.writeText(artistId).then(() => {
            const copySpan = document.getElementById(`copyArtistText-${artistId}`);
            if (copySpan) {
                const originalText = copySpan.textContent;
                copySpan.textContent = "Copiado!";
                showToastSuccess("ID do artista copiado com sucesso!");
                setTimeout(() => {
                    copySpan.textContent = originalText;
                }, 1500);
            }
        }).catch(err => {
            console.error('Erro ao copiar ID do artista:', err);
            showToastError("Erro ao copiar o ID do artista.");
        });
    }

    function attachArtistActionListeners() {
        document.querySelectorAll('.edit-artist-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const artistId = e.currentTarget.getAttribute('data-id');
                openEditArtistModal(artistId);
            });
        });
        
        document.querySelectorAll('.copy-artist-id-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const artistId = e.currentTarget.getAttribute('data-id');
                handleCopyArtistId(artistId);
            });
        });
    }

    
    // ========================================
    // LÓGICA DO MODAL DE EDIÇÃO E BANIMENTO (ATUALIZADA)
    // ========================================
    
    async function openEditArtistModal(artistId) {
        editForm.reset();
        modal.style.display = 'flex';
        const docRef = doc(db, "usuarios", artistId);
        
        // Referências para os elementos de banimento no modal
        const banStatusText = document.getElementById('banStatusText');
        const oldToggleBanButton = document.getElementById('toggleBanButton');
        
        if (!oldToggleBanButton || !banStatusText) {
             console.error("ERRO: Elementos de banimento (toggleBanButton ou banStatusText) não encontrados no modal.");
             return;
        }

        // Clonar o botão para remover o listener anterior (evitar duplicação de eventos)
        const newToggleBanButton = oldToggleBanButton.cloneNode(true);
        oldToggleBanButton.parentNode.replaceChild(newToggleBanButton, oldToggleBanButton);

        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                document.getElementById('artistDocId').value = artistId; 
                document.getElementById('modalArtistTitle').textContent = `Editar Artista: ${data.nome || 'N/A'}`;
                
                document.getElementById('modalArtistName').value = data.nome || '';
                document.getElementById('modalArtistPhoto').value = data.foto || '';
                document.getElementById('modalArtistCountry').value = data.country || '';
                
                // ⭐ LÓGICA DE BANIMENTO: Carregar Status e Configurar Botão ⭐
                // O campo 'banido' é armazenado como string "true" ou "false"
                const isBanned = data.banido === "true"; 
                
                if (isBanned) {
                    banStatusText.textContent = "Status Atual: BANIDO 🚫";
                    banStatusText.className = 'text-red-500 font-semibold'; // Atualiza classes
                    
                    newToggleBanButton.textContent = "DESBANIR";
                    newToggleBanButton.className = 'py-2 px-4 rounded-full font-bold transition-colors duration-200 bg-green-500 hover:bg-green-600 text-white'; // Atualiza classes
                } else {
                    banStatusText.textContent = "Status Atual: ATIVO ✅";
                    banStatusText.className = 'text-green-500 font-semibold'; // Atualiza classes
                    
                    newToggleBanButton.textContent = "BANIR";
                    newToggleBanButton.className = 'py-2 px-4 rounded-full font-bold transition-colors duration-200 bg-red-500 hover:bg-red-600 text-white'; // Atualiza classes
                }
                
                // Adicionar o listener no novo botão
                newToggleBanButton.addEventListener('click', () => {
                    // Passa o ID e o status atual
                    toggleBanStatus(artistId, data.banido); 
                });
                
            } else {
                showToastError("Documento do artista não encontrado.");
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao carregar dados para edição do artista:", error);
            showToastError("Erro ao carregar dados do artista.");
            modal.style.display = 'none';
        }
    }

    function closeArtistModal() {
        modal.style.display = 'none';
        editForm.reset();
    }
    
    // Listeners para fechar o modal
    closeModalButton.addEventListener('click', closeArtistModal);
    modalCancelButton.addEventListener('click', closeArtistModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeArtistModal();
        }
    });

    // LÓGICA DE SALVAR EDIÇÃO DE ARTISTA
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const docId = document.getElementById('artistDocId').value;
        const docRef = doc(db, "usuarios", docId);

        const updatedData = {
            nome: document.getElementById('modalArtistName').value.trim(),
            foto: document.getElementById('modalArtistPhoto').value.trim(),
            country: document.getElementById('modalArtistCountry').value.trim() || null,
        };

        try {
            await updateDoc(docRef, updatedData);
            showToastSuccess("Artista atualizado com sucesso!");
            closeArtistModal();
            // Recarrega a listagem após a edição
            fetchAllArtistsData(); 
        } catch (error) {
            console.error("Erro ao salvar a edição do artista:", error);
            showToastError("Erro ao salvar a edição do artista. Tente novamente.");
        }
    });

    // INÍCIO: Inicia o carregamento dos artistas ao carregar a página
    fetchAllArtistsData();
}

// ============================================
// ⭐ FUNÇÃO DE SETUP PARA PÁGINA DE PLAYLIST (ATUALIZADA) ⭐
// ============================================
function setupAddPlaylistPage() {
    const playlistForm = document.getElementById("playlistForm");
    
    // ⭐ NOVAS REFERÊNCIAS DE ELEMENTOS ⭐
    const categorySelect = document.getElementById("category");
    const stationSearchSection = document.getElementById("artistStationSearchSection");
    
    const artistSearchInput = document.getElementById("artistSearch");
    const selectedArtistUidInput = document.getElementById("selectedArtistUid"); 
    const artistSearchResultsDiv = document.getElementById("artistSearchResults");
    const selectedArtistDisplay = document.getElementById("selectedArtistDisplay");

    const cancelButton = document.getElementById("cancelButton");

    let artistSearchTimeout; // Variável para debounce
    
    // --- LÓGICA DE EXIBIÇÃO DA BUSCA ---
    if (categorySelect && stationSearchSection) {
        // Função para mostrar/esconder a busca de artista
        const toggleArtistSearch = () => {
            if (categorySelect.value === 'Stations') {
                stationSearchSection.classList.remove('hidden');
            } else {
                stationSearchSection.classList.add('hidden');
                // Limpa os campos quando a categoria muda
                selectedArtistUidInput.value = '';
                if(artistSearchInput) artistSearchInput.value = '';
                if(selectedArtistDisplay) selectedArtistDisplay.textContent = 'Artista Selecionado: Nenhum';
                if(artistSearchResultsDiv) artistSearchResultsDiv.classList.add('hidden');
            }
        };
        
        categorySelect.addEventListener('change', toggleArtistSearch);
        toggleArtistSearch(); // Define o estado inicial
    }


    // --- LÓGICA DE BUSCA DE ARTISTA ---
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
        
        // Esconde os resultados ao clicar fora
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

            // Query para buscar artistas pelo nomeArtistico
            const q = query(
                collection(db, "usuarios"),
                where("artista", "==", "true"), // Apenas usuários marcados como artista
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
            const artistId = doc.id; // O ID do documento é o UID

            const name = artistData.nomeArtistico || artistData.apelido || 'Nome Indisponível';
            
            const artistItem = document.createElement('div');
            artistItem.className = 'p-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0';
            artistItem.innerHTML = `<p class="text-white font-medium">${name}</p>`;
            
            // Atributos de dados para seleção
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
        
        selectedArtistDisplay.textContent = `Artista Selecionado: ${artistName} (UID: ${artistId.substring(0, 6)}...)`;

        artistSearchResultsDiv.classList.add('hidden');

        showToastSuccess(`Artista '${artistName}' selecionado com sucesso!`);
    }

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    if (playlistForm) {
        playlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const playlistName = playlistForm.playlistName.value.trim();
            const playlistCover = playlistForm.playlistCover.value.trim();
            const category = playlistForm.category.value;
            const genres = playlistForm.genres.value.split(',').map(g => g.trim()).filter(g => g);
            
            // UID ARS agora usa o valor do campo oculto
            const artistUid = selectedArtistUidInput.value; 

            if (!playlistName || !playlistCover || !category) {
                showToastError("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
            
            // Nova validação: Se for Stations, o UID do artista é obrigatório
            if (category === 'Stations' && !artistUid) {
                 showToastError("Ao selecionar 'Stations', você deve buscar e selecionar um Artista.");
                 return;
            }

            try {
                const playlistData = {
                    name: playlistName,
                    cover: playlistCover,
                    category,
                    genres,
                    // Salva o UID do artista para Stations
                    uidars: artistUid || null, 
                    dataCriacao: new Date()
                };
                await addDoc(collection(db, "playlists"), playlistData);

                showToastSuccess("Playlist salva com sucesso!");
                playlistForm.reset();
                // Limpa o estado da busca após o sucesso
                if(artistSearchInput) artistSearchInput.value = "";
                if(selectedArtistUidInput) selectedArtistUidInput.value = "";
                if(selectedArtistDisplay) selectedArtistDisplay.textContent = 'Artista Selecionado: Nenhum';
                toggleArtistSearch(); // Esconde a seção se a categoria voltar ao padrão
                
            } catch (error) {
                console.error("Erro ao salvar a playlist:", error);
                showToastError("Erro ao salvar a playlist. Tente novamente.");
            }
        });
    }
    
    // ** CORREÇÃO DE NAVEGAÇÃO **
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            loadContent('dashboard');
        });
    }
}



// ============================================
// ⭐ FUNÇÃO DE SETUP PARA PÁGINA DE ÁLBUM (additem.html) ⭐
// AJUSTADA PARA USAR O ESQUEMA DE DADOS ANTIGO
// ============================================
function setupAddAlbumPage() {
    const albumForm = document.querySelector("#combinedForm"); 
    // const selectedArtistUidInput = document.getElementById("selectedArtistUid"); // REMOVIDO: Substituído por artistUidInput
    const artistNameInput = document.getElementById("artistName"); // NOVO INPUT
    const artistUidInput = document.getElementById("artistUid"); // NOVO INPUT
    const cancelButton = document.getElementById("cancelButton");

    if (!albumForm) {
        console.error("ERRO CRÍTICO: Formulário de Álbum (combinedForm) não encontrado no DOM.");
        return; 
    }

    // Listener para o botão Cancelar (mantido para navegação)
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            loadContent('dashboard');
        });
    }

    albumForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. COLETAR DADOS DO FORMULÁRIO (COM OS NOVOS CAMPOS)
        const currentItemName = albumForm.itemName.value.trim();
        const currentItemCover = albumForm.itemCover.value.trim();
        const currentReleaseDate = albumForm.releaseDate.value.trim();
        const currentDuration = albumForm.duration.value.trim();
        
        // NOVOS VALORES COLETADOS
        const artistName = artistNameInput ? artistNameInput.value.trim() : "Artista Desconhecido";
        const artistUid = artistUidInput ? artistUidInput.value.trim() : null;

        // Validação MÍNIMA
        if (!currentItemName || !currentItemCover || !artistName) {
            showToastError("Por favor, preencha o nome do álbum, capa e o nome do artista.");
            return;
        }

        try {
            // 2. MAPEAMENTO PARA O ESQUEMA ANTIGO OBRIGATÓRIO (Renaissance)
            const albumData = {
                // Mapeamento de Nome do Álbum
                album: currentItemName,
                
                // Mapeamento de Capa
                cover: currentItemCover,

                // Mapeamento de Data de Lançamento
                date: currentReleaseDate,
                
                // Mapeamento de Duração
                duration: currentDuration,
                
                // Mapeamento NOVO: artistName (Form) -> artist (Firestore)
                artist: artistName,
                
                // Mapeamento NOVO: artistUid (Form) -> uidars (Firestore)
                uidars: artistUid || null,
                
                // Campos fixos/padrão que existiam no esquema antigo
                country: "N/A", 
                label: "N/A"
            };

            // Salva na coleção 'albuns'
            await addDoc(collection(db, "albuns"), albumData); 

            showToastSuccess("Álbum salvo com sucesso no esquema antigo!");
            albumForm.reset();
            // Limpa os novos campos de artista também
            if(artistNameInput) artistNameInput.value = "";
            if(artistUidInput) artistUidInput.value = "";
             
        } catch (error) {
            console.error("Erro ao salvar o álbum:", error);
            showToastError("Erro ao salvar o álbum. Tente novamente.");
        }
    });
}

// Constantes de Paginação
const ALBUMS_PER_PAGE = 20;
let currentPage = 1;
let lastVisible = null; // Último documento visível (para paginação baseada em cursor)

// ============================================
// ⭐ FUNÇÃO DE SETUP PARA PÁGINA DE EDIÇÃO DE ÁLBUNS ⭐
// ============================================

function setupEditAlbumsPage() {
    const albumsGrid = document.getElementById('albumsGrid');
    const loadingMessage = document.getElementById('loadingAlbums');
    const prevButton = document.getElementById('prevPageButton');
    const nextButton = document.getElementById('nextPageButton');
    const pageDisplay = document.getElementById('currentPageDisplay');
    const modal = document.getElementById('editAlbumModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const modalCancelButton = document.getElementById('modalCancelButton');
    const editForm = document.getElementById('editAlbumForm');

    if (!albumsGrid || !modal) {
        console.error("Elementos essenciais (Grid ou Modal) não encontrados na página editalbums.");
        return;
    }

    // ========================================
    // LÓGICA DE PAGINAÇÃO
    // ========================================

    async function fetchAlbums(skip = 0) {
        albumsGrid.innerHTML = '';
        loadingMessage.textContent = "Carregando álbuns...";
        loadingMessage.style.display = 'block';

        try {
            let q;
            // A paginação por `limit` e `startAfter` é mais eficiente para o Firestore
            if (skip > 0) {
                // Para simplificar a demonstração, vamos apenas pular os documentos iniciais
                // Nota: O Firestore não tem um 'offset' nativo eficiente para skips longos.
                // A melhor prática é usar startAfter(lastDocument).
                // Para simular o SKIP no front-end, buscaríamos tudo ou usaríamos um sistema
                // mais complexo de cursores (que é mais lento para avançar/voltar).
                
                // Vamos simplificar o `skip` aqui: sempre buscamos do início + limit
                // Se você quiser a paginação real do Firestore, avise!
                q = query(
                    collection(db, "albuns"),
                    orderBy("date", "desc"), 
                    limit(ALBUMS_PER_PAGE)
                );
                
                // Para uma paginação real com cursor (next/prev), a lógica seria:
                // q = query(collection(db, "albuns"), orderBy("date", "desc"), startAfter(lastVisible), limit(ALBUMS_PER_PAGE));
            } else {
                q = query(
                    collection(db, "albuns"),
                    orderBy("date", "desc"),
                    limit(ALBUMS_PER_PAGE)
                );
            }

            // Para simular o 'skip' simples:
            const allDocsQuery = query(collection(db, "albuns"), orderBy("date", "desc"));
            const snapshot = await getDocs(allDocsQuery);
            const allDocs = snapshot.docs;
            
            const startIndex = (currentPage - 1) * ALBUMS_PER_PAGE;
            const endIndex = startIndex + ALBUMS_PER_PAGE;
            const currentDocs = allDocs.slice(startIndex, endIndex);

            renderAlbums(currentDocs);
            
            // Atualizar status dos botões
            prevButton.disabled = currentPage === 1;
            nextButton.disabled = endIndex >= allDocs.length;
            pageDisplay.textContent = `Página ${currentPage}`;

        } catch (error) {
            console.error("Erro ao buscar álbuns:", error);
            albumsGrid.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar álbuns.</p>';
            loadingMessage.style.display = 'none';
        }
    }

    function renderAlbums(docs) {
        albumsGrid.innerHTML = '';
        if (docs.length === 0) {
            albumsGrid.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum álbum encontrado.</p>';
        }

        docs.forEach(doc => {
            const album = doc.data();
            const albumId = doc.id;
            
            // Lógica de fallback para campos antigos (album, date)
            const albumName = album.album || "Sem Nome";
            const artistName = album.artist || "Artista Desconhecido";

            const albumCard = document.createElement('div');
            // Mantém as classes de estilo
            albumCard.className = 'bg-black rounded-lg shadow-xl overflow-hidden relative group'; 
            
            albumCard.innerHTML = `
                <img src="${album.cover}" alt="Capa do ${albumName}" class="w-full h-40 object-cover">
                
                <div class="p-3">
                    <h4 class="text-sm font-semibold text-white truncate">${albumName}</h4>
                    <p class="text-xs text-gray-400 truncate">${artistName}</p>
                    
                     <div class="mt-2">
                        <button 
                            data-id="${albumId}" 
                            class="edit-album-btn flex items-center justify-center space-x-1 
                                   w-full py-1 text-xs font-medium 
                                   bg-white text-black 
                                   hover:bg-gray-200 rounded transition-colors duration-200"
                        >
                            <i class='bx bx-search-alt text-lg'></i>
                            <span>Editar</span>
                        </button>
                    </div>
                </div>
            `;
            albumsGrid.appendChild(albumCard);
        });
        
        loadingMessage.style.display = 'none';
        attachEditListeners();
    }
    
    // Adiciona a funcionalidade de clique aos botões de edição recém-criados
    function attachEditListeners() {
        document.querySelectorAll('.edit-album-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const albumId = e.currentTarget.getAttribute('data-id');
                openEditModal(albumId);
            });
        });
    }

    // Botões de Paginação
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchAlbums();
        }
    });

    nextButton.addEventListener('click', () => {
        currentPage++;
        fetchAlbums();
    });

    // ========================================
    // LÓGICA DO MODAL DE EDIÇÃO
    // ========================================
    
    async function openEditModal(albumId) {
        // Limpar e bloquear o formulário enquanto carrega
        editForm.reset();
        modal.style.display = 'flex';
        const docRef = doc(db, "albuns", albumId);
        
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Preencher o formulário com os dados do álbum
                document.getElementById('albumDocId').value = albumId; // ID do documento
                document.getElementById('modalTitle').textContent = `Editar Álbum: ${data.album || data.name}`;
                
                // Mapeamento de chaves antigas (album, date) para os IDs dos inputs do modal
                document.getElementById('modalItemName').value = data.album || '';
                document.getElementById('modalItemCover').value = data.cover || '';
                document.getElementById('modalReleaseDate').value = data.date || ''; // Mapeia 'date'
                document.getElementById('modalDuration').value = data.duration || '';
                document.getElementById('modalArtistName').value = data.artist || '';
                document.getElementById('modalArtistUid').value = data.uidars || '';
                document.getElementById('modalCountry').value = data.country || '';
                document.getElementById('modalLabel').value = data.label || '';
                
            } else {
                showToastError("Documento do álbum não encontrado.");
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao carregar dados para edição:", error);
            showToastError("Erro ao carregar dados do álbum.");
            modal.style.display = 'none';
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        editForm.reset();
    }
    
    // Listeners para fechar o modal
    closeModalButton.addEventListener('click', closeModal);
    modalCancelButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });


    // ========================================
    // LÓGICA DE SALVAR EDIÇÃO
    // ========================================

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const docId = document.getElementById('albumDocId').value;
        const docRef = doc(db, "albuns", docId);

        // Coletar novos dados do formulário do modal
        const updatedData = {
            // Mapeamento para o esquema antigo
            album: document.getElementById('modalItemName').value.trim(),
            cover: document.getElementById('modalItemCover').value.trim(),
            date: document.getElementById('modalReleaseDate').value.trim(),
            duration: document.getElementById('modalDuration').value.trim(),
            artist: document.getElementById('modalArtistName').value.trim(),
            uidars: document.getElementById('modalArtistUid').value.trim() || null,
            country: document.getElementById('modalCountry').value.trim() || null,
            label: document.getElementById('modalLabel').value.trim() || null,
            // Adicionar timestamp de atualização se necessário (opcional)
            // dataAtualizacao: new Date() 
        };

        try {
            await updateDoc(docRef, updatedData);
            showToastSuccess("Álbum atualizado com sucesso!");
            closeModal();
            // Recarrega a lista para mostrar a alteração
            fetchAlbums(); 
        } catch (error) {
            console.error("Erro ao salvar a edição do álbum:", error);
            showToastError("Erro ao salvar. Tente novamente.");
        }
    });

    // Inicia o carregamento dos álbuns
    fetchAlbums();
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

