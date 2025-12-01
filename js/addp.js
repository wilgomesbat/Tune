// tt.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
  authDomain: "tune-8cafb.firebaseapp.com",
  projectId: "tune-8cafb",
  storageBucket: "tune-8cafb.firebasestorage.app",
  messagingSenderId: "599729070480",
  appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Esperar o DOM carregar
window.addEventListener('DOMContentLoaded', () => {
    // Referencia o novo formulário de playlist
    const form = document.getElementById("playlistForm");

    // --- Lógica para Adicionar Playlist (do formulário) ---
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const playlistData = {
                name: form.playlistName?.value || '',
                cover: form.playlistCover?.value || '',
                category: form.category?.value || '',
                genres: form.genres?.value.split(',').map(g => g.trim()) || []
            };

            try {
                // Adiciona os dados à coleção "playlists"
                await addDoc(collection(db, "playlists"), playlistData);
                console.log("Playlist enviada com sucesso para o Firestore!");

                const messageDiv = document.createElement('div');
                messageDiv.textContent = "Playlist enviada com sucesso!";
                messageDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #4CAF50;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    z-index: 1000;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    font-family: 'Inter', sans-serif;
                    font-size: 16px;
                    opacity: 0;
                    transition: opacity 0.5s ease-in-out;
                `;
                document.body.appendChild(messageDiv);
                void messageDiv.offsetWidth;
                messageDiv.style.opacity = 1;

                setTimeout(() => {
                    messageDiv.style.opacity = 0;
                    messageDiv.addEventListener('transitionend', () => messageDiv.remove(), { once: true });
                }, 3000);

                form.reset();
            } catch (error) {
                console.error("Erro ao enviar para o Firestore:", error);

                const errorDiv = document.createElement('div');
                errorDiv.textContent = `Erro ao enviar playlist: ${error.message || 'Verifique o console para detalhes.'}`;
                errorDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #f44336;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    z-index: 1000;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    font-family: 'Inter', sans-serif;
                    font-size: 16px;
                    opacity: 0;
                    transition: opacity 0.5s ease-in-out;
                `;
                document.body.appendChild(errorDiv);
                void errorDiv.offsetWidth;
                errorDiv.style.opacity = 1;

                setTimeout(() => {
                    errorDiv.style.opacity = 0;
                    errorDiv.addEventListener('transitionend', () => errorDiv.remove(), { once: true });
                }, 5000);
            }
        });
    } else {
        console.warn("Formulário com ID 'playlistForm' não encontrado. A funcionalidade de adicionar playlist não estará disponível.");
    }

    // --- Outros scripts da sua página, se existirem ---
    
    // Eable Disable Script
    function enabledisable(element) {
        console.log(element.style)
        if (element.style.fill != "rgb(29, 185, 84)") {
            element.style.setProperty('fill', '#1db954');
        } else {
            element.style.setProperty('fill', '#fff');
        }
    }

    // Greetings Script
    const greeting = document.getElementById("greeting");
    const hour = new Date().getHours();
    const welcomeTypes = ["Bom dia", "Boa tarde", "Boa noite"];
    let welcomeText = "";

    if (hour < 12) welcomeText = welcomeTypes[0];
    else if (hour < 18) welcomeText = welcomeTypes[1];
    else welcomeText = welcomeTypes[2];

    if (greeting) {
        greeting.innerHTML = welcomeText;
    }

    // Scrolling nav bar code
    const nav = document.querySelector("#topNav");
    const sectionOne = document.querySelector(".fw-bold");
    const sectionOneOptions = {};
    if (nav && sectionOne) {
        const sectionOneObserver = new IntersectionObserver(function(entries, sectionOneObserver) {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    nav.style.backgroundColor = "black";
                } else {
                    nav.style.backgroundColor = "transparent";
                }
            });
        }, sectionOneOptions);
        sectionOneObserver.observe(sectionOne);
    }
});
    document.addEventListener('DOMContentLoaded', function() {
        const languageButton = document.getElementById('language-toggle');
        const languageText = document.getElementById('language-text');
        
        languageButton.addEventListener('click', function() {
            if (languageText.textContent.includes('Português')) {
                languageText.textContent = 'English';
            } else {
                languageText.textContent = 'Português (Brasil)';
            }
        });
    });