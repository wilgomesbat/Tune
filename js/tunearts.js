import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, updateDoc, setDoc, query, where, onSnapshot, orderBy, getDocs, limit, addDoc, deleteDoc, increment, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js"; 
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { getDatabase, ref as databaseRef, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ================================
// 2️⃣ CONFIGURAÇÃO DO FIREBASE
// ================================
const firebaseConfig = {
  apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
  authDomain: "tune-8cafb.firebaseapp.com",
  databaseURL: "https://tune-8cafb-default-rtdb.firebaseio.com",
  projectId: "tune-8cafb",
  storageBucket: "tune-8cafb.firebasestorage.app",
  messagingSenderId: "599729070480",
  appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); 
const rtdb = getDatabase(app);

// ================================
// ⭐ VARIÁVEIS GLOBAIS E UTILITÁRIOS ⭐
// ================================
let isUserLoggedIn = false;
let isUserArtist = false;
const MAIN_HTML_FILE = 'tuneartists.html'; 
const elements = {
    contentArea: document.getElementById('feed'),
};
let stepElements = [];
let currentStep = 1;

// ⭐ NOVO: Variáveis globais para armazenar dados do usuário após o login
window.currentArtistUid = null;
window.currentArtistName = null;



/**
 * Formata um número com separador de milhares (ex: 1234567 -> 1.234.567).
 * @param {number} num O número a ser formatado.
 * @returns {string} O número formatado.
 */
function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('pt-BR').format(num);
}

/**
 * Exibe um toast (notificação pop-up) na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} type O tipo de toast ('success', 'error', 'warning', 'info').
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let bgColorClass = '';
    let icon = '';

    switch (type) {
        case 'success':
            bgColorClass = 'bg-green-600';
            icon = '';
            break;
        case 'error':
            bgColorClass = 'bg-red-600';
            icon = '✖';
            break;
        case 'warning':
            bgColorClass = 'bg-orange-500';
            icon = '';
            break;
        case 'info':
        default:
            bgColorClass = 'bg-gray-700';
            icon = 'i';
            break;
    }

    const toast = document.createElement('div');
    toast.className = `p-4 max-w-sm rounded-lg shadow-xl text-white ${bgColorClass} pointer-events-auto opacity-0 transition-opacity duration-300`;
    
    toast.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0 text-lg mr-3">${icon}</div>
            <div class="text-sm font-medium flex-grow">${message}</div>
            <button class="toast-close-btn ml-4 text-white text-sm" onclick="this.closest('div').remove()">
                &times;
            </button>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
        
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
        
    }, 5000);
}

window.showDeleteConfirm = (id, collection, title) => {
    const modal = document.getElementById('delete-confirm-modal');
    const titleElement = document.getElementById('delete-item-title');
    const confirmBtn = document.getElementById('confirmDeleteButton');

    if (!modal || !titleElement || !confirmBtn) {
        console.error("ERRO CRÍTICO: Elementos da modal de exclusão não encontrados.");
        showToast("Erro interno: A janela de confirmação não pôde ser aberta.", 'error');
        return;
    }
    
    titleElement.textContent = title;
    
    confirmBtn.setAttribute('data-id', id);
    confirmBtn.setAttribute('data-collection', collection);
    
    modal.classList.remove('hidden');
};

window.hideDeleteConfirm = () => {
    document.getElementById('delete-confirm-modal')?.classList.add('hidden');
};

/**
 * Executa a exclusão de um álbum/música do Firestore.
 */
window.deleteRelease = async () => {
    const confirmBtn = document.getElementById('confirmDeleteButton');
    const id = confirmBtn.getAttribute('data-id');
    const collectionName = confirmBtn.getAttribute('data-collection');
    
    if (!id || !collectionName) {
        showToast("Erro: Dados de exclusão incompletos.", 'error');
        return;
    }

    try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);

        document.getElementById('delete-confirm-modal')?.classList.add('hidden');
        showToast(`Lançamento excluído com sucesso!`, 'success');
        
        loadArtistReleases(auth.currentUser.uid); 
        
    } catch (error) {
        console.error("Erro ao excluir documento:", error);
        showToast(`Erro ao excluir o lançamento. Verifique as permissões.`, 'error');
    }
};

// ================================
// ⭐ FUNÇÕES DE SEGURANÇA E AUTORIZAÇÃO ⭐
// ================================

/**
 * Redireciona para a página de login ou exibe a modal de aviso.
 * @param {boolean} isLogged Indica se o usuário está logado, mas sem permissão.
 */
function redirectOrWarn(isLogged) {
    const warningModal = document.getElementById('warning-modal');
    
    if (warningModal) {
        document.getElementById('warning-message').textContent = isLogged
            ? "Você está logado, mas não tem permissão de artista para acessar o painel."
            : "Você precisa estar logado para acessar o painel de administração.";
            
        warningModal.classList.remove('hidden');
        document.getElementById('app')?.classList.add('hidden'); 
    } else {
        const loginPage = 'index.html'; 
        window.location.replace(loginPage);
    }
}

