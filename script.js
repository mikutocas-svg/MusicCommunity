import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment, getDoc, setDoc, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7eeZNhk68XrK9WgdaoMrR3J63aJXsTvw",
  authDomain: "oncommu-bc186.firebaseapp.com",
  projectId: "oncommu-bc186",
  storageBucket: "oncommu-bc186.firebasestorage.app",
  messagingSenderId: "448010255366",
  appId: "1:448010255366:web:9e77f50eeaef8c577cd787"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ユーザーデータ（アイコン画像URLを保持可能に）
let user = JSON.parse(localStorage.getItem('OtoUser')) || { id: "u"+Date.now(), name: "", icon: "", likedIds: [], following: [] };
let currentCategory = 'home', currentThreadId = null, currentDmUserId = null, selectedImgBase64 = null;
const likeSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');

window.onload = () => {
    if (!user.name) document.getElementById('setup-view').classList.remove('hidden');
    else initApp();
    document.getElementById('btn-register').onclick = register;
    document.getElementById('btn-send').onclick = handleSend;
    document.getElementById('btn-create-thread').onclick = createThread;
};

// --- 初期化 & 同期 ---
async function register() {
    const name = document.getElementById('user-name-input').value.trim();
    if (!name) return;
    user.name = name;
    await saveUserToFireStore();
    localStorage.setItem('OtoUser', JSON.stringify(user));
    document.getElementById('setup-view').classList.add('hidden');
    initApp();
}

async function saveUserToFireStore() {
    await setDoc(doc(db, "users", user.id), { name: user.name, id: user.id, icon: user.icon || "", following: user.following || [] }, { merge: true });
}

function initApp() {
    updateHeaderIcon();
    document.getElementById('display-user-name').innerText = user.name;
    syncLounge();
    syncThreads();
    saveUserToFireStore();
}

function updateHeaderIcon() {
    const area = document.getElementById('header-icon-area');
    const content = user.icon ? `<img src="${user.icon}" class="w-full h-full object-cover">` : `<span class="text-xs font-bold text-white">${user.name.substring(0,2)}</span>`;
    area.innerHTML = `<div onclick="window.openMyPage()" class="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-white shadow-md cursor-pointer overflow-hidden">${content}</div>`;
}

// --- 画像プレビュー機能 ---
window.previewImage = (input) => {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImgBase64 = e.target.result;
            document.getElementById('img-preview').src = selectedImgBase64;
            document.getElementById('img-preview-area').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};

window.clearImage = () => {
    selectedImgBase64 = null;
    document.getElementById('img-input').value = "";
    document.getElementById('img-preview-area').classList.add('hidden');
};

// --- 送信機能（画像対応） ---
async function handleSend() {
    const input = document.getElementById('main-input');
    const text = input.value.trim();
    if (!text && !selectedImgBase64) return;

    const msg = {
        userId: user.id, userName: user.name, userIcon: user.icon || "",
        text: text, image: selectedImgBase64 || null,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        timestamp: Date.now(), likes: 0
    };

    try {
        if (currentCategory === 'dm' && currentDmUserId) {
            const chatId = [user.id, currentDmUserId].sort().join('_');
            await addDoc(collection(db, "dms", chatId, "messages"), msg);
        } else if (currentCategory === 'lounge') {
            await addDoc(collection(db, "lounge"), msg);
        } else if (currentThreadId) {
            await addDoc(collection(db, currentCategory, currentThreadId, "messages"), msg);
        }
        input.value = "";
        window.clearImage();
    } catch (e) { alert("送信失敗"); }
}

// --- 削除機能 ---
window.deletePost = async (col, id, subId = null) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
        if (subId) await deleteDoc(doc(db, col, id, "messages", subId));
        else await deleteDoc(doc(db, col, id));
    } catch (e) { alert("削除失敗"); }
};

// --- ラウンジ同期 ---
function syncLounge() {
    const q = query(collection(db, "lounge"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        if(currentCategory !== 'lounge' && currentCategory !== 'home') return;
        document.getElementById('lounge-view').innerHTML = snapshot.docs.map(doc => {
            const m = doc.data();
            const isLiked = user.likedIds.includes(doc.id);
            const isMe = m.userId === user.id;
            const userIcon = m.userIcon ? `<img src="${m.userIcon}" class="w-full h-full object-cover">` : `<span class="text-[8px] font-bold text-indigo-600">${m.userName.substring(0,2)}</span>`;
            return `
            <div class="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center overflow-hidden">${userIcon}</div>
                        <p class="text-xs font-black text-gray-700">@${m.userName}</p>
                    </div>
                    <div class="flex gap-2">
                        ${isMe ? `<button onclick="window.deletePost('lounge','${doc.id}')" class="text-gray-300 text-xs">🗑️</button>` : ''}
                        ${!isMe ? `<button onclick="window.toggleFollow('${m.userId}')" class="text-[10px] px-3 py-1 rounded-full border ${(user.following||[]).includes(m.userId) ? 'bg-gray-100 text-gray-400' : 'text-indigo-600 border-indigo-600'}">＋フォロー</button>` : ''}
                    </div>
                </div>
                ${m.text ? `<p class="text-sm leading-relaxed mb-2">${m.text}</p>` : ''}
                ${m.image ? `<img src="${m.image}" class="post-img shadow-sm border">` : ''}
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                    <span class="text-[10px] text-gray-400">${m.time}</span>
                    <button onclick="window.toggleLike('lounge','${doc.id}')" class="text-sm ${isLiked ? 'text-pink-500' : 'text-gray-300'}">❤️ ${m.likes || 0}</button>
                </div>
            </div>`;
        }).join('');
    });
}

