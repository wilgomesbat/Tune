import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// --- Configuração ---
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

// --- Referências do DOM ---
const userProfileImg = document.getElementById('user-profile-img');
const userDisplayName = document.getElementById('user-display-name');
const editModal = document.getElementById('editModal');
const btnEditar = document.getElementById('btnEditar');
const btnCancelar = document.getElementById('btnCancelar');
const btnSalvar = document.getElementById('btnSalvar');
const fileInput = document.getElementById('fileInput');
const editNameInput = document.getElementById('editNameInput');
const dynamicBg = document.getElementById('dynamic-bg');

// --- 1. Função de Toast ---
function showToast(message) {
    let toast = document.createElement("div");
    toast.innerText = message;
    toast.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-2xl text-sm z-[100] transition-all duration-300 ease-out font-bold uppercase tracking-wider";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("opacity-0");
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- 2. Função de Gradiente Dinâmico com Fade-in ---
function updateDynamicGradient() {
    const colorThief = new ColorThief();
    
    // Se a imagem já carregou
    if (userProfileImg.complete && userProfileImg.naturalWidth !== 0) {
        try {
            const color = colorThief.getColor(userProfileImg);
            const rgbColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            
            // 1. Aplica a nova cor ao gradiente
            dynamicBg.style.background = `linear-gradient(to bottom, #000000 0%, #000000 35%, ${rgbColor} 100%)`;
            
            // 2. Dispara o Fade-in adicionando a classe após um pequeno delay
            setTimeout(() => {
                dynamicBg.classList.add('bg-visible');
            }, 100);

        } catch (e) {
            console.error("Erro ao extrair cor:", e);
            // Se houver erro (ex: CORS), mantém o fundo preto
            dynamicBg.style.background = "#000000";
            dynamicBg.classList.add('bg-visible');
        }
    } else {
        // Se a imagem ainda está baixando, espera o evento 'load'
        userProfileImg.addEventListener('load', function() {
            updateDynamicGradient();
        }, { once: true });
    }
}

// --- 3. Controle do Modal ---
btnEditar?.addEventListener('click', () => editModal.classList.remove('hidden'));
btnCancelar?.addEventListener('click', () => editModal.classList.add('hidden'));

// --- 4. Lógica de Salvar (Upload + Firestore) ---
btnSalvar?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    btnSalvar.disabled = true;
    btnSalvar.textContent = "PROCESSANDO...";

    try {
        let finalFotoUrl = userProfileImg.src;

        // Upload de Imagem se houver arquivo selecionado
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            // Caminho configurado conforme suas regras de segurança
            const storageRef = ref(storage, `fotos_perfil/${user.uid}/pfp_${Date.now()}`);
            
            const snapshot = await uploadBytes(storageRef, file);
            finalFotoUrl = await getDownloadURL(snapshot.ref);
        }

        // Atualização no Firestore
        const novoNome = editNameInput.value.trim();
        await updateDoc(doc(db, "usuarios", user.uid), {
            apelido: novoNome,
            foto: finalFotoUrl
        });

        // Atualiza UI local
        userDisplayName.textContent = novoNome;
        userProfileImg.src = finalFotoUrl;
        
        // Atualiza o gradiente com a nova foto
        updateDynamicGradient();

        editModal.classList.add('hidden');
        showToast("PERFIL ATUALIZADO!");

    } catch (error) {
        console.error("Erro ao salvar:", error);
        showToast("ERRO AO SALVAR ALTERAÇÕES.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "SALVAR";
    }
});

// --- 5. Monitor de Autenticação ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Preenche os dados
                userDisplayName.textContent = data.apelido || "USUÁRIO";
                editNameInput.value = data.apelido || "";
                
                if (data.foto) {
                    userProfileImg.src = data.foto;
                    // Dispara o gradiente após a imagem carregar
                    updateDynamicGradient();
                }
            }
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
        }
    } else {
        // Redireciona se não estiver logado
        window.location.href = "login.html";
    }
});