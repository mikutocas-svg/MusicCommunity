import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === 1. ここに自分のConfigを必ず貼り付ける！ ===
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;
let currentCategory = "ラウンジ";

// === 2. 新規登録ロジック ===
const handleSignUp = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;

    if (!id) return alert("ユーザーIDを入力してください");
    if (pass.length < 8) return alert("パスワードは8文字以上で入力してください");

    try {
        // ID被りチェック
        const idRef = doc(db, "usernames", id);
        const idSnap = await getDoc(idRef);
        if (idSnap.exists()) return alert("そのIDは既に使用されています");

        // 登録実行 (IDを内部用メールに変換)
        const fakeEmail = `${id}@otocommu.internal`;
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
        
        // ユーザー情報を保存
        await setDoc(doc(db, "users", cred.user.uid), { userId: id, createdAt: serverTimestamp() });
        await setDoc(idRef, { uid: cred.user.uid });
        
        alert("登録成功しました！");
    } catch (e) {
        console.error(e);
        alert("登録エラー: " + e.message);
    }
};

// === 3. ログインロジック ===
const handleLogin = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    if (!id || !pass) return alert("IDとパスワードを入力してください");

    try {
        await signInWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
    } catch (e) {
        alert("ログイン失敗。IDまたはパスワードが違います");
    }
};

// === 4. 投稿・表示系ロジック ===
const postMessage = async () => {
    const text = document.getElementById('messageInput').value.trim();
    if (!text) return;
    try {
        await addDoc(collection(db, "posts"), {
            text,
            category: currentCategory,
            userId: currentUserData.userId,
            uid: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });
        document.getElementById('messageInput').value = "";
    } catch (e) { alert("投稿失敗: " + e.message); }
};

const loadPosts = () => {
    const q = query(collection(db, "posts"), where("category", "==", currentCategory), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('postContainer');
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl shadow-sm border mb-4";
            div.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-blue-600 text-xs">@${p.userId}</span>
                    ${p.uid === auth.currentUser.uid ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-gray-300 text-[10px]">削除</button>` : ''}
                </div>
                <p class="text-gray-800">${p.text}</p>
            `;
            container.appendChild(div);
        });
    });
};

// === 5. ボタンの紐付け (EventListener) ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('signUpBtn').addEventListener('click', handleSignUp);
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('sendBtn').addEventListener('click', postMessage);
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    
    // カテゴリ切替
    const cats = ['lounge', 'consult', 'band'];
    cats.forEach(c => {
        const btn = document.getElementById(`cat-${c}`);
        if(btn) btn.onclick = () => {
            currentCategory = btn.innerText;
            loadPosts();
        };
    });
});

// グローバル関数（HTMLから呼ぶ用）
window.deletePost = async (id) => { if(confirm("削除しますか？")) await deleteDoc(doc(db, "posts", id)); };

// ログイン状態監視
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        document.getElementById('profileName').innerText = currentUserData.userId;
        loadPosts();
    } else {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('appScreen').classList.add('hidden');
    }
});
