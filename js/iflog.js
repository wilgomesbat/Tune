import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",

    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const LOGIN_URL = "index.html";
const db = getFirestore(app);
const auth = getAuth(app);

// --- Elementos do DOM ---

const searchInput = document.getElementById('searchInput');
const searchResultsDropdown = document.getElementById('searchResultsDropdown');
const defaultSections = document.getElementById('defaultSections');
const searchPageResults = document.getElementById('searchPageResults');

const userProfileContainer = document.getElementById('user_profile_sidebar');
const guestProfileContainer = document.getElementById('guest_profile_sidebar');
const userProfileImg = document.getElementById('user-profile-img');
const userProfileButton = document.getElementById('user-profile-button');
const profileDropdown = document.getElementById('user-dropdown-menu');
const userDisplayName = document.getElementById('user-display-name');
const logoutLink = document.getElementById('logout-link');
const artistLink = document.getElementById('artist-link');
const artistLinkIcon = document.getElementById('artist-link-icon');
const artistLinkText = document.getElementById('artist-link-text');
const loginButton = document.getElementById('login-button');
const tuneteamItem = document.getElementById('tuneteam-item'); // O <li> do link do TuneTeam

// --- Função para buscar e renderizar o perfil do usuário ---
async function fetchAndRenderUserProfile(user) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userDocRef);

        const userData = docSnap.exists() ? docSnap.data() : {};

        // --- Lógica para o link 'Suporte' / 'Painel Artist' ---
        if (artistLink && artistLinkIcon && artistLinkText) {
            if (userData.artista === "true") {
                artistLink.href = "tuneartists.html";
                artistLinkText.textContent = "Painel";
                artistLinkIcon.classList.add('hidden');
            } else {
                artistLink.href = "#";
                artistLinkText.textContent = "Suporte";
                artistLinkIcon.classList.remove('hidden');
            }
        }

        // --- Lógica para o Link do Tuneteam (Admin) ---
        // Verifica se o niveladmin é o número 1
        if (tuneteamItem) {
            // Compara diretamente com o número 1
            if (userData.niveladmin === 1) {
                tuneteamItem.classList.remove('hidden'); // Mostra se for admin
            } else {
                tuneteamItem.classList.add('hidden'); // Esconde se não for
            }
        }
        
        // --- Atualiza a imagem de perfil ---
        if (userProfileImg) {
            userProfileImg.src = userData.foto || user.photoURL || './assets/artistpfp.png';
            userProfileImg.alt = userData.apelido || user.displayName || 'Foto do Usuário';
        }


        // --- Alterna a visibilidade dos containers de perfil ---
        if (userProfileContainer) userProfileContainer.classList.remove('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.add('hidden');

    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        if (userProfileImg) userProfileImg.src = './assets/artistpfp.png';
        if (userProfileContainer) userProfileContainer.classList.add('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.remove('hidden');
    }
}

// --- Autenticação ---
onAuthStateChanged(auth, user => {
    if (user) {
        fetchAndRenderUserProfile(user);
    } else {
        if (userProfileContainer) userProfileContainer.classList.add('hidden');
        if (guestProfileContainer) guestProfileContainer.classList.remove('hidden');
        // Oculta o link do Tuneteam se o usuário não estiver logado
        if (tuneteamItem) {
            tuneteamItem.classList.add('hidden');
        }
    }
});

// --- Lógica do Dropdown do Perfil do Usuário ---
if (userProfileButton && profileDropdown) {
    userProfileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', (event) => {
        if (!userProfileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}

// --- Lógica de Logout ---
if (logoutLink) {
    logoutLink.addEventListener('click', e => {
        e.preventDefault();
        signOut(auth)
            .then(() => {
                window.location.href = LOGIN_URL;
            })
            .catch(err => console.error("Erro no logout:", err));
    });
}

// --- Lógica do Botão "Entrar" ---
if (loginButton) {
    loginButton.addEventListener('click', () => {
        window.location.href = LOGIN_URL;
    });
}

let debounceTimeout;

searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length > 0) {
            performSearch(query);
            defaultSections.classList.add('hidden');
        } else {
            searchResultsDropdown.classList.add('hidden');
            defaultSections.classList.remove('hidden');
        }
    }, 300);
});

async function performSearch(q) {
    let results = {
        albums: [],
        playlists: [],
        artists: []
    };

    try {
        // Busca de álbuns
        const albumRef = collection(db, `/artifacts/${__app_id}/public/data/albums`);
        const albumQuery = query(albumRef, where('album', '>=', q), where('album', '<=', q + '\uf8ff'));
        const albumSnapshot = await getDocs(albumQuery);
        albumSnapshot.forEach(doc => results.albums.push(doc.data()));

        // Busca de artistas
        const usersRef = collection(db, `/artifacts/${__app_id}/public/data/usuarios`);
        const artistQuery = query(usersRef, where('artista', '==', 'true'), where('nomeArtistico', '>=', q), where('nomeArtistico', '<=', q + '\uf8ff'));
        const artistSnapshot = await getDocs(artistQuery);
        artistSnapshot.forEach(doc => results.artists.push(doc.data()));

        // Busca de playlists
        const playlistsRef = collection(db, `/artifacts/${__app_id}/public/data/playlists`);
        const playlistQuery = query(playlistsRef, where('name', '>=', q), where('name', '<=', q + '\uf8ff'));
        const playlistSnapshot = await getDocs(playlistQuery);
        playlistSnapshot.forEach(doc => results.playlists.push(doc.data()));

        displayResults(results);

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        searchResultsDropdown.innerHTML = '<p class="p-4 text-red-500">Erro ao buscar. Tente novamente.</p>';
        searchResultsDropdown.classList.remove('hidden');
    }
}

function displayResults(results) {
    let html = '';

    if (results.albums.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Álbuns</h3>';
        results.albums.forEach(album => {
            html += `<a href="#" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                        <img src="${album.cover}" alt="${album.album}" class="w-12 h-12 rounded-full mr-3">
                        <div>
                            <p class="font-semibold text-white">${album.album}</p>
                            <p class="text-gray-400 text-sm">${album.artist}</p>
                        </div>
                    </a>`;
        });
    }

    if (results.artists.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Artistas</h3>';
        results.artists.forEach(artist => {
            html += `<a href="#" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                        <img src="${artist.profilePicture}" alt="${artist.nomeArtistico}" class="w-12 h-12 rounded-full mr-3">
                        <div>
                            <p class="font-semibold text-white">${artist.nomeArtistico}</p>
                            <p class="text-gray-400 text-sm">Artista</p>
                        </div>
                    </a>`;
        });
    }

    if (results.playlists.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Playlists</h3>';
        results.playlists.forEach(playlist => {
            html += `<a href="#" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                        <img src="${playlist.cover}" alt="${playlist.name}" class="w-12 h-12 rounded-lg mr-3">
                        <div>
                            <p class="font-semibold text-white">${playlist.name}</p>
                            <p class="text-gray-400 text-sm">Playlist</p>
                        </div>
                    </a>`;
        });
    }

    if (html === '') {
        html = '<p class="p-4 text-gray-400">Nenhum resultado encontrado.</p>';
    }

    searchResultsDropdown.innerHTML = html;
    searchResultsDropdown.classList.remove('hidden');
}