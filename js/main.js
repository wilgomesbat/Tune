// main.js

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, deleteDoc, collection, addDoc, query, onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, limit, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Configuração do Firebase para a sua aplicação web (APENAS ESTA SEÇÃO)
const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.appspot.com",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};



// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // ✅ Inicialize e exporte o Auth

// ⚠️ Declare a variável globalmente
let currentUserUid = null; 

// ✅ Use o listener para atualizar a variável global
onAuthStateChanged(auth, (user) => {
    // Define a variável global com o UID, ou null se deslogado
    currentUserUid = user ? user.uid : null;
        populateUserProfile(user);
    // Se você tiver uma função que carrega a página após o login, chame-a aqui.
    // Ex: loadInitialPage();
});

// NOVO: Função para finalizar o carregamento e mostrar o conteúdo
function hideLoadingAndShowContent() {
    const mainContent = document.getElementById('main-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // 1. Mostrar o conteúdo principal
    if (mainContent) {
        mainContent.classList.add('loaded'); // Adiciona a classe que define opacity: 1
    }
    
    // 2. Esconder o overlay de carregamento
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
    
    console.log("--- INÍCIO DE POPULATE PROFILE ---");

    if (user) {
        const uid = user.uid;
        console.log(`STATUS: Usuário logado. UID: ${uid}`);

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
    console.log(`BUSCA: Tentando buscar documento em: ${collectionPath}/${uid}`);
    
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        console.log("SUCESSO: Documento do Firestore encontrado!");
        const userData = userDoc.data();
        
        // Mapeamento das chaves do Firestore
        nomeArtistico = userData.nomeArtistico || user.displayName || 'Artista Desconhecido';
        profilePicURL = userData.foto || user.photoURL || DEFAULT_PROFILE_PIC; 
        apelido = userData.apelido || uid; 
        email = userData.email || user.email;
        
        console.log(`DADOS OBTIDOS: Nome: ${nomeArtistico}, Foto URL: ${profilePicURL}, Apelido: ${apelido}`);
        
    } else {
        console.log("ALERTA: Documento do Firestore NÃO encontrado. Usando fallbacks.");
        // Fallbacks: usa o que está no Auth ou o valor padrão
        nomeArtistico = user.displayName || 'Artista Desconhecido';
        apelido = uid;
        profilePicURL = user.photoURL || DEFAULT_PROFILE_PIC;
    }
} catch (error) {
            console.error("ERRO FATAL AO BUSCAR DADOS DO FIRESTORE:", error);
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
        console.log("STATUS: Usuário não está logado.");
    }
    console.log("--- FIM DE POPULATE PROFILE ---\n");
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
    console.log("🎧 Tocando:", track.title);
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

// --- Setup Página Playlist ---
// --- Setup Página Playlist ---
// Lida com playlists normais, a playlist "Top 100" e playlists de "Stations"
async function setupPlaylistPage(playlistId) {
    const playlistCoverDetail = document.getElementById("playlist-cover-detail");
    const playlistCoverBg = document.getElementById("playlist-cover-bg");
    const playlistTitleDetail = document.getElementById("playlist-title-detail");
    const playlistDescriptionDetail = document.getElementById("playlist-description-detail");
    const tracksContainer = document.getElementById("tracks-container");
    const detailHeader = document.querySelector('#playlist-header');
    const fallbackBackground = 'linear-gradient(to bottom, #1a1a1a, #121212)';
    const playlistImgDetail = document.getElementById("playlist-cover-detail");
    const fallbackImage = 'caminho/para/imagem/fallback.jpg'; // Adicione seu fallback real

    if (!playlistId) {
        console.error("Nenhum ID de playlist encontrado na URL.");
        return;
    }

    
    try {
        // --- 1) Buscar dados da playlist principal ---
        const playlistRef = doc(db, "playlists", playlistId);
        const playlistSnap = await getDoc(playlistRef);

        if (!playlistSnap.exists()) {
            playlistTitleDetail.textContent = "Playlist não encontrada";
            tracksContainer.innerHTML = `<p class="text-gray-400">Não foi possível carregar esta playlist.</p>`;
            if (detailHeader) detailHeader.style.background = fallbackBackground;
            return;
        }

        const playlist = { id: playlistSnap.id, ...playlistSnap.data() };

        // --- Atribui título e imagem ---
        playlistTitleDetail.textContent = playlist.name || "Sem título";
        
        // Atualiza a descrição para Stations
        if (playlist.category === "Stations") {
            playlistDescriptionDetail.textContent = "Baseada nas músicas deste artista.";
        } else {
            // Mantenha a descrição original da playlist
            playlistDescriptionDetail.textContent = playlist.description || "";
        }


// 1) Atualiza a imagem da capa (elemento <img>)
const coverUrl = playlist.cover || fallbackImage;
if (coverUrl && playlistImgDetail) {
    playlistImgDetail.src = coverUrl;
} else if (playlistImgDetail) {
    playlistImgDetail.src = fallbackImage;
}

// 2) Atualiza o background BLUR no elemento correto (#playlist-cover-bg)
if (playlistCoverBg) {
    const imgToLoad = new Image();
    imgToLoad.crossOrigin = "Anonymous";
    imgToLoad.src = coverUrl;

    // enquanto carrega, opcional: mantém a imagem antiga ou mostra fallback
    // quando carregar, setamos o background (assim o blur é aplicado sem problemas)
    imgToLoad.onload = () => {
        playlistCoverBg.style.backgroundImage = `url('${imgToLoad.src}')`;
        playlistCoverBg.style.backgroundSize = "cover";
        playlistCoverBg.style.backgroundPosition = "center";
        playlistCoverBg.style.backgroundRepeat = "no-repeat";
        // garante a transição suave (você já tem no CSS, mas reforça)
        playlistCoverBg.style.transition = "background-image 0.5s ease-in-out, filter 0.5s ease";
    };

    imgToLoad.onerror = () => {
        // fallback se não carregar
        playlistCoverBg.style.backgroundImage = `url('${fallbackImage}')`;
    };
}

        // --- 2) Determinar origem das músicas ---
        let tracks = [];

        // AUTOMÁTICAS: Top 100 / Daily Top 50
        const automaticTopNames = ["Top 100", "Daily Top 50"];
        const isAutomaticTop =
            automaticTopNames.includes(playlist.name) &&
            playlist.category === "Charts";

        if (isAutomaticTop) {
            const limitCount = playlist.name === "Top 100" ? 100 : 50;

            const musicasRef = collection(db, "musicas");
            const q = query(
                musicasRef,
                orderBy("streamsMensal", "desc"),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((d) =>
                tracks.push({ id: d.id, ...d.data() })
            );

            console.log(`Carregou automática ${playlist.name} com ${tracks.length} itens.`);

        } 
        // ---------------------------------------------------------------------
        // 🛑 NOVO BLOCO: Lógica para PLAYLIST STATION (usando 'uidars')
        // ---------------------------------------------------------------------
        else if (playlist.uidars) {
            const artistId = playlist.uidars;
            
            console.log(`Carregando Artist Station para UID: ${artistId}`);

            const musicasRef = collection(db, "musicas");
            const q = query(
                musicasRef,
                where("artist", "==", artistId), // <-- USA O CAMPO 'artist' DO DOCUMENTO MÚSICA
                orderBy("streamsMensal", "desc") // Opcional: ordena por popularidade
            );

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((d) =>
                tracks.push({ id: d.id, ...d.data() })
            );
            
            console.log(`Carregadas ${tracks.length} músicas para a Station.`);
            
            // Se não houver faixas, exibe a mensagem aqui (antes de passar para subcoleção)
            if (tracks.length === 0) {
                tracksContainer.innerHTML =
                    `<p class="text-gray-400 col-span-full">Nenhuma música encontrada para este artista.</p>`;
            }
        }
        // ---------------------------------------------------------------------
        // FIM DO NOVO BLOCO
        // ---------------------------------------------------------------------
        else {
            // SUBCOLEÇÃO (Lógica original)
            const playlistMusicasRef = collection(db, `playlists/${playlistId}/musicas`);
            const snapshotMusicas = await getDocs(playlistMusicasRef);

            if (!snapshotMusicas.empty) {
                snapshotMusicas.forEach((d) =>
                    tracks.push({ id: d.id, ...d.data() })
                );

                console.log(`Carregadas ${tracks.length} músicas da subcoleção.`);
            }

            // FALLBACK: track_ids (Lógica original)
            else if (playlist.track_ids && Array.isArray(playlist.track_ids)) {
                for (const trackId of playlist.track_ids) {
                    try {
                        const ref = doc(db, "musicas", trackId);
                        const snap = await getDoc(ref);

                        if (snap.exists()) {
                            tracks.push({ id: snap.id, ...snap.data() });
                        }
                    } catch (err) {
                        console.error("Erro em track_ids:", err);
                    }
                }
                console.log(`Carregadas ${tracks.length} músicas via track_ids.`);
            }

            // SEM NADA (Lógica original)
            else {
                tracksContainer.innerHTML =
                    `<p class="text-gray-400 col-span-full">Nenhuma música encontrada nesta playlist.</p>`;
            }
        }

        // ORDENAÇÃO PARA PLAYLISTS NORMAIS
        // Adicionada a verificação para não ordenar se for uma Station (que já está ordenada por streams)
        if (!isAutomaticTop && !playlist.uidars) { 
            tracks.sort((a, b) => {
                const ta = typeof a.trackNumber === "number" ? a.trackNumber : Number.MAX_SAFE_INTEGER;
                const tb = typeof b.trackNumber === "number" ? b.trackNumber : Number.MAX_SAFE_INTEGER;
                return ta - tb;
            });
        }

        // --- 3) Renderizar ---
        renderTracksSpotifyStyle(tracks, playlist);

    } catch (error) {
        console.error("Erro ao carregar playlist:", error);
        playlistTitleDetail.textContent = "Erro ao Carregar Playlist";
        tracksContainer.innerHTML = `<p class="text-red-500">Não foi possível carregar as músicas.</p>`;
        if (detailHeader) detailHeader.style.background = fallbackBackground;
    }
}



async function toggleLike(type, itemId, buttonElement) {
    // Verifica se o usuário está logado
   if (!currentUserUid || !itemId) {
        alert("Você precisa estar logado para interagir.");
        console.warn("Tentativa de curtir falhou: currentUserUid ou itemId ausente.");
        return;
    }

    try {
        const userLikesRef = collection(db, `usuarios/${currentUserUid}/curtidas`);
        const q = query(userLikesRef, where("itemId", "==", itemId), where("type", "==", type));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // CURTIR
            await addDoc(userLikesRef, {
                itemId: itemId,
                type: type, // 'music' ou 'album'
                timestamp: new Date()
            });
            updateLikeButtonState(buttonElement, true);
            console.log(`Curtida ADICIONADA: ${type} - ${itemId}. Enviado para Firestore.`);
            
            // ⭐ CHAMADA DO TOAST AO CURTIR ⭐
            if (type === 'music') {
                showToast('Adicionado a Músicas Curtidas.', 'like');
            } else if (type === 'album') {
                showToast('Álbum adicionado à sua biblioteca.', 'like');
            }
            
        } else {
            // DESCURTIR
            const docToDelete = querySnapshot.docs[0];
            await deleteDoc(doc(db, `usuarios/${currentUserUid}/curtidas`, docToDelete.id));
            updateLikeButtonState(buttonElement, false);
            console.log(`Curtida REMOVIDA: ${type} - ${itemId}. Deletado do Firestore.`);
            
            // ⭐ CHAMADA DO TOAST AO DESCURTIR ⭐
            showToast('', 'unlike'); 
        }
    } catch (error) {
        console.error("ERRO GRAVE ao processar curtida no Firestore:", error);
        alert("Ocorreu um erro ao salvar sua curtida. Verifique o console.");
        // ⭐ CHAMADA DO TOAST DE ERRO ⭐
        showToast('Ocorreu um erro ao salvar sua curtida.', 'error');
    }
}

async function checkAndSetLikeState(type, itemId, buttonElement) {
    if (!currentUserUid || !itemId || !buttonElement) {
        // Define o estado visual como "não curtido" se não houver UID
        updateLikeButtonState(buttonElement, false); 
        return;
    }
    
    try {
        const userLikesRef = collection(db, `usuarios/${currentUserUid}/curtidas`);
        const q = query(userLikesRef, where("itemId", "==", itemId), where("type", "==", type));
        const querySnapshot = await getDocs(q);

        const isLiked = !querySnapshot.empty;
        updateLikeButtonState(buttonElement, isLiked);
    } catch (error) {
        console.error("Erro ao checar estado de curtida:", error);
        updateLikeButtonState(buttonElement, false);
    }
}

function updateLikeButtonState(button, isLiked) {
    if (!button) return;
    const img = button.querySelector('img');
    const iconBase = "./assets/like.svg";
    const iconLiked = "./assets/favorite_50dp_9DC384_FILL1_wght400_GRAD0_opsz48.svg";

    if (isLiked) {
        img.src = iconLiked;
        button.classList.add('is-liked');
        // Garante que o ícone fique visível (reverte a opacidade do hover)
        button.classList.remove('opacity-0', 'group-hover:opacity-100'); 
    } else {
        img.src = iconBase;
        img.style.filter = "none";
        button.classList.remove('is-liked');
        // Restaura a opacidade para aparecer apenas no hover
        if (button.closest('.group')) {
            button.classList.add('opacity-0', 'group-hover:opacity-100');
        }
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
// --- 2. Função de Renderização de Músicas (Ajustada com 'Nationale Regular' e 'E') ---
function renderTracksSpotifyStyle(tracks, playlist) { 
    const tracksContainer = document.getElementById("tracks-container");
    tracksContainer.innerHTML = "";

    if (!tracks || !tracks.length) {
        tracksContainer.innerHTML = `<p class="text-gray-400 col-span-full">Nenhuma música encontrada nesta playlist ou álbum.</p>`;
        return;
    }

    const isTop100 = playlist.name === "Top 100" && playlist.category === "Charts";
    const table = document.createElement("table");
    table.className = `w-full text-left text-gray-300 border-collapse ${isTop100 ? 'mt-0' : 'mt-4'}`; 
    
    const tbody = document.createElement("tbody");

    tracks.forEach((track, index) => { 
        try {
            const tr = document.createElement("tr");
            tr.className = `group hover:bg-white/10 transition duration-200 cursor-pointer text-sm`;

            const trackId = track.id; 
            if (!trackId) {
                console.error(`Música no índice ${index} não tem ID e será ignorada.`, track);
                return;
            }

            const trackNumberDisplay = isTop100 ? (index + 1) : (track.trackNumber || '—');
            const isExplicit = track.explicit === true;
            const artistDisplay = track.artistName || playlist.artistName || "Desconhecido"; 
            
            let htmlContent = `
                <td class="w-10 px-4 py-2 text-gray-400 group-hover:text-white transition duration-200">
                    <div class="flex justify-start items-center">
                        <span class="track-number-display">${trackNumberDisplay}</span>
                    </div>
                </td>

                <td class="py-2">
                    <div class="flex flex-col">
                        <span class="font-normal track-title ${isExplicit ? 'text-white' : 'text-gray-200'} group-hover:text-white transition duration-200">
                            ${track.title}
                            ${isExplicit ? '<span class="explicit-tag">E</span>' : ''}
                        </span>
                        <span class="text-gray-400 text-xs">${artistDisplay}</span> 
                    </div>
                </td>

                <td class="w-10 py-2 text-center">
                    <button class="track-like-button text-gray-400 hover:text-white p-1 rounded-full transition duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100" 
                            data-track-id="${trackId}">
                        <img src="./assets/like.svg" alt="Curtir" class="w-5 h-5">
                    </button>
                </td>

                <td class="py-2 text-right"></td>
            `;
            
            tr.innerHTML = htmlContent;
            tbody.appendChild(tr);

            // --- CURTIDAS ---
            const likeButton = tr.querySelector('.track-like-button');
            if (likeButton && currentUserUid) {
                likeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleLike('music', trackId, likeButton);
                });
            }
            
            // --- PLAY/STREAM ---
            tr.addEventListener("click", async (e) => { 
    if (e.target.closest('.track-like-button') || e.target.closest('a')) {
        return;
    }

    // Aceitar todos os formatos: audioURL, audioUrl, Url
    const audioURL =
        track.audioURL ||
        track.audioUrl ||
        track.Url ||
        null;

    if (!audioURL) {
        console.warn(`Música ${track.id} não possui nenhum campo de URL.`);
        return;
    }

    // Garante que o player receba sempre audioURL
    const trackFixed = {
        ...track,
        audioURL: audioURL 
    };

    // Reproduzir
    if (window.playTrackGlobal) {
        window.playTrackGlobal(trackFixed);
    }

    addToQueue(tracks, index);

    try {
        await checkAndResetMonthlyStreams(track.id);
    } catch (err) {
        console.error("Erro ao registrar stream:", err);
    }
});


        } catch (error) {
            console.error(`ERRO DE RENDERIZAÇÃO da música no índice ${index}:`, error, track);
        }
    });

    table.appendChild(tbody);
    tracksContainer.appendChild(table);
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
    window.countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Verifica e reseta o streamsMensal se um novo mês começou e incrementa o contador.
 * @param {string} musicId O ID do documento da música.
 * @returns {Promise<void>}
 */
async function checkAndResetMonthlyStreams(musicId) {
    if (!musicId) return;

    try {
        const musicRef = doc(db, "musicas", musicId);
        const docSnap = await getDoc(musicRef);

        if (!docSnap.exists()) {
            console.warn(`Música com ID ${musicId} não encontrada no Firestore.`);
            return;
        }

        const musicData = docSnap.data();
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Converte o Timestamp do Firebase para um objeto Date
        const lastStreamDate = musicData.lastMonthlyStreamDate 
            ? musicData.lastMonthlyStreamDate.toDate() 
            : null;

        let updateData = {};
        let needsReset = false;

        if (lastStreamDate) {
            const lastStreamMonth = lastStreamDate.getMonth();
            const lastStreamYear = lastStreamDate.getFullYear();

            // Se o ano mudou OU se o mês mudou, o streamMensal precisa ser resetado
            if (currentYear > lastStreamYear || currentMonth !== lastStreamMonth) {
                needsReset = true;
            }
        } else {
             // Se 'lastMonthlyStreamDate' não existe, é a primeira vez.
             needsReset = true;
        }

        if (needsReset) {
            // Zera o contador e adiciona 1 pelo stream atual
            updateData.streamsMensal = 1; 
            console.log(`Reset Mensal e incremento efetuados para streamMensal de: ${musicId}`);
        } else {
            // Apenas incrementa se for no mesmo mês
            updateData.streamsMensal = increment(1);
        }

        // Incrementa sempre o stream geral
        updateData.streams = increment(1);
        
        // Atualiza a data do stream mensal (Timestamp do Firebase para precisão)
        updateData.lastMonthlyStreamDate = new Date(); 
        
        await updateDoc(musicRef, updateData);
        console.log(`Stream geral e mensal atualizados para a música: ${musicId}`);

    } catch (error) {
        console.error("Erro ao processar stream mensal:", error);
    }
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

// ... (Seu código anterior) ...

// =========================================================================
// ⭐ FUNÇÃO setupAlbumPage COMPLETA E CORRIGIDA ⭐
// =========================================================================

/**
 * Função principal para carregar e configurar a página do álbum, 
 * incluindo ações de Curtir, Compartilhar e Meta Tags.
 * @param {string} albumId - O ID único do álbum.
 */
async function setupAlbumPage(albumId) {
    // 1. Definições Iniciais
    const detailHeader = document.querySelector('#album-header');
    const albumCoverDetail = document.getElementById('album-cover-detail');
    const albumTitleDetail = document.getElementById('album-title-detail');
    const artistNameDetail = document.getElementById('artist-name-detail');
    const albumYearDetail = document.getElementById('album-year-detail');
    const tracksContainer = document.getElementById("tracks-container");
    const playButton = document.querySelector('.album-actions .play-button');
    const likeButton = document.querySelector('.album-actions .like');
    const shareButton = document.querySelector('.album-actions .share');
    const fallbackBackground = 'linear-gradient(to bottom, #1a1a1a, #121212)';
    
    if (!albumId) {
        console.error("Nenhum ID de álbum encontrado na URL.");
        return;
    }

    try {
        // 2. CÓDIGO DE CARREGAMENTO DO ÁLBUM (FIREBASE/FIRESTORE)
        const albumDocRef = doc(db, "albuns", albumId);
        const albumSnap = await getDoc(albumDocRef);

        if (!albumSnap.exists()) {
            albumTitleDetail.textContent = "Álbum não encontrado";
            tracksContainer.innerHTML = `<p class="text-gray-400">Não foi possível carregar este álbum.</p>`;
            if (detailHeader) detailHeader.style.background = fallbackBackground;
            return;
        }
        
        const album = { id: albumSnap.id, ...albumSnap.data() };
        
        // Dados principais
        const albumTitle = album.album || 'Título Desconhecido';
        const artistName = album.artist || 'Artista Desconhecido';
        const coverUrl = album.cover || './assets/default-cover.png';
        
        // ⭐ CORREÇÃO APLICADA AQUI: Tratamento seguro para album.date ⭐
        let albumYear = album.releaseYear || 'Ano Desconhecido';

        if (albumYear === 'Ano Desconhecido' && album.date) {
            // Verifica se album.date é um Timestamp (possui o método toDate)
            if (typeof album.date.toDate === 'function') {
                albumYear = new Date(album.date.toDate()).getFullYear();
            } else if (typeof album.date === 'string' || typeof album.date === 'number') {
                // Se for uma string ISO (data) ou um timestamp JS puro (número)
                 const dateObj = new Date(album.date);
                 if (!isNaN(dateObj)) {
                    albumYear = dateObj.getFullYear();
                 }
            } 
            // Se não for nenhum dos formatos acima, manterá 'Ano Desconhecido'
        }
        // FIM DA CORREÇÃO
        

        // Atualiza o DOM
        albumCoverDetail.src = coverUrl;
        albumTitleDetail.textContent = albumTitle;
        artistNameDetail.textContent = artistName;
        albumYearDetail.textContent = albumYear;
        
        document.title = `${albumTitle}`; // Atualiza o título da aba

        // 3. Aplica Cor Dominante no Cabeçalho
        if (albumCoverDetail) {
            const tempImg = new Image();
            tempImg.crossOrigin = "Anonymous";
            tempImg.src = coverUrl;
            // Assume que applyDominantColorToHeader está definido (seu main.js a possui)
            tempImg.onload = () => applyDominantColorToHeader(tempImg, detailHeader);
            tempImg.onerror = () => detailHeader.style.background = fallbackBackground;
        } else {
            detailHeader.style.background = fallbackBackground;
        }

        // 4. Configuração de Meta Tags para Link Preview (COMPARTILHAMENTO)
        const currentUrl = window.location.href; 
        const title = `${albumTitle} - ${artistName}`;
        const description = `Ouça o álbum "${albumTitle}" de ${artistName} no TUNE.`;
        
        // Assumindo que updateMetaTags está no seu main.js
        updateMetaTags(title, description, coverUrl, currentUrl);

        // 5. Configuração do Botão de Curtir (LIKE)
        if (likeButton) {
            // Assume que checkAndSetLikeState e toggleLike estão definidos
            checkAndSetLikeState('album', albumId, likeButton);
            likeButton.onclick = () => toggleLike('album', albumId, likeButton);
        }

        // 6. Configuração do Botão de Compartilhar (SHARE)
        if (shareButton) {
            shareButton.onclick = () => {
                // Assume que shareAlbum e showToast estão definidos
                shareAlbum(albumTitle, artistName, currentUrl, showToast);
            };
        }

        // 7. Configuração do Botão de Play e Carregamento de Faixas
        const musicasRef = collection(db, "musicas");
        // Filtra pelo ID do álbum e ordena pelo número da faixa
        const q = query(musicasRef, where("albumId", "==", albumId), orderBy("trackNumber"));
        
        let tracks = [];
        
        // Uso de onSnapshot para tempo real
        onSnapshot(q, (querySnapshot) => {
            tracks = [];
            querySnapshot.forEach((docSnap) => {
                const trackData = docSnap.data();
                // Garante que o nome do artista e a capa da faixa venham do álbum se não estiverem na faixa
                const trackArtist = trackData.artistName || artistName; 
                tracks.push({ 
                    id: docSnap.id, 
                    ...trackData, 
                    artistName: trackArtist, 
                    cover: trackData.cover || coverUrl 
                });
            });

            // Ordena as músicas por trackNumber
            tracks.sort((a, b) => (a.trackNumber || 999) - (b.trackNumber || 999));

            console.log(`Músicas encontradas para renderizar: ${tracks.length}`);
            
            // Assume que renderTracksSpotifyStyle está definido
            renderTracksSpotifyStyle(tracks, album);
            
            // Configura o botão de Play/Shuffle principal
            if (playButton && tracks.length > 0) {
                // Assume que addToQueue está definido
                playButton.onclick = () => addToQueue(tracks);
                playButton.classList.remove('hidden'); 
            } else if (playButton) {
                playButton.classList.add('hidden');
            }
        });

    } catch (error) {
        console.error("Erro ao carregar álbum:", error);
        albumTitleDetail.textContent = "Erro ao Carregar Álbum";
        tracksContainer.innerHTML = `<p class="text-red-500">Não foi possível carregar as músicas.</p>`;
        if (detailHeader) detailHeader.style.background = fallbackBackground;
    }
}
// ... (Restante do seu código) ...

    // Botão de voltar
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back();
        });
    }

    // --- Função de Formatação de Números (Streams) ---
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    // Formata o número com separadores de milhar (ex: 1.234.567)
    return num.toLocaleString('pt-BR');
}