function checkAuthAndPermissions() {
    onAuthStateChanged(auth, async (user) => {
        const pagePath = window.location.pathname;
        const isRestrictedArea = pagePath.includes(MAIN_HTML_FILE) || pagePath === '/';

        if (user) {
            isUserLoggedIn = true;
            window.currentArtistUid = user.uid; // ⭐ GARANTE O UID GLOBALMENTE ⭐
            console.log("Usuário logado:", user.uid);

            try {
                const userDocRef = doc(db, "usuarios", user.uid);
                const docSnap = await getDoc(userDocRef);

                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    
                    // Verifica se o usuário é artista (true ou "true")
                    if (userData.artista === true || userData.artista === "true") {
                        isUserArtist = true;
                        
                        // Define o nome global (opcional, mas útil)
                        window.currentArtistName = userData.nomeArtistico || userData.displayName || 'Artista Desconhecido';
                        
                        document.getElementById('app')?.classList.remove('hidden'); 

                        // ⭐ CRÍTICO: CHAMA A INICIALIZAÇÃO DA PÁGINA AQUI ⭐
                        initializePageNavigation(); 
                    } else {
                        isUserArtist = false;
                        if (isRestrictedArea) {
                            redirectOrWarn(true); 
                        }
                    }
                } else {
                    console.error("Documento do usuário não encontrado no Firestore. UID:", user.uid);
                    if (isRestrictedArea) {
                        redirectOrWarn(true); 
                    }
                }
            } catch (error) {
                console.error("Erro ao verificar permissões do usuário:", error);
                if (isRestrictedArea) {
                    redirectOrWarn(true); 
                }
            }
        } else {
            isUserLoggedIn = false;
            isUserArtist = false;
            window.currentArtistUid = null; // Limpa o UID
            if (isRestrictedArea) {
                redirectOrWarn(false); 
            }
        }
    });
}

// ============================================
// ⭐ FUNÇÕES DE CÁLCULO DE MÉTRICAS ⭐
// ============================================