// --- マイページ機能（アイコン変更追加） ---
window.openMyPage = async () => {
    currentCategory = 'mypage';
    const views = ['home-view', 'lounge-view', 'thread-list-view', 'chat-view', 'user-list-view', 'bottom-input-area', 'fab'];
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById('app-view').classList.remove('hidden');
    document.getElementById('mypage-view').classList.remove('hidden');
    document.getElementById('page-title').innerText = "マイページ";

    const fCount = user.following ? user.following.length : 0;
    const qF = query(collection(db, "users"), where("following", "array-contains", user.id));
    const rF = await getDocs(qF);

    document.getElementById('mypage-header').innerHTML = `
        <div class="flex flex-col items-center text-center gap-4">
            <div class="relative group">
                <div class="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                    ${user.icon ? `<img src="${user.icon}" class="w-full h-full object-cover">` : `<span class="text-2xl font-bold text-indigo-700">${user.name.substring(0,2)}</span>`}
                </div>
                <label class="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg cursor-pointer">
                    <span class="text-xs">📸</span>
                    <input type="file" class="hidden" onchange="window.changeProfileIcon(this)">
                </label>
            </div>
            <div>
                <h2 class="text-2xl font-black">${user.name}</h2>
                <div class="flex gap-4 mt-4">
                    <div onclick="window.showUserList('following')" class="cursor-pointer font-bold"><p class="text-indigo-600">${fCount}</p><p class="text-[10px] text-gray-400">フォロー中</p></div>
                    <div onclick="window.showUserList('followers')" class="cursor-pointer font-bold"><p class="text-pink-600">${rF.size}</p><p class="text-[10px] text-gray-400">フォロワー</p></div>
                </div>
            </div>
        </div>
    `;
    window.loadMyActivity('posts');
};

window.changeProfileIcon = (input) => {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            user.icon = e.target.result;
            localStorage.setItem('OtoUser', JSON.stringify(user));
            await saveUserToFireStore();
            location.reload();
        };
        reader.readAsDataURL(file);
    }
};

// --- その他共通機能 ---
window.toggleLike = async (c, id) => {
    const dr = doc(db, c, id);
    if (user.likedIds.includes(id)) {
        user.likedIds = user.likedIds.filter(i => i !== id);
        await updateDoc(dr, { likes: increment(-1) });
    } else {
        user.likedIds.push(id);
        likeSound.play();
        await updateDoc(dr, { likes: increment(1) });
    }
    localStorage.setItem('OtoUser', JSON.stringify(user));
};

window.toggleFollow = async (id) => {
    if(!user.following) user.following = [];
    user.following = user.following.includes(id) ? user.following.filter(i => i !== id) : [...user.following, id];
    localStorage.setItem('OtoUser', JSON.stringify(user));
    await saveUserToFireStore();
    syncLounge();
};

window.startDm = (pId, pName) => {
    currentCategory = 'dm'; currentDmUserId = pId;
    ['user-list-view', 'mypage-view'].forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('bottom-input-area').classList.remove('hidden');
    document.getElementById('page-title').innerText = `To: ${pName}`;
    const cId = [user.id, pId].sort().join('_');
    onSnapshot(query(collection(db, "dms", cId, "messages"), orderBy("timestamp", "asc")), (s) => {
        document.getElementById('message-list').innerHTML = s.docs.map(d => {
            const m = d.data(); const isMe = m.userId === user.id;
            return `<div class="flex flex-col ${isMe?'items-end':'items-start'}">
                <div class="${isMe?'bg-indigo-600 text-white':'bg-white border'} px-4 py-2 rounded-2xl ${isMe?'rounded-tr-none':'rounded-tl-none'} text-sm max-w-[80%] shadow-sm">
                    ${m.image ? `<img src="${m.image}" class="rounded-lg mb-2">` : ''}${m.text}
                </div><span class="text-[9px] text-gray-400 mt-1">${m.time}</span></div>`;
        }).join('');
        window.scrollTo(0, document.body.scrollHeight);
    });
};

