// 1. IMPORTAÇÕES DE MÓDULOS DO FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 2. CONFIGURAÇÃO DO FIREBASE
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

// 3. ELEMENTOS DO DOM
const elements = {
    // Dashboard
    totalAlbums: document.getElementById("total-albums"),
    totalArtists: document.getElementById("total-artists"),
    totalAccesses: document.getElementById("total-accesses"),
    totalMusics: document.getElementById("total-musics"), // Para total de músicas
    latestReleasesBody: document.getElementById("latest-releases-body"),
    // Formulários
    albumForm: document.getElementById("albumForm"),
    songForm: document.getElementById("songForm"),
    // Listas
    albumsListContainer: document.getElementById("albums-list"),
    musicListContainer: document.getElementById("musics-list"),
    loadingMessage: document.getElementById("loading-message"),
    // Pop-up de Aviso
    warningModal: document.getElementById('warning-modal'),
    warningMessage: document.getElementById('warning-message'),
    // Outros
    greeting: document.getElementById("greeting"),
    albumInput: document.getElementById("album"),
    trackSection: document.getElementById("trackSection"),
    topNav: document.querySelector("#topNav"),
    sectionOne: document.querySelector(".fw-bold"),
    artistsListContainer: document.getElementById("artists-list"), // Novo elemento a ser adicionado no HTML
    adminList: document.getElementById("admin-list"),
    adminLoading: document.getElementById("admin-loading"),
};

// --- LÓGICA PARA GERENCIAR O STATUS ONLINE/OFFLINE DOS ADMINISTRADORES ---

// Função para atualizar o status online de um usuário
async function updateUserStatus(userId, isOnline) {
    const userDocRef = doc(db, "usuarios", userId);
    try {
        await updateDoc(userDocRef, {
            online: isOnline,
            lastSeen: new Date() // Opcional: registrar o último visto
        });
        console.log(`Status do admin ${userId} atualizado para ${isOnline}`);
    } catch (error) {
        console.error("Erro ao atualizar status do admin:", error);
    }
}

// Função para verificar o status online do usuário logado e atualizar a UI
function monitorUserStatus(user) {
    if (!user) return;

    const userId = user.uid;
    const userDocRef = doc(db, "usuarios", userId);

    // Monitora as mudanças no documento do usuário
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const isAdmin = userData.niveladmin === 1; // Verifica se é um administrador

            if (isAdmin) {
                const onlineStatus = userData.online || false; // Padrão para false se não existir
                const adminElements = document.querySelectorAll(`.admin-item[data-user-id="${userId}"]`);
                adminElements.forEach(el => {
                    const statusIndicator = el.querySelector('.status-indicator');
                    if (statusIndicator) {
                        statusIndicator.classList.remove('bg-green-500', 'bg-gray-500');
                        if (onlineStatus) {
                            statusIndicator.classList.add('bg-green-500'); // Verde para online
                        } else {
                            statusIndicator.classList.add('bg-gray-500'); // Cinza para offline
                        }
                    }
                });
            }
        }
    }, (error) => {
        console.error("Erro ao monitorar status do usuário:", error);
    });
}

// Lógica para definir o status como online ao entrar na página e offline ao sair
function setupOnlineStatusManagement() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const userId = user.uid;
            // Define o status como online quando o usuário entra ou recarrega a página
            updateUserStatus(userId, true);
            monitorUserStatus(user); // Inicia o monitoramento do status

            // Define o status como offline quando o usuário sai da página
            window.addEventListener('beforeunload', () => {
                updateUserStatus(userId, false);
            });
        } else {
            // Se não houver usuário logado, garante que nenhum status fique como online indevidamente
            console.log("Nenhum usuário logado.");
        }
    });
}