async function calculateTotalStreams(artistId) {
    try {
        const musicasRef = collection(db, "musicas");
        
        const q = query(
            musicasRef, 
            where("uidars", "==", artistId) 
        );
        
        const querySnapshot = await getDocs(q);
        let totalStreams = 0;

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

async function calculateMonthlyStreams(artistId) {
    try {
        const musicasRef = collection(db, "musicas");
        
        const q = query(
            musicasRef, 
            where("uidars", "==", artistId) 
        );
        
        const querySnapshot = await getDocs(q);
        let totalMonthlyStreams = 0;

        querySnapshot.forEach((doc) => {
            const streamsMensal = doc.data().streamsMensal || 0; 
            totalMonthlyStreams += streamsMensal;
        });

        return totalMonthlyStreams;
    } catch (error) {
        console.error("Erro ao calcular total de streams mensais:", error);
        return 0;
    }
}

// ============================================
// ⭐ FUNÇÕES DE SETUP DAS PÁGINAS ⭐
// ============================================

function setupDashboardPage() {
    console.log("Dashboard page setup: Inicializando lógica de tempo real e semanal.");

    const realtimeListeners = document.getElementById('realtime-listeners-count');
    const weeklyStreamsElement = document.getElementById('weekly-streams'); 
    const monthlyListenersElement = document.getElementById('monthly-listeners');
    const weeklyFollowersElement = document.getElementById('weekly-followers'); 
    
    const artistUid = window.currentArtistUid; 
    
    if (artistUid) {
        
        if (realtimeListeners) {
            realtimeListeners.textContent = formatNumber(3407); // Valor estático
        }

        // 1. CÁLCULO DE STREAMS TOTAIS
        if (weeklyStreamsElement) {
            weeklyStreamsElement.textContent = '...'; 
            
            calculateTotalStreams(artistUid)
                .then(totalStreams => {
                    weeklyStreamsElement.textContent = formatNumber(totalStreams);
                })
                .catch(error => {
                    console.error("Erro ao carregar streams:", error);
                    weeklyStreamsElement.textContent = '0';
                });
        }

        // 2. CÁLCULO DE OUVINTES MENSAIS (streamsMensal)
        if (monthlyListenersElement) {
            monthlyListenersElement.textContent = '--';
            
            calculateMonthlyStreams(artistUid)
                .then(totalMonthly => {
                    monthlyListenersElement.textContent = formatNumber(totalMonthly);
                })
                .catch(error => {
                    console.error("Erro ao carregar ouvintes mensais:", error);
                    monthlyListenersElement.textContent = '0';
                });
        }

        // ✅ CHAMADA DA NOVA FUNÇÃO AQUI
    if (window.currentArtistUid) {
        // Carrega dados específicos do dashboard (se houver, como streams e ouvintes)
        // loadDashboardMetrics(window.currentArtistUid); // Se você tiver esta função

        // Carrega as Top Músicas
        loadTopTracks(window.currentArtistUid); 
    } else {
        showToast("Erro de autenticação: UID do artista ausente no Dashboard.", 'error');
    }
        
        // 3. OUTROS ELEMENTOS
        if (weeklyFollowersElement) {
            weeklyFollowersElement.textContent = formatNumber(7500); 
        }
            
    } else {
        if (realtimeListeners) realtimeListeners.textContent = '0';
        if (weeklyStreamsElement) weeklyStreamsElement.textContent = '0';
        if (monthlyListenersElement) monthlyListenersElement.textContent = '0'; 
        if (weeklyFollowersElement) weeklyFollowersElement.textContent = '0';
    }
}

async function loadArtistReleases(artistUid) {
    const releasesList = document.getElementById('releasesList');
    const loadingMessage = document.getElementById('loading-releases');
    const noReleasesMessage = document.getElementById('no-releases-message');
    
    if (!releasesList) return; 

    releasesList.innerHTML = '';
    loadingMessage?.classList.remove('hidden');
    noReleasesMessage?.classList.add('hidden');

    try {
        // 1. Obter Álbuns
        const qAlbums = query(
            collection(db, "albuns"),
            where("uidars", "==", artistUid),
            orderBy("date", "desc")
        );
        const albumSnapshot = await getDocs(qAlbums);
        
        // 2. Obter Músicas (que não fazem parte de álbuns, se houver)
        const qMusics = query(
            collection(db, "musicas"),
            where("artist", "==", window.currentArtistName), // Usando o nome para singles soltos
            orderBy("streams", "desc") 
        );
        const musicSnapshot = await getDocs(qMusics);
        
        const releases = [];
        
        // Processar Álbuns
        albumSnapshot.forEach(doc => {
            const data = doc.data();
            releases.push({
                id: doc.id,
                type: 'Álbum',
                title: data.album || 'Álbum Desconhecido', 
                date: data.date,
                status: data.status || 'N/A',
                cover: data.cover || 'https://via.placeholder.com/40?text=A',
            });
        });

        // Processar Músicas
        musicSnapshot.forEach(doc => {
            const data = doc.data();
            releases.push({
                id: doc.id,
                type: 'Música',
                title: data.title || 'Música Desconhecida', 
                date: 'N/A', 
                status: 'Lançado',
                cover: data.cover || 'https://via.placeholder.com/40?text=M',
            });
        });

        loadingMessage?.classList.add('hidden');

        if (releases.length === 0) {
            noReleasesMessage?.classList.remove('hidden');
            return;
        }

        // 3. Renderizar a lista
        const ASSETS_PATH = './assets/'; 
        releases.forEach(item => {
            const isAlbum = item.type.toLowerCase() === 'álbum';
            const collectionName = isAlbum ? 'albuns' : 'musicas';
            
            const listItem = `
                <li class="p-3 bg-white rounded-lg shadow flex items-center justify-between transition duration-150 hover:shadow-lg">
                    <div class="flex items-center space-x-4">
                        <img src="${item.cover}" alt="${item.title}" class="w-10 h-10 object-cover rounded-md">
                        <div>
                            <p class="font-semibold text-sm text-black">${item.title}</p>
                            
                            <p class="text-xs text-gray-500">${item.type}</p> 
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        
                        <span class="text-xs font-bold px-3 py-1 rounded-full ${item.status === 'Em Revisão' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                            ${item.status}
                        </span>
                        
                        <button class="text-gray-500 hover:text-red-600 transition duration-150 delete-button" 
                                title="Excluir Lançamento"
                                onclick="showDeleteConfirm('${item.id}', '${collectionName}', '${item.title.replace(/'/g, "\\'")}')"
                        >
                            <img src="${ASSETS_PATH}trash.svg" alt="Lixeira" class="w-4 h-4 trash-icon">
                        </button>
                    </div>
                </li>
            `;
            if (releasesList) {
                releasesList.insertAdjacentHTML('beforeend', listItem);
            }
        });

    } catch (error) {
        console.error("Erro ao carregar lançamentos:", error);
        loadingMessage?.classList.add('hidden');
        if (releasesList) {
            releasesList.innerHTML = `<p class="text-red-500 text-center p-8">Erro ao carregar os dados. Verifique o console.</p>`;
        }
    }
}


function setupReleasesPage() {
    console.log("Setup para Gerenciamento de Lançamentos (Releases).");
    const currentUserUid = window.currentArtistUid;
    if (!currentUserUid) return; 

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = {
        'releases': document.getElementById('tabContentReleases'),
        'add-album-placeholder': document.getElementById('tabContentAddAlbum') 
    };
    
    function switchTab(targetTab) {
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === targetTab) {
                btn.classList.add('active-tab');
            } else {
                btn.classList.remove('active-tab');
            }
        });

        Object.keys(tabContents).forEach(key => {
            if (tabContents[key]) {
                if (key === targetTab) {
                    tabContents[key].classList.remove('hidden');
                    if (key === 'releases') {
                        loadArtistReleases(currentUserUid); 
                    }
                } else {
                    tabContents[key].classList.add('hidden');
                }
            }
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    switchTab('releases');
}


function setupAddAlbumPage() {
    console.log("Setup para Adicionar Álbum (Formulário Multi-step).");
    
    const albumForm = document.querySelector("#combinedForm");
    
    if (!albumForm) {
        console.error("Formulário de Adicionar Álbum não encontrado.");
        return;
    }

    const artistUidInput = document.getElementById("artistUid"); 
    const artistNameInput = document.getElementById("artistName");
    const submitButton = document.getElementById("submitButton");
    const itemCoverFileInput = document.getElementById("itemCoverFile");
    const uploadStatusText = document.getElementById("uploadStatus");
    const backButton = document.getElementById("backToReleasesButton");

    const artistUid = window.currentArtistUid; 

    if (!artistUid) {
        console.error("ERRO: UID do artista não disponível ao inicializar formulário.");
        return; 
    }
    
    function showStep(stepIndex) { 
        stepElements = [
            { id: 1, element: document.getElementById('step1'), indicator: document.getElementById('step1Indicator') },
            { id: 2, element: document.getElementById('step2'), indicator: document.getElementById('step2Indicator') },
            { id: 3, element: document.getElementById('step3'), indicator: document.getElementById('step3Indicator') }
        ];
        
        stepElements.forEach((step) => {
            step.element?.classList.add('hidden');
            step.indicator?.classList.remove('text-black', 'font-bold');
            step.indicator?.classList.add('text-gray-400');
        });
        
        if (stepIndex >= 1 && stepIndex <= stepElements.length) {
            stepElements[stepIndex - 1].element?.classList.remove('hidden');
            stepElements[stepIndex - 1].indicator?.classList.add('text-black', 'font-bold');
            currentStep = stepIndex;
        }
    }
    
    showStep(1);
    
    
    if (artistUidInput) {
        artistUidInput.value = artistUid;
    }
    if (artistNameInput && window.currentArtistName) {
        artistNameInput.value = window.currentArtistName;
    }
    
    function setupReview() {
        const coverFile = itemCoverFileInput.files[0];
        const data = {
            itemName: albumForm.itemName.value.trim(),
            artistName: albumForm.artistName.value.trim(),
            releaseDate: albumForm.releaseDate.value.trim(),
            duration: albumForm.duration.value.trim() || 'N/A'
        };
        document.getElementById('reviewItemName').textContent = data.itemName;
        document.getElementById('reviewArtistName').textContent = data.artistName;
        document.getElementById('reviewReleaseDate').textContent = data.releaseDate ? data.releaseDate : 'Não Agendado';
        document.getElementById('reviewDuration').textContent = data.duration;
        const reviewCoverImg = document.getElementById('reviewCover');
        if (coverFile) {
            reviewCoverImg.src = URL.createObjectURL(coverFile);
        } else {
             reviewCoverImg.src = 'https://via.placeholder.com/96?text=Capa+Ausente';
        }
        reviewCoverImg.onerror = () => {
            reviewCoverImg.src = 'https://via.placeholder.com/96?text=Erro';
        };
        showStep(3);
    }

    backButton?.addEventListener('click', () => {
        loadContent('releases');
    });
    
    document.getElementById('cancelButton1')?.addEventListener('click', () => {
        loadContent('releases'); 
    });

    document.getElementById('nextButton1')?.addEventListener('click', () => {
        const itemName = albumForm.itemName.value.trim();
        const artistName = albumForm.artistName.value.trim();
        const coverFile = itemCoverFileInput.files[0]; 
        
        if (!itemName || !artistName) {
             showToast("Por favor, preencha o Nome do Álbum e Nome do Artista.", 'warning');
             return;
        }
        if (!coverFile) {
             uploadStatusText.classList.remove('hidden');
             uploadStatusText.textContent = "Por favor, selecione um arquivo de imagem para a capa.";
             showToast("Por favor, selecione um arquivo de imagem para a capa.", 'warning');
             return;
        }
        uploadStatusText.classList.add('hidden'); 
        showStep(2);
    });

    document.getElementById('prevButton2')?.addEventListener('click', () => {
        showStep(1);
    });

    document.getElementById('nextButton2')?.addEventListener('click', () => {
        const releaseDate = albumForm.releaseDate.value.trim();
        if (!releaseDate) {
             showToast("Por favor, selecione a Data de Lançamento.", 'warning');
             return;
        }
        setupReview();
    });
    
    document.getElementById('prevButton3')?.addEventListener('click', () => {
        const reviewCoverImg = document.getElementById('reviewCover');
        if (reviewCoverImg.src && reviewCoverImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(reviewCoverImg.src);
        }
        showStep(2);
    });
    
    
    albumForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando Capa...'; 

        const coverFile = itemCoverFileInput.files[0];
        if (!coverFile) {
            showToast("Erro: Arquivo de capa ausente.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar e Salvar';
            return;
        }

        let coverUrl = null;

        try {
// ===================================
// 1. UPLOAD DA CAPA PARA O FIREBASE STORAGE
// ===================================
const fileExtension = coverFile.name.split('.').pop();
const storagePath = `covers/${artistUid}/${Date.now()}.${fileExtension}`;
const imageRef = storageRef(storage, storagePath);

const uploadResult = await uploadBytes(imageRef, coverFile);
coverUrl = await getDownloadURL(uploadResult.ref);


submitButton.textContent = 'Salvando Dados...'; 

// ===================================
// 2. SALVAMENTO NO FIRESTORE
// ===================================
const albumData = {
    album: albumForm.itemName.value.trim(),
    cover: coverUrl, 
    date: albumForm.releaseDate.value.trim(),
    duration: albumForm.duration.value.trim() || 'N/A',
    artist: albumForm.artistName.value.trim(),
    
    uidars: artistUid, 
    status: "Em Revisão",
    
    country: "N/A", 
    label: "N/A"
};

            await addDoc(collection(db, "albuns"), albumData); 

            showToast(`Álbum '${albumData.album}' enviado! Status: Em Revisão.`, 'success');
            
            loadContent('releases'); 
            
        } catch (error) {
            console.error("Erro ao salvar o álbum ou fazer upload:", error);
            showToast("Erro ao salvar o álbum. Verifique o console para detalhes.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar e Salvar';
        }
    });
}

async function loadArtistMusics(artistUid) {
    const musicListContainer = document.getElementById('music-list-container');
    
    if (!musicListContainer) return; 

    musicListContainer.innerHTML = `
        <p id="loading-music" class="text-center text-gray-500 p-8">Carregando suas músicas...</p>
        <ul id="artistMusicList" class="space-y-3"></ul>
        <p id="no-music-message" class="text-center text-gray-500 p-8 hidden">Nenhuma música encontrada. Adicione uma nova!</p>
    `;
    const list = document.getElementById('artistMusicList');
    const loadMsg = document.getElementById('loading-music');
    const noMsg = document.getElementById('no-music-message');

    loadMsg?.classList.remove('hidden');
    noMsg?.classList.add('hidden');

    try {
        const qMusics = query(
            collection(db, "musicas"),
            where("uidars", "==", artistUid), 
            orderBy("timestamp", "desc") 
        );
        const musicSnapshot = await getDocs(qMusics);
        
        loadMsg?.classList.add('hidden');
        
        if (musicSnapshot.empty) {
            noMsg?.classList.remove('hidden');
            return;
        }

        musicSnapshot.forEach(doc => {
            const data = doc.data();
            const musicTitle = data.title || 'Música Sem Título';
            const albumName = data.albumName || 'Single';
            const trackNumber = data.trackNumber ? `Faixa ${data.trackNumber}` : 'Single';
            const coverUrl = data.cover || 'https://via.placeholder.com/40?text=M';
            const status = 'Aprovada'; 

            const listItem = `
                <li class="p-3 bg-white rounded-lg shadow flex items-center justify-between transition duration-150 hover:shadow-lg">
                    <div class="flex items-center space-x-4">
                        <img src="${coverUrl}" alt="${musicTitle}" class="w-10 h-10 object-cover rounded-md">
                        <div>
                            <p class="font-semibold text-sm text-black">${musicTitle}</p>
                            <p class="text-xs text-gray-500">${albumName} (${trackNumber})</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-800">
                            ${status}
                        </span>
                        
                        <button class="text-gray-500 hover:text-red-600 transition duration-150 delete-button" 
                                title="Excluir Música"
                                onclick="showDeleteConfirm('${doc.id}', 'musicas', '${musicTitle.replace(/'/g, "\\'")}')"
                        >
                            <img src="./assets/trash.svg" alt="Lixeira" class="w-4 h-4 trash-icon">
                        </button>
                    </div>
                </li>
            `;
            list.insertAdjacentHTML('beforeend', listItem);
        });

    } catch (error) {
        console.error("Erro ao carregar músicas:", error);
        loadMsg?.classList.add('hidden');
        musicListContainer.innerHTML = `<p class="text-red-500 text-center p-8">Erro ao carregar os dados. Verifique o console.</p>`;
    }
}


function setupAddMusicPage() {
    console.log("Setup para Gerenciamento de Músicas (AddMusic).");
    const currentUserUid = window.currentArtistUid;
    if (!currentUserUid) return; 

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContentMusicList = document.getElementById('tabContentMusicList');
    const tabContentAddNewMusic = document.getElementById('tabContentAddNewMusic');

    function switchMusicTab(targetTab) {
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === targetTab) {
                btn.classList.add('active-tab');
            } else {
                btn.classList.remove('active-tab');
            }
        });

        if (tabContentMusicList) tabContentMusicList.style.display = 'none';
        if (tabContentAddNewMusic) tabContentAddNewMusic.style.display = 'none';

        if (targetTab === 'music-list') {
            if (tabContentMusicList) tabContentMusicList.style.display = 'block';
            loadArtistMusics(currentUserUid); 
        } else if (targetTab === 'add-new-music') {
            if (tabContentAddNewMusic) tabContentAddNewMusic.style.display = 'block';
            initializeAddMusicForm(); 
        }
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchMusicTab(btn.getAttribute('data-tab'));
        });
    });

    switchMusicTab('music-list'); 
}

