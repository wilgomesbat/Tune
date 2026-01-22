import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

// Inicializa serviços
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Elementos do DOM
const registerForm = document.getElementById('registerForm');
const userInput = document.getElementById('user');
const usernameStatusIcon = document.getElementById('username-status-icon');
const submitBtn = document.getElementById('submitBtn');
const nomeInput = document.getElementById('nome');
const userInputField = document.getElementById('user');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const imageInput = document.getElementById('profile-image-input');
const imageViewer = document.getElementById('profile-preview');
const termosCheckbox = document.getElementById('termos-uso');
const artistToggleButton = document.getElementById('artist-toggle-btn'); 


// Variáveis globais
let profileFile = null;
let isUsernameAvailable = false;
let debounceTimeout;
let isArtistSelected = false; // Deve começar como false (alpha 1.0)
// ----------------------------------------------------------------------
// FUNÇÕES DE UTILIDADE E INICIALIZAÇÃO (Manutencao e Toast)
// ----------------------------------------------------------------------

async function verificarManutencao() {
    const docRef = doc(db, "config", "status");
    try {
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().manutencao) {
            window.location.href = "man";
        }
    } catch (e) {
        console.error("Erro ao verificar status de manutenção: ", e);
    }
}
verificarManutencao();

function showToast(message, type = "error") {
    const toastContainer = document.getElementById('toast-container');
    const targetContainer = toastContainer || document.body;
    
    const toast = document.createElement('div');
    
    const baseClass = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 text-white px-4 py-2 rounded shadow-lg text-sm z-50 transition-opacity duration-300';
    const typeClass = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    toast.className = `${baseClass} ${typeClass}`;
    toast.textContent = message;
    targetContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}



// ----------------------------------------------------------------------
// EVENTOS DE UPLOAD DE FOTO
// ----------------------------------------------------------------------

imageInput.addEventListener('change', e => {
  if (!e.target.files || e.target.files.length === 0) return;

  profileFile = e.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    imageViewer.src = reader.result;
    checkFormReady();
  };

  reader.readAsDataURL(profileFile);
});

// ----------------------------------------------------------------------
// EVENTOS DE VALIDAÇÃO (Username)
// ----------------------------------------------------------------------

userInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    isUsernameAvailable = false;

    usernameStatusIcon.classList.remove('success', 'error', 'visible');

    let username = userInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    userInput.value = username;

    if (!username) {
        checkFormReady();
        return;
    }

    if (username.length < 3) {
        usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
        usernameStatusIcon.classList.remove('success');
        usernameStatusIcon.classList.add('error', 'visible');
        checkFormReady();
        return;
    }

debounceTimeout = setTimeout(async () => {
    try {
        const usernameDocRef = doc(db, "nomes", username);
        const docSnap = await getDoc(usernameDocRef);
        
        if (docSnap.exists()) {
            usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
            usernameStatusIcon.classList.remove('success');
            usernameStatusIcon.classList.add('error', 'visible');
            isUsernameAvailable = false;
        } else {
            usernameStatusIcon.src = "assets/check_circle_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
            usernameStatusIcon.classList.remove('error');
            usernameStatusIcon.classList.add('success', 'visible');
            isUsernameAvailable = true;
        }
    } catch (err) {
        console.error(err);
        usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
        usernameStatusIcon.classList.remove('success');
        usernameStatusIcon.classList.add('error', 'visible');
        isUsernameAvailable = false;
    }
    checkFormReady();
}, 500);
});

// ----------------------------------------------------------------------
// SUBMIT DO FORMULÁRIO (REGISTRO)
// ----------------------------------------------------------------------

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

   

    const nome = nomeInput.value.trim();
    const user = userInputField.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value;
    


    if (!nome || !user || !email || !senha) {
        showToast("Preencha todos os campos.");
        return;
    }

    if (!isUsernameAvailable) {
        showToast("Nome de usuário não disponível.");
        return;
    }

    if (!profileFile) {
        showToast("Adicione uma foto de perfil.");
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerText = "Criando...";

    try {
        // 2. Criar usuário no Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // 3. Upload da foto
        const storageRef = ref(storage, `fotos_perfil/${userUid}/${profileFile.name}`);
        await uploadBytes(storageRef, profileFile);
        const photoURL = await getDownloadURL(storageRef);

        // 4. Salvar nome de usuário (para checagem de disponibilidade)
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });
        
        // 5. Salvar dados do usuário na coleção 'usuarios'
        await setDoc(doc(db, "usuarios", userUid), {
            email,
            apelido: user,
            nomeArtistico: nome,
            artista: "true", 
            admin: "false",
            verificado: "false",
            niveladmin: 0,
            seguidores: 0,
            banido: "false",
            instagram: "",
            twitter: "",
            youtube: "",
            streams: 0,
            status: "ativo",
            foto: photoURL,
            criadoEm: new Date().toLocaleString('pt-BR'),
            uid: userUid
        });

        showToast("Conta criada com sucesso!", "success");
        setTimeout(() => window.location.href = "index.html", 4000);

    } catch (err) {
        console.error(err);
        let userMessage = 'Erro desconhecido. Tente novamente.';

        if (err.code && err.code.startsWith('auth/')) {
            if (err.code === 'auth/email-already-in-use') {
                userMessage = 'O e-mail já está em uso por outro usuário.';
            } else if (err.code === 'auth/weak-password') {
                userMessage = 'A senha deve ter pelo menos 6 caracteres.';
            } else {
                userMessage = 'Erro no registro. Verifique seu e-mail e senha.';
            }
        } else if (err.code && err.code.startsWith('storage/')) {
            userMessage = 'Erro no Upload da Foto. Verifique o tamanho do arquivo.';
        } else {
            userMessage = `Erro: ${err.message}`; 
        }
        
        showToast(userMessage);

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Criar";
    }
});

// ----------------------------------------------------------------------
// LÓGICA DO BOTÃO DINÂMICO
// ----------------------------------------------------------------------

function checkFormReady() {
    const nome = nomeInput.value.trim();
    const user = userInputField.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();


    if (nome && user && email && senha && profileFile && isUsernameAvailable) {
        submitBtn.style.opacity = "1";
        submitBtn.style.pointerEvents = "auto";
    } else {
        submitBtn.style.opacity = "0.5";
        submitBtn.style.pointerEvents = "none";
    }
}

// Eventos de input para atualizar dinamicamente o estado do botão
[nomeInput, userInputField, emailInput, senhaInput, termosCheckbox].forEach(input => {
    input.addEventListener('input', checkFormReady);
    if (input.type === 'checkbox') {
        input.addEventListener('change', checkFormReady);
    }
});

checkFormReady();