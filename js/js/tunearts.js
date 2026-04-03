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


// Constantes Globais
const ACTIVE_OPACITY = '1';
const INACTIVE_OPACITY = '0.5';
const MAIN_HTML_FILE = 'tuneartists.html'; 


window.handleImagePreview = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const preview = document.getElementById('preview-img');
        const uploadZone = input.closest('.upload-zone');
        const textPlaceholder = uploadZone ? uploadZone.querySelector('div') : null;

        const reader = new FileReader();
        
        reader.onload = function(e) {
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                preview.style.width = '100%';
                preview.style.height = '100%';
                preview.style.objectFit = 'cover';
                preview.style.position = 'absolute';
                preview.style.inset = '0';
                preview.style.zIndex = '1';
            }
            
            if (textPlaceholder) {
                textPlaceholder.style.display = 'none';
            }
        };

        reader.readAsDataURL(file);
    }
};

// Variáveis de Controle
let currentUser = null;
window.currentArtistUid = null;
window.handleImagePreview = handleImagePreview;


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
            const valorNoBanco = userData.artista;

            // Normalização: identifica se é artista (aceita Boolean true ou String "true")
            const ehArtista = (valorNoBanco === true || valorNoBanco === "true");

            // SE NÃO FOR ARTISTA, EXPULSA
            if (!ehArtista) { 
                console.warn("Acesso negado: Apenas artistas podem acessar esta página.");
                window.location.href = "index.html"; 
                return;
            }

            // SE CHEGOU AQUI, É ARTISTA: LIBERA O CONTEÚDO
            currentUser = user;
            window.currentArtistUid = user.uid;
            console.log("Acesso de artista confirmado:", user.uid);

            if (typeof initializePageNavigation === "function") {
                initializePageNavigation();
            }
            
        } else {
            // Se o documento nem existir, manda para index por segurança
            console.error("Perfil não encontrado.");
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error("Erro na verificação de permissões:", error);
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


// --- FUNÇÃO DE VALIDAÇÃO DE ARTISTA (FEAT) ---
async function validarArtistaPorUID() {
    const uidInput = document.getElementById('collab-uid-input');
    const uid = uidInput ? uidInput.value.trim() : null;
    
    // currentUser vem do seu estado de auth do Firebase
    if (!uid || !auth.currentUser) {
        window.showToast("Insira um UID válido.", "error");
        return;
    }

    if (uid === auth.currentUser.uid) {
        window.showToast("Você não pode adicionar a si mesmo!", "error");
        return;
    }

    try {
        const docRef = doc(db, "usuarios", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Define variáveis globais para a submissão do formulário
            window.collabIdSelecionado = uid; 
            window.collabNomeSelecionado = data.nomeArtistico || data.nome;

            // Atualiza o Preview no HTML
            const previewImg = document.getElementById('collab-preview-img');
            const previewName = document.getElementById('collab-preview-name');
            const previewContainer = document.getElementById('collab-preview');

            if (previewImg) previewImg.src = data.foto || './assets/artistpfp.png';
            if (previewName) previewName.textContent = window.collabNomeSelecionado;
            if (previewContainer) previewContainer.style.display = 'flex';

            window.showToast("Artista validado!");
        } else {
            window.showToast("Artista não encontrado. Verifique o UID.", "error");
        }
    } catch (e) { 
        console.error("Erro na validação:", e); 
        window.showToast("Erro ao buscar artista.", "error");
    }
}

// Aproveite e garanta o cancelamento também
window.cancelarCollab = function() {
    window.collabIdSelecionado = null;
    window.collabNomeSelecionado = null;
    const preview = document.getElementById('collab-preview');
    if (preview) preview.style.display = 'none';
    const input = document.getElementById('collab-uid-input');
    if (input) input.value = "";
};


// 🌟 ESTA LINHA DEVE ESTAR FORA DE QUALQUER FUNÇÃO
window.validarArtistaPorUID = validarArtistaPorUID

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
        
        if (pageName === 'notifc') {
            if (typeof window.carregarPaginaNotificacoes === 'function') {
                window.carregarPaginaNotificacoes();
            }
        }

        if (pageName === 'releases') listarGerenciamentoLancamentos();

        // Chamada corrigida para addmusic
        if (pageName === 'addmusic') {
            if (typeof window.carregarAlbunsNoSelect === 'function') {
                await window.carregarAlbunsNoSelect();
            }
        }

        if (pageName === 'editprofile') setupEditProfilePage();

        window.history.pushState({ page: pageName }, '', `${MAIN_HTML_FILE}?page=${pageName}`);
        setActiveNav(pageName);
    } catch (error) {
        console.error(error);
    }
}

// 1. CARREGAMENTO INICIAL DOS CAMPOS
async function setupEditProfilePage() {
    if (!currentUser) return;

    try {
        const snap = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (!snap.exists()) return;

        const data = snap.data();
        
        // Preencher Nome e Bio nos inputs
        const inputNome = document.getElementById('input-nome-v3');
        const inputBio = document.getElementById('input-bio-v3');
        const imgPreview = document.getElementById('artist-cover-bg');

        if (inputNome) inputNome.value = data.nomeArtistico || data.nome || "";
        if (inputBio) inputBio.value = data.bio || "";
        if (imgPreview) imgPreview.src = data.foto || './assets/artistpfp.png';

        // Carregar o Preview do Artist Pick no seletor
        if (data.pinnedItem) {
            atualizarPreviewSorteio(data.pinnedItem);
        }

    } catch (e) {
        console.error("Erro ao carregar dados de edição:", e);
    }
}

