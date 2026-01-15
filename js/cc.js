import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');
const nomeInput = document.getElementById('nome');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const termosCheckbox = document.getElementById('termos-uso');

// --- VERIFICAÇÃO DE MANUTENÇÃO ---
async function verificarManutencao() {
    const docRef = doc(db, "config", "status");
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().manutencao) {
            window.location.href = "man";
        }
    } catch (e) { console.error(e); }
}
verificarManutencao();

// --- FUNÇÃO TOAST ---
function showToast(message, type = "error") {
    const targetContainer = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : 'error'}`;
    toast.textContent = message;
    targetContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// --- SUBMIT COM TRATAMENTO DE ERROS FIREBASE ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!termosCheckbox.checked) {
        showToast("Você precisa aceitar os Termos de Uso.");
        return;
    }

    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    submitBtn.disabled = true;
    submitBtn.innerText = "Criando...";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        await setDoc(doc(db, "usuarios", userUid), {
            email: email,
            apelido: nome.toLowerCase().replace(/\s+/g, ''),
            nomeArtistico: nome,
            artista: "false",
            admin: "false",
            verificado: "false",
            niveladmin: 0,
            seguidores: 0,
            banido: "false",
            instagram: "", twitter: "", youtube: "",
            streams: 0,
            status: "ativo",
            foto: "", 
            criadoEm: new Date().toLocaleString('pt-BR'),
            uid: userUid
        });

        showToast("Conta criada com sucesso!", "success");
        setTimeout(() => window.location.href = "index.html", 3000);

    } catch (err) {
        console.error("Erro Original:", err.code); // Log para debug
        
        let mensagemErro = "Ocorreu um erro ao criar a conta.";

        // Mapeamento de erros comuns do Firebase
        switch (err.code) {
            case 'auth/weak-password':
                mensagemErro = "A senha deve ter pelo menos 6 caracteres.";
                break;
            case 'auth/email-already-in-use':
                mensagemErro = "Este e-mail já está sendo usado por outra conta.";
                break;
            case 'auth/invalid-email':
                mensagemErro = "O endereço de e-mail não é válido.";
                break;
            case 'auth/operation-not-allowed':
                mensagemErro = "O cadastro de e-mail/senha não está habilitado.";
                break;
            default:
                mensagemErro = err.message; // Exibe a mensagem padrão do Firebase se não for mapeada
        }

        showToast(mensagemErro, "error");
        submitBtn.disabled = false;
        submitBtn.innerText = "Criar";
    }
});

// --- VALIDAÇÃO DO BOTÃO ---
function checkFormReady() {
    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();
    const termosAceitos = termosCheckbox.checked;

    if (nome && email && senha && termosAceitos) {
        submitBtn.style.opacity = "1";
        submitBtn.style.pointerEvents = "auto";
    } else {
        submitBtn.style.opacity = "0.5";
        submitBtn.style.pointerEvents = "none";
    }
}

[nomeInput, emailInput, senhaInput].forEach(input => {
    input.addEventListener('input', checkFormReady);
});
termosCheckbox.addEventListener('change', checkFormReady);

checkFormReady();