// --- Função de Renderização do Top 5 (Para o novo container: 'top-tracks-container') ---
function renderTop5Tracks(tracks, containerId) {
    const tracksContainer = document.getElementById(containerId);
    if (!tracksContainer) return;

    tracksContainer.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-white">Populares</h2>
        <div id="top-tracks-list"></div>
    `;

    const listContainer = document.getElementById("top-tracks-list");
    
    if (!tracks.length) {
        listContainer.innerHTML = `<p class="text-gray-400">Nenhuma música popular encontrada.</p>`;
        return;
    }
    
    tracks.forEach((track, index) => {
        const div = document.createElement("div");
        // Ajustei a classe para caber capa/título e streams
        div.className = "flex items-center justify-between group hover:bg-white/10 p-2 rounded-md transition duration-200 cursor-pointer text-sm mb-2";
        
        const isExplicit = track.explicit === true;
        const streamsFormatted = formatNumber(track.streams);

        div.innerHTML = `
            <div class="flex items-center flex-grow">
                <span class="w-8 text-center text-gray-400 group-hover:text-white transition duration-200">${index + 1}</span>
                <img src="${track.cover || 'https://placehold.co/50x50/333333/FFFFFF?text=Capa'}" 
                     alt="${track.title}" 
                     class="w-12 h-12 rounded-md shadow-lg object-cover mx-4">
                <div class="flex flex-col">
                    <span class="font-normal track-title ${isExplicit ? 'text-white' : 'text-gray-200'} group-hover:text-white transition duration-200">
                        ${track.title}
                        ${isExplicit ? '<span class="explicit-tag">E</span>' : ''}
                    </span>
                    ${track.audioUrl && track.audioUrl.includes('youtube.com') ? '<span class="text-gray-400 text-xs flex items-center mt-0.5"><img src="/assets/youtube.svg" class="w-3 h-3 mr-1"/> Videoclipe</span>' : ''}
                </div>
            </div>

            <div class="flex items-center space-x-4">
                <span class="text-gray-400 group-hover:text-white transition duration-200 font-medium text-xs md:text-sm text-right w-24">
                    ${streamsFormatted}
                </span>
                <button class="text-gray-400 hover:text-white p-1 rounded-full transition duration-200">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Adiciona a lógica de clique para o player e incremento de stream
        div.addEventListener("click", async () => {
            const trackData = {
                title: track.title,
                artist: track.artistName || track.artist || "Desconhecido",
                audioUrl: track.audioUrl,
                cover: track.cover
            };

            localStorage.setItem("currentTrack", JSON.stringify(trackData));
            window.dispatchEvent(new Event("storage"));
            
            try {
                // Referência ao documento da música (collection: 'musicas', document ID: track.id)
                const musicRef = doc(db, "musicas", track.id); 
                
                // Atualiza o stream total E o stream do mês
                await updateDoc(musicRef, { 
                    streams: increment(1),
                    streamsMonth: increment(1) // ⭐ CORREÇÃO AQUI ⭐
                });
            } catch (error) {
                console.error("Erro ao incrementar stream:", error);
            }
            
            window.location.href = "menu.html";
        });

        listContainer.appendChild(div);
    });
}