// --- LÓGICA PARA LISTAR ADMINISTRADORES (REVISADA PARA STATUS ONLINE) ---
async function fetchAdmins() {
    if (elements.adminLoading) {
        elements.adminLoading.style.display = 'block';
        elements.adminLoading.textContent = "";
    }

    try {
        // Busca todos os usuários que são administradores (niveladmin === 1)
        const usersQuery = query(collection(db, "usuarios"), where("niveladmin", "==", 1));

        onSnapshot(usersQuery, (querySnapshot) => {
            if (elements.adminList) {
                elements.adminList.innerHTML = ''; // Limpa a lista existente

                if (querySnapshot.empty) {
                    elements.adminList.innerHTML = '<p class="text-xs text-gray-500">Nenhum admin encontrado.</p>';
                } else {
                    querySnapshot.forEach((doc) => {
                        const user = doc.data();
                        const userId = doc.id; // Pega o ID do documento do usuário
                        const isOnline = user.online || false; // Pega o status online, com padrão false

                        const adminElement = document.createElement('div');
adminElement.className = "flex items-center gap-2 text-white p-1 rounded-md cursor-pointer admin-item";
adminElement.setAttribute('data-user-id', userId);

// Alteração aqui para remover a exibição do nome e focar apenas na foto e status
adminElement.innerHTML = `
    <div class="relative w-10 h-10">
        <img class="w-full h-full rounded-full" src="${user.foto || './assets/default-profile.png'}" alt="Foto de perfil">
        <span class="status-indicator absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${isOnline ? 'bg-green500' : 'bg-gray-500'}"></span>
    </div>
`;
elements.adminList.appendChild(adminElement);                    });
                }
            }
            if (elements.adminLoading) {
                elements.adminLoading.style.display = 'none';
            }
        }, (error) => {
            console.error("Erro ao buscar administradores:", error);
            if (elements.adminList) {
                elements.adminList.innerHTML = '<p class="text-xs text-red-500">Erro ao carregar admins.</p>';
            }
            if (elements.adminLoading) {
                elements.adminLoading.style.display = 'none';
            }
        });
    } catch (error) {
        console.error("Erro ao configurar o listener de administradores:", error);
        if (elements.adminList) {
            elements.adminList.innerHTML = '<p class="text-xs text-red-500">Erro ao carregar admins.</p>';
        }
        if (elements.adminLoading) {
            elements.adminLoading.style.display = 'none';
        }
    }
}

// --- FUNÇÕES AUXILIARES PARA MODAL DE AVISO ---
function showWarningPopup(message) {
    if (elements.warningModal && elements.warningMessage) {
        elements.warningMessage.innerText = message;
        elements.warningModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Impede a rolagem da página principal
    } else {
        console.error("Elemento de modal de aviso ou mensagem não encontrado.");
    }
}

function hideWarningPopup() {
    if (elements.warningModal) {
        elements.warningModal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Permite a rolagem da página principal
    }
}

// --- FUNÇÃO PARA FORMATAR NÚMEROS GRANDES ---
function formatNumber(num) {
    if (typeof num === 'number') {
        return num.toLocaleString('pt-BR');
    }
    return num;
}

// --- LÓGICA DE AUTENTICAÇÃO E VERIFICAÇÃO DE NÍVEL ---
function setupAuthAndAdminChecks() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            showWarningPopup("Você precisa estar logado como administrador para acessar este painel.");
        } else {
            checkAdminLevelAndShowWarning(user.uid);
            // Inicia o monitoramento do status do usuário logado
            monitorUserStatus(user);
        }
    });
}

async function checkAdminLevelAndShowWarning(uid) {
    try {
        const docRef = doc(db, "usuarios", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const nivelAdmin = userData.niveladmin;

            if (nivelAdmin !== 1) {
                showWarningPopup("Você não tem permissão para acessar este painel.");
            } else {
                hideWarningPopup(); // Permite acesso se for admin nível 1
            }
        } else {
            showWarningPopup("Seus dados de acesso não foram encontrados. Por favor, contate o suporte.");
        }
    } catch (error) {
        console.error("Erro ao verificar nível de admin:", error);
        showWarningPopup("Ocorreu um erro ao verificar seu acesso. Tente novamente mais tarde.");
    }
}

// --- LÓGICA PARA CONTADORES ---
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
            console.error(`Erro ao ouvir coleção ${collectionName}:`, error);
            if (element) {
                element.textContent = 'Erro';
            }
        });
    };

    // Contagem de Álbuns
    updateCounter(elements.totalAlbums, "albuns");

    // Contagem de Artistas (assumindo que se refere a todos os usuários)
    updateCounter(elements.totalArtists, "usuarios");

    // Contagem de Músicas
    updateCounter(elements.totalMusics, "musicas");

    // Contagem de Acessos
    const accessesDocRef = doc(db, "contagem", "numeros");
    const updateAccessCount = async () => {
        try {
            const docSnap = await getDoc(accessesDocRef);
            if (docSnap.exists()) {
                await updateDoc(accessesDocRef, { acessos: increment(1) });
                const currentAccesses = docSnap.data().acessos + 1;
                if (elements.totalAccesses) {
                    elements.totalAccesses.textContent = formatNumber(currentAccesses);
                }
            } else {
                await setDoc(accessesDocRef, { acessos: 1 });
                if (elements.totalAccesses) {
                    elements.totalAccesses.textContent = '1';
                }
            }
        } catch (error) {
            console.error("Erro ao atualizar contagem de acessos:", error);
            if (elements.totalAccesses) {
                elements.totalAccesses.textContent = 'Erro';
            }
        }
    };
    updateAccessCount();
}

