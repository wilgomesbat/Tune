import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
    getFirestore, collection, doc, getDoc, updateDoc, setDoc, 
    query, where, onSnapshot, orderBy, getDocs, limit, 
    addDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js"; 
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// ================================
// 1. CONFIGURAÇÃO DO FIREBASE
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
const storage = getStorage(app);

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

async function verificarManutencao() {
    const docRef = doc(db, "config", "status");
    try {
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().manutencao) {
            window.location.href = "main";
        }
    } catch (e) {
        console.error("Erro ao verificar status de manutenção: ", e);
    }
}
verificarManutencao();

// Constantes Globais
const ACTIVE_OPACITY = '1';
const INACTIVE_OPACITY = '0.5';
const MAIN_HTML_FILE = 'tuneartists.html'; 

// Variáveis de Controle
let currentUser = null;
window.currentArtistUid = null;

// ================================
// 2. ESTADO DE AUTENTICAÇÃO E VERIFICAÇÃO DE PERFIL
// ================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();

            if (userData.artista !== "false") {
                console.warn("Acesso negado: Usuário não é artista.");
                window.location.href = "index.html"; 
                return;
            }

            currentUser = user;
            window.currentArtistUid = user.uid;
            console.log("Artista verificado e conectado:", user.uid);

            // Verifica se a função existe antes de chamar para evitar novo erro
            if (typeof initializePageNavigation === "function") {
                initializePageNavigation();
            }
            
        } else {
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error("Erro ao verificar permissões:", error);
        window.location.href = "index.html";
    }
});

window.showDeleteConfirm = function(id, titulo, colecao) {
    const modal = document.getElementById('delete-confirm-modal');
    const confirmBtn = document.getElementById('confirmDeleteButton');
    
    document.getElementById('delete-item-title').innerText = titulo;
    confirmBtn.setAttribute('data-id', id);
    confirmBtn.setAttribute('data-collection', colecao);

    modal.classList.remove('hidden');
};

// Esconde o modal
window.hideDeleteConfirm = function() {
    document.getElementById('delete-confirm-modal').classList.add('hidden');
};

// ============================================
// ⭐ SISTEMA DE ABAS E NAVEGAÇÃO ⭐
// ============================================

window.switchTab = function(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    const tabs = document.querySelectorAll('.tab-btn');

    contents.forEach(c => c.classList.add('hidden'));
    tabs.forEach(t => t.classList.remove('active', 'border-purple-500', 'text-white'));

    const targetContent = document.getElementById('content-' + tabId);
    if (targetContent) targetContent.classList.remove('hidden');
    
    // Gatilhos de carregamento
    if (tabId === 'dashboard') setupDashboardPage();
    if (tabId === 'releases') listarGerenciamentoLancamentos(); // Chamada para a página de gestão
    if (tabId === 'novo') carregarAlbunsNoSelect();
};

async function loadContent(pageName) {
    const contentArea = document.getElementById('content') || document.getElementById('feed');
    if (!contentArea) return;

    try {
        const response = await fetch(`tuneartists/${pageName}.html`);
        if (!response.ok) throw new Error("Erro ao carregar HTML");

        contentArea.innerHTML = await response.text();

        // Inicializa lógicas específicas
        if (pageName === 'dashboard') setupDashboardPage();
        if (pageName === 'releases') listarGerenciamentoLancamentos();
        if (pageName === 'addmusic') carregarAlbunsNoSelect();
        if (pageName === 'editprofile') setupEditProfilePage();

        window.history.pushState({ page: pageName }, '', `${MAIN_HTML_FILE}?page=${pageName}`);
        setActiveNav(pageName);
    } catch (error) {
        console.error(error);
    }
}

async function setupEditProfilePage() {
    if (!currentUser) return;

    try {
        const snap = await getDoc(doc(db, "usuarios", currentUser.uid));

        if (!snap.exists()) return;

        const data = snap.data();
        const nome =
            data.nomeArtistico ||
            data.nome ||
            "Artista sem nome";

        const nameEl = document.getElementById('display-nome-artistico');
        if (nameEl) {
            nameEl.textContent = nome;
        }

        const photoEl = document.getElementById('artist-cover-bg');
        if (photoEl) {
            photoEl.src = data.foto || './assets/artistpfp.png';
        }

        console.log("✅ Nome exibido:", nome);

    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
    }
}




window.showPhotoEditModal = function () {
  const modal = document.getElementById("photo-edit-modal");
  modal.classList.remove("hidden");
};