// Delegação de Eventos: Ouve cliques em todo o documento
document.addEventListener('click', async (e) => {
    // Verifica se o elemento clicado é o botão de confirmar playlist
    if (e.target && e.target.id === 'btnPreviewTracks') {
        const urlInput = document.getElementById("ytPlaylistUrl");
        const grid = document.getElementById("trackCardsGrid");
        const status = document.getElementById("trackStatus");
        const container = document.getElementById("previewContainer");

        // 🛡️ PROTEÇÃO: Se os elementos não existem na página atual, para aqui.
        if (!grid || !status) {
            console.warn("Elementos da playlist não encontrados nesta página.");
            return;
        }

        const YT_API_KEY = 'AIzaSyCTy9IM54bO4CQudHJgnO_YNUSBtPrMzlU';
        const url = urlInput.value.trim();
        const playlistId = url.match(/[&?]list=([^&]+)/i)?.[1];

        if (!playlistId) {
            alert("Por favor, cole um link de playlist válido.");
            return;
        }

        try {
            // Agora o innerHTML não dará erro porque verificamos acima
            status.innerHTML = "⏳ Buscando músicas...";
            
            const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YT_API_KEY}`);
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            grid.innerHTML = ""; // Limpa com segurança
            if (container) container.style.display = "block";

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
            // Verifica se o elemento status ainda existe antes de escrever o erro
            if (status) status.innerHTML = `<span style="color: red;">❌ Erro: ${err.message}</span>`;
        }
    }
});




function atualizarPreviewSorteio(pinned, artistPhoto, artistName) {
    const empty = document.getElementById('pinned-empty');
    const active = document.getElementById('pinned-active');

    if (!empty || !active) {
        console.warn("Containers de destaque não encontrados na Dashboard.");
        return;
    }

    // Troca os estados
    empty.classList.add('hidden');
    active.classList.remove('hidden');
    active.style.display = 'flex'; // Garante que apareça caso o 'hidden' use display:none

    // Preenche os dados da música/álbum
    const img = document.getElementById('pinned-img');
    const title = document.getElementById('pinned-title');
    const subtitle = document.getElementById('pinned-subtitle');

    if (img) img.src = pinned.capa;
    if (title) title.textContent = pinned.titulo;
    if (subtitle) subtitle.textContent = `${pinned.subtitulo} • ${pinned.tipo.toUpperCase()}`;
    
    // Preenche a Pílula Branca (Igual Imagem 1)
    const pillImg = document.getElementById('pill-artist-photo');
    const pillName = document.getElementById('pill-artist-name');
    
    if (pillImg) pillImg.src = artistPhoto || './assets/artistpfp.png';
    if (pillName) pillName.textContent = `De ${artistName || 'Artista'}`;
}

// 3. SALVAR TUDO (NOME E BIO)
window.salvarPerfilCompleto = async function() {
    const inputNome = document.getElementById('input-nome-v3');
    const inputBio = document.getElementById('input-bio-v3');

    if (!currentUser || !inputNome) return;

    const novoNome = inputNome.value.trim();
    const novaBio = inputBio.value.trim();

    if (novoNome.length < 2) {
        if (window.showToast) window.showToast("Nome muito curto!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "usuarios", currentUser.uid), {
            nomeArtistico: novoNome,
            bio: novaBio
        });

        if (window.showToast) window.showToast("Perfil atualizado com sucesso!");
        
        // Opcional: Redirecionar para a visualização do perfil após salvar
        // loadContent('profile', currentUser.uid); 

    } catch (e) {
        console.error("Erro ao salvar perfil:", e);
        alert("Erro ao salvar alterações.");
    }
};


// 1. Função que busca e abre o seletor (Músicas + Álbuns)
window.abrirSeletorDestaque = async function() {
    const lista = document.getElementById('lista-musicas-artista');
    const modal = document.getElementById('modal-seletor');
    
    if (!lista || !modal) {
        console.error("Elementos do modal de seleção não encontrados!");
        return;
    }

    lista.innerHTML = "<p class='text-sm text-gray-500 p-4'>Buscando suas obras...</p>";
    modal.style.display = 'flex';

    try {
        const qMusicas = query(collection(db, "musicas"), where("artist", "==", currentUser.uid));
        const qAlbuns = query(collection(db, "albuns"), where("uidars", "==", currentUser.uid));

        const [musicasSnap, albunsSnap] = await Promise.all([getDocs(qMusicas), getDocs(qAlbuns)]);
        
        lista.innerHTML = "";

        if (musicasSnap.empty && albunsSnap.empty) {
            lista.innerHTML = "<p class='text-sm text-gray-400 p-4'>Nenhuma obra encontrada.</p>";
            return;
        }

        // Renderiza os itens na lista do modal
        const todasObras = [];
        albunsSnap.forEach(d => todasObras.push({ ...d.data(), id: d.id, tipo: 'album', displayTitle: d.data().album }));
        musicasSnap.forEach(d => todasObras.push({ ...d.data(), id: d.id, tipo: 'musica', displayTitle: d.data().title }));

        todasObras.forEach(obra => {
            const item = document.createElement('div');
            item.className = "song-item-select flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer transition";
            item.innerHTML = `
                <img src="${obra.cover || obra.capa || './assets/default-album.png'}" class="w-10 h-10 rounded object-cover">
                <div class="text-left">
                    <p class="text-sm font-bold text-white">${obra.displayTitle}</p>

                </div>
            `;
            // Ao clicar em uma obra da lista, chama o aplicarDestaque
            item.onclick = () => aplicarDestaque({
                id: obra.id,
                tipo: obra.tipo,
                titulo: obra.displayTitle,
                capa: obra.cover || obra.capa,
                subtitulo: obra.genre || 'Lançamento'
            });
            lista.appendChild(item);
        });

    } catch (e) {
        console.error("Erro no seletor:", e);
    }
};

// 2. Aplica a escolha, salva no Firebase e ATUALIZA O PREVIEW NA TELA
async function aplicarDestaque(dados) {
    if (!currentUser) return;

    try {
        await updateDoc(doc(db, "usuarios", currentUser.uid), {
            pinnedItem: dados
        });

        // ESSENCIAL: Atualiza o visual da tela de edição sem precisar de refresh
        atualizarPreviewSorteio(dados);
        
        window.fecharSeletor();
        if (window.showToast) window.showToast("Destaque atualizado!");
        
    } catch (e) {
        console.error("Erro ao salvar destaque:", e);
    }
}

function exibirDestaqueAtivo(pinned, artistPhoto, artistName) {
    const empty = document.getElementById('pinned-empty');
    const active = document.getElementById('pinned-active');

    if (empty && active) {
        empty.classList.add('hidden');
        active.classList.remove('hidden');

        document.getElementById('pinned-img').src = pinned.capa;
        document.getElementById('pinned-title').textContent = pinned.titulo;
        document.getElementById('pinned-subtitle').textContent = `${pinned.subtitulo} • ${pinned.tipo.toUpperCase()}`;
        
        // Elementos da Pílula Branca
        const pillImg = document.getElementById('pill-artist-photo');
        const pillName = document.getElementById('pill-artist-name');
        
        if (pillImg) pillImg.src = artistPhoto || './assets/artistpfp.png';
        if (pillName) pillName.textContent = `De ${artistName}`;
    }
}

// 2. EXIBIR ITEM (Com verificações de NULL)
function exibirItemFixado(data) {
    const emptyState = document.getElementById('pinned-empty');
    const activeState = document.getElementById('pinned-active');
    const img = document.getElementById('pinned-img');
    const title = document.getElementById('pinned-title');
    const subtitle = document.getElementById('pinned-subtitle');

    // Só executa se os elementos existirem na tela
    if (emptyState) emptyState.classList.add('hidden');
    if (activeState) activeState.classList.remove('hidden');
    
    if (img) img.src = data.capa;
    if (title) title.textContent = data.titulo;
    if (subtitle) subtitle.textContent = data.subtitulo;
}

window.fecharSeletor = () => {
    const seletor = document.getElementById('modal-seletor');
    if (seletor) seletor.style.display = 'none';
};

// --- FUNÇÃO DE REDIMENSIONAMENTO (CORRIGE O ERRO) ---
async function resizeImage(file, maxWidth = 500, maxHeight = 500, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

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
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        };
        reader.readAsDataURL(file);
    });
}

// --- GESTÃO DE FOTO E MODAL ---
window.showPhotoEditModal = () => {
    const modal = document.getElementById("photo-edit-modal");
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.warn("Aviso: 'photo-edit-modal' não encontrado no DOM.");
    }
};

window.hidePhotoEditModal = () => {
    const modal = document.getElementById("photo-edit-modal");
    if (modal) modal.classList.add("hidden");
};

window.updateArtistPhoto = async () => {
    const fileInput = document.getElementById('new-photo-file-input');
    if (!fileInput?.files?.[0] || !currentUser) return;

    try {
        // Agora a função resizeImage está definida!
        const resizedFile = await resizeImage(fileInput.files[0], 500, 500, 0.7);
        
        const formData = new FormData();
        formData.append("file", resizedFile);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/profile/${currentUser.uid}`);

        window.hidePhotoEditModal();

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST", 
            body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message);

        const url = data.secure_url;
        await updateDoc(doc(db, "usuarios", currentUser.uid), { foto: url });

        const artistPhoto = document.getElementById('artist-cover-bg');
        if (artistPhoto) artistPhoto.src = url;
        
        if (window.showToast) window.showToast("Foto atualizada com sucesso!");
    } catch (error) {
        console.error("Erro no upload:", error);
        alert("Erro ao enviar foto.");
    }
};

