// 1. Import do player (mantenha como está)
import { loadTrack } from './player.js'; 

// 2. Importe apenas as FUNÇÕES que você vai usar do Firebase (sem inicializar nada aqui)
import { 
    getFirestore, serverTimestamp, deleteDoc, collection, addDoc, query, 
    onSnapshot, orderBy, doc, getDoc, updateDoc, increment, setDoc, limit, where, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 3. IMPORTANTE: Importe as INSTÂNCIAS do seu novo arquivo de configuração
// Isso garante que todo o site use a mesma conexão
import { db, auth } from './firebase-config.js';