window.hidePhotoEditModal = function () {
  const modal = document.getElementById("photo-edit-modal");
  modal.classList.add("hidden");
};


window.updateArtistPhoto = async () => {
    const fileInput = document.getElementById('new-photo-file-input');
    if (!fileInput?.files?.[0] || !currentUser) return;

    const file = fileInput.files[0];
    window.hidePhotoEditModal();

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/posts/profile/${currentUser.uid}`);

        // 🔥 TRANSFORMAÇÕES
        formData.append("width", 600);
        formData.append("height", 600);
        formData.append("crop", "fill");
        formData.append("gravity", "face");
        formData.append("quality", "auto:low");
        formData.append("fetch_format", "auto");

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();
        if (!data.secure_url) throw new Error("Upload falhou");

        const url = data.secure_url;

        await updateDoc(doc(db, "usuarios", currentUser.uid), {
            foto: url
        });

        const artistPhoto = document.getElementById('artist-cover-bg');
        if (artistPhoto) artistPhoto.src = url;

        alert("Foto atualizada!");
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar foto.");
    }
};

window.salvarNomeV3 = async function () {
    const input = document.getElementById('input-sistema-v3');
    if (!input || !currentUser) return;

    const novoNome = input.value.trim();
    if (novoNome.length < 2) {
        window.showToast("Nome muito curto", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "usuarios", currentUser.uid), {
            nomeArtistico: novoNome
        });

        document.getElementById('display-nome-artistico').textContent = novoNome;
        gerenciarModalNome(false);

        window.showToast("Nome atualizado com sucesso!");
    } catch (e) {
        console.error(e);
        window.showToast("Erro ao salvar nome", "error");
    }
};


window.gerenciarModalNome = function (abrir) {
    const modal = document.getElementById('modal-sistema-v3');
    if (!modal) return;

    modal.style.display = abrir ? 'flex' : 'none';

    if (abrir) {
        const input = document.getElementById('input-sistema-v3');
        const nomeAtual = document.getElementById('display-nome-artistico');

        if (input && nomeAtual) {
            input.value = nomeAtual.textContent.trim();
            input.focus();
        }
    }
};


// ============================================
// ⭐ GERENCIAMENTO DE LANÇAMENTOS (CORRIGIDO) ⭐
// ============================================

export async function listarGerenciamentoLancamentos() {
    const listContainer = document.getElementById('releasesList');
    const loadingMsg = document.getElementById('loading-releases');

    if (!listContainer || !currentUser) return;

    listContainer.innerHTML = '';
    if (loadingMsg) loadingMsg.classList.remove('hidden');

    try {
        // Query de Músicas: Usa 'artist' para o UID
        const qMusicas = query(collection(db, "musicas"), where("artist", "==", currentUser.uid));
        
        // Query de Álbuns: CORRIGIDA para usar 'uidars' conforme seu padrão original
        const qAlbuns = query(collection(db, "albuns"), where("uidars", "==", currentUser.uid));

        // Escuta as músicas
        onSnapshot(qMusicas, (snap) => renderizarCards(snap, 'musicas', listContainer, loadingMsg));
        
        // Escuta os álbuns
        onSnapshot(qAlbuns, (snap) => renderizarCards(snap, 'albuns', listContainer, loadingMsg));
        
    } catch (e) {
        console.error("Erro na query de lançamentos:", e);
    }
}

window.handleImagePreview = function(input) {
    const preview = document.getElementById('preview-img');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                
                // Esconde o texto/ícone "Adicionar Arte"
                const uploadIcon = input.closest('.upload-zone').querySelector('div');
                if (uploadIcon) uploadIcon.style.opacity = '0';
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
};

// Aproveite e adicione também a função de alternar campos do formulário
window.toggleFormBehavior = function(type) {
    const audioSection = document.getElementById('audioSection');
    if (audioSection) {
        audioSection.style.display = (type === 'album') ? 'none' : 'block';
    }
};

window.toggleDateInfo = function(status) {
    const dateField = document.getElementById('dateField');
       if (status === 'agendado' || status === 'arquivado') {
        dateField.style.display = 'block';
    } else {
        dateField.style.display = 'none';
    }
};

function renderizarCards(snapshot, colecao, container, loader) {
    if (loader) loader.classList.add('hidden');
    
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        if (document.getElementById(`item-${id}`)) return;

        const titulo = data.title || data.album || "Sem título";
        const status = data.status || 'Público';
        const isArquivado = status.toLowerCase() === 'arquivado' || status.toLowerCase() === 'em revisão';

        const li = document.createElement('li');
        li.id = `item-${id}`;
        li.className = "bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between mb-3 shadow-sm";
        li.innerHTML = `
            <div class="flex items-center space-x-4">
                <img src="${data.cover}" class="w-12 h-12 rounded-lg object-cover">
                <div>
                    <h3 class="font-bold text-black">${titulo}</h3>
                    <p class="text-xs text-gray-500 uppercase">${colecao === 'musicas' ? 'Single' : 'Álbum'}</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isArquivado ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}">
                        ${status}
                    </span>
                </div>
            </div>