// 3. GESTÃO DE FOTO (Protegida contra erros de DOM)
window.updateArtistPhoto = async () => {
    const fileInput = document.getElementById('new-photo-file-input');
    if (!fileInput?.files?.[0] || !currentUser) return;

    try {
        const resizedFile = await resizeImage(fileInput.files[0], 500, 500, 0.7);
        const formData = new FormData();
        formData.append("file", resizedFile);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/profile/${currentUser.uid}`);

        window.hidePhotoEditModal();

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST", body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message);

        const url = data.secure_url;
        await updateDoc(doc(db, "usuarios", currentUser.uid), { foto: url });

        const artistPhoto = document.getElementById('artist-cover-bg');
        if (artistPhoto) artistPhoto.src = url;
        
        if (window.showToast) window.showToast("Foto atualizada!");
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar foto.");
    }
};



// ============================================
// 1. SUBMISSÃO DE MÚSICA (SINGLE) COM FEAT
// ============================================
window.handleReleaseSubmission = async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit'); // Certifique-se que o id no HTML é btnSubmit
    if (!currentUser) {
        window.showToast("Erro: Usuário não autenticado.", "error");
        return;
    }

    // Captura de Inputs
    const title = document.getElementById('relTitle').value.trim();
    const youtubeUrl = document.getElementById('relAudioLink').value.trim();
    const coverFileInput = document.getElementById('relCover');
    const status = document.getElementById('relStatus').value;
    const duration = document.getElementById('relDuration').value.trim();
    const isExplicit = document.getElementById('relExplicit').checked;
    const genre = document.getElementById('relGenre').value;
    const releaseDateTime = document.getElementById('relReleaseDate').value;

    // --- BLOCO DE VALIDAÇÕES RÍGIDAS ---
    if (!duration.includes(':')) {
        window.showToast("Informe a duração no formato mm:ss", "error");
        return;
    }

    if (status === 'agendado' && !releaseDateTime) {
        window.showToast("Escolha uma data e horário para o agendamento!", "error");
        return;
    }

    if (title.length < 2) {
        window.showToast("Insira o título da música!", "error");
        return;
    }

    if (!coverFileInput.files || coverFileInput.files.length === 0) {
        window.showToast("Selecione uma imagem de capa!", "error");
        return;
    }

    const isValidYt = youtubeUrl.includes("youtube.com") || youtubeUrl.includes("youtu.be");
    if (!isValidYt) {
        window.showToast("Link inválido! Insira um link do YouTube.", "error");
        return;
    }

    // Início do Processamento
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSANDO...';

    try {
        // A. Busca Nome Artístico do Dono
        let nomeDoArtista = "Artista";
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
            nomeDoArtista = userDoc.data().nomeArtistico || userDoc.data().nome || "Artista";
        }

        // B. Compressão e Upload da Capa
        const originalFile = coverFileInput.files[0];
        const compressedBlob = await compressImage(originalFile, 500, 500);

        const formData = new FormData();
        formData.append("file", compressedBlob);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/posts/releases/${currentUser.uid}`);

        const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            { method: "POST", body: formData }
        );

        const uploadData = await uploadResponse.json();
        if (!uploadData.secure_url) throw new Error("Erro ao enviar capa.");

        const coverUrl = uploadData.secure_url;

        // C. Salvamento no Firestore (Adição do array 'artists')
        // Inicializamos o array apenas com o dono. O feat entra após aceitar.
        const musicaRef = await addDoc(collection(db, "musicas"), {
            title: title,
            artist: currentUser.uid, // Dono principal
            artists: [currentUser.uid], // Array de busca para perfis
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
            scheduledTime: (status === 'publico') ? "Imediato" : releaseDateTime,
            timestamp: serverTimestamp()
        });

        // D. Envio do Convite de Colaboração (Se um UID foi validado)
        // 'collabIdSelecionado' deve ser a variável global definida na lógica de busca por UID
        if (typeof collabIdSelecionado !== 'undefined' && collabIdSelecionado) {
            await addDoc(collection(db, "convites_colaboracao"), {
                fromArtistUid: currentUser.uid,
                fromArtistName: nomeDoArtista,
                toArtistUid: collabIdSelecionado,
                musicId: musicaRef.id,
                musicTitle: title,
                musicCover: coverUrl,
                status: "pendente",
                timestamp: serverTimestamp()
            });
            window.showToast("Música enviada e convite de feat despachado!");
        } else {
            window.showToast("Música publicada com sucesso!", "success");
        }

        setTimeout(() => { if (typeof loadContent === 'function') loadContent('releases'); }, 1500);

    } catch (err) {
        console.error("Erro na submissão:", err);
        window.showToast("Erro: " + err.message, "error");
        btn.disabled = false;
        btn.innerHTML = 'PUBLICAR MÚSICA';
    }
};