// --- LÓGICA PARA EXIBIR LISTAS E DEMAIS ELEMENTOS ---
function setupDisplayLogic() {
    // LÓGICA PARA OBTER E EXIBIR ÁLBUNS
    if (elements.albumsListContainer) {
        const q = query(collection(db, "albuns"), orderBy('date', 'desc'));
        onSnapshot(q, (querySnapshot) => {
            elements.albumsListContainer.innerHTML = '';
            if (elements.loadingMessage) elements.loadingMessage.style.display = 'none';
            if (querySnapshot.empty) {
                elements.albumsListContainer.innerHTML = '<p class="col-span-full text-center text-gray-400">Nenhum álbum encontrado.</p>';
            }
            querySnapshot.forEach((doc) => {
                const album = doc.data();
                const albumCard = document.createElement('div');
                albumCard.className = 'bg-gray-800 rounded-lg shadow-lg overflow-hidden transform transition-transform hover:scale-105 p-4 cursor-pointer flex flex-col items-center text-center flex-shrink-0 w-40 sm:w-48 md:w-56 lg:w-64';
                albumCard.innerHTML = `
                    <div class="relative w-full pb-[100%] bg-transparent rounded-md">
                        <img src="${album.cover || ''}"
                             alt="Capa do Álbum: ${album.album}"
                             class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-md block">
                    </div>
                    <div class="mt-4 w-full">
                        <h3 class="text-base font-semibold text-white truncate">${album.album}</h3>
                        <p class="text-gray-400 text-sm truncate">${album.artist}</p>
                        <div class="mt-2 text-gray-500 text-xs">
                            <span>${album.date ? album.date.split('-')[0] : ''}</span> &bull;
                            <span>Álbum</span>
                        </div>
                    </div>
                `;
                elements.albumsListContainer.appendChild(albumCard);
            });
        }, (error) => {
            console.error("Erro ao carregar álbuns:", error);
            if (elements.albumsListContainer) elements.albumsListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">Erro ao carregar álbuns.</p>';
            if (elements.loadingMessage) elements.loadingMessage.style.display = 'none';
        });
    }

    // LÓGICA PARA OBTER E EXIBIR MÚSICAS (se houver uma lista específica para isso)
    if (elements.musicListContainer) {
        const q = query(collection(db, "musicas"), orderBy("releaseDate", "desc"));
        onSnapshot(q, (snapshot) => {
            elements.musicListContainer.innerHTML = "";
            if (snapshot.empty) {
                elements.musicListContainer.innerHTML = '<p class="text-gray-400">Nenhuma música encontrada.</p>';
            }
            snapshot.forEach((doc) => {
                const music = doc.data();
                const musicCard = document.createElement("div");
                musicCard.className = "p-2 mb-2 bg-gray-800 rounded-lg text-white";
                musicCard.innerHTML = `
                    <strong>${music.title}</strong> - ${music.artist} <br>
                    Álbum: ${music.album || "N/A"} | Faixa: ${music.trackNumber} <br>
                    Lançamento: ${music.releaseDate} | Duração: ${music.duration} | Gênero: ${music.genre || "N/A"}
                `;
                elements.musicListContainer.appendChild(musicCard);
            });
        }, (error) => {
            console.error("Erro ao carregar músicas:", error);
            elements.musicListContainer.innerHTML = '<p class="text-red-500">Erro ao carregar músicas.</p>';
        });
    }

    // LÓGICA PARA ÚLTIMOS LANÇAMENTOS
    if (elements.latestReleasesBody) {
        const qLatest = query(collection(db, "albuns"), orderBy('date', 'desc'), limit(4));
        onSnapshot(qLatest, (querySnapshot) => {
            elements.latestReleasesBody.innerHTML = '';
            if (querySnapshot.empty) {
                elements.latestReleasesBody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-gray-500">Nenhum lançamento recente.</td></tr>';
                return;
            }
            querySnapshot.forEach((doc) => {
                const album = doc.data();
                const streams = album.streams !== undefined ? album.streams.toLocaleString('pt-BR') : 'N/A';
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-800';
                row.innerHTML = `<td class="py-2">${album.album}</td><td>${album.artist}</td><td>${streams}</td>`;
                elements.latestReleasesBody.appendChild(row);
            });
        }, (error) => {
            console.error("Erro ao carregar últimos lançamentos:", error);
            elements.latestReleasesBody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-red-500">Erro ao carregar lançamentos.</td></tr>';
        });
    }

    // LÓGICA DE FORMULÁRIOS
    if (elements.albumForm) {
        elements.albumForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const albumData = {
                artist: elements.albumForm.artist?.value || '',
                album: elements.albumForm.album?.value || '',
                cover: elements.albumForm.cover?.value || '',
                date: elements.albumForm.date?.value || '',
                country: elements.albumForm.country?.value || '',
                duration: elements.albumForm.duration?.value || '',
                label: elements.albumForm.label?.value || '',
                streams: 0
            };
            try {
                await addDoc(collection(db, "albuns"), albumData);
                alert("Álbum enviado com sucesso!");
                elements.albumForm.reset();
            } catch (error) {
                console.error("Erro ao enviar álbum:", error);
                alert("Erro ao enviar álbum.");
            }
        });
    }

    if (elements.songForm) {
        elements.songForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const musicData = {
                title: elements.songForm.title.value.trim(),
                artist: elements.songForm.artist.value.trim(),
                album: elements.songForm.album.value.trim(),
                trackNumber: parseInt(elements.songForm.trackNumber.value) || 1,
                genre: elements.songForm.genre.value.trim(),
                releaseDate: elements.songForm.releaseDate.value,
                duration: elements.songForm.duration.value.trim(),
                cover: elements.songForm.cover.value.trim(),
                audioUrl: elements.songForm.audioUrl.value.trim(),
                explicit: elements.songForm.explicit.value === "true",
                streams: 0
            };
            if (!musicData.title || !musicData.artist || !musicData.releaseDate || !musicData.duration || !musicData.cover || !musicData.audioUrl) {
                alert("Preencha todos os campos obrigatórios!");
                return;
            }
            try {
                await addDoc(collection(db, "musicas"), musicData);
                alert("Música enviada com sucesso!");
                elements.songForm.reset();
            } catch (err) {
                console.error("Erro ao enviar música:", err);
                alert("Erro ao enviar música, tente novamente.");
            }
        });
    }

    // Script de Saudação
    if (elements.greeting) {
        const hour = new Date().getHours();
        const welcomeTypes = ["Bom dia", "Boa tarde", "Boa noite"];
        let welcomeText = "";
        if (hour < 12) welcomeText = welcomeTypes[0];
        else if (hour < 18) welcomeText = welcomeTypes[1];
        else welcomeText = welcomeTypes[2];
        elements.greeting.innerHTML = welcomeText;
    }

    // Script de 'enabledisable'
    window.enabledisable = (element) => {
        if (element && element.style) {
            if (element.style.fill !== "rgb(29, 185, 84)") {
                element.style.setProperty('fill', '#1db954');
            } else {
                element.style.setProperty('fill', '#fff');
            }
        }
    };

    // Script de Seção de Faixas
    if (elements.albumInput && elements.trackSection) {
        function toggleTrackSection() {
            if (elements.albumInput.value.trim() !== "") {
                elements.trackSection.classList.remove("hidden");
                elements.trackSection.classList.add("opacity-100");
            } else {
                elements.trackSection.classList.add("hidden");
                elements.trackSection.classList.remove("opacity-100");
            }
        }
        toggleTrackSection();
        elements.albumInput.addEventListener("input", toggleTrackSection);
    }

    // Script de Navegação
    if (elements.topNav && elements.sectionOne) {
        const sectionOneObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    elements.topNav.style.backgroundColor = "black";
                } else {
                    elements.topNav.style.backgroundColor = "transparent";
                }
            });
        }, {});
        sectionOneObserver.observe(elements.sectionOne);
    }

    // Lógica para listar administradores (se houver uma seção separada para admins)
    if (elements.adminList && elements.adminLoading) {
        fetchAdmins(); // Chamada para buscar e exibir administradores
    }
}