<div class="flex space-x-2">
    ${isArquivado ? `<button onclick="window.publicarItem('${id}', '${colecao}')" class="p-2 text-green-600 hover:bg-green-50 rounded-full"><i class="fas fa-check"></i></button>` : ''}
    
    <button onclick="window.showDeleteConfirm('${id}', '${titulo.replace(/'/g, "\\'")}', '${colecao}')" 
            class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors" 
            title="Excluir">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
    </button>
</div>
        `;
        container.appendChild(li);
    });
}

// No seu tunearts.js
window.deleteRelease = async function() {
    const confirmBtn = document.getElementById('confirmDeleteButton');
    const id = confirmBtn.getAttribute('data-id');
    const colecao = confirmBtn.getAttribute('data-collection');

    console.log("Tentando apagar:", colecao, id); 

    if (!id || !colecao) {
        console.error("ID ou Coleção não encontrados no botão!");
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerText = "Excluindo...";

    try {
        const docRef = doc(db, colecao, id);
        await deleteDoc(docRef);

        // Remove da tela
        const elemento = document.getElementById(`item-${id}`);
        if (elemento) elemento.remove();

        window.hideDeleteConfirm();
        if (window.showToast) window.showToast("Excluído com sucesso!");

    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir. Verifique o console.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = "Confirmar Exclusão";
    }
};

window.carregarAlbunsNoSelect = async function() {
    const select = document.getElementById('modalAlbumSelect');
    if (!select || !currentUser) return;

    select.innerHTML = '<option value="">Nenhum Álbum</option>';

    try {
        const q = query(collection(db, "albuns"), where("uidars", "==", currentUser.uid));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const opt = document.createElement('option');
            opt.value = docSnap.data().album;
            opt.textContent = docSnap.data().album;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Erro ao carregar álbuns:", e); }
};

window.showToast = (msg, type = "success") => {
    // 1. Procura ou cria o container dos toasts no body
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        // Estilização rápida via JS para garantir que apareça
        container.style.cssText = "position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;";
        document.body.appendChild(container);
    }

    // 2. Cria o elemento do toast
    const toast = document.createElement('div');
    const bgColor = type === "error" ? "#ff4b4b" : "#2ecc71";
    
    toast.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: sans-serif;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        min-width: 200px;
    `;
    
    toast.textContent = msg;

    // 3. Adiciona na tela
    container.appendChild(toast);

    // 4. Remove automaticamente após 4 segundos
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.5s ease";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// Adiciona a animação de entrada via código para não precisar mexer no CSS
if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.innerHTML = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// --- LÓGI