// ============================================
// 2. SUBMISSÃO DE ÁLBUM (BATCH)
// ============================================
window.handleAlbumSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitAlbum');
    
    if (!currentUser) return window.showToast("Usuário não logado", "error");

    const trackInputs = document.querySelectorAll('.track-title-input');
    if (trackInputs.length === 0) return window.showToast("Importe as músicas do YouTube antes!", "error");

    // Bloqueio de UI
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO ÁLBUM...';

    try {
        const batch = writeBatch(db); // Inicializa a transação em lote

        // 1. Upload da Capa do Álbum
        const coverFileInput = document.getElementById('relCoverAlbum');
        if (!coverFileInput.files[0]) throw new Error("Selecione a capa do álbum.");

        const originalFile = coverFileInput.files[0];
        const compressedBlob = await compressImage(originalFile, 600, 600); 
        
        const formData = new FormData();
        formData.append("file", compressedBlob);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/posts/albums/${currentUser.uid}`);
        
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST", body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.secure_url) throw new Error("Erro no upload da capa.");
        
        const coverUrl = uploadData.secure_url;

        // 2. Criar Referência e Dados do Álbum
        const albumRef = doc(collection(db, "albuns"));
        const artistDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        const artistName = artistDoc.exists() ? (artistDoc.data().nomeArtistico || artistDoc.data().nome) : "Artista";

        const albumData = {
            album: document.getElementById('albumName').value.trim(),
            artist: artistName,
            cover: coverUrl,
            date: document.getElementById('releaseDate').value,
            duration: document.getElementById('duration').value,
            genre: document.getElementById("genre").value,
            uidars: currentUser.uid,
            status: "Em Revisão",
            timestamp: serverTimestamp()
        };

        batch.set(albumRef, albumData);

        // 3. Criar Músicas Vinculadas ao Álbum
        trackInputs.forEach((input, index) => {
            const musicRef = doc(collection(db, "musicas"));
            batch.set(musicRef, {
                album: albumRef.id, // ID gerado acima
                artist: currentUser.uid,
                artistName: artistName,
                audioURL: input.dataset.videoid,
                cover: coverUrl,
                genre: albumData.genre,
                title: input.value.trim(),
                trackNumber: index + 1,
                status: "Em Revisão",
                streams: 0,
                single: "false"
            });
        });

        // Execução Atômica (Ou vai tudo, ou não vai nada)
        await batch.commit();

        window.showToast("Álbum e músicas enviados!", "success");
        setTimeout(() => { if (typeof loadContent === 'function') loadContent('releases'); }, 2000);

    } catch (err) {
        console.error("Erro detalhado no Álbum:", err);
        window.showToast("Erro: " + err.message, "error");
        btn.disabled = false;
        btn.innerHTML = 'ENVIAR ÁLBUM';
    }
};


window.carregarPaginaNotificacoes = function() {
    if (!window.currentArtistUid) return;

    const container = document.getElementById('container-notificacoes');
    const emptyState = document.getElementById('notif-empty-state');

    // Query em tempo real para convites pendentes
    const q = query(
        collection(db, "convites_colaboracao"), 
        where("toArtistUid", "==", window.currentArtistUid), 
        where("status", "==", "pendente"),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snap) => {
        if (!container) return; // Segurança caso o usuário mude de página

        if (snap.empty) {
            container.innerHTML = "";
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = "";

        snap.forEach(d => {
            const c = d.data();
            container.innerHTML += `
                <div class="card-convite">
                    <img src="${c.musicCover}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">
                    <div style="flex: 1;">
                        <p style="margin:0; font-size:14px; color:#000;">
                            <b>${c.fromArtistName}</b> convidou você para colaborar na música <b>"${c.musicTitle}"</b>.
                        </p>
                        <p style="margin:5px 0 0; font-size:10px; color:#888;">Enviado em: ${c.timestamp?.toDate().toLocaleDateString() || 'Recentemente'}</p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.responderConvite('${d.id}', '${c.musicId}', 'aceito')" class="btn-collab-aceitar">ACEITAR</button>
                        <button onclick="window.responderConvite('${d.id}', '${c.musicId}', 'recusado')" class="btn-collab-recusar">RECUSAR</button>
                    </div>
                </div>`;
        });
    });
};

// --- ACEITAR OU RECUSAR ---
window.responderConvite = async function(notifId, musicId, acao) {
    try {
        if (acao === 'aceito') {
            const musicRef = doc(db, "musicas", musicId);
            const musicSnap = await getDoc(musicRef);

            if (musicSnap.exists()) {
                const data = musicSnap.data();
                const currentArtists = data.artists || [data.artist];
                const currentNames = data.artistName || "";
                
                // Busca nome do usuário logado
                const userDoc = await getDoc(doc(db, "usuarios", window.currentArtistUid));
                const meuNome = userDoc.exists() ? (userDoc.data().nomeArtistico || userDoc.data().nome) : "Artista";

                // Atualiza a música com o novo colaborador
                await updateDoc(musicRef, {
                    artists: [...new Set([...currentArtists, window.currentArtistUid])],
                    artistName: currentNames.includes(meuNome) ? currentNames : `${currentNames}, ${meuNome}`
                });
            }
        }

        // Atualiza o convite no banco
        await updateDoc(doc(db, "convites_colaboracao", notifId), { 
            status: acao,
            respondidoEm: serverTimestamp() 
        });

        window.showToast(acao === 'aceito' ? "Convite aceito com sucesso!" : "Convite recusado.");
        
    } catch (e) {
        console.error("Erro ao responder convite:", e);
        window.showToast("Erro ao processar resposta.", "error");
    }
};

window.handleAlbumSubmission = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit'); 
    
    if (!btn) {
        console.error("Botão de submissão não encontrado!");
        return;
    }    
    if (!currentUser) return window.showToast("Usuário não logado", "error");

    const trackInputs = document.querySelectorAll('.track-title-input');
    if (trackInputs.length === 0) return window.showToast("Importe as músicas do YouTube antes!", "error");

    // Bloqueio de UI
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO ÁLBUM...';

    try {
        const batch = writeBatch(db); // Inicializa a transação em lote

        // 1. Upload da Capa do Álbum
        const coverFileInput = document.getElementById('relCoverAlbum');
        if (!coverFileInput.files[0]) throw new Error("Selecione a capa do álbum.");

        const originalFile = coverFileInput.files[0];
        const compressedBlob = await compressImage(originalFile, 600, 600); 
        
        const formData = new FormData();
        formData.append("file", compressedBlob);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", `tune/posts/albums/${currentUser.uid}`);
        
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST", body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.secure_url) throw new Error("Erro no upload da capa.");
        
        const coverUrl = uploadData.secure_url;

        // 2. Criar Referência e Dados do Álbum
        const albumRef = doc(collection(db, "albuns"));
        const artistDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        const artistName = artistDoc.exists() ? (artistDoc.data().nomeArtistico || artistDoc.data().nome) : "Artista";

        const albumData = {
            album: document.getElementById('albumName').value.trim(),
            artist: artistName,
            cover: coverUrl,
            date: document.getElementById('releaseDate').value,
            duration: document.getElementById('duration').value,
            genre: document.getElementById("genre").value,
            uidars: currentUser.uid,
            status: "Em Revisão",
            timestamp: serverTimestamp()
        };

        batch.set(albumRef, albumData);

        // 3. Criar Músicas Vinculadas ao Álbum
        trackInputs.forEach((input, index) => {
            const musicRef = doc(collection(db, "musicas"));
            batch.set(musicRef, {
                album: albumRef.id, // ID gerado acima
                artist: currentUser.uid,
                artistName: artistName,
                audioURL: input.dataset.videoid,
                cover: coverUrl,
                genre: albumData.genre,
                title: input.value.trim(),
                trackNumber: index + 1,
                status: "Em Revisão",
                streams: 0,
                single: "false"
            });
        });

        // Execução Atômica (Ou vai tudo, ou não vai nada)
        await batch.commit();

        window.showToast("Álbum e músicas enviados!", "success");
        setTimeout(() => { if (typeof loadContent === 'function') loadContent('releases'); }, 2000);

    } catch (err) {
        console.error("Erro detalhado no Álbum:", err);
        window.showToast("Erro: " + err.message, "error");
        btn.disabled = false;
        btn.innerHTML = 'ENVIAR ÁLBUM';
    }
};

// 4. MODAIS (Verificando existência antes de acessar classList)
window.showPhotoEditModal = () => {
    const modal = document.getElementById("photo-edit-modal");
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.warn("Modal 'photo-edit-modal' não encontrado no DOM atual.");
    }
};

window.hidePhotoEditModal = () => {
    const modal = document.getElementById("photo-edit-modal");
    if (modal) modal.classList.add("hidden");
};

// Inicialização segura
if (document.readyState === 'complete') {
    setupEditProfilePage();
} else {
    window.addEventListener('load', setupEditProfilePage);
}

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


// Função renomeada para evitar conflitos de SyntaxError
async function processStudioCover(file, maxWidth = 500, maxHeight = 500, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        img.onerror = () => { console.error("Erro ao ler arquivo"); resolve(file); };
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            // Lógica de Crop Center (Corte Quadrado Perfeito)
            let width = img.width;
            let height = img.height;
            const size = Math.min(width, height);
            
            canvas.width = maxWidth;
            canvas.height = maxHeight;

            ctx.drawImage(
                img, 
                (width - size) / 2, (height - size) / 2, size, size, // Origem
                0, 0, maxWidth, maxHeight // Destino
            );
            
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        };
        reader.readAsDataURL(file);
    });
}
// Função de Salvamento no Modal de Edição

const salvarMudancas = async () => {
    const btnPc = document.getElementById('btn-salvar-edicao-pc');
    const btnMob = document.getElementById('btn-salvar-edicao-mob');
    const fileInput = document.getElementById('input-edit-cover');
    
    // Captura valores dos inputs
    const newTitle = document.getElementById('edit-item-title-input').value.trim();
    const newDate = document.getElementById('edit-item-date-input').value;
    const newGenre = document.getElementById('edit-item-genre-input').value;
    const newCanvas = document.getElementById('edit-item-canvas-url').value.trim();
    const newLyrics = document.getElementById('edit-item-lyrics').value.trim();

    // Feedback visual nos botões
    const btns = [btnPc, btnMob].filter(b => b !== null);
    btns.forEach(b => { b.disabled = true; b.innerText = "SINC..."; });

    try {
        // 1. GARANTIA ANTI-UNDEFINED: Começamos com o valor que já existe no banco
        // 'dadosOriginais' deve ter sido preenchido na função 'abrirModalEdicao'
        let finalCoverUrl = dadosOriginais.cover || dadosOriginais.capa || "";

        // 2. Só processa imagem se o usuário escolheu um arquivo novo
        if (fileInput?.files?.[0]) {
            try {
                // Usando a função processStudioCover que criamos
                const blob = await processStudioCover(fileInput.files[0]);
                
                const formData = new FormData();
                formData.append("file", blob);
                formData.append("upload_preset", UPLOAD_PRESET); // Usa sua const do topo

                // CORREÇÃO DA URL: Agora usando a sua variável CLOUD_NAME
                const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                    method: "POST", 
                    body: formData
                });

                if (resp.ok) {
                    const cloudData = await resp.json();
                    finalCoverUrl = cloudData.secure_url;
                } else {
                    const errorMsg = await resp.text();
                    console.error("Erro Cloudinary:", errorMsg);
                }
            } catch (imgErr) {
                console.warn("Falha no upload, mantendo a capa original.", imgErr);
            }
        }

        // 3. Monta o objeto para o Firebase (Seguro contra undefined)
        const updates = {
            genre: newGenre || "Pop",
            canvasUrl: newCanvas || "",
            lyrics: newLyrics || ""
        };

        // Lógica de campos por coleção (Música ou Álbum)
        if (dadosOriginais.colecao === 'musicas') {
            updates.title = newTitle || dadosOriginais.title;
            updates.releaseDate = newDate || dadosOriginais.releaseDate || "";
            updates.cover = finalCoverUrl; // Nunca será undefined
        } else {
            updates.album = newTitle || dadosOriginais.album;
            updates.date = newDate || dadosOriginais.date || "";
            updates.capa = finalCoverUrl; // Nunca será undefined
        }

        // 4. Envia para o Firestore
        const docRef = doc(db, dadosOriginais.colecao, dadosOriginais.id);
        await updateDoc(docRef, updates);

        window.showToast("Lançamento atualizado!");
        window.hideModalEdicao();
        
        if (typeof listarGerenciamentoLancamentos === 'function') {
            listarGerenciamentoLancamentos();
        }

    } catch (err) {
        console.error("Erro Crítico no Firebase:", err);
        window.showToast("Erro ao salvar no banco.", "error");
    } finally {
        btns.forEach(b => { b.disabled = false; b.innerText = "SALVAR ALTERAÇÕES"; });
    }
};

// 1. Funções Auxiliares Globais (Acessíveis pelo HTML)
window.previewEditImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgPreview = document.getElementById('preview-edit-cover');
            if (imgPreview) imgPreview.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.switchEditTab = (tabName, btnElement) => {
    const allPills = document.querySelectorAll('.nav-pill');
    allPills.forEach(pill => pill.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    const targetPane = document.getElementById(`edit-tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
    }
};