// O restante do seu código JavaScript e imports do Firebase...
// O restante do seu código JavaScript e imports do Firebase...

// --- Setup Página Artista Completa (Atualizada com Imagem de Banimento) ---
async function setupArtistPage(artistId) {
    const artistCoverBg = document.getElementById('artist-cover-bg');
    const artistNameElement = document.getElementById('artist-name');
    const artistListeners = document.getElementById('artist-listeners');
    const mainHeader = document.getElementById('artist-header');
    const banIndicator = document.getElementById('ban-indicator');
    const verifiedStatusContainer = document.getElementById('verified-status-container');
    const topTracksContainer = document.getElementById('top-tracks-container');

    const fallbackBackground = 'linear-gradient(to bottom, #1a1a1a, #121212)';
    const bannedImageURL = 'https://i.ibb.co/fzqH088Z/Captura-de-tela-2025-10-06-230858.png'; // Sua imagem de banimento

    if (!artistId) {
        artistNameElement.textContent = "ID do Artista Ausente";
        if (mainHeader) mainHeader.style.background = fallbackBackground;
        return;
    }

    try {
        const artistRef = doc(db, "usuarios", artistId);
        const docSnap = await getDoc(artistRef);

        if (!docSnap.exists() || docSnap.data().artista !== "true") {
            artistNameElement.textContent = "Artista Não Encontrado";
            if (mainHeader) mainHeader.style.background = fallbackBackground;
            return;
        }

        const artistData = docSnap.data();
        const artistName = artistData.nomeArtistico || "Nome Desconhecido";
        
        // ⭐ VERIFICAÇÃO DE BANIMENTO (LÓGICA ATUALIZADA) ⭐
        const isBanned = artistData.banido === "true"; // Seu campo é string

        if (isBanned) {
            // 1. Mostra o indicador de banimento
            if (banIndicator) {
                banIndicator.style.display = 'flex'; 
            }
            // 2. Oculta o status de verificado
            if (verifiedStatusContainer) {
                verifiedStatusContainer.style.display = 'none';
            }
            // 3. Define o nome, mas não prossegue com o carregamento de conteúdo
            artistNameElement.textContent = `${artistName} (Banido)`;
            artistListeners.textContent = `Acesso restrito`;
            
            // 4. Limpa e desativa as seções de música
            if (topTracksContainer) {
                topTracksContainer.innerHTML = '<p class="text-gray-400 p-8">Conteúdo indisponível para contas banidas.</p>';
            }
            document.getElementById('albums-container').innerHTML = '';
            document.getElementById('stations-container').innerHTML = '';
            
            // ⭐ NOVO: Aplica a imagem de banimento no background
            if (artistCoverBg) {
                artistCoverBg.style.backgroundImage = `url('${bannedImageURL}')`;
                artistCoverBg.style.backgroundSize = 'cover';
                artistCoverBg.style.backgroundPosition = 'center';
                artistCoverBg.style.backgroundRepeat = 'no-repeat';
                artistCoverBg.style.backgroundColor = 'transparent'; // Garante que não há cor de fundo indesejada
            }
            // Garante que o gradiente escuro ainda é aplicado sobre a imagem
            if (mainHeader) {
                 // Certifica-se que o gradiente 'artist-bg-gradient' do HTML ainda está funcionando
                 // Se não estiver aparecendo, você pode tentar adicionar um filtro aqui também
                 // mainHeader.style.background = `linear-gradient(to top, #121212, transparent) no-repeat center center / cover, url('${bannedImageURL}') center center / cover`;
            }
            
            return; // Interrompe o restante do carregamento da página
        }
        // ⭐ FIM DA LÓGICA DE BANIMENTO ⭐
        
        // 1. Aplica Nome, Ouvintes e Foto (continuação da lógica original)
        artistNameElement.textContent = artistName;
        // Assume que formatNumber está disponível
        artistListeners.textContent = `${formatNumber(artistData.ouvintesMensais || 0)} ouvintes mensais`; 

        if (artistData.foto && artistCoverBg) {
            // Lógica de background original (se não estiver banido)
            artistCoverBg.style.backgroundImage = `url('${artistData.foto}')`;
            artistCoverBg.style.backgroundSize = 'cover';
            artistCoverBg.style.backgroundPosition = 'center';
            artistCoverBg.style.backgroundRepeat = 'no-repeat';
            artistCoverBg.style.backgroundColor = 'transparent';

            const tempImg = new Image();
            tempImg.crossOrigin = "Anonymous";
            tempImg.src = artistData.foto;

            // Assume que applyDominantColorToHeader e formatNumber estão definidos
            tempImg.onload = () => applyDominantColorToHeader(tempImg, mainHeader);
            tempImg.onerror = () => mainHeader.style.background = fallbackBackground;
        } else {
            mainHeader.style.background = fallbackBackground;
        }

        const totalStreams = await calculateTotalStreams(artistId); 

        // Atualiza a contagem de ouvintes/streams com o valor calculado
        if (artistListeners) {
            artistListeners.textContent = `${formatNumber(totalStreams)} ouvintes mensais`; 
        }

        // ----------------------------------------------------
        // ⭐ 2. BUSCA E RENDERIZAÇÃO DAS MÚSICAS POPULARES ⭐
        // ----------------------------------------------------
        const musicasRef = collection(db, "musicas");
        // Filtra pelo ID do artista e ordena por streams
        const q = query(
            musicasRef, 
            where("artist", "==", artistId), // Use o campo correto: artist
            orderBy("streams", "desc"), 
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        const topTracks = [];

        querySnapshot.forEach((doc) => {
            // Adiciona o nome do artista à faixa para uso no player
            const track = { id: doc.id, ...doc.data(), artistName: artistName };
            topTracks.push(track);
        });
        
        // Renderiza a seção "Populares"
        // Assume que renderTop5Tracks(tracks, containerId) está definido
        renderTop5Tracks(topTracks, "top-tracks-container"); 

        // 3. Carrega álbuns e estações
        // Assume que loadArtistAlbums e loadArtistStations estão definidas
        if (typeof loadArtistAlbums === 'function') {
            await loadArtistAlbums(artistId);
        }
        if (typeof loadArtistStations === 'function') {
            await loadArtistStations(artistId);
        }

    } catch (error) {
        console.error("Erro ao buscar o artista:", error);
        artistNameElement.textContent = "Erro ao Carregar Artista";
        if (mainHeader) mainHeader.style.background = fallbackBackground;
    }
}


async function fetchAndRenderTrendingSongs() {
    // Referências aos elementos HTML
    const containerId = 'trending-songs-list';
    const loadingMessageId = 'trending-songs-loading-message';
    const listContainer = document.getElementById(containerId);
    const loadingMessage = document.getElementById(loadingMessageId);

    if (!listContainer) {
        console.error(`CRÍTICO: Contêiner HTML com ID '${containerId}' não encontrado.`);
        if (loadingMessage) loadingMessage.style.display = 'none';
        return;
    }

    if (loadingMessage) loadingMessage.style.display = 'block';
    listContainer.innerHTML = `<p class="text-gray-400">A carregar músicas em alta...</p>`;

    try {
        const musicasRef = collection(db, "musicas");
        
        // 1. Busca das Músicas em Alta
        const q = query(
            musicasRef, 
            orderBy("streamsMensal", "desc"), 
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        
        const tracks = [];
        const artistUidsToFetch = new Set();
        
        // 2. Coletar UIDs e preparar a lista de tracks
        querySnapshot.forEach(docSnap => {
            const trackData = docSnap.data();
            const track = { 
                id: docSnap.id, 
                ...trackData, 
                cover: trackData.cover || trackData.albumCover 
            };
            
            if (track.artist && !track.artistName) {
                artistUidsToFetch.add(track.artist);
            }

            tracks.push(track);
        });
        
        // 3. Batch Fetch (Buscar Nomes de Artistas em paralelo)
        const artistNameMap = new Map();
        if (artistUidsToFetch.size > 0) {
            const artistPromises = Array.from(artistUidsToFetch).map(uid => 
                getDoc(doc(db, "usuarios", uid)) 
            );
            
            const artistSnapshots = await Promise.all(artistPromises);
            
            artistSnapshots.forEach(snap => {
                if (snap.exists()) {
                    const artistData = snap.data();
                    const name = artistData.nomeArtistico || artistData.apelido; 
                    artistNameMap.set(snap.id, name); 
                }
            });
        }

        // Limpar a mensagem de carregamento
        listContainer.innerHTML = ''; 

        // 4. Renderizar: Usar o nome resolvido
       if (tracks.length === 0) {
     listContainer.innerHTML = `<p class="text-gray-400">Nenhuma música em alta encontrada.</p>`;
} else {
    // 👇 MUDANÇA: Usamos o forEach com o índice para obter a posição
    tracks.forEach((track, index) => {
        const rank = index + 1; // Posição (1, 2, 3...)
        let finalArtistName = track.artistName;

        if (!finalArtistName && track.artist && artistNameMap.has(track.artist)) {
            finalArtistName = artistNameMap.get(track.artist);
        }

        const trackToRender = { 
            ...track, 
            artistName: finalArtistName || track.artist // Fallback para UID
        };
        
        // ⭐ MUDANÇA: Passando o 'rank' (posição) como terceiro argumento
        const card = createTrendingSongCard(trackToRender, trackToRender.id, rank); 
        listContainer.appendChild(card);
    });
}
    } catch (error) {
        console.error("ERRO GRAVE ao buscar Músicas em Alta no Firebase:", error);
        listContainer.innerHTML = `<p class="text-red-500">Erro ao carregar as músicas em alta. Verifique o console. (Erro: ${error.message})</p>`;
    } finally {
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

// -------------------------------------------------------------------------
// ## 📌 ROTEAMENTO E HISTÓRICO (SOLUÇÃO SPA)

/**
 * 1. Função Central de Navegação.
 * Realiza o roteamento, manipula o histórico e chama loadContent.
 *
 * @param {string} pageName - A página de destino ('home', 'album', etc.).
 * @param {string} id - O ID do item (opcional).
 * @param {boolean} updateHistory - Se deve adicionar um novo estado (true) ou apenas substituir (false).
 */
function navigateTo(pageName, id = null, updateHistory = true) {
    // A. CHAMA A FUNÇÃO DE RENDERIZAÇÃO
    // loadContent é chamada para carregar o HTML e fazer o setup da página.
    loadContent(pageName, id);
    
    // B. MANIPULA O HISTÓRICO
    const newUrl = id ? `menu.html?page=${pageName}&id=${id}` : `menu.html?page=${pageName}`;

    // O objeto { page: pageName, id: id } é o estado salvo para o botão 'Voltar'
    if (updateHistory) {
        // history.pushState: Usado ao clicar em um link (avança na história).
        history.pushState({ page: pageName, id: id }, '', newUrl);
    } else {
        // history.replaceState: Usado no carregamento inicial (para que o usuário possa voltar para o site anterior)
        // e no popstate (para não duplicar estados).
        history.replaceState({ page: pageName, id: id }, '', newUrl);
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
    } else {
        // Fallback: Se não houver estado (ex: primeira página do site), lê da URL e renderiza 'home'.
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page') || 'home';
        const id = urlParams.get('id');
        
        loadContent(page, id);
    }
});


/**
 * 3. Função de Inicialização.
 * Lida com a primeira carga da página e links compartilhados.
 */
function initializeRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') || 'home'; // Padrão: home
    const id = urlParams.get('id');
    
    // Chamamos navigateTo com updateHistory=false (replaceState) para o primeiro estado.
    navigateTo(page, id, false); 
}

// --- Função loadContent ---

async function loadContent(pageName, id = null) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    try {
        const filePath = `${pageName}.html`;
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Não foi possível carregar ${filePath}: ${response.statusText}`);
        
        const html = await response.text();
        contentArea.innerHTML = html;
        
        // Ajuste no newUrl para ser consistente (usando 'menu.html?page=...')
        const newUrl = id ? `menu.html?page=${pageName}&id=${id}` : `menu.html?page=${pageName}`;
        window.history.pushState({ page: pageName, id: id }, '', newUrl);

        // Garantimos que o DOM foi atualizado antes de chamar as funções de setup
        setTimeout(() => {
            if (pageName === 'album') {
                setupAlbumPage(id);
            } else if (pageName === 'home') { 
                setupHomePage();
            } else if (pageName === 'loginartists') {
                setupLoginartistsPage(id);
            } else if (pageName === 'artist') 
            { 
                setupArtistPage(id);
            } else if (pageName === 'search') {
                // Importação dinâmica para a página de busca
                import('./search.js').then(module => { 
                    module.setupSearchPage();
                }).catch(err => console.error("Erro ao importar search.js:", err));
            } else if (pageName === 'playlist') { 
                setupPlaylistPage(id);
            } else if (pageName === 'liked') { // ⬅️ NOVO: Chama a função de setup da página de curtidas
                setupLikedPage();
            } else if (pageName === 'library') { // ⬅️ NOVO: Chama a função de setup da página de curtidas
                setupLibraryPage();
            }
        }, 50);

    } catch (error) {
        console.error("Erro ao carregar conteúdo da página:", error);
        contentArea.innerHTML = `<p class="text-red-500 text-center">Erro ao carregar a página: ${pageName}.html</p>`;
    }
}

async function setupLibraryPage() {
    console.log("🔧 Carregando página Library...");

    // Exemplo: carregar o perfil do usuário
    if (auth.currentUser) {
        await populateUserProfile(auth.currentUser);
    }

}

// --- Lógica Principal da Página Home (setupHomePage) ---

// NOVO: Função para criar o card de um artista
function createArtistCard(docData, docId) {
    const card = document.createElement("div");
    // Increased width for better visibility and slightly better alignment with the screenshot's 'feel'
    card.className = "w-27 flex-shrink-0 text-center cursor-pointer hover:opacity-80 transition";

    const img = document.createElement("img");
    img.src = docData.foto || "/assets/default-artist.png";
    img.alt = docData.apelido || "Artista";
    
    // 🎨 CORRECTION/IMPROVEMENT: 
    // 1. Made the size explicit and square (e.g., w-24 h-24) to ensure proper circular cropping.
    // 2. Used 'rounded-full' for a perfect circle.
    // 3. Used 'object-cover' to ensure the image covers the area without distortion, cropping as needed.
    img.className = "w-24 h-24 rounded-full object-cover mx-auto mb-0";

     const nome = document.createElement("p");
    // 🎨 MUDANÇA 2: Aumentada a fonte de text-xs para text-sm.
      nome.className = "text-white text-xs font-bold truncate mt-3";  
    nome.innerText = docData.nomeArtistico || "Artista";

    card.appendChild(img);
    card.appendChild(nome);

    if (docId) {
        card.addEventListener("click", () => {
            loadContent('artist', docId);
        });
    }
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
    // Manteve o estilo de card original do usuário
    playlistCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
    playlistCard.addEventListener('click', () => {
        loadContent('playlist', playlistId);
    });

    // 💡 Adiciona o cálculo e formatação dos streams
    // (A função formatNumber deve estar definida no escopo global/do módulo)
    const formattedStreams = playlist.streams ? formatNumber(playlist.streams) : '0';

    playlistCard.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
            <img src="${playlist.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa'}" 
                alt="Capa da Playlist: ${playlist.name}" 
                class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${playlist.name}</h3>
            <p class="text-gray-400 text-xs truncate">${playlist.genres?.join(', ') || 'Playlist'}</p>
            
            
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

    listElement.innerHTML = ''; // Limpa o conteúdo existente
    
    items.forEach(item => {
        let card;
        
        // Chamada da função de criação baseada no tipo
        // Se for playlist, passa o item e o ID (que é item.id)
        if (type === 'playlist') {
            card = createPlaylistCard(item, item.id);
        } 
        // Se for álbum, passa o item e o ID
        else if (type === 'album') {
            // Assumindo que você tem uma função createAlbumCard(item, item.id)
            card = createAlbumCard(item, item.id);
        }
        // Se for artista, passa o item e o ID
        else if (type === 'artist') {
            // Assumindo que você tem uma função createArtistCard(item, item.id)
            card = createArtistCard(item, item.id);
        }

        if (card) {
            listElement.appendChild(card);
        }
    });
}

function createAlbumCard(album, albumId) {
    const albumCard = document.createElement('div');
    albumCard.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-[150px] mr-4';
    albumCard.addEventListener('click', () => {
        loadContent('album', albumId);
    });
    albumCard.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
            <img src="${album.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa'}" alt="Capa do Álbum: ${album.album}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block">
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${album.album}</h3>
            <p class="text-gray-400 text-xs truncate">${album.artist}</p>
            <div class="mt-1 text-gray-500 text-xs">
            </div>
        </div>
    `;
    return albumCard;
}




function setupContentCarousel(
  listId,
  leftBtnId,
  rightBtnId,
  loadingMsgId,
  collectionName,
  queryConfig,
  contentCallback
) {
  const listWrapper = document.getElementById(listId)?.parentElement;
  const listContainer = document.getElementById(listId);
  const loadingMessage = document.getElementById(loadingMsgId);
  const btnLeft = document.getElementById(leftBtnId);
  const btnRight = document.getElementById(rightBtnId);

  if (!listContainer || !listWrapper || !btnLeft || !btnRight) return;

  // Esconde as setas por padrão ao carregar a página
  btnLeft.classList.add('hidden');
  btnRight.classList.add('hidden');

  const q = query(collection(db, collectionName), ...queryConfig);
  onSnapshot(q, (querySnapshot) => {
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
    // A visibilidade inicial será controlada pelo mouse
  });

  function updateArrowVisibility() {
    const scrollLeft = listContainer.scrollLeft;
    const maxScrollLeft = listContainer.scrollWidth - listContainer.clientWidth;
    btnLeft.classList.toggle('hidden', scrollLeft <= 0);
    btnRight.classList.toggle('hidden', scrollLeft >= maxScrollLeft - 1);
  }

  // --- Lógica para mostrar/esconder as setas ao passar o mouse ---
  listWrapper.addEventListener('mouseenter', () => {
    // Quando o mouse entra, exibe as setas com base na posição do scroll
    updateArrowVisibility();
  });

  listWrapper.addEventListener('mouseleave', () => {
    // Quando o mouse sai, esconde as setas
    btnLeft.classList.add('hidden');
    btnRight.classList.add('hidden');
  });

  // Observa o scroll para atualizar a visibilidade enquanto o mouse estiver dentro
  listContainer.addEventListener('scroll', updateArrowVisibility);
  window.addEventListener('resize', updateArrowVisibility);

  // Botões de scroll agora usam o contêiner correto
  btnLeft.addEventListener('click', () =>
    listContainer.scrollBy({ left: -300, behavior: 'smooth' })
  );
  btnRight.addEventListener('click', () =>
    listContainer.scrollBy({ left: 300, behavior: 'smooth' })
  );

  // Drag para scroll
  let isDown = false;
  let startX;
  let scrollLeftStart;

  listContainer.addEventListener('mousedown', (e) => {
    isDown = true;
    listContainer.classList.add('cursor-grabbing');
    startX = e.pageX - listContainer.offsetLeft;
    scrollLeftStart = listContainer.scrollLeft;
  });

  listContainer.addEventListener('mouseleave', () => {
    isDown = false;
    listContainer.classList.remove('cursor-grabbing');
  });

  listContainer.addEventListener('mouseup', () => {
    isDown = false;
    listContainer.classList.remove('cursor-grabbing');
  });

  listContainer.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - listContainer.offsetLeft;
    const walk = (x - startX) * 1.5;
    listContainer.scrollLeft = scrollLeftStart - walk;
  });

  // Suporte para toque
  let touchStartX;
  listContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].pageX;
    scrollLeftStart = listContainer.scrollLeft;
  });

  listContainer.addEventListener('touchmove', (e) => {
    const touchX = e.touches[0].pageX;
    const walk = (touchX - touchStartX) * 1.5;
    listContainer.scrollLeft = scrollLeftStart - walk;
  });
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