// ============================================
// 1. SISTEMA DE TOASTS (VISUAL)
// ============================================
window.showToast = (msg, type = "success") => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = "position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === "error" ? "#ff4b4b" : "#2ecc71";
    
    toast.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 14px 22px;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        animation: slideIn 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        min-width: 250px;
        border-left: 5px solid rgba(0,0,0,0.2);
    `;
    
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        toast.style.transition = "all 0.5s ease";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// CSS de Animação (Injetado via JS)
if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.innerHTML = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);
}

// ============================================
// 2. FUNÇÃO DE SUBMISSÃO PRINCIPAL
// ============================================
window.handleReleaseSubmission = async (e) => {
    e.preventDefault();
    
    // Referência do botão para feedback visual
    const btn = document.getElementById('btnSubmit');
    if (!currentUser) {
        window.showToast("Erro: Usuário não autenticado.", "error");
        return;
    }

// Captura dos novos inputs
    const title = document.getElementById('relTitle').value.trim();
    const youtubeUrl = document.getElementById('relAudioLink').value.trim();
    const coverFileInput = document.getElementById('relCover');
    const status = document.getElementById('relStatus').value;
    
    // NOVIDADES:
    const duration = document.getElementById('relDuration').value.trim();
    const isExplicit = document.getElementById('relExplicit').checked;
    const genre = document.getElementById('relGenre').value;
    const releaseDateTime = document.getElementById('relReleaseDate').value; // Captura Data + Hora

    // --- BLOCO DE VALIDAÇÕES RÍGIDAS ---

    if (!duration.includes(':')) {
        window.showToast("Informe a duração no formato mm:ss", "error");
        return;
    }

    if (status === 'agendado' && !releaseDateTime) {
    window.showToast("Escolha uma data e horário para o agendamento!", "error");
    return;
}

    // 1. Validação de Título
    if (title.length < 2) {
        window.showToast("Insira o título da música!", "error");
        return;
    }

    // 2. Validação de Foto (Capa)
    if (!coverFileInput.files || coverFileInput.files.length === 0) {
        window.showToast("Selecione uma imagem de capa!", "error");
        return;
    }

if (!youtubeUrl) {
    window.showToast("O link do YouTube é obrigatório!", "error");
    return;
}

// Verifica se a string contém os domínios básicos do YouTube
const isValidYt = youtubeUrl.includes("youtube.com") || youtubeUrl.includes("youtu.be");

if (!isValidYt) {
    window.showToast("Link inválido! Por favor, insira um link do YouTube.", "error");
    return;
}

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSANDO...';

    try {
        // A. Busca Nome Artístico no Firestore
        let nomeDoArtista = currentUser.displayName || "Artista";
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
            nomeDoArtista = userDoc.data().nomeArtistico || userDoc.data().nome || nomeDoArtista;
        }

       // B. Upload da Imagem (Cloudinary - otimizado)
const file = coverFileInput.files[0];

const formData = new FormData();
formData.append("file", file);
formData.append("upload_preset", UPLOAD_PRESET);
formData.append("folder", `tune/posts/releases/${currentUser.uid}`);

// 🔥 transformações (economia + padrão Spotify vibes)
formData.append("width", 600);
formData.append("height", 600);
formData.append("crop", "fill");
formData.append("gravity", "auto");
formData.append("quality", "auto:eco");
formData.append("fetch_format", "auto");

const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
        method: "POST",
        body: formData
    }
);

const uploadData = await uploadResponse.json();

if (!uploadData.secure_url) {
    throw new Error("Erro ao enviar capa para o Cloudinary");
}

const coverUrl = uploadData.secure_url;


        // C. Salvamento do Documento no Firestore
await addDoc(collection(db, "musicas"), {
    title: title,
    artist: currentUser.uid,
    artistName: nomeDoArtista,
    audioURL: youtubeUrl,
    duration: duration,
    explicit: isExplicit,
    genre: genre,
    cover: coverUrl,
    album: "Single", 
    streams: 0,
    single: "true",
    status: status,
    // Se estiver em "Lançar Agora", salva como Imediato, senão salva a data/hora escolhida
    scheduledTime: (status === 'publico') ? "Imediato" : releaseDateTime,
    timestamp: serverTimestamp()
});
        // Feedback de Sucesso
        window.showToast("Música publicada com sucesso!", "success");

window.showToast("Lançamento configurado!", "success");
        setTimeout(() => { if (typeof loadContent === 'function') loadContent('releases'); }, 1500);

    } catch (err) {
        window.showToast("Erro: " + err.message, "error");
        btn.disabled = false;
    }
};

// ============================================
// 3. SUBMISSÃO DE ÁLBUM (CHAVES ORIGINAIS)
// ============================================
window.handleAlbumSubmission = async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmitAlbum');
    if (!currentUser) {
        window.showToast("Erro: Usuário não autenticado.", "error");
        return;
    }

    // Captura dos inputs do formulário
    const albumTitle = document.getElementById('albumName').value.trim();
    const albumOriginal = document.getElementById('albumOriginal').value.trim(); // Nome do álbum original (referência)
    const durationValue = document.getElementById('duration').value.trim();
    const releaseDate = document.getElementById('releaseDate').value;
    const coverFileInput = document.getElementById('relCoverAlbum');

    // Validações básicas
    if (!albumTitle || !releaseDate || !coverFileInput.files[0]) {
        window.showToast("Preencha os campos obrigatórios e a capa!", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';

    try {
        // A. Busca Nome Artístico para a chave 'artist'
        let nomeDoArtista = "N/A";
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
            nomeDoArtista = userDoc.data().nomeArtistico || userDoc.data().nome || "N/A";
        }

        // B. Upload da Capa (Cloudinary)
        const file = coverFileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/albums/${currentUser.uid}`);
        
        // Transformações padrão
        formData.append("width", 600);
        formData.append("height", 600);
        formData.append("crop", "fill");

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.secure_url) throw new Error("Erro no upload da imagem");

        // C. Salvamento com as CHAVES ORIGINAIS solicitadas
        await addDoc(collection(db, "albuns"), {
            album: albumTitle,          // Nome do Álbum
            artist: nomeDoArtista,      // Nome do Artista (String)
            country: "N/A",             // Padrão solicitado
            cover: uploadData.secure_url,
            date: releaseDate,          // Data (YYYY-MM-DD)
            duration: durationValue,    // Ex: "1h 11min"
            label: "N/A",               // Padrão solicitado
            uidars: currentUser.uid,    // ID do Artista (String)
            status: "Em Revisão",       // Controle interno
            album_original_ref: albumOriginal // Campo extra solicitado anteriormente
        });

        window.showToast("Álbum enviado com sucesso!", "success");
        
        setTimeout(() => { 
            if (typeof loadContent === 'function') loadContent('releases'); 
        }, 1500);

    } catch (err) {
        console.error(err);
        window.showToast("Erro: " + err.message, "error");
        btn.disabled = false;
        btn.innerHTML = 'Enviar';
    }
};