window.updateCanvasPreview = () => {
    const inputElement = document.getElementById('edit-item-canvas-url');
    const url = inputElement ? inputElement.value.trim() : "";
    const iframe = document.getElementById('canvas-iframe');
    const container = document.getElementById('canvas-preview-container');

    if (!iframe || !container) return;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = "";
        try {
            if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('shorts/')) {
                videoId = url.split('shorts/')[1].split('?')[0];
            } else {
                videoId = url.split('/').pop().split('?')[0];
            }

            if (videoId) {
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=1&modestbranding=1&rel=0`;
                container.classList.remove('hidden');
            }
        } catch (e) {
            console.warn("Erro ao processar URL do YouTube");
        }
    } else {
        container.classList.add('hidden');
        iframe.src = "";
    }
};

window.hideModalEdicao = () => {
    const modal = document.getElementById('modal-editar-lancamento');
    if (modal) modal.style.display = 'none';
    const iframe = document.getElementById('canvas-iframe');
    if (iframe) iframe.src = ""; 
};

// Variável de controle global
let dadosOriginais = {};

// --- FUNÇÃO DE ABERTURA DE MODAL COMPLETA ---
window.abrirModalEdicao = async function(id, colecao, tituloAtual) {
    const modal = document.getElementById('modal-editar-lancamento');
    const btnSalvar = document.getElementById('btn-salvar-edicao-pc');
    const btnSalvarMob = document.getElementById('btn-salvar-edicao-mob');

    if (!modal) return;
    modal.style.display = 'flex';

    // --- 1. LÓGICA DE BLOQUEIO DE NAVEGAÇÃO (PÍLULAS) ---
    const pills = document.querySelectorAll('.nav-pill');
    let pillLetras = null;

    // Localiza a pílula de letras para manipulação
    pills.forEach(pill => {
        if (pill.innerText.toLowerCase().includes('letras')) {
            pillLetras = pill;
        }
    });

    const seletorModoExibicao = document.querySelector('.display-mode-selector');

    if (colecao !== 'musicas') {
        // Se for ÁLBUM: bloqueia Letras e Canvas
        if (pillLetras) pillLetras.style.display = 'none';
        if (seletorModoExibicao) seletorModoExibicao.style.display = 'none';
        console.log("Modo Álbum: Abas de Letras e opção de Canvas ocultadas.");
    } else {
        // Se for MÚSICA: exibe tudo
        if (pillLetras) pillLetras.style.display = 'flex';
        if (seletorModoExibicao) seletorModoExibicao.style.display = 'block';
    }

    // Força a abertura na aba 'geral' ao iniciar para evitar bugs de visualização
    const firstPill = document.querySelector('.nav-pill');
    window.switchEditTab('geral', firstPill);

    try {
        const docRef = doc(db, colecao, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            dadosOriginais = docSnap.data();
            dadosOriginais.id = id;
            dadosOriginais.colecao = colecao;

            // --- 2. CAPTURA DE ELEMENTOS DO DOM ---
            const areaCapa = document.getElementById('area-upload-cover');
            const areaCanvas = document.getElementById('area-upload-canvas');
            const inputCanvas = document.getElementById('edit-item-canvas-url');
            const inputLyrics = document.getElementById('edit-item-lyrics');
            const previewCover = document.getElementById('preview-edit-cover');
            
            // Preenchimento dinâmico
            document.getElementById('edit-item-title-input').value = (colecao === 'musicas') ? (dadosOriginais.title || "") : (dadosOriginais.album || "");
            document.getElementById('edit-item-date-input').value = dadosOriginais.date || dadosOriginais.releaseDate || "";
            document.getElementById('edit-item-genre-input').value = dadosOriginais.genre || "Pop";
            
            // Reset de campos bloqueados para álbuns
            inputCanvas.value = (colecao === 'musicas') ? (dadosOriginais.canvasUrl || "") : "";
            inputLyrics.value = (colecao === 'musicas') ? (dadosOriginais.lyrics || "") : "";
            if (previewCover) previewCover.src = dadosOriginais.cover || dadosOriginais.capa || "/assets/default-cover.png";

            // --- 3. LÓGICA DE ALTERNÂNCIA VISUAL (INTERNA) ---
            const alternarModoVisual = (modo) => {
                if (!areaCapa || !areaCanvas) return;
                
                // Se for álbum, o modo visual é estritamente 'cover'
                const modoFinal = (colecao !== 'musicas') ? 'cover' : modo;

                if (modoFinal === 'canvas') {
                    areaCapa.classList.add('hidden');
                    areaCanvas.classList.remove('hidden');
                } else {
                    areaCapa.classList.remove('hidden');
                    areaCanvas.classList.add('hidden');
                }
            };

            // Define o estado inicial do rádio e da visualização
            const modoSalvo = dadosOriginais.displayMode || 'cover';
            const modoInicial = (colecao === 'musicas' && inputCanvas.value.trim() !== "") ? modoSalvo : 'cover';

            const radioAlvo = document.querySelector(`input[name="displayMode"][value="${modoInicial}"]`);
            if (radioAlvo) radioAlvo.checked = true;
            alternarModoVisual(modoInicial);

            // Vincula evento de mudança nos rádios
            document.querySelectorAll('input[name="displayMode"]').forEach(radio => {
                radio.onchange = (e) => {
                    alternarModoVisual(e.target.value);
                    if (e.target.value === 'canvas') window.updateCanvasPreview();
                };
            });

            // --- 4. FUNÇÃO DE SALVAMENTO ---
            const executarSalvar = async () => {
                const selectedMode = (colecao !== 'musicas') ? 'cover' : document.querySelector('input[name="displayMode"]:checked').value;
                const fileInput = document.getElementById('input-edit-cover');
                const btns = [btnSalvar, btnSalvarMob].filter(b => b !== null);
                
                btns.forEach(b => { b.disabled = true; b.innerText = "SINC..."; });

                try {
                    let finalCoverUrl = dadosOriginais.cover || dadosOriginais.capa || "";

                    // Lógica de Upload para Cloudinary
                    if (fileInput?.files?.[0]) {
                        const blob = await processStudioCover(fileInput.files[0]);
                        const formData = new FormData();
                        formData.append("file", blob);
                        formData.append("upload_preset", UPLOAD_PRESET);

                        const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                            method: "POST", body: formData
                        });

                        if (resp.ok) {
                            const cloudData = await resp.json();
                            finalCoverUrl = cloudData.secure_url;
                        }
                    }

                    const updates = {
                        displayMode: selectedMode,
                        genre: document.getElementById('edit-item-genre-input').value,
                        canvasUrl: (colecao === 'musicas') ? inputCanvas.value.trim() : "",
                        lyrics: (colecao === 'musicas') ? inputLyrics.value.trim() : ""
                    };

                    // Diferenciação de campos por coleção
                    if (colecao === 'musicas') {
                        updates.title = document.getElementById('edit-item-title-input').value.trim();
                        updates.releaseDate = document.getElementById('edit-item-date-input').value;
                        updates.cover = finalCoverUrl; 
                    } else {
                        updates.album = document.getElementById('edit-item-title-input').value.trim();
                        updates.date = document.getElementById('edit-item-date-input').value;
                        updates.capa = finalCoverUrl;
                    }

                    await updateDoc(docRef, updates);
                    window.showToast("Salvo com sucesso!");
                    window.hideModalEdicao();
                    if (typeof listarGerenciamentoLancamentos === 'function') listarGerenciamentoLancamentos();

                } catch (err) {
                    console.error("Erro ao salvar edição:", err);
                    window.showToast("Erro ao salvar alterações.", "error");
                } finally {
                    btns.forEach(b => { b.disabled = false; b.innerText = "SALVAR ALTERAÇÕES"; });
                }
            };

            // Atribui os eventos de clique aos botões de salvar
            if (btnSalvar) btnSalvar.onclick = executarSalvar;
            if (btnSalvarMob) btnSalvarMob.onclick = executarSalvar;
        }
    } catch (e) {
        console.error("Erro ao carregar dados do Firebase:", e);
    }
};

// Define a função globalmente para que o modal consiga chamá-la
window.showToast = (message, type = 'success') => {
    // Cria o elemento do toast se não existir (exemplo simples)
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerText = message;
    
    // Estilo rápido para teste (você pode mover isso para o CSS)
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: type === 'success' ? '#1db954' : '#ff4444',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '50px',
        fontFamily: 'Nationale Bold, sans-serif',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });

    document.body.appendChild(toast);

    // Remove após 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- FUNÇÕES DE INTERAÇÃO DO MODAL ---

// Troca as Abas Principais (Visual / Letras)
window.switchEditTab = (tabName, btnElement) => {
    // 1. Remove active de todas as pílulas da navegação
    const allPills = document.querySelectorAll('.nav-pill');
    allPills.forEach(pill => pill.classList.remove('active'));

    // 2. Ativa a pílula clicada
    if (btnElement) btnElement.classList.add('active');

    // 3. Esconde todas as seções e mostra a correta
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    const targetPane = document.getElementById(`edit-tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
    }
};

