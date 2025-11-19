import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Sua configuração do Firebase
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

document.addEventListener('DOMContentLoaded', async () => {
    const scrollArea = document.getElementById('artists-scroll-area');

    async function loadArtists() {
        try {
            const q = query(collection(db, "usuarios"), where("artista", "==", "true"));
            const querySnapshot = await getDocs(q);

            const artists = [];
            querySnapshot.forEach((doc) => {
                artists.push(doc.data());
            });

            if (artists.length === 0) {
                console.warn('Nenhum artista encontrado no Firestore.');
                return;
            }

            // Renderiza os artistas na área de rolagem
            function renderArtists(artistsArray) {
                artistsArray.forEach(data => {
                    const artistItem = document.createElement('div');
                    artistItem.className = 'artist-item';
                    
                    const imageWrapper = document.createElement('div');
                    imageWrapper.className = 'artist-image-wrapper';
                    
                    const image = document.createElement('img');
                    image.className = 'artist-image';
                    image.src = data.foto;
                    image.alt = data.nomeArtistico;
                    image.loading = 'lazy';
                    
                    const name = document.createElement('p');
                    name.className = 'artist-name';
                    name.textContent = data.nomeArtistico;
                    
                    imageWrapper.appendChild(image);
                    artistItem.appendChild(imageWrapper);
                    artistItem.appendChild(name);
                    scrollArea.appendChild(artistItem);
                });
            }

            // Renderiza os artistas duas vezes para criar o loop contínuo da animação
            renderArtists(artists);
            renderArtists(artists);
            
        } catch (error) {
            console.error("Erro ao carregar artistas do Firestore: ", error);
        }
    }

    // Inicia o carregamento dos artistas
    loadArtists();
});