// ... (seu código existente de inicialização do Firebase) ...

/**
 * Formata um timestamp do Firestore em um formato legível (DD/MM/AAAA).
 * @param {firebase.firestore.Timestamp} timestamp - O timestamp do Firestore.
 * @returns {string} A data formatada ou uma mensagem de indisponibilidade.
 */
function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return "Data indisponível";
    }
    try {
        const date = timestamp.toDate();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês é baseado em zero, então adicionamos 1
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Erro ao formatar data:", timestamp, e);
        return "Erro na data";
    }
}

/**
 * Copia um texto para a área de transferência do usuário e exibe um toast.
 * @param {string} text - O texto a ser copiado.
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("UID copiado!");
    }).catch(err => {
        console.error('Erro ao copiar UID: ', err);
        showToast("Falha ao copiar UID.");
    });
}

/**
 * Busca os artistas mais recentes no Firestore e os renderiza na página.
 */
async function fetchAndRenderRecentArtists() {
    const artistsContainer = document.getElementById("recent-artists-container");
    if (!artistsContainer) return;

    try {
        // A consulta (query) está correta, pois o campo 'criadoEm' já existe
        const q = query(collection(db, "usuarios"), orderBy("criadoEm", "desc"), limit(5));

        const querySnapshot = await getDocs(q);
        artistsContainer.innerHTML = '';

        if (querySnapshot.empty) {
            artistsContainer.innerHTML = '<p class="text-gray-500">Nenhum artista encontrado.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const artist = doc.data();
            const artistId = doc.id; 
            
            // AQUI ESTÃO OS AJUSTES 👇
            const entryDate = artist.criadoEm; // O campo já é uma string, não precisa de .toDate()
            const artistName = artist.nomeArtistico || artist.apelido; // Use nomeArtistico ou apelido como fallback
            const artistPhoto = artist.foto || 'assets/default-artist.png'; // Use o campo 'foto'

            const artistCard = document.createElement("div");
            artistCard.className = "flex items-center gap-4 bg-[#232323] p-3 rounded-lg";
            
            artistCard.innerHTML = `
                <img src="${artistPhoto}" alt="Foto de perfil de ${artistName}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-grow">
                    <h4 class="font-bold text-white">${artistName}</h4>
                    <p class="text-xs text-gray-400">UID: <span class="artist-uid" data-uid="${artistId}">${artistId}</span></p>
                    <p class="text-xs text-gray-500">Desde: ${entryDate}</p>
                </div>
                <button class="copy-uid-btn text-gray-400 hover:text-white transition-colors" data-uid="${artistId}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h-2.5-2.5-2.5M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
            `;
            
            artistsContainer.appendChild(artistCard);
        });

        document.querySelectorAll(".copy-uid-btn").forEach(button => {
            button.addEventListener("click", () => {
                const uidToCopy = button.getAttribute("data-uid");
                copyToClipboard(uidToCopy);
            });
        });

    } catch (error) {
        console.error("Erro ao buscar e renderizar artistas recentes: ", error);
        artistsContainer.innerHTML = '<p class="text-red-500 text-center">Ocorreu um erro ao carregar os artistas.</p>';
    }
}