const areaCapa = document.getElementById('area-upload-cover');
const areaCanvas = document.getElementById('area-upload-canvas');

const alternarModoVisual = (modo) => {
    if (modo === 'canvas') {
        areaCapa.classList.add('hidden');    // Esconde total a Capa
        areaCanvas.classList.remove('hidden'); // Mostra total o Canvas
    } else {
        areaCapa.classList.remove('hidden'); // Mostra total a Capa
        areaCanvas.classList.add('hidden');    // Esconde total o Canvas
    }
};

// Escuta a mudança nas pílulas
document.querySelectorAll('input[name="displayMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        alternarModoVisual(e.target.value);
    });
});

// Inicializa o estado baseado no que veio do banco
const modoInicial = dadosOriginais.displayMode || 'cover';
alternarModoVisual(modoInicial);

// Preview da Imagem ao escolher arquivo
window.previewEditImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgPreview = document.getElementById('preview-edit-cover');
            if (imgPreview) imgPreview.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};



window.updateCanvasPreview = () => {
    // 1. Pegamos o valor do input (id correto conforme seu HTML)
    const inputElement = document.getElementById('edit-item-canvas-url');
    const url = inputElement ? inputElement.value.trim() : "";
    
    const iframe = document.getElementById('canvas-iframe');
    const container = document.getElementById('canvas-preview-container');

    if (!iframe || !container) return;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = "";
        
        // Lógica para extrair ID de vídeos normais, Shorts ou links curtos
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('shorts/')) {
            // CORREÇÃO: Usando a variável 'url' em vez de 'urlInput'
            videoId = url.split('shorts/')[1].split('?')[0];
        } else {
            videoId = url.split('/').pop().split('?')[0];
        }

        if (videoId) {
            // Monta o embed otimizado para Canvas (Mudo, Loop e sem controles)
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=1&modestbranding=1&rel=0`;
            container.classList.remove('hidden');
            
            if (window.showToast) window.showToast("Preview do Canvas carregado!");
        }
    } else {
        // Se o campo for limpo ou o link for inválido
        container.classList.add('hidden');
        iframe.src = "";
    }
};

window.hideModalEdicao = () => {
    const modal = document.getElementById('modal-editar-lancamento');
    modal.classList.add('hidden');
    document.getElementById('canvas-iframe').src = ""; // Para o vídeo
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

// Função para formatar números (ex: 100k, 1.2m)
function formatNumber(num) {
    if (!num) return "0";
    const n = Number(num);
    if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'b';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
}

async function renderizarCards(snapshot, tipoOriginal, container, loadingMsg) {
    if (loadingMsg) loadingMsg.classList.add('hidden');

    for (const change of snapshot.docChanges()) {
        const data = change.doc.data();
        const id = change.doc.id;
        // Usa o título da música ou o nome do álbum como título do card
        const tituloValue = data.title || data.titulo || data.album || "Sem título";

        if (change.type === "added") {
            const li = document.createElement('li');
            li.id = `item-${id}`;
            li.className = "flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-shadow";
            
            let exibicaoStreams = "0 streams";

            if (tipoOriginal === 'albuns') {
                try {
                    const musicasRef = collection(db, "musicas");
                    // Busca músicas onde o campo 'album' é o ID deste álbum
                    const q = query(musicasRef, where("album", "==", id));
                    const querySnapshot = await getDocs(q);
                    
                    let totalAlbumStreams = 0;
                    querySnapshot.forEach((docMusica) => {
                        totalAlbumStreams += (docMusica.data().streams || 0);
                    });
                    
                    exibicaoStreams = `${formatNumber(totalAlbumStreams)} streams (Total)`;
                } catch (err) {
                    console.error("Erro ao calcular streams do álbum:", err);
                }
            } else {
                const streamsSimples = data.streams || 0;
                exibicaoStreams = `${formatNumber(streamsSimples)} streams`;
            }

            li.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${data.cover || data.capa || 'assets/default.png'}" class="w-12 h-12 rounded object-cover">
                    <div style="flex: 1;">
                        <h4 class="font-bold text-gray-900">${tituloValue}</h4>
                        <p class="text-sm text-gray-500">
                            ${exibicaoStreams}
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.abrirModalEdicao('${id}', '${tipoOriginal}', '${tituloValue.replace(/'/g, "\\'")}')" 
                            class="p-2 hover:bg-blue-50 rounded-full transition-colors" 
                            title="Editar">
                        <span class="material-symbols-outlined">edit_square</span>
                    </button>
                </div>
            `;
            container.appendChild(li);
        }

        if (change.type === "modified") {
            const item = document.getElementById(`item-${id}`);
            if (item && tipoOriginal !== 'albuns') {
                const p = item.querySelector('p');
                if (p) p.innerText = `${formatNumber(data.streams || 0)} streams`;
            }
        }

        if (change.type === "removed") {
            document.getElementById(`item-${id}`)?.remove();
        }
    }
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



