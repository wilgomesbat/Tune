import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { db } from './firebase-config.js';

export function setupSearchPage() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsDropdown = document.getElementById('searchResultsDropdown');
    const defaultSections = document.getElementById('defaultSections');

    if (!searchInput || !searchResultsDropdown) return;

    let debounceTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        const queryText = searchInput.value.trim();

        // Verificação de Segurança: 4 caracteres
        if (queryText.length >= 4) {
            debounceTimeout = setTimeout(() => {
                performSearch(queryText, searchResultsDropdown);
                if (defaultSections) defaultSections.classList.add('hidden');
            }, 400); 
        } else {
            searchResultsDropdown.classList.add('hidden');
            searchResultsDropdown.innerHTML = ''; 
            if (defaultSections) defaultSections.classList.remove('hidden');
        }
    });
}

async function performSearch(queryText, container) {
    const q = queryText.toLowerCase();
    const results = { songs: [], artists: [], albums: [], playlists: [] };

    try {
        const [musicasSnap, usuariosSnap, albunsSnap, playlistsSnap] = await Promise.all([
            getDocs(collection(db, 'musicas')),
            getDocs(collection(db, 'usuarios')),
            getDocs(collection(db, 'albuns')),
            getDocs(collection(db, 'playlists'))
        ]);

        // FILTRO DE MÚSICAS (Ajustado para os campos: title e artistName)
        musicasSnap.forEach(doc => {
            const data = doc.data();
            const titulo = data.title || data.titulo || "";
            const artista = data.artistName || data.artista || "";
            
            if (titulo.toLowerCase().includes(q) || artista.toLowerCase().includes(q)) {
                results.songs.push({ id: doc.id, ...data });
            }
        });

        // FILTRO DE PLAYLISTS
        playlistsSnap.forEach(doc => {
            const data = doc.data();
            const nomePl = data.name || data.nome || "";
            if (nomePl.toLowerCase().includes(q)) {
                results.playlists.push({ id: doc.id, ...data });
            }
        });

        // FILTRO DE ARTISTAS
        usuariosSnap.forEach(doc => {
            const data = doc.data();
            const nomeArt = data.nomeArtistico || data.apelido || "";
            if (data.artista === "true" && nomeArt.toLowerCase().includes(q)) {
                results.artists.push({ id: doc.id, ...data });
            }
        });

        // FILTRO DE ÁLBUNS
        albunsSnap.forEach(doc => {
            const data = doc.data();
            const nomeAlb = data.album || data.nome || "";
            if (nomeAlb.toLowerCase().includes(q)) {
                results.albums.push({ id: doc.id, ...data });
            }
        });

        renderResults(results, container);

    } catch (error) {
        console.error("Erro na busca Tune:", error);
    }
}

function renderResults(results, container) {
    let html = '<div class="search-results-list">';
    const total = results.songs.length + results.artists.length + results.albums.length + results.playlists.length;

    if (total === 0) {
        container.innerHTML = '<p style="padding: 20px; color: #b3b3b3;">Nenhum resultado encontrado.</p>';
        return;
    }

    // 1. Músicas (Usando title e artistName)
    results.songs.forEach(song => {
        const isExplicit = song.explicit === true;
        html += `
            <div class="search-item" onclick="if(window.playSong) playSong('${song.id}')">
                <img src="${song.cover || 'default-cover.png'}" class="img-song">
                <div class="info">
                    <p class="title">${song.title || song.titulo}</p>
                    <p class="subtitle">
                        ${isExplicit ? '<span class="badge-e">E</span>' : ''} 
                         ${song.artistName || 'Artista'}
                    </p>
                </div>
            </div>`;
    });

    // 2. Artistas
    results.artists.forEach(artist => {
        html += `
            <div class="search-item" onclick="window.location.href='menu.html?page=artist&id=${artist.id}'">
                <img src="${artist.foto || 'default-avatar.png'}" class="img-artist">
                <div class="info">
                    <p class="title">${artist.nomeArtistico || artist.apelido}</p>
                    <p class="subtitle">Artista</p>
                </div>
            </div>`;
    });

    // 3. Playlists e Álbuns
    [...results.playlists, ...results.albums].forEach(item => {
        const isAlbum = item.album !== undefined;
        html += `
            <div class="search-item" onclick="window.location.href='menu.html?page=${isAlbum ? 'album' : 'playlist'}&id=${item.id}'">
                <img src="${item.cover || item.capa || item.image || 'default-cover.png'}" class="img-song">
                <div class="info">
                    <p class="title">${item.name || item.nome || item.album}</p>
                    <p class="subtitle">${isAlbum ? 'Álbum' : 'Playlist'} de ${item.artistName || item.owner || 'Tune'}</p>
                </div>
            </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    container.classList.remove('hidden');
}