// ... (seu código existente, incluindo setupLatinSection) ...

// ⭐ FUNÇÃO AJUSTADA: para buscar e renderizar a seção de um artista específico ⭐
async function setupArtistSection(artistUid) { // Removido artistName do parâmetro, buscaremos os dados do artista
    const listContainer = document.getElementById('taylor-swift-list');
    const loadingMessage = document.getElementById('taylor-swift-loading-message');
    const artistHeader = document.getElementById('taylor-swift-header');
    const artistHeaderImg = document.getElementById('taylor-swift-header-img');
    const artistHeaderName = document.getElementById('taylor-swift-header-name');

    if (!listContainer || !artistHeader || !artistHeaderImg || !artistHeaderName) {
        console.error("Elementos HTML da seção de artista não encontrados.");
        return;
    }

    if (loadingMessage) loadingMessage.style.display = 'block';
    
    let artistContent = [];
    let artistData = null; // Para guardar os dados do artista principal

    // Passo 1: Buscar os dados do perfil do artista para o cabeçalho
    try {
        const artistDocRef = doc(db, "usuarios", artistUid);
        const artistDocSnap = await getDoc(artistDocRef);
        if (artistDocSnap.exists()) {
            artistData = { id: artistDocSnap.id, ...artistDocSnap.data() };
            // ATUALIZA O CABEÇALHO DA SEÇÃO
            artistHeaderImg.src = artistData.foto || "/assets/default-artist.png";
            artistHeaderName.textContent = artistData.nomeArtistico || artistData.apelido || "Artista";
            
            // Adiciona evento de clique no cabeçalho
            artistHeader.addEventListener('click', () => {
                loadContent('artist', artistUid); // Supondo que 'artist' é a página do artista
            });

        } else {
            console.warn(`Artista com UID ${artistUid} não encontrado.`);
            artistHeaderName.textContent = "Artista Desconhecido";
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum conteúdo encontrado para este artista.</p>`;
            return; // Sai da função se o artista não for encontrado
        }
    } catch (error) {
        console.error("Erro ao buscar dados do artista:", error);
        artistHeaderName.textContent = "Erro ao carregar artista";
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Erro ao carregar conteúdo do artista.</p>`;
        return;
    }
    
    // Passo 2: Buscar Playlists (Stations) da artista
    try {
        const playlistsQuery = query(collection(db, "playlists"), where('uidars', '==', artistUid));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsSnapshot.forEach(doc => {
            const playlistData = doc.data();
            artistContent.push({ id: doc.id, type: 'playlist', name: playlistData.name, ...playlistData });
        });
    } catch (error) {
        console.error("Erro ao buscar stations da artista:", error);
    }

    // Passo 3: Buscar Álbuns da artista
    try {
        const albumsQuery = query(collection(db, "albuns"), where('uidars', '==', artistUid));
        const albumsSnapshot = await getDocs(albumsQuery);
        albumsSnapshot.forEach(doc => {
            const albumData = doc.data();
            artistContent.push({ id: doc.id, type: 'album', name: albumData.album, ...albumData });
        });
    } catch (error) {
        console.error("Erro ao buscar álbuns da artista:", error);
    }

    // Ordenar o restante do conteúdo por nome (de A a Z)
    artistContent.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    // Oculta a mensagem de carregamento
    if (loadingMessage) loadingMessage.style.display = 'none';

    // Limpa a lista existente antes de renderizar
    if (listContainer) listContainer.innerHTML = '';
    
    if (artistContent.length === 0) {
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum álbum ou playlist encontrado para ${artistData.nomeArtistico || artistData.apelido}.</p>`;
    } else {
        artistContent.forEach(item => {
            let card;
            if (item.type === 'album') {
                card = createAlbumCard(item, item.id);
            } else { // playlist ou station
                card = createPlaylistCard(item, item.id);
            }
            if (listContainer) listContainer.appendChild(card);
        });
    }

    // Adicione a lógica de scroll, drag e visibilidade das setas (a mesma que já temos)
    const listWrapper = listContainer?.parentElement;
    const btnLeft = document.getElementById('taylor-swift-scroll-left');
    const btnRight = document.getElementById('taylor-swift-scroll-right');
    
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

// ⭐ FUNÇÃO PARA ANITTA: idêntica à de Taylor Swift, mas com IDs da Anitta ⭐
async function setupAnittaSection(artistUid) {
    const listContainer = document.getElementById('anitta-list');
    const loadingMessage = document.getElementById('anitta-loading-message');
    const artistHeader = document.getElementById('anitta-header');
    const artistHeaderImg = document.getElementById('anitta-header-img');
    const artistHeaderName = document.getElementById('anitta-header-name');

    // Se um dos elementos não existir, a seção Anitta não será renderizada.
    if (!listContainer || !artistHeader || !artistHeaderImg || !artistHeaderName) {
        console.error("Elementos HTML da seção de Anitta não encontrados.");
        return;
    }

    if (loadingMessage) loadingMessage.style.display = 'block';
    
    let artistContent = [];
    let artistData = null;

    // Passo 1: Buscar os dados do perfil do artista para o cabeçalho
    try {
        const artistDocRef = doc(db, "usuarios", artistUid);
        const artistDocSnap = await getDoc(artistDocRef);
        if (artistDocSnap.exists()) {
            artistData = { id: artistDocSnap.id, ...artistDocSnap.data() };
            // ATUALIZA O CABEÇALHO DA SEÇÃO
            artistHeaderImg.src = artistData.foto || "/assets/default-artist.png";
            artistHeaderName.textContent = artistData.nomeArtistico || artistData.apelido || "Artista";
            
            // Adiciona evento de clique no cabeçalho
            artistHeader.addEventListener('click', () => {
                loadContent('artist', artistUid); // Supondo que 'artist' é a página do artista
            });

        } else {
            console.warn(`Artista com UID ${artistUid} não encontrado.`);
            artistHeaderName.textContent = "Artista Desconhecido";
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum conteúdo encontrado para este artista.</p>`;
            return;
        }
    } catch (error) {
        console.error("Erro ao buscar dados do artista Anitta:", error);
        artistHeaderName.textContent = "Erro ao carregar artista";
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Erro ao carregar conteúdo do artista.</p>`;
        return;
    }
    
    // Passo 2: Buscar Playlists (Stations) da artista
    try {
        const playlistsQuery = query(collection(db, "playlists"), where('uidars', '==', artistUid));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsSnapshot.forEach(doc => {
            const playlistData = doc.data();
            artistContent.push({ id: doc.id, type: 'playlist', name: playlistData.name, ...playlistData });
        });
    } catch (error) {
        console.error("Erro ao buscar stations da artista:", error);
    }

    // Passo 3: Buscar Álbuns da artista
    try {
        const albumsQuery = query(collection(db, "albuns"), where('uidars', '==', artistUid));
        const albumsSnapshot = await getDocs(albumsQuery);
        albumsSnapshot.forEach(doc => {
            const albumData = doc.data();
            artistContent.push({ id: doc.id, type: 'album', name: albumData.album, ...albumData });
        });
    } catch (error) {
        console.error("Erro ao buscar álbuns da artista:", error);
    }

    // Ordenar o restante do conteúdo por nome (de A a Z)
    artistContent.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    // Oculta a mensagem de carregamento
    if (loadingMessage) loadingMessage.style.display = 'none';

    // Limpa a lista existente antes de renderizar
    if (listContainer) listContainer.innerHTML = '';
    
    if (artistContent.length === 0) {
        if (listContainer) listContainer.innerHTML = `<p class="flex-shrink-0 text-gray-400">Nenhum álbum ou playlist encontrado para ${artistData.nomeArtistico || artistData.apelido}.</p>`;
    } else {
        artistContent.forEach(item => {
            let card;
            if (item.type === 'album') {
                // Supondo que você tem a função createAlbumCard
                card = createAlbumCard(item, item.id);
            } else { // playlist ou station
                // Supondo que você tem a função createPlaylistCard
                card = createPlaylistCard(item, item.id);
            }
            if (listContainer) listContainer.appendChild(card);
        });
    }
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
            <p class="card-subtitle-library" title="${subtitle}">${subtitle}</p>
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

/**
 * Define a saudação (Bom Dia, Boa Tarde, Boa Noite) com base na hora atual.
 */
function setGreeting() {
    const greetingElement = document.getElementById('greeting-title');
    if (!greetingElement) {
        console.warn("Elemento 'greeting-title' não encontrado.");
        return;
    }

    const now = new Date();
    const hour = now.getHours();
    let greetingText = '';

    if (hour >= 5 && hour < 12) {
        // 5:00 AM até 11:59 AM
        greetingText = 'Bom Dia';
    } else if (hour >= 12 && hour < 18) {
        // 12:00 PM até 5:59 PM
        greetingText = 'Boa Tarde';
    } else {
        // 6:00 PM até 4:59 AM
        greetingText = 'Boa Noite';
    }

    greetingElement.textContent = greetingText;
}


/**
 * Função principal para configurar a página inicial (home).
 * Esta função deve ser chamada quando a página "home" é carregada.
 */
function setupHomePage() {
    // Carrossel de Álbuns Recentes (Novidades)
    // Busca na coleção 'albuns' e ordena pela data de lançamento
    setupContentCarousel(
        'albums-list',
        'albums-scroll-left',
        'albums-scroll-right',
        'albums-loading-message',
        'albuns',
        [orderBy('date', 'desc')], // Verifique se o nome do campo é 'releaseDate'
        createAlbumCard
    );

    // Carrossel de Charts
    // Busca na coleção 'playlists' e filtra por categoria 'Charts'
    setupContentCarousel(
        'charts-list',
        'charts-scroll-left',
        'charts-scroll-right',
        'charts-loading-message',
        'playlists',
        [where('category', '==', 'Charts')],
        createPlaylistCard
    );

    // Carrossel de Artistas Populares
    // Busca na coleção 'usuarios' e filtra por 'artista' igual a 'true'
    setupContentCarousel(
        'artists-list',
        'artists-scroll-left',
        'artists-scroll-right',
        'artists-loading-message',
        'usuarios',
        [where("artista", "==", "true"), limit(undefined)],
        createArtistCard
    );

    // NOVO: Carrossel de playlists da categoria "Stations"
    setupContentCarousel(
        'stations-list',
        'stations-scroll-left',
        'stations-scroll-right',
        'stations-loading-message',
        'playlists',
        [where('category', '==', 'Stations')], // Filtra por category 'Stations'
        createPlaylistCard
    );

    // Estas chamadas duplicadas foram removidas/comentadas para clareza
    // setupContentCarousel( /* ... albums */ );
    // setupContentCarousel( /* ... stations */ );
    // setupContentCarousel( /* ... charts */ );
    // setupContentCarousel( /* ... artists */ );


    // Chame a nova função que renderiza a seção de Pop unificada
    setupPopSection();
    // setupPopSection(); // Chamada duplicada removida
    setupLatinSection();
    
    // ⭐ CORREÇÃO AQUI: A função setupArtistSection só espera 1 argumento (artistUid)
    setupArtistSection('lFxIUcsTaiaQYfirY9Jp78hFqyM2'); 
    fetchAndRenderTrendingSongs();
    loadTopStreamedPlaylists();
    setupAnittaSection("79ToiOtXJlZR5KxuvpTKNWaggoz1");
    loadMyLikedItems();
    checkAuthAndLoadLikedItems();
    loadSertanejoSection();
    setGreeting();
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

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const fotoUrlInput = document.getElementById('fotoUrl');
    const previewFoto = document.getElementById('previewFoto');

    fotoUrlInput.addEventListener('input', (event) => {
        const url = event.target.value;
        if (url && url.startsWith('http')) {
            previewFoto.src = url;
        } else {
            previewFoto.src = 'assets/artistpfp.png';
        }

    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        if (senha !== confirmarSenha) {
            alert('As senhas não coincidem. Por favor, verifique.');
            return;
        }

        const nome = document.getElementById('nome').value;
        const user = document.getElementById('user').value;
        const email = document.getElementById('email').value;
        const gravadora = document.getElementById('gravadora').value;
        const bio = document.getElementById('bio').value;
        const foto_url = fotoUrlInput.value || 'assets/artistpfp.png';
        const tipo = 'artista';

        const novoArtista = {
            nome_artistico: nome,
            nome_usuario: user,
            email: email,
            gravadora: gravadora,
            senha: senha,
            bio: bio,
            foto_url: foto_url,
            tipo: tipo,
            data_cadastro: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const userDocRef = db.collection('artistas').doc(user);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                alert('Este nome de usuário já está em uso. Por favor, escolha outro.');
                return;
            }

            await userDocRef.set(novoArtista);

            alert('Conta de artista criada com sucesso!');
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Erro ao criar a conta:', error);
            alert(`Ocorreu um erro: ${error.message}`);
        }
    });
});

function getArtistIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadArtistData(artistId) {
  if (!artistId) {
    document.getElementById('artist-name').textContent = "ID do Artista Ausente";
    return;
  }

  try {
    const artistRef = doc(db, "usuarios", artistId);
    const artistSnap = await getDoc(artistRef);

    if (!artistSnap.exists() || artistSnap.data().artista !== "true") {
      document.getElementById('artist-name').textContent = "Artista Não Encontrado";
      return;
    }

    const artistData = artistSnap.data();

    document.getElementById('artist-name').textContent = artistData.apelido || "Nome Desconhecido";
    document.getElementById('artist-listeners').textContent = `${new Intl.NumberFormat('pt-BR').format(artistData.ouvintesMensais || 0)} ouvintes mensais`;

    // Define imagem de fundo
    const artistCoverBg = document.getElementById('artist-cover-bg');
    if (artistData.foto) {
      artistCoverBg.style.backgroundImage = `url('${artistData.foto}')`;
      artistCoverBg.style.backgroundSize = 'cover';
      artistCoverBg.style.backgroundPosition = 'center';
      artistCoverBg.style.backgroundRepeat = 'no-repeat';
    }

    // Carrega os álbuns do artista
    await loadArtistAlbums(artistId);

  } catch (error) {
    console.error("Erro ao carregar dados do artista:", error);
    document.getElementById('artist-name').textContent = "Erro ao carregar artista";
  }
}

async function loadArtistAlbums(artistId) {
  const albumsContainer = document.getElementById('albums-container');
  albumsContainer.innerHTML = ''; // limpa container

  const title = document.createElement('h2');
  title.textContent = 'Álbuns';
  title.className = 'text-2xl font-bold mb-4 mt-8';
  albumsContainer.appendChild(title);

  try {
    const q = query(collection(db, 'albuns'), where('uidars', '==', artistId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-gray-400';
      emptyMsg.textContent = 'Nenhum álbum encontrado para este artista.';
      albumsContainer.appendChild(emptyMsg);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';
    albumsContainer.appendChild(grid);

    querySnapshot.forEach(doc => {
      const album = doc.data();

      const card = document.createElement('div');
      card.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-full';

      card.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
          <img src="${album.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa'}" alt="Capa do Álbum: ${album.album}" class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block" />
        </div>
        <div class="mt-2 w-full">
          <h3 class="text-sm font-semibold text-white truncate">${album.album}</h3>
          <p class="text-gray-400 text-xs truncate">${album.artist}</p>
          <div class="mt-1 text-gray-500 text-xs">
            <span>${album.date ? album.date.split('-')[0] : ''}</span> &bull;
            <span>Álbum</span>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

  } catch (error) {
    console.error('Erro ao carregar álbuns do artista:', error);
    const errorMsg = document.createElement('p');
    errorMsg.className = 'text-red-500';
    errorMsg.textContent = 'Erro ao carregar os álbuns.';
    albumsContainer.appendChild(errorMsg);
  }
}

async function loadArtistStations(artistId) {
  if (!artistId) {
    console.warn("artistId vazio");
    return;
  }

  const stationsContainer = document.getElementById('stations-container');
  if (!stationsContainer) {
    console.error("Elemento #stations-container não encontrado");
    return;
  }

  stationsContainer.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Estações';
  title.className = 'text-2xl font-bold mb-4 mt-8';
  stationsContainer.appendChild(title);

  try {
    console.log("Buscando estações com uidars =", artistId);

    const q = query(
      collection(db, 'playlists'),
      where('category', '==', 'Stations'),
      where('uidars', '==', artistId)
    );

    const querySnapshot = await getDocs(q);
    console.log("Estações encontradas:", querySnapshot.size);

    if (querySnapshot.empty) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-gray-400';
      emptyMsg.textContent = 'Nenhuma estação encontrada para este artista.';
      stationsContainer.appendChild(emptyMsg);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';
    stationsContainer.appendChild(grid);

    querySnapshot.forEach(doc => {
      const station = doc.data();
      console.log("Estação:", station.name);

      const card = document.createElement('div');
      card.className = 'cursor-pointer flex flex-col items-start text-left flex-shrink-0 w-full';

      card.innerHTML = `
        <div class="relative w-full pb-[100%] rounded-md">
          <img src="${station.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa'}"
               alt="Capa da Estação: ${station.name}"
               class="absolute top-0 left-0 w-full h-full object-cover rounded-md shadow-lg block" />
        </div>
        <div class="mt-2 w-full">
          <h3 class="text-sm font-semibold text-white truncate">${station.name}</h3>
          <p class="text-gray-400 text-xs truncate">Estação</p>
          <div class="mt-1 text-gray-500 text-xs">
            <span>${station.genres?.join(', ') || ''}</span>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar estações:", error);
    const errorMsg = document.createElement('p');
    errorMsg.className = 'text-red-500';
    errorMsg.textContent = 'Erro ao carregar estações.';
    stationsContainer.appendChild(errorMsg);
  }
}

// album.js
function playTrack(track) {
    // Salva a música no localStorage
    localStorage.setItem("currentTrack", JSON.stringify(track));
    // Redireciona para a página do player
    window.location.href = "menu.html";
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTrack = JSON.parse(localStorage.getItem('currentTrack'));
    if(savedTrack) {
        playTrackGlobal(savedTrack);
    }
});


function playTrackGlobal(track) {
    const playerAudio = document.getElementById("player-audio");
    const playerCover = document.getElementById("player-cover");
    const playerTitle = document.getElementById("player-title");
    const playerArtist = document.getElementById("player-artist");

    playerAudio.src = track.audioUrl;
    playerCover.src = track.cover;
    playerTitle.textContent = track.title;
    playerArtist.textContent = track.artist;
    playerAudio.play();
}

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

document.addEventListener('DOMContentLoaded', () => {
    // Sua função para carregar as músicas em alta
    // ⭐ AGORA VAI FUNCIONAR POIS A FUNÇÃO FOI DEFINIDA ACIMA! ⭐
    fetchAndRenderTrendingSongs(); 
    
    // Suas outras chamadas de inicialização (se houver, como setupListeners, etc.)
});
