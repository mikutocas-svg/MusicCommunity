import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === ここを自分のConfigに書き換え！ ==
const firebaseConfig = {
  apiKey: "AIzaSyC7eeZNhk68XrK9WgdaoMrR3J63aJXsTvw",
  authDomain: "oncommu-bc186.firebaseapp.com",
  projectId: "oncommu-bc186",
  storageBucket: "oncommu-bc186.firebasestorage.app",
  messagingSenderId: "448010255366",
  appId: "1:448010255366:web:9e77f50eeaef8c577cd787"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;
let currentCategory = "ラウンジ";

// 登録
async function handleSignUp() {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    if(!id || pass.length < 8) return alert("IDと8文字以上のパスワードが必要です");
    try {
        const idRef = doc(db, "usernames", id);
        const idSnap = await getDoc(idRef);
        if(idSnap.exists()) return alert("そのIDは使われています");
        const cred = await createUserWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
        await setDoc(doc(db, "users", cred.user.uid), { userId: id });
        await setDoc(idRef, { uid: cred.user.uid });
        alert("登録成功！そのままログインされます");
    } catch(e) { alert("エラー: " + e.message); }
}

// ログイン
async function handleLogin() {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
    } catch(e) { alert("ログイン失敗。IDかパスワードを確認してね"); }
}

// 投稿
async function postMessage() {
    const text = document.getElementById('messageInput').value.trim();
    if(!text) return;
    await addDoc(collection(db, "posts"), {
        text, category: currentCategory, userId: currentUserData.userId, uid: auth.currentUser.uid, createdAt: serverTimestamp()
    });
    document.getElementById('messageInput').value = "";
}

// 読み込み
function loadPosts() {
    const q = query(collection(db, "posts"), where("category", "==", currentCategory), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('postContainer');
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl shadow-sm border mb-4 animate-fade-in";
            div.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="font-bold text-blue-600 text-xs">@${p.userId}</span>
                ${p.uid === auth.currentUser.uid ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-gray-300 text-[10px]">削除</button>` : ''}</div>
                <p class="text-gray-800 text-sm">${p.text}</p>`;
            container.appendChild(div);
        });
    });
}

// イベント登録
document.getElementById('signUpBtn').addEventListener('click', handleSignUp);
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('sendBtn').addEventListener('click', postMessage);
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('toProfile').addEventListener('click', () => document.getElementById('profilePage').classList.remove('hidden'));
document.getElementById('backToHome').addEventListener('click', () => document.getElementById('profilePage').classList.add('hidden'));

window.deletePost = async (id) => { if(confirm("消す？")) await deleteDoc(doc(db, "posts", id)); };

// カテゴリ切替
['lounge', 'consult', 'band'].forEach(id => {
    document.getElementById(`cat-${id}`).onclick = function() {
        currentCategory = this.innerText;
        document.getElementById('currentCategoryTitle').innerText = currentCategory;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600'));
        this.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        loadPosts();
    };
});

// ログイン監視
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        document.getElementById('profileName').innerText = currentUserData.userId;
        loadPosts();
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
    }
});