async function verificarERenderizarBotaoThisIs() {
    if (!currentUser) return;
    const container = document.getElementById('card-this-is-creator');
    if (!container) return;

    try {
        // Busca se já existe uma playlist deste artista na categoria Stations
        const q = query(collection(db, "playlists"), 
            where("uidars", "==", currentUser.uid), 
            where("category", "==", "Stations")
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
            // BLOQUEIO: Se o usuário já tiver a playlist, garante que o card continue invisível
            container.classList.add('hidden');
            container.style.display = 'none';
        } else {
            // Se NÃO tiver, remove a classe hidden para tornar o card visível
            container.classList.remove('hidden');
            container.style.display = 'block'; // Ou 'flex' dependendo do seu layout
            document.getElementById('btn-gerar-thisis').onclick = gerarPlaylistThisIs;
        }
    } catch (e) {
        console.error("Erro ao verificar playlist existente:", e);
        // Em caso de erro, por segurança, mantemos escondido
        container.classList.add('hidden');
    }
}

async function gerarPlaylistThisIs() {
    const btn = document.getElementById('btn-gerar-thisis');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ALINHANDO ELEMENTOS...';

    try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        const userData = userDoc.data();
        const nomeArtista = userData.nomeArtistico || userData.nome || "Artista";
        const fotoUrl = userData.foto || "./assets/artistpfp.png";

        // 1. Carregamento de Recursos
        try {
            await Promise.all([
                document.fonts.load("10pt 'Nationale Black'"),
                document.fonts.load("10pt 'Nationale Bold'")
            ]);
        } catch (fErr) { console.warn("Fontes não carregadas, usando fallbacks."); }

        const canvas = document.getElementById("canvas-thisis");
        const ctx = canvas.getContext("2d");
        canvas.width = 500;
        canvas.height = 500;

        const imgArtista = new Image();
        const imgLogo = new Image();
        imgArtista.crossOrigin = "anonymous";
        imgLogo.src = "./assets/image-removebg-preview.png"; 
        imgArtista.src = fotoUrl;

        await Promise.all([
            new Promise(res => imgArtista.onload = res),
            new Promise(res => imgLogo.onload = res)
        ]);

        // 2. Cor Dominante
        ctx.drawImage(imgArtista, 0, 0, 10, 10);
        const p = ctx.getImageData(5, 5, 1, 1).data;
        const corDominante = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
        ctx.clearRect(0, 0, 500, 500);

        // 3. Fundo (Divisão Spotify Style)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 500, 250); // Metade superior
        ctx.fillStyle = corDominante;
        ctx.fillRect(0, 250, 500, 250); // Metade inferior

        // 4. Logo e Texto "THIS IS" (ALINHADOS NO TOPO)
        // Definimos um eixo Y fixo para ambos ficarem na mesma linha
        const eixoYTopo = 75; 

        // Logo (Invertida para Preto)
        
        ctx.drawImage(imgLogo, 35, 40, 40, 40); 
        
// 4. Logo e Texto "THIS IS" (Alinhados)
        


        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = "normal 32px 'Nationale Regular', 'Arial Black', sans-serif";
        ctx.fillText("THIS IS", 250, 75);

        // 5. FOTO DO ARTISTA (300x300 Centralizada)
        const fotoSize = 300; 
        const fotoX = (500 - fotoSize) / 2;
        const fotoY = (500 - fotoSize) / 2; 
        ctx.drawImage(imgArtista, fotoX, fotoY, fotoSize, fotoSize);

        // 6. Nome do Artista (Nationale Bold) - SEM UPPERCASE
        let fontSize = 42;
        ctx.fillStyle = "#ffffff";
        ctx.font = `normal ${fontSize}px 'Nationale Bold', Arial, sans-serif`;

        // Ajuste de tamanho dinâmico usando o nome original
        while (ctx.measureText(nomeArtista).width > 440 && fontSize > 28) {
            fontSize -= 2;
            ctx.font = `normal ${fontSize}px 'Nationale Bold', Arial, sans-serif`;
        }

        // Posicionado com respiro na parte inferior
        ctx.fillText(nomeArtista, 250, 470);

        // 7. Upload para Cloudinary e Firestore
        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append("file", blob);
            formData.append("upload_preset", UPLOAD_PRESET);
            formData.append("folder", "tune/stations");

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                { method: "POST", body: formData }
            );
            const data = await uploadRes.json();

            await addDoc(collection(db, "playlists"), {
                name: `This is ${nomeArtista}`,
                artist: nomeArtista,
                uidars: currentUser.uid,
                cover: data.secure_url,
                category: "Stations",
                genres: userData.genres || [],
                dataCriacao: serverTimestamp(),
                status: "publico"
            });

            window.showToast("Playlist oficial criada com sucesso!");
            document.getElementById("card-this-is-creator")?.remove();
        }, "image/jpeg", 0.95);

    } catch (error) {
        console.error("Erro no alinhamento:", error);
        window.showToast("Erro ao processar imagem", "error");
        btn.disabled = false;
        btn.innerHTML = "GERAR AGORA";
    }
}

