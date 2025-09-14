import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, updateDoc, setDoc, query, where, onSnapshot, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
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

// ================================
// 3️⃣ ELEMENTOS DO DOM
// ================================
const elements = {
    adminList: document.getElementById("admin-list"),
    adminLoading: document.getElementById("admin-loading")
};

// ================================
// 4️⃣ FUNÇÕES DE STATUS ONLINE/OFFLINE
// ================================
async function updateUserStatus(userId, isOnline) {
    const userDocRef = doc(db, "usuarios", userId);
    const rtdbRef = databaseRef(rtdb, `status/${userId}`);

    try {
        // Atualiza RTDB
        await set(rtdbRef, { isOnline, lastSeen: serverTimestamp() });

        // Atualiza Firestore
        await updateDoc(userDocRef, { online: isOnline, lastSeen: new Date() });

        console.log(`Status do admin ${userId} => ${isOnline}`);
    } catch (error) {
        console.error("Erro ao atualizar status do admin:", error);
    }
}

function setupOnlineStatusManagement(user) {
    if (!user) return;
    const userId = user.uid;
    const rtdbRef = databaseRef(rtdb, `status/${userId}`);

    // Define status offline no disconnect
    onDisconnect(rtdbRef).set({ isOnline: false, lastSeen: serverTimestamp() });

    // Marca usuário como online imediatamente
    set(rtdbRef, { isOnline: true, lastSeen: serverTimestamp() });
}

// ================================
// 5️⃣ MONITORA LISTA DE ADMINS EM TEMPO REAL
// ================================
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

// ================================
// 6️⃣ CARREGA ADMINS DO FIRESTORE
// ================================
async function fetchAdmins() {
    if (!elements.adminList) return;
    if (elements.adminLoading) {
        elements.adminLoading.style.display = 'block';
        elements.adminLoading.textContent = "Carregando administradores...";
    }

    try {
        const q = query(collection(db, "usuarios"), where("niveladmin", "==", 1));
        onSnapshot(q, (snapshot) => {
            elements.adminList.innerHTML = '';

            if (snapshot.empty) {
                elements.adminList.innerHTML = '<p class="text-gray-500">Nenhum administrador encontrado.</p>';
                if (elements.adminLoading) elements.adminLoading.style.display = 'none';
                return;
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

                elements.adminList.appendChild(adminEl);
            });

            if (elements.adminLoading) elements.adminLoading.style.display = 'none';

            // Começa a monitorar status depois de renderizar a lista
            monitorAdminsStatus();
        });

    } catch (error) {
        console.error("Erro ao buscar administradores:", error);
        if (elements.adminList) elements.adminList.innerHTML = '<p class="text-red-500">Erro ao carregar administradores.</p>';
        if (elements.adminLoading) elements.adminLoading.style.display = 'none';
    }
}

// ================================
// 7️⃣ AUTENTICAÇÃO E VERIFICAÇÃO DE NÍVEL
// ================================
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const docRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;

    const userData = docSnap.data();
    if (userData.niveladmin !== 1) return;

    // Configura status online/offline
    setupOnlineStatusManagement(user);

    // Carrega admins
    fetchAdmins();
});


// --- FUNÇÕES AUXILIARES PARA MODAL DE AVISO ---
function showWarningPopup(message) {
    if (elements.warningModal && elements.warningMessage) {
        elements.warningMessage.innerText = message;
        elements.warningModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Elemento de modal de aviso ou mensagem não encontrado.");
    }
}

function hideWarningPopup() {
    if (elements.warningModal) {
        elements.warningModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
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
    onAuthStateChanged(auth, (user) => { // 'auth' agora está definido
        if (!user) {
            showWarningPopup("Você precisa estar logado como administrador para acessar este painel.");
        } else {
            checkAdminLevelAndShowWarning(user.uid);
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
                hideWarningPopup();
                // Se o usuário for um admin válido, agora podemos carregar os dados e iniciar os listeners
                setupDisplayLogic();
                setupCounterListeners();
                setupOnlineStatusManagement();
                fetchAdmins(); // Certifique-se de que a lista de admins é carregada
                fetchAndRenderRecentArtists(); // Carrega artistas recentes se a seção existir
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
            } else {
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
            }
        }, (error) => {
            console.error("Erro ao carregar álbuns:", error);
            if (elements.albumsListContainer) elements.albumsListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">Erro ao carregar álbuns.</p>';
            if (elements.loadingMessage) elements.loadingMessage.style.display = 'none';
        });
    }

    // LÓGICA PARA OBTER E EXIBIR MÚSICAS
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
}

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
            const entryDate = artist.criadoEm;
            const artistName = artist.nomeArtistico || artist.apelido;
            const artistPhoto = artist.foto || 'assets/default-artist.png';

            const artistCard = document.createElement("div");
            artistCard.className = "flex items-center gap-4 bg-[#232323] p-3 rounded-lg";
            artistCard.innerHTML = `
                <div class="relative w-16 h-16 flex-shrink-0">
                    <img src="${artistPhoto}" alt="Foto do Artista" class="w-full h-full rounded-full object-cover">
                    <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${artist.online ? 'bg-green-500' : 'bg-gray-500'}"></span>
                </div>
                <div>
                    <h4 class="text-white font-bold text-lg">${artistName || 'Nome Indisponível'}</h4>
                    <p class="text-gray-400 text-sm">Desde: ${entryDate ? entryDate.split('T')[0] : 'Data Indisponível'}</p>
                </div>
            `;
            artistsContainer.appendChild(artistCard);
        });
    } catch (error) {
        console.error("Erro ao buscar artistas recentes:", error);
        artistsContainer.innerHTML = '<p class="text-red-500">Erro ao carregar artistas.</p>';
    }
}

// --- FUNÇÃO DE TOAST (Implementação básica, personalize se necessário) ---
function showToast(message) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toastElement = document.createElement('div');
    toastElement.className = 'toast bg-gray-700 text-white p-2 rounded-md shadow-lg mb-2';
    toastElement.textContent = message;
    toastContainer.appendChild(toastElement);
    setTimeout(() => {
        toastElement.remove();
        if (toastContainer.children.length === 0) {
            toastContainer.remove();
        }
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column-reverse';
    container.style.gap = '10px';
    document.body.appendChild(container);
    return container;
}


// --- INICIALIZAÇÃO GERAL ---
document.addEventListener('DOMContentLoaded', () => {
    // A autenticação é verificada primeiro. Se o usuário for um admin válido,
    // as outras funções de carregamento de dados e listeners serão chamadas.
    setupAuthAndAdminChecks();
});
