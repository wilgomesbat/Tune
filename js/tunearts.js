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
}/**
 * TUNE - EDITPROFILE.JS
 * Lógica para gerenciar Nome, Bio, Foto e Artist Pick (Destaque)
 */


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

        </div>
    </div>

    <div class="flex space-x-2">
        ${isArquivado ? `<button onclick="window.publicarItem('${id}', '${colecao}')" class="p-2 text-green-600 hover:bg-green-50 rounded-full"><i class="fas fa-check"></i></button>` : ''}
        

<button onclick="window.abrirModalEdicao('${id}', '${colecao}', '${titulo.replace(/'/g, "\\'")}')" 
                class="p-2 hover:bg-blue-50 rounded-full transition-colors" 
                title="Editar">
            <span class="material-symbols-outlined">
                edit_square
            </span>
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
// 1. SUBMISSÃO DE MÚSICA (SINGLE)
// ============================================
window.handleReleaseSubmission = async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit');
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
        // A. Busca Nome Artístico
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

        // C. Salvamento no Firestore
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
            scheduledTime: (status === 'publico') ? "Imediato" : releaseDateTime,
            timestamp: serverTimestamp()
        });

        window.showToast("Música publicada com sucesso!", "success");
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
        // Carrega dados do artista
        const artistDoc = await getDoc(doc(db, "usuarios", uid));
        if (artistDoc.exists()) {
            const data = artistDoc.data();
            
            // Se já tiver algo fixado, mostra o card ativo
            if (data.pinnedItem) {
                atualizarPreviewSorteio(data.pinnedItem, data.foto, data.nomeArtistico || data.nome);
            }
        }

        // 2. STREAMS TOTAIS
        const q = query(collection(db, "musicas"), where("artist", "==", uid));
        const snap = await getDocs(q);
        
        let total = 0;
        snap.forEach(d => total += (d.data().streams || 0));
        
        const el = document.getElementById('weekly-streams');
        if (el) el.textContent = new Intl.NumberFormat('pt-BR').format(total);

        // 3. RESTANTE DO SETUP
        loadTopTracks(uid);
        verificarERenderizarBotaoThisIs();

    } catch (error) {
        console.error("Erro no setup da dashboard:", error);
    }
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