window.loadMyActivity = async (t) => {
    const c = document.getElementById('mypage-content');
    c.innerHTML = '<p class="text-center text-xs text-gray-400">読み込み中...</p>';
    const q = query(collection(db, "lounge"), where("userId", "==", user.id), orderBy("timestamp", "desc"));
    const s = await getDocs(q);
    c.innerHTML = s.docs.map(d => `<div class="bg-white p-4 rounded-2xl shadow-sm text-sm border mb-2 flex justify-between items-center">${d.data().text} <button onclick="window.deletePost('lounge','${d.id}')">🗑️</button></div>`).join('') || '<p class="text-center text-xs text-gray-400">投稿なし</p>';
};

// ナビゲーション
window.goHome = () => { currentCategory='home'; document.getElementById('home-view').classList.remove('hidden'); document.getElementById('app-view').classList.add('hidden'); };
window.changeMode = (m) => {
    currentCategory = m;
    document.getElementById('home-view').classList.add('hidden'); document.getElementById('app-view').classList.remove('hidden');
    ['lounge-view', 'thread-list-view', 'chat-view', 'mypage-view', 'user-list-view'].forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById(m === 'lounge' ? 'lounge-view' : 'thread-list-view').classList.remove('hidden');
    document.getElementById('bottom-input-area').classList.toggle('hidden', m !== 'lounge');
    document.getElementById('fab').classList.toggle('hidden', m === 'lounge');
    document.getElementById('page-title').innerText = m==='lounge'?'ラウンジ':m==='talk'?'相談所':'バンド結成';
};

window.showUserList = async (type) => {
    const v = document.getElementById('user-list-view');
    document.getElementById('mypage-view').classList.add('hidden');
    v.classList.remove('hidden');
    document.getElementById('page-title').innerText = type==='following'?'フォロー中':'フォロワー';
    v.innerHTML = '<p class="text-center py-10 text-gray-400 text-xs">読込中...</p>';
    let users = [];
    if (type === 'following') {
        for (const id of (user.following || [])) {
            const s = await getDoc(doc(db, "users", id));
            if (s.exists()) users.push(s.data());
        }
    } else {
        const q = query(collection(db, "users"), where("following", "array-contains", user.id));
        const s = await getDocs(q);
        s.forEach(d => users.push(d.data()));
    }
    v.innerHTML = users.map(u => `
        <div class="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                    ${u.icon ? `<img src="${u.icon}" class="w-full h-full object-cover">` : `<span class="text-xs">${u.name.substring(0,2)}</span>`}
                </div>
                <div class="font-bold text-sm">${u.name}</div>
            </div>
            <button onclick="window.startDm('${u.id}', '${u.name}')" class="bg-indigo-600 text-white text-xs px-4 py-2 rounded-full font-bold">DM</button>
        </div>
    `).join('') || '<p class="text-center py-10 font-bold text-gray-400">いません</p>';
};

function syncThreads() { /* 省略せずに維持 */
    ['talk', 'band'].forEach(cat => {
        onSnapshot(query(collection(db, cat), orderBy("timestamp", "desc")), (s) => {
            if (currentCategory !== cat) return;
            document.getElementById('thread-list-view').innerHTML = s.docs.map(d => `<div onclick="window.openThread('${d.id}')" class="bg-white p-5 rounded-2xl shadow-sm border mb-3 flex justify-between items-center"><div><h3 class="font-bold">${d.data().title}</h3><p class="text-xs text-gray-400 mt-1">by ${d.data().userName}</p></div><span class="text-gray-300">❯</span></div>`).join('');
        });
    });
}

async function createThread() {
    const i = document.getElementById('thread-input'); if (!i.value.trim()) return;
    await addDoc(collection(db, currentCategory), { title: i.value, userId: user.id, userName: user.name, timestamp: Date.now() });
    i.value = ""; window.toggleThreadModal(false);
}

window.openThread = (id) => {
    currentThreadId = id; document.getElementById('thread-list-view').classList.add('hidden');
    document.getElementById('chat-view').classList.remove('hidden'); document.getElementById('bottom-input-area').classList.remove('hidden');
    onSnapshot(query(collection(db, currentCategory, id, "messages"), orderBy("timestamp", "asc")), (s) => {
        document.getElementById('message-list').innerHTML = s.docs.map(d => {
            const m = d.data(); const isMe = m.userId === user.id;
            return `<div class="flex flex-col ${isMe?'items-end':'items-start'}">
                <p class="text-[9px] text-gray-400 mb-1 mx-1">${m.userName}</p>
                <div class="${isMe?'bg-indigo-600 text-white':'bg-white border'} px-4 py-2 rounded-2xl text-sm max-w-[85%] shadow-sm">
                    ${m.image ? `<img src="${m.image}" class="rounded-lg mb-2">` : ''}${m.text}
                    ${isMe ? `<button onclick="window.deletePost('${currentCategory}','${id}','${d.id}')" class="ml-2 opacity-50 text-[10px]">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('');
    });
};

window.toggleThreadModal = (s) => document.getElementById('thread-modal').classList.toggle('hidden', !s);