function initializeAddMusicForm() {
    const addMusicForm = document.getElementById('addMusicForm');
    const titleInput = document.getElementById('title');
    const artistInput = document.getElementById('artist');
    const audioFileInput = document.getElementById('audioFile');
    const coverImageInput = document.getElementById('coverImage');
    const isSingleRadio = document.getElementById('isSingle');
    const isAlbumTrackRadio = document.getElementById('isAlbumTrack');
    const albumSelectionDiv = document.getElementById('albumSelection');
    const albumSelect = document.getElementById('album');
    const trackNumberInput = document.getElementById('trackNumber');
    const genreInput = document.getElementById('genre');
    const explicitCheckbox = document.getElementById('explicit');
    const messageElement = document.getElementById('message');
    const errorElement = document.getElementById('error');
    const submitButton = document.getElementById('submitButton');
    
    if (!addMusicForm) {
        console.error("ERRO: Formulário de Adicionar Música (ID: addMusicForm) não encontrado.");
        return;
    }
    
    const loggedInArtistUid = window.currentArtistUid;
    const loggedInArtistName = window.currentArtistName || 'Artista Desconhecido'; 

    const showMessage = (msg, isError = false) => {
        const msgEl = isError ? errorElement : messageElement;
        const otherEl = isError ? messageElement : errorElement;
        msgEl.textContent = msg;
        otherEl.textContent = '';
        msgEl.style.color = isError ? '#dc2626' : '#16a34a';
    };

    const setFormLoading = (isLoading) => {
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading ? 'Processando...' : 'Enviar Música';
    };

    artistInput.value = loggedInArtistName;

    const loadArtistAlbums = async (artistUid) => {
        albumSelect.innerHTML = '<option value="">Carregando seus álbuns...</option>';
        try {
            const albumsQuery = query(
                collection(db, 'albuns'),
                where('uidars', '==', artistUid)
            );
            const albumsSnapshot = await getDocs(albumsQuery);

            if (albumsSnapshot.empty) {
                albumSelect.innerHTML = '<option value="">Nenhum álbum encontrado</option>';
            } else {
                albumSelect.innerHTML = '<option value="">Selecione um álbum</option>';
                albumsSnapshot.docs.forEach(doc => {
                    const albumData = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id; 
                    option.textContent = albumData.album; 
                    albumSelect.appendChild(option);
                });
            }
        } catch (error) {
            showMessage(`Erro ao carregar álbuns: ${error.message}`, true);
            albumSelect.innerHTML = '<option value="">Erro ao carregar álbuns</option>';
        }
    };
    
    loadArtistAlbums(loggedInArtistUid); 


    const toggleAlbumSelection = () => {
        const isAlbum = isAlbumTrackRadio.checked;
        if (isAlbum) {
            albumSelectionDiv.style.display = 'block';
            albumSelect.setAttribute('required', 'required');
            trackNumberInput.setAttribute('required', 'required');
        } else {
            albumSelectionDiv.style.display = 'none';
            albumSelect.removeAttribute('required');
            trackNumberInput.removeAttribute('required');
        }
    };
    
    isSingleRadio?.addEventListener('change', toggleAlbumSelection);
    isAlbumTrackRadio?.addEventListener('change', toggleAlbumSelection);
    toggleAlbumSelection(); 

    addMusicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('Iniciando o envio...', false);
        setFormLoading(true);

        const audioFile = audioFileInput.files[0];
        if (!audioFile) {
            showMessage('Por favor, selecione um arquivo de áudio.', true);
            setFormLoading(false);
            return;
        }

        const releaseType = document.querySelector('input[name="releaseType"]:checked').value;
        let albumId = null;
        let albumName = null;
        let trackNumber = null;

        if (releaseType === 'albumTrack') {
            albumId = albumSelect.value;
            if (!albumId) {
                showMessage('Por favor, selecione um álbum.', true);
                setFormLoading(false);
                return;
            }
            albumName = albumSelect.options[albumSelect.selectedIndex].textContent;
            trackNumber = parseInt(trackNumberInput.value, 10);
            if (isNaN(trackNumber) || trackNumber < 1) {
                showMessage('Número da faixa inválido. Deve ser 1 ou maior.', true);
                setFormLoading(false);
                return;
            }
        }

        try {
            // 1. Upload do Arquivo de Áudio
            showMessage('1/3: Enviando arquivo de áudio...', false);
            const audioPath = `audio/${loggedInArtistUid}/${Date.now()}_${audioFile.name}`;
            const audioRef = storageRef(storage, audioPath);
            await uploadBytes(audioRef, audioFile);
            const audioUrl = await getDownloadURL(audioRef);

            // 2. Upload da Capa (Opcional ou herdada do Álbum)
            let coverUrl = '';
            const coverImage = coverImageInput.files[0];

            if (coverImage) {
                showMessage('2/3: Enviando capa...', false);
                const coverPath = `covers/${loggedInArtistUid}/${Date.now()}_${coverImage.name}`;
                const coverRef = storageRef(storage, coverPath);
                await uploadBytes(coverRef, coverImage);
                coverUrl = await getDownloadURL(coverRef);
            } else if (albumId) {
                 const albumDoc = await getDoc(doc(db, 'albuns', albumId));
                 if (albumDoc.exists() && albumDoc.data().cover) {
                     coverUrl = albumDoc.data().cover;
                 }
            }
            
            // 3. Salvando Metadados no Firestore
            showMessage('3/3: Salvando no Firestore...', false);

            const musicData = {
                title: titleInput.value,
                artist: loggedInArtistName,
                audioURL: audioUrl,
                cover: coverUrl || '',
                duration: '00:00', 
                explicit: explicitCheckbox.checked,
                genre: genreInput.value || '',
                
                albumName: albumName || 'Single', 
                
                uidars: loggedInArtistUid,
                streams: 0,
                streamsMensal: 0,
                releaseDate: new Date().toISOString().split('T')[0],
                timestamp: serverTimestamp(),
                
                ...(albumId ? { 
                    album: albumId, 
                    trackNumber: trackNumber 
                } : {}),
            };
            
            await addDoc(collection(db, 'musicas'), musicData);
            
            showMessage('Música enviada com sucesso! Você pode encontrá-la em "Minhas Músicas".', false);
            addMusicForm.reset(); 
            isSingleRadio.checked = true;
            toggleAlbumSelection(); 
            artistInput.value = loggedInArtistName; 
            
            const tabListButton = document.getElementById('tabMusicList');
            if (tabListButton) tabListButton.click(); 

        } catch (error) {
            showMessage(`Erro ao enviar música: ${error.message}`, true);
            console.error("Erro detalhado ao enviar música:", error);
        } finally {
            setFormLoading(false);
        }
    });
}

