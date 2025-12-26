import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// === 自分のFirebase設定をここに貼り付け ===
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
const storage = getStorage(app);

let currentCategory = "ラウンジ";
let currentUserData = null;

// --- 認証機能 ---
const signUp = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    if(!id || pass.length < 8) return alert("IDと8文字以上のパスワードが必要です");
    
    const idRef = doc(db, "usernames", id);
    const idSnap = await getDoc(idRef);
    if(idSnap.exists()) return alert("そのIDは使用されています");

    try {
        const fakeEmail = `${id}@otocommu.internal`;
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
        await setDoc(doc(db, "users", cred.user.uid), { userId: id, createdAt: serverTimestamp() });
        await setDoc(idRef, { uid: cred.user.uid });
        alert("登録成功！");
    } catch(e) { alert("登録エラー: " + e.message); }
};

const login = async () => {
    const id = document.getElementById('authId').value.trim();
    const pass = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, `${id}@otocommu.internal`, pass);
    } catch(e) { alert("ログイン失敗。IDかパスワードを確認してください"); }
};

// --- 投稿機能 ---
const postMessage = async () => {
    const text = document.getElementById('messageInput').value.trim();
    const file = document.getElementById('fileInput').files[0];
    if(!text && !file) return;

    let fileUrl = null;
    let fileType = null;
    if(file) {
        const sRef = ref(storage, `posts/${Date.now()}_${file.name}`);
        await uploadBytes(sRef, file);
        fileUrl = await getDownloadURL(sRef);
        fileType = file.type.startsWith('image') ? 'image' : 'video';
    }

    await addDoc(collection(db, "posts"), {
        text, fileUrl, fileType,
        category: currentCategory,
        userId: currentUserData.userId,
        uid: auth.currentUser.uid,
        likes: [],
        createdAt: serverTimestamp()
    });
    document.getElementById('messageInput').value = "";
    document.getElementById('fileInput').value = "";
};

// --- 表示処理 ---
function loadPosts() {
    const q = query(collection(db, "posts"), where("category", "==", currentCategory), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('postContainer');
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl shadow-sm border mb-4";
            div.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-blue-600 text-sm">@${p.userId}</span>
                    ${p.uid === auth.currentUser.uid ? `<button onclick="this.dataset.id='${docSnap.id}'; deletePost(this.dataset.id)" class="text-gray-300 text-xs">削除</button>` : ''}
                </div>
                <p class="text-gray-800">${p.text}</p>
                ${p.fileUrl ? (p.fileType === 'image' ? `<img src="${p.fileUrl}" class="rounded-xl mt-2 w-full">` : `<video src="${p.fileUrl}" controls class="rounded-xl mt-2 w-full"></video>`) : ''}
                <div class="mt-3"><button class="text-xs text-pink-500 font-bold">❤️ ${p.likes?.length || 0}</button></div>
            `;
            container.appendChild(div);
        });
    });
}

// --- イベントリスナー登録 ---
document.getElementById('signUpBtn').addEventListener('click', signUp);
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('sendBtn').addEventListener('click', postMessage);
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('toProfile').addEventListener('click', () => document.getElementById('profilePage').classList.remove('hidden'));
document.getElementById('backToHome').addEventListener('click', () => document.getElementById('profilePage').classList.add('hidden'));

// 削除機能用（windowに登録）
window.deletePost = async (id) => { if(confirm("削除しますか？")) await deleteDoc(doc(db, "posts", id)); };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        document.getElementById('profileName').innerText = currentUserData.userId;
        document.getElementById('profileId').innerText = "@" + currentUserData.userId;
        loadPosts();
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
    }
});
