import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
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
const tokenInput = document.getElementById('token'); // input para código
const tokenFeedback = document.getElementById('token-feedback');
const profileFrame = document.querySelector('.profile-frame');
const profileIcon = document.querySelector('.profile-icon');
const usernameStatusIcon = document.getElementById('username-status-icon');

// Função para verificar o status de manutenção
async function verificarManutencao() {
    // Referência ao documento de status no Firestore
    const docRef = doc(db, "config", "status");
    try {
        const docSnap = await getDoc(docRef);
        
        // Verifica se o documento existe e se a chave 'manutencao' é true
        if (docSnap.exists() && docSnap.data().manutencao) {
            // Redireciona para a página de manutenção
            window.location.href = "man";
        }
    } catch (e) {
        console.error("Erro ao verificar status de manutenção: ", e);
    }
}

// Executa a função imediatamente
verificarManutencao();

// Variáveis globais
let profileFile = null;
let currentFileInput = null;
let isUsernameAvailable = false;
let debounceTimeout;
let isTokenValid = false;



const imageInput = document.getElementById('profile-image-input');
const imageViewer = document.getElementById('profile-preview');

imageInput.addEventListener('change', e => {
  if (!e.target.files || e.target.files.length === 0) return;

  profileFile = e.target.files[0]; // ← usa a variável global
  const reader = new FileReader();

  reader.onload = () => {
    imageViewer.src = reader.result; // atualiza a imagem
  };

  reader.readAsDataURL(profileFile);
});


// --- Toast ---
function showToast(message, type) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// --- Validação de username ---
userInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    isUsernameAvailable = false;

    // Remove status anterior e esconde o ícone
    usernameStatusIcon.classList.remove('success', 'error', 'visible');

    let username = userInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    userInput.value = username;

    if (!username) return;

    // Username muito curto
    if (username.length < 3) {
         usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
        usernameStatusIcon.classList.remove('success');
        usernameStatusIcon.classList.add('error', 'visible');
        return;
    }

// Debounce para evitar muitas requisições ao Firestore
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
}, 500);
}); // ✅ FECHA O EVENT LISTENER


// --- Validação de token ---
async function validarTokenCode(tokenCode) {
    const q = query(collection(db, "tokens"), where("tokenCode", "==", tokenCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return false;

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    if (data.used || Date.now() > data.expiresAt) return false;

    return { id: docSnap.id, ...data };
}

// --- Submit do formulário ---
const termosCheckbox = document.getElementById('termos-uso');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!termosCheckbox.checked) {
        showToast("Você precisa aceitar os Termos de Uso e a Licença.", "error");
        return;
    }

    const tokenCode = tokenInput.value.trim();
    if (!tokenCode) {
        showToast("Insira o código de verificação.", "error");
        return;
    }

    const tokenDoc = await validarTokenCode(tokenCode);
    if (!tokenDoc) {
        showToast("Código de verificação inválido.", "error");
        return;
    }

    const nome = document.getElementById('nome').value.trim();
    const user = userInput.value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!nome || !user || !email || !senha) {
        showToast("Preencha todos os campos.", "error");
        return;
    }

    if (!isUsernameAvailable) {
        showToast("Nome de usuário não disponível.", "error");
        return;
    }

    if (!profileFile) {
        showToast("Adicione uma foto de perfil.", "error");
        return;
    }

    // Bloquear botão para evitar múltiplos cliques
    submitBtn.disabled = true;
    submitBtn.innerText = "Criando...";

    try {
        // Criar usuário (Loga o usuário automaticamente se for sucesso)
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // Upload da foto (AGORA FUNCIONA, pois o usuário está logado e a regra 'fotos_perfil' existe)
        const storageRef = ref(storage, `fotos_perfil/${userUid}/${profileFile.name}`);
        await uploadBytes(storageRef, profileFile);
        const photoURL = await getDownloadURL(storageRef);

        // Salvar nome de usuário
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });

        // Salvar dados do usuário
        await setDoc(doc(db, "usuarios", userUid), {
            email,
            apelido: user,
            nomeArtistico: nome,
            artista: "true",
            admin: 0,
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

        // Marcar token como usado
        await setDoc(doc(db, "tokens", tokenDoc.id), { used: true }, { merge: true });

        showToast("Conta criada com sucesso!", "success");
        setTimeout(() => window.location.href = "index.html", 4000);

    } catch (err) {
        console.error(err);
        let userMessage = 'Erro desconhecido. Tente novamente.';

        // 🎯 Lógica para Erros Personalizados 🎯

        // Erros de Autenticação (auth/)
        if (err.code && err.code.startsWith('auth/')) {
             if (err.code === 'auth/email-already-in-use') {
                 userMessage = 'O e-mail já está em uso por outro usuário.';
             } else if (err.code === 'auth/weak-password') {
                 userMessage = 'A senha deve ter pelo menos 6 caracteres.';
             } else {
                 userMessage = 'Erro no registro. Verifique seu e-mail e senha.';
             }
        // Erros de Storage (storage/)
        } else if (err.code && err.code.startsWith('storage/')) {
            // Este erro (unauthorized) ocorre se a regra de segurança não for atendida (ex: foto muito grande)
            userMessage = 'Erro no Upload da Foto. Verifique o tamanho do arquivo ou tente outra imagem.';
        // Outros erros
        } else {
            userMessage = `Erro: ${err.message}`; 
        }
        
        showToast(userMessage, "error");

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Criar";
        profileFile = null;
        if (currentFileInput) {
            currentFileInput.remove();
            currentFileInput = null;
        }
    }
});

const submitBtn = document.getElementById('submitBtn');
const nomeInput = document.getElementById('nome');
const userInputField = document.getElementById('user');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');

// Função que checa se o formulário está pronto para envio
function checkFormReady() {
    const nome = nomeInput.value.trim();
    const user = userInputField.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();
    const token = tokenInput.value.trim();

    // Condição: todos os campos preenchidos, foto enviada e token preenchido
    if (nome && user && email && senha && profileFile && token) {
        submitBtn.style.opacity = "1";
        submitBtn.style.pointerEvents = "auto";
    } else {
        submitBtn.style.opacity = "0.5";
        submitBtn.style.pointerEvents = "none";
    }
}

// Eventos de input para atualizar dinamicamente
[nomeInput, userInputField, emailInput, senhaInput, tokenInput].forEach(input => {
    input.addEventListener('input', checkFormReady);
});

// Caso queira atualizar quando a foto for selecionada
const profileInput = document.getElementById('profile-image-input');
profileInput.addEventListener('change', (e) => {
    profileFile = e.target.files[0] || null;
    checkFormReady();
});

// Inicializa estado do botão
checkFormReady();