// ============================================
// ⭐ FUNÇÕES DE EDIÇÃO DE PERFIL (editprofile.html) ⭐
// ============================================

/** Carrega os dados do artista no Firestore e preenche o HTML de visualização. */
async function loadArtistProfileData(artistUid) {
    const artistNameElement = document.getElementById('artist-name');
    const artistPhoto = document.getElementById('artist-cover-bg'); // agora é a foto do artista
    const artistListenersElement = document.getElementById('artist-listeners');
    const artistUsernameElement = document.getElementById('artist-username');

    if (!artistNameElement || !artistPhoto) return;

    try {
        const userDocRef = doc(db, "usuarios", artistUid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();

            // 🔹 Preenche dados básicos
            const artistName = userData.nomeArtistico || 'Nome Desconhecido';
            const profileUrl = userData.foto || './assets/artistpfp.png';
            const monthlyListeners = userData.streamsMensal || 0;
            const username = userData.apelido || '@usuario';

            artistNameElement.textContent = artistName;
            artistPhoto.src = profileUrl; // agora usa src
            artistUsernameElement.textContent = `@${username}`;
            if (artistListenersElement) artistListenersElement.textContent = formatNumber(monthlyListeners);

            // 🔹 Carregar redes sociais (caso existam)
            const socials = userData.socials || {};
            if (socials.spotify) document.getElementById('spotify-link').href = socials.spotify;
            if (socials.instagram) document.getElementById('instagram-link').href = socials.instagram;
            if (socials.twitter) document.getElementById('twitter-link').href = socials.twitter;
            if (socials.youtube) document.getElementById('youtube-link').href = socials.youtube;

        } else {
            artistNameElement.textContent = 'Perfil não encontrado';
        }
    } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
        showToast("Erro ao carregar dados do perfil.", 'error');
    }
}