// ============================================
// ⭐ DASHBOARD E AUXILIARES ⭐
// ============================================

function setupDashboardPage() {
    const uid = currentUser?.uid;
    if (!uid) return;

    // Streams Totais
    const q = query(collection(db, "musicas"), where("artist", "==", uid));
    getDocs(q).then(snap => {
        let total = 0;
        snap.forEach(d => total += (d.data().streams || 0));
        const el = document.getElementById('weekly-streams');
        if (el) el.textContent = new Intl.NumberFormat('pt-BR').format(total);
    });

    loadTopTracks(uid);
}

async function loadTopTracks(uid) {
    const list = document.getElementById('top-tracks-list');
    if (!list) return;

    const q = query(collection(db, "musicas"), where("artist", "==", uid), orderBy("streams", "desc"), limit(5));
    const snap = await getDocs(q);
    list.innerHTML = snap.empty ? '<p>Nenhuma música.</p>' : '';
    
    snap.forEach(d => {
        const m = d.data();
        list.innerHTML += `<div class="flex items-center p-2 bg-white/5 mb-1 rounded">
            <img src="${m.cover}" class="w-8 h-8 rounded mr-2">
            <span class="text-sm flex-grow">${m.title}</span>
            <span class="text-xs font-bold">${m.streams || 0}</span>
        </div>`;
    });
}

// Funções de Exclusão e Publicação (Globais)
window.publicarItem = async (id, colecao) => {
    try {
        await updateDoc(doc(db, colecao, id), { status: 'publico' });
        document.getElementById(`item-${id}`)?.remove();
        window.showToast("Publicado!", "success");
    } catch (e) { console.error(e); }
};

window.showDeleteConfirm = function(id, titulo, colecao) {
    const modal = document.getElementById('delete-confirm-modal');
    const confirmBtn = document.getElementById('confirmDeleteButton');
    const titleDisplay = document.getElementById('delete-item-title');
    
    if (titleDisplay) titleDisplay.innerText = titulo;
    
    // Define os atributos no botão de confirmação
    confirmBtn.setAttribute('data-id', id);
    confirmBtn.setAttribute('data-collection', colecao);

    modal.classList.remove('hidden');
};

window.deleteRelease = async () => {
    const btn = document.getElementById('confirmDeleteButton');
    const id = btn.getAttribute('data-id');
    const col = btn.getAttribute('data-collection');
    await deleteDoc(doc(db, col, id));
    document.getElementById(`item-${id}`)?.remove();
    document.getElementById('delete-confirm-modal').classList.add('hidden');
    window.showToast("Excluído");
};

// Utilitários
function initializePageNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            loadContent(link.getAttribute('data-page'));
        };
    });
    const urlParams = new URLSearchParams(window.location.search);
    loadContent(urlParams.get('page') || 'dashboard');
}

function setActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(l => {
        l.style.opacity = l.getAttribute('data-page') === page ? ACTIVE_OPACITY : INACTIVE_OPACITY;
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('mainReleaseForm');
    if (form) form.onsubmit = window.handleReleaseSubmission;
});