import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
    getFirestore, collection, doc, getDoc, updateDoc, setDoc, 
    query, where, writeBatch, onSnapshot, orderBy, getDocs, limit, 
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

            // AJUSTE AQUI: Verifica se é diferente de "true" para bloquear
            // Se for "true", ele ignora o IF e segue para o painel.
            if (userData.artista !== "true") { 
                console.warn("Acesso negado: Usuário não possui perfil de artista.");
                window.location.href = "index.html"; 
                return;
            }

            // Se chegou aqui, é porque userData.artista === "true"
            currentUser = user;
            window.currentArtistUid = user.uid;
            console.log("Artista verificado e conectado:", user.uid);

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

async function resizeImage(file, maxWidth = 500, maxHeight = 500, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // calcula proporção
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => resolve(blob),
                "image/jpeg",
                quality
            );
        };

        reader.readAsDataURL(file);
    });
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

    try {
        const originalFile = fileInput.files[0];

        // 🔥 Reduz a imagem antes de enviar
        const resizedFile = await resizeImage(originalFile, 500, 500, 0.7);

        const formData = new FormData();
        formData.append("file", resizedFile);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/posts/profile/${currentUser.uid}`);

        window.hidePhotoEditModal();

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            {
                method: "POST",
                body: formData
            }
        );

       const data = await response.json();

if (!response.ok) {
    console.error("STATUS:", response.status);
    console.error("RESPOSTA:", data);
    alert(data.error?.message || "Erro desconhecido");
    return;
}


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

window.abrirModalEdicao = async function(id, colecao, tituloAtual) {
    const modal = document.getElementById('modal-editar-lancamento');
    const inputTitle = document.getElementById('edit-item-title-input');
    const inputDate = document.getElementById('edit-item-date-input');
    const inputGenre = document.getElementById('edit-item-genre-input');
    const btnSalvar = document.getElementById('btn-salvar-edicao');
    const btnExcluir = document.getElementById('btn-excluir-edicao');

    // Abre o modal e limpa estados anteriores
    modal.style.display = 'flex';
    inputTitle.value = "Carregando...";

    try {
        // 1. Busca as informações atuais diretamente do Firebase
        const docRef = doc(db, colecao, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // 2. Preenche os campos com o que já existe no banco (Valores de Backup)
            const valorOriginalTitulo = colecao === 'musicas' ? data.title : data.album;
            const valorOriginalData = data.date || data.releaseDate || "";
            const valorOriginalGenero = data.genre || "Sertanejo";

            inputTitle.value = valorOriginalTitulo;
            inputDate.value = valorOriginalData;
            inputGenre.value = valorOriginalGenero;

            // 3. Configura a ação de salvar
            btnSalvar.onclick = async () => {
                btnSalvar.disabled = true;
                btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SALVANDO...';

                try {
                    // Prepara o objeto de atualização com os valores dos inputs (mesmo se não mudarem)
                    const novosDados = {
                        genre: inputGenre.value,
                        [colecao === 'musicas' ? 'title' : 'album']: inputTitle.value.trim()
                    };

                    // Mantém a consistência da data para a coleção correta
                    if (colecao === 'musicas') {
                        novosDados.releaseDate = inputDate.value;
                    } else {
                        novosDados.date = inputDate.value;
                    }

                    // Envia para o Firestore
                    await updateDoc(docRef, novosDados);
                    
                    window.showToast("Lançamento atualizado com sucesso!");
                    modal.style.display = 'none';
                    
                    // Atualiza a lista na tela para refletir os novos dados
                    if (typeof listarGerenciamentoLancamentos === 'function') {
                        listarGerenciamentoLancamentos();
                    }

                } catch (err) {
                    console.error("Erro ao salvar edição:", err);
                    window.showToast("Erro ao salvar.", "error");
                } finally {
                    btnSalvar.disabled = false;
                    btnSalvar.innerHTML = "SALVAR ALTERAÇÕES";
                }
            };
        }

        // Configuração do botão de excluir dentro deste contexto
        btnExcluir.onclick = () => {
            modal.style.display = 'none';
            window.showDeleteConfirm(id, inputTitle.value, colecao);
        };

    } catch (error) {
        console.error("Erro ao carregar dados para edição:", error);
        window.showToast("Erro ao carregar informações.", "error");
        modal.style.display = 'none';
    }
};

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
        // Dentro da função renderizarCards no seu tunearts.js
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
        
        <button onclick="window.abrirModalEdicao('${id}', '${colecao}', '${titulo.replace(/'/g, "\\'")}')" 
                class="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors" 
                title="Editar">
            <img src="/assets/edit_document_24dp_000000_FILL0_wght400_GRAD0_opsz24.svg">
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

// Função para comprimir a imagem antes do upload
async function compressImage(file, maxWidth = 500, maxHeight = 500) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Lógica de redimensionamento proporcional (Crop Center)
                const size = Math.min(width, height);
                canvas.width = maxWidth;
                canvas.height = maxHeight;

                const ctx = canvas.getContext('2d');
                // Desenha a imagem cortando o centro para ficar quadrada
                ctx.drawImage(img, (width - size) / 2, (height - size) / 2, size, size, 0, 0, maxWidth, maxHeight);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7); // 0.7 é a qualidade (70%)
            };
        };
    });
}

// Delegação de Eventos: Ouve cliques em todo o documento
document.addEventListener('click', async (e) => {
    // Verifica se o elemento clicado é o botão de confirmar playlist
    if (e.target && e.target.id === 'btnPreviewTracks') {
        const urlInput = document.getElementById("ytPlaylistUrl");
        const grid = document.getElementById("trackCardsGrid");
        const status = document.getElementById("trackStatus");
        const container = document.getElementById("previewContainer");
        const YT_API_KEY = 'AIzaSyCTy9IM54bO4CQudHJgnO_YNUSBtPrMzlU';

        const url = urlInput.value.trim();
        const playlistId = url.match(/[&?]list=([^&]+)/i)?.[1];

        if (!playlistId) {
            alert("Por favor, cole um link de playlist válido.");
            return;
        }

        try {
            status.innerHTML = "⏳ Buscando músicas...";
            
            // Certifique-se que YT_API_KEY esteja disponível globalmente
            const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YT_API_KEY}`);
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            grid.innerHTML = "";
            container.style.display = "block";

            data.items.forEach((item, index) => {
                const videoTitle = item.snippet.title;
                const videoId = item.snippet.resourceId.videoId;

                const card = document.createElement("div");
                card.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #f4f4f4; border: 1px solid #ddd; border-radius: 10px; padding: 10px 15px; margin-bottom: 8px;";

                card.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <span style="font-weight: bold; color: #888; font-size: 12px;">${index + 1}</span>
                        <input type="text" class="track-title-input" 
                               data-videoid="${videoId}" 
                               value="${videoTitle}" 
                               readonly
                               style="background: transparent; border: none; color: #000; width: 100%; outline: none; font-size: 13px; font-family: inherit;">
                    </div>
                    <button type="button" class="btn-edit-track" style="background: none; border: none; cursor: pointer; color: #000; padding: 5px;">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                `;
                grid.appendChild(card);
            });

            status.innerHTML = `<span style="color: green; font-weight: bold;">✅ ${data.items.length} músicas prontas!</span>`;

        } catch (err) {
            console.error("Erro na importação:", err);
            status.innerHTML = `<span style="color: red;">❌ Erro: ${err.message}</span>`;
        }
    }

    // Lógica para o botão de Editar (Lápis) usando a mesma técnica
    if (e.target && (e.target.classList.contains('btn-edit-track') || e.target.closest('.btn-edit-track'))) {
        const btn = e.target.classList.contains('btn-edit-track') ? e.target : e.target.closest('.btn-edit-track');
        const input = btn.parentElement.querySelector('.track-title-input');
        const icon = btn.querySelector('i');
        
        if (input.readOnly) {
            input.readOnly = false;
            input.focus();
            input.style.background = "#fff";
            input.style.border = "1px solid #ccc";
            icon.classList.replace('fa-pencil-alt', 'fa-check');
            icon.style.color = "green";
        } else {
            input.readOnly = true;
            input.style.background = "transparent";
            input.style.border = "none";
            icon.classList.replace('fa-check', 'fa-pencil-alt');
            icon.style.color = "#000";
        }
    }
});
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

const originalFile = coverFileInput.files[0];
const compressedBlob = await compressImage(originalFile, 500, 500); // Reduz para 500x500

const formData = new FormData();
// Enviamos o blob comprimido em vez do arquivo original
formData.append("file", compressedBlob);
formData.append("upload_preset", UPLOAD_PRESET);
formData.append("folder", `tune/posts/releases/${currentUser.uid}`);

// Removido o campo "transformation" que causava erro 400
// O Cloudinary aplicará o que estiver definido no preset, 
// mas como já diminuímos a imagem no canvas, ela já irá leve.

const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
        method: "POST",
        body: formData
    }
);

const uploadData = await uploadResponse.json();

if (!uploadData.secure_url) {
    console.error(uploadData);
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

window.handleAlbumSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitAlbum');
    
    if (!currentUser) return window.showToast("Usuário não logado", "error");

    const trackInputs = document.querySelectorAll('.track-title-input');
    if (trackInputs.length === 0) return window.showToast("Importe as músicas!", "error");

    btn.disabled = true;
    btn.innerHTML = 'ENVIANDO...';

    try {
        // --- AQUI ESTÁ A CORREÇÃO ---
        // Se writeBatch(db) falhar, o erro aparecerá aqui
        const batch = writeBatch(db); 

        // 1. Upload da Capa
        const coverFileInput = document.getElementById('relCoverAlbum');
        const originalFile = coverFileInput.files[0];
        const compressedBlob = await compressImage(originalFile, 600, 600); 
        
        const formData = new FormData();
        formData.append("file", compressedBlob);
        formData.append("upload_preset", UPLOAD_PRESET);
        
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST", body: formData
        });
        const uploadData = await uploadRes.json();
        const coverUrl = uploadData.secure_url;

        // 2. Criar Álbum
        const albumRef = doc(collection(db, "albuns"));
        const artistDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        const artistName = artistDoc.exists() ? (artistDoc.data().nomeArtistico || artistDoc.data().nome) : "N/A";

        batch.set(albumRef, {
            album: document.getElementById('albumName').value.trim(),
            artist: artistName,
            cover: coverUrl,
            date: document.getElementById('releaseDate').value,
            duration: document.getElementById('duration').value,
            genre: document.getElementById("genre").value,
            uidars: currentUser.uid,
            status: "Em Revisão",
            timestamp: new Date().toISOString()
        });

        // 3. Criar Músicas
        trackInputs.forEach((input, index) => {
            const musicRef = doc(collection(db, "musicas"));
            batch.set(musicRef, {
                album: albumRef.id,
                artist: currentUser.uid,
                artistName: artistName,
                audioURL: input.dataset.videoid,
                cover: coverUrl,
                genre: document.getElementById("genre").value,
                title: input.value.trim(),
                trackNumber: index + 1,
                status: "Em Revisão",
                streams: 0
            });
        });

        // Finalizar
        await batch.commit();
        window.showToast("Álbum enviado com sucesso!", "success");
        setTimeout(() => location.reload(), 2000);

    } catch (err) {
        console.error("Erro detalhado:", err);
        // Se o erro for "writeBatch is not defined", precisamos importar ele no topo do arquivo
        window.showToast("Erro técnico: " + err.message, "error");
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