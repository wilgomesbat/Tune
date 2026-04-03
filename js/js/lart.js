import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const artistLoginForm = document.getElementById('artistLoginForm');

// Checa se o usuário já está logado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Se houver um usuário logado, verifica se ele é um artista
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.artista === "true") {
                // Redireciona para a página de artistas se ele já estiver logado
                window.location.href = "tuneartists.html";
            }
        }
    }
});

artistLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = artistLoginForm['email'].value;
    const password = artistLoginForm['password'].value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Após o login, verifica se este usuário é um artista
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.artista === "true") {
                // Redireciona para a página de artistas
                window.location.href = "tuneartists.html";
            } else {
                // Se não for artista, desloga e mostra um erro
                await auth.signOut();
                alert("Acesso negado. Esta página é exclusiva para artistas.");
            }
        } else {
            // Se o documento não existir, desloga e mostra um erro
            await auth.signOut();
            alert("Acesso negado. Usuário não encontrado ou não é um artista.");
        }
    } catch (error) {
        let errorMessage = "Erro ao fazer login. Verifique seu e-mail e senha.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Verifique seu e-mail.";
        }
        alert(errorMessage);
        console.error("Erro de login:", error);
    }
});