// --- Funções de Edição da FOTO DE PERFIL ---
window.showPhotoEditModal = () => {
    document.getElementById('photo-edit-modal')?.classList.remove('hidden');
};

window.hidePhotoEditModal = () => {
    document.getElementById('photo-edit-modal')?.classList.add('hidden');
};

/** Salva a nova foto de perfil (Upload para Storage e atualização do Firestore). */
window.updateArtistPhoto = async () => {
    const fileInput = document.getElementById('new-photo-file-input');
    const artistUid = window.currentArtistUid;

    if (!fileInput?.files?.length || !artistUid)
        return showToast("Selecione um arquivo de imagem.", 'warning');

    const file = fileInput.files[0];
    hidePhotoEditModal();

    try {
        showToast("Enviando nova foto de perfil...", 'info');

        // 1️⃣ Upload para Firebase Storage
        const storagePath = `profile_photos/${artistUid}/foto_${Date.now()}_${file.name}`;
        const photoRef = storageRef(storage, storagePath);
        const snapshot = await uploadBytes(photoRef, file);

        // 2️⃣ Obter URL de download
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 3️⃣ Atualizar Firestore
        const userDocRef = doc(db, "usuarios", artistUid);
        await updateDoc(userDocRef, { foto: downloadURL });

        // 4️⃣ Atualizar o DOM
        const artistPhoto = document.getElementById('artist-cover-bg');
        artistPhoto.src = downloadURL;

        showToast("Foto de perfil atualizada com sucesso!", 'success');
        fileInput.value = '';

    } catch (error) {
        console.error("Erro ao atualizar foto:", error);
        showToast("Erro ao salvar a foto. Tente novamente.", 'error');
    }
};