// --- ATENÇÃO ---
// Certifique-se de que a função showToast existe e está configurada
// no seu código principal para exibir as mensagens. Se ela não estiver
// no código que você forneceu, você precisará adicioná-la.
// Exemplo de showToast:
/*
function showToast(msg, bgColor = "bg-red-600") {
    let toast = document.createElement("div");
    toast.innerText = msg;
    toast.className = `fixed bottom-6 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-4 py-2 rounded shadow-lg text-sm z-50 animate-fade`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
*/

// Chame a função para carregar os artistas quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
    // ... (outras inicializações, se houver)
    fetchAndRenderRecentArtists();
});

// --- INICIALIZAÇÃO AO CARREGAR O DOM ---
document.addEventListener('DOMContentLoaded', () => {
    // Configura a autenticação e verificação de admin
    setupAuthAndAdminChecks();
    // Configura os listeners para os contadores
    setupCounterListeners();
    // Configura a lógica de exibição de listas e formulários
    setupDisplayLogic();
    // Inicia o gerenciamento do status online
    setupOnlineStatusManagement();

    // Lógica para listar todos os artistas/usuários (se o elemento existir)
    if (elements.artistsListContainer) {
        fetchAndDisplayArtists(); // Certifique-se de que esta função está definida em algum lugar ou remova a chamada
    }

    // A função fetchAdmins já é chamada dentro de setupDisplayLogic() se os elementos existirem.
    // Se precisar chamá-la separadamente, remova a chamada de dentro de setupDisplayLogic().
});

// --- FUNÇÃO EXEMPLO PARA BUSCAR E EXIBIR ARTISTAS (SE NECESSÁRIO) ---
async function fetchAndDisplayArtists() {
    // Implemente aqui a lógica para buscar artistas do Firestore e exibi-los no elements.artistsListContainer
    // Exemplo:
    // const artistsRef = collection(db, "usuarios"); // Ou uma coleção específica de artistas
    // const q = query(artistsRef, orderBy("nome"));
    // onSnapshot(q, (snapshot) => { ... });
    console.log("Função fetchAndDisplayArtists chamada (implemente a lógica)");
}