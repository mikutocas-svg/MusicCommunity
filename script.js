import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === Firebase Configをここに貼り付け ===
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentCategory = "ラウンジ";
let currentUserData = null;

// 新規登録
const signUp = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    if(!id || pass.length < 8) return alert("IDと8文字以上のパスワードを入れてね");

    try {
        const idRef = doc(db, "usernames", id);
        const idSnap = await getDoc(idRef);
        if(idSnap.exists()) return alert("そのIDは使われてるよ");

        const cred = await createUserWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
        await setDoc(doc(db, "users", cred.user.uid), { userId: id });
        await setDoc(idRef, { uid: cred.user.uid });
        alert("登録できたよ！");
    } catch(e) { alert("エラー: " + e.message); }
};

// ログイン
const login = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
    } catch(e) { alert("ログイン失敗。IDかパスワードが違うかも"); }
};

// 投稿
const postMessage = async () => {
    const text = document.getElementById('messageInput').value.trim();
    if(!text) return;
    await addDoc(collection(db, "posts"), {
        text,
        category: currentCategory,
        userId: currentUserData.userId,
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp()
    });
    document.getElementById('messageInput').value = "";
};

// 表示
function loadPosts() {
    const q = query(collection(db, "posts"), where("category", "==", currentCategory), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('postContainer');
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl shadow-sm border";
            div.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-blue-600 text-xs">@${p.userId}</span>
                    ${p.uid === auth.currentUser.uid ? `<button onclick="deletePost('${docSnap.id}')" class="text-gray-300 text-[10px]">削除</button>` : ''}
                </div>
                <p class="text-gray-800">${p.text}</p>
            `;
            container.appendChild(div);
        });
    });
}

// ボタン設定
document.getElementById('signUpBtn').onclick = signUp;
document.getElementById('loginBtn').onclick = login;
document.getElementById('sendBtn').onclick = postMessage;
document.getElementById('logoutBtn').onclick = () => signOut(auth);
document.getElementById('toProfile').onclick = () => document.getElementById('profilePage').style.display = 'block';
document.getElementById('backToHome').onclick = () => document.getElementById('profilePage').style.display = 'none';

window.deletePost = async (id) => { if(confirm("消す？")) await deleteDoc(doc(db, "posts", id)); };

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