async function setupDashboardPage() {
    const uid = currentUser?.uid;
    if (!uid) return;

    try {
        // 1. DADOS DO ARTISTA E DESTAQUE
        const artistDoc = await getDoc(doc(db, "usuarios", uid));
        const artistData = artistDoc.exists() ? artistDoc.data() : {};
        const artistName = artistData.nomeArtistico || artistData.nome || "Artista";
        
        if (artistData.pinnedItem) {
            atualizarPreviewSorteio(artistData.pinnedItem, artistData.foto, artistName);
        }

        // 2. BUSCAR ÚLTIMO LANÇAMENTO
        const qLatest = query(collection(db, "musicas"), 
            where("artist", "==", uid), 
            orderBy("timestamp", "desc"), 
            limit(1)
        );
        const snapLatest = await getDocs(qLatest);
        
        if (!snapLatest.empty) {
            const latest = snapLatest.docs[0].data();
            const focusCard = document.querySelector('.sfa-focus-card');
            const coverImg = document.getElementById('latest-cover');

            // Atualiza textos
            document.getElementById('latest-title').textContent = latest.title;
            const totalStreamsMusica = latest.streams || 0;
            document.getElementById('latest-total-streams').textContent = totalStreamsMusica.toLocaleString('pt-BR');

            // --- LÓGICA DE COR DINÂMICA (LADO ESQUERDO) ---
            const imageUrl = latest.cover || latest.capa;
            
            // 1. Atualizamos a imagem visual imediatamente
            coverImg.src = imageUrl;

            // 2. Criamos uma imagem auxiliar para extrair a cor (Evita erro de Canvas Sujo)
            const colorImg = new Image();
            colorImg.crossOrigin = "Anonymous"; // Crucial para permitir leitura de pixels
            
            // Adicionamos um timestamp para forçar o navegador a pedir permissão de CORS de novo
            colorImg.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + "t=" + new Date().getTime();

            colorImg.onload = function() {
                const extrairCor = () => {
                    if (typeof ColorThief !== 'undefined') {
                        try {
                            const colorThief = new ColorThief();
                            
                            // Criamos um canvas interno para recortar o lado esquerdo
                            const tempCanvas = document.createElement('canvas');
                            const ctx = tempCanvas.getContext('2d');
                            
                            // Recorte: 20% da largura na extrema esquerda
                            const sw = colorImg.naturalWidth * 0.2;
                            const sh = colorImg.naturalHeight;
                            tempCanvas.width = sw;
                            tempCanvas.height = sh;

                            ctx.drawImage(colorImg, 0, 0, sw, sh, 0, 0, sw, sh);

                            // Pega a cor predominante desse recorte lateral
                            const color = colorThief.getColor(tempCanvas);

                            if (focusCard && color) {
                                const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                                focusCard.style.backgroundColor = rgb;
                                console.log("Cor lateral aplicada:", rgb);
                            }
                        } catch (err) {
                            console.warn("Erro ao extrair cor (CORS provável):", err);
                            // Fallback: Se o recorte falhar, tenta a cor total da imagem
                            try {
                                const color = new ColorThief().getColor(colorImg);
                                focusCard.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                            } catch(e) {
                                focusCard.style.backgroundColor = "#1a1a1a";
                            }
                        }
                    } else {
                        // Se a lib ainda não carregou, espera 150ms
                        setTimeout(extrairCor, 150);
                    }
                };
                extrairCor();
            };

            // --- OUVINDO AGORA ---
            const agoraLimit = new Date(Date.now() - 3 * 60000);
            const qLive = query(collection(db, "stream_logs"), 
                where("itemTitle", "==", latest.title), 
                where("timestamp", ">=", agoraLimit)
            );
            const liveSnap = await getDocs(qLive);
            document.getElementById('live-count').textContent = liveSnap.size;
        }

        loadTopTracks(uid);
        verificarERenderizarBotaoThisIs();

    } catch (e) {
        console.error("Erro na Dashboard:", e);
    }
}


async function loadTopTracks(uid) {
    const list = document.getElementById('top-tracks-list');
    if (!list) return;
    const q = query(collection(db, "musicas"), where("artist", "==", uid), orderBy("streams", "desc"), limit(5));
    const snap = await getDocs(q);
    list.innerHTML = snap.empty ? '<p class="text-gray-500">Nenhuma música.</p>' : '';
    snap.forEach(d => {
        const m = d.data();
        list.innerHTML += `
        <div class="flex items-center p-3 bg-black mb-2 rounded-xl ">
            <img src="${m.cover}" class="w-10 h-10 rounded-md mr-3 object-cover">
            <div class="flex-grow">
                <div class="text-white text-sm font-bold">${m.title}</div>
                <div class="text-gray-500 text-xs">${m.streams || 0} streams</div>
            </div>
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