/**
 * Setup principal da página editprofile.html
 */
function setupEditProfilePage() {
    console.log("🟢 Setup da Edição de Perfil iniciado.");
    if (window.currentArtistUid) {
        loadArtistProfileData(window.currentArtistUid);
    } else {
        showToast("Erro de autenticação: UID do artista ausente.", 'error');
    }
}


// ============================================
// ⭐ FUNÇÕES DE DASHBOARD (Top Tracks) ⭐
// ============================================

/**
 * Busca as 5 músicas mais tocadas do artista logado.
 * @param {string} artistUid O UID do artista logado.
 */
async function loadTopTracks(artistUid) {
    const listContainer = document.getElementById('top-tracks-list');
    const loadingMessage = document.getElementById('loading-top-tracks');

    if (!listContainer) return;

    try {
        if (loadingMessage) loadingMessage.textContent = 'Carregando...';

        // 1. Consulta ao Firestore
        const q = query(
            collection(db, "musicas"),
            where("uidars", "==", artistUid), // Filtra apenas as músicas deste artista
            orderBy("streams", "desc"),        // Ordena por streams (do maior para o menor)
            limit(5)                           // Limita aos 5 primeiros resultados
        );

        const snapshot = await getDocs(q);
        
        // 2. Limpa o conteúdo (incluindo a mensagem de loading)
        listContainer.innerHTML = '';
        
        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-gray-500">Nenhuma música encontrada ou sem streams.</p>';
            return;
        }

        // 3. Renderiza os resultados
        let rank = 1;
        snapshot.forEach(doc => {
            const music = doc.data();
            
            const trackItem = document.createElement('div');
            trackItem.className = 'flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition shadow-sm';
            
            trackItem.innerHTML = `
                <div class="text-xl font-bold text-gray-400 w-8 flex-shrink-0">${rank++}</div>
                
                <img src="${music.cover || './assets/artistpfp.png'}" alt="Capa" class="w-12 h-12 rounded-md object-cover mr-4 flex-shrink-0">
                
                <div class="flex-grow">
                    <p class="text-base font-semibold text-black truncate">${music.title}</p>
                    <p class="text-sm text-gray-500">${music.artist}</p>
                </div>
                
                <div class="text-right flex-shrink-0 ml-4">
                    <p class="text-base font-bold text-black">${formatNumber(music.streams)}</p>
                    <p class="text-sm text-gray-500">streams</p>
                </div>
            `;
            listContainer.appendChild(trackItem);
        });

    } catch (error) {
        console.error("Erro ao carregar top tracks:", error);
        listContainer.innerHTML = `<p class="text-red-500">Erro ao carregar top tracks. Verifique o console.</p>`;
    }
}

// ===============================================
// ⭐ LÓGICA DE REDES SOCIAIS (Socials) - CORREÇÃO DE ESCOPO E NOME ⭐
// ===============================================

// Função para CARREGAR os links ATUAIS nos campos de INPUT (CORRIGIDA)
// Colocada no window para ser acessível globalmente, como chamada no loadArtistProfileData.
window.loadCurrentSocialsToInputs = async (artistId) => {
    // ⚠️ ATENÇÃO: Esta função usa o artistId passado, e não o auth.currentUser.
    if (!artistId) return;

    // Acessa a coleção correta e usa o UID.
    const docRef = doc(db, "usuarios", artistId); 
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();

            // Lógica de compatibilidade (Prioriza 'socials', senão usa campos raiz)
            // Incluindo Spotify, caso você o use em outro lugar.
            const socials = data.socials || data; 

            // Preenche os inputs com os dados existentes
            const spotifyInput = document.getElementById('spotify-input');
            const instagramInput = document.getElementById('instagram-input');
            const twitterInput = document.getElementById('twitter-input');
            const youtubeInput = document.getElementById('youtube-input');

            // Preenche apenas se o elemento existir
            if (spotifyInput) spotifyInput.value = socials.spotify || ''; 
            if (instagramInput) instagramInput.value = socials.instagram || '';
            if (twitterInput) twitterInput.value = socials.twitter || '';
            if (youtubeInput) youtubeInput.value = socials.youtube || '';
        }
    } catch (error) {
        console.error("Erro ao carregar redes sociais para edição:", error);
    }
};

// Função para SALVAR as alterações (chamada pelo onsubmit do formulário)
// Ajustada para usar a coleção correta "usuarios"
window.updateArtistSocials = async (event) => {
    event.preventDefault();

    const spotifyLink = document.getElementById('spotify-input').value.trim();
    const instagramLink = document.getElementById('instagram-input').value.trim();
    const twitterLink = document.getElementById('twitter-input').value.trim();
    const youtubeLink = document.getElementById('youtube-input').value.trim();

    // Garante que o usuário esteja autenticado para obter o UID
    const artistId = auth.currentUser ? auth.currentUser.uid : null;
    if (!artistId) return window.showToast("Erro de autenticação. Tente fazer login novamente.", 'error');

    // MUDANÇA: Usando a coleção "usuarios"
    const docRef = doc(db, "usuarios", artistId); 
    
    try {
        window.showToast("Salvando links...", 'info');

        const socialsUpdate = {};
        // Se um campo não tiver valor, salva uma string vazia para limpar no DB
        socialsUpdate.spotify = spotifyLink;
        socialsUpdate.instagram = instagramLink;
        socialsUpdate.twitter = twitterLink;
        socialsUpdate.youtube = youtubeLink;
        
        await updateDoc(docRef, {
            socials: socialsUpdate 
        });

        // Não precisa mais esconder o modal
        // window.hideSocialsEditModal(); 
        window.showToast('Links atualizados!', 'success');
        
        // Recarrega os dados do perfil para atualizar a tela de visualização (se houver)
        loadArtistProfileData(artistId); 

    } catch (error) {
        console.error("Erro ao atualizar links de redes sociais:", error);
        window.showToast('Erro ao salvar: ' + error.message, 'error');
    }
};

// Se você mantiver a função displaySocials, ela deve continuar como está.
// Caso contrário, remova-a se não for mais usada para visualização.
// A função loadCurrentSocialsForEdit deve ser removida ou substituída pelo novo window.loadCurrentSocialsToInputs.


function setupMaintenanceToggle() {
    console.log("Setup para página de Configurações (Maintenance Toggle).");
}

function setupAddPlaylistPage() {
    console.log("Setup para Add Playlist.");
}
function setupEditAlbumsPage() {
    console.log("Setup para Edit Albums.");
}
function setupListArtistsPage() {
    console.log("Setup para List Artists.");
}


// ===================================
// ⭐ CARREGAMENTO DE PÁGINAS ⭐
// ===================================

// ASSUMA QUE ESTAS CONSTANTES ESTÃO DEFINIDAS NO SEU ESCOPO GLOBAL:
// const ACTIVE_OPACITY = '1';
// const INACTIVE_OPACITY = '0.5';

async function loadContent(pageName) {
    if (!elements.contentArea || !isUserArtist) {
        return;
    }

    const filePath = `tuneartists/${pageName}.html`; 

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }

        const html = await response.text();
        elements.contentArea.innerHTML = html;

        // LÓGICA DE SETUP
        if (pageName === 'dashboard') {
            setupDashboardPage();
        } else if (pageName === 'settings') { 
            setupMaintenanceToggle(); 
        } 
        else if (pageName === 'addplaylist') {
            setupAddPlaylistPage(); 
        } else if (pageName === 'releases') { 
            setupReleasesPage(); 
        } 
        else if (pageName === 'addalbum') { 
            setupAddAlbumPage();
        } else if (pageName === 'editprofile') { 
            setupEditProfilePage(); 
        }
        else if (pageName === 'editalbums') { 
            setupEditAlbumsPage();
        } else if (pageName === 'listartists') { 
            setupListArtistsPage();

        } else if (pageName === 'addmusic') { 
            setupAddMusicPage(); 
        }

        const newUrlPath = `${MAIN_HTML_FILE}?page=${pageName}`; 
        window.history.pushState({ page: pageName }, '', newUrlPath);

        // AQUI A FUNÇÃO ATUALIZADA É CHAMADA
        setActiveNav(pageName);

    } catch (error) {
        console.error("Error loading page content:", error);
        elements.contentArea.innerHTML = `<p class="text-red-500 text-center">Error loading page: ${pageName}.html</p>`;
    }
}

// ===============================================
// ⭐ FUNÇÃO DE ATIVAÇÃO DE NAVEGAÇÃO (ALPHA) ⭐
// ***********************************************
// Esta função agora usa opacidade (style.opacity) no lugar da troca de ícones (img.src).
// ***********************************************

function setActiveNav(currentPageName) {
    const activeNavPage = currentPageName === 'addalbum' ? 'releases' : currentPageName;
    
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    
    // As constantes de ícone foram removidas, pois não são mais necessárias
    // para a lógica de opacidade.
    
    navLinks.forEach(link => {
        const page = link.getAttribute('data-page');
        
        if (page === activeNavPage) {
            // ATIVAÇÃO: Opacidade 1 (Total)
            link.style.opacity = ACTIVE_OPACITY; // Requer que ACTIVE_OPACITY seja global
            link.classList.add('active'); 
        } else {
            // DESATIVAÇÃO: Opacidade 0.5 (Reduzida)
            link.style.opacity = INACTIVE_OPACITY; // Requer que INACTIVE_OPACITY seja global
            link.classList.remove('active');
        }
        
        // A lógica de manipulação de IMG SRC (troca de ícones -filled.svg / .svg) 
        // foi removida.
    });
}


// ============================================
// ⭐ OUVINTES DE NAVEGAÇÃO E INICIALIZAÇÃO ⭐
// ============================================

function initializePageNavigation() {
    // 1. Setup dos botões de navegação (todos os elementos com atributo data-page)
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.getAttribute('data-page');
            
            if (pageName) {
                // A navegação real ocorre aqui
                loadContent(pageName);
            }
        });
    });

    // 2. Carregamento da página inicial (lê a URL ou usa 'dashboard')
    const urlParams = new URLSearchParams(window.location.search);
    let initialPage = 'dashboard'; 
    
    if (urlParams.has('page')) {
        initialPage = urlParams.get('page');
    }
    
    loadContent(initialPage);
}


// ============================================
// ⭐ FUNÇÕES GLOBAIS (PARA O HTML) ⭐
// ============================================

window.doLogout = async () => {
    try {
        await signOut(auth);
        window.location.replace('index.html'); 
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
};

window.hideWarningPopup = () => {
    const modal = document.getElementById('warning-modal');
    if (modal) {
        modal.classList.add('hidden');
        window.location.replace('index.html'); 
    }
}

window.loadContent = loadContent;


// ============================================
// ⭐ PONTO DE ENTRADA PRINCIPAL ⭐
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!elements.contentArea) {
        elements.contentArea = document.getElementById('feed');
    }
    checkAuthAndPermissions();
});