// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAJHCvgzkZQlNGYQDTrEhdeO3jn461w62M",
    authDomain: "tmjh-9aeca.firebaseapp.com", 
    databaseURL: "https://tmjh-9aeca-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tmjh-9aeca",
    storageBucket: "tmjh-9aeca.appspot.com",
    messagingSenderId: "821201370572",
    appId: "1:821201370572:web:17d0a3e2c2a2da533eb169",
    measurementId: "G-ZNH6NKZSXS"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const postContent = document.getElementById('postContent');
const charCount = document.getElementById('charCount');
const submitButton = document.getElementById('submitButton');
const postMedia = document.getElementById('postMedia');
const mediaPreview = document.getElementById('mediaPreview');
const postCount = document.getElementById('postCount');

function updateCharCount() {
    // 直接獲取內容並移除首尾空格
    const content = postContent.value.trim();
    const currentLength = content.length;
    
    // 更新顯示
    charCount.textContent = `已輸入 ${currentLength} 字`;
    
    // 更新字數警告狀態
    if (currentLength < 3) {
        charCount.classList.add('text-red-400');
    } else {
        charCount.classList.remove('text-red-400');
    }
}

// 添加新的事件監聽器
postContent.addEventListener('input', updateCharCount);
postContent.addEventListener('change', updateCharCount);
postContent.addEventListener('keyup', updateCharCount);

postMedia.addEventListener('change', function(e) {
    handleMediaFiles(e.target.files);
});

function handleMediaFiles(files) {
    const totalFiles = mediaPreview.children.length + files.length;
    if (totalFiles > 1) {
        alert('最多只能上傳一個檔案');
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const mediaElement = document.createElement('img');
            mediaElement.src = e.target.result;
            mediaElement.classList.add('w-full', 'h-full', 'object-cover', 'rounded-xl', 'shadow-lg', 'transition-all');
            const deleteButton = createDeleteButton();
            const container = document.createElement('div');
            container.classList.add('relative');
            container.appendChild(mediaElement);
            container.appendChild(deleteButton);
            mediaPreview.appendChild(container);
        }
        reader.readAsDataURL(file);
    });
}

function createDeleteButton() {
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '×';
    deleteButton.classList.add('absolute', 'top-2', 'right-2', 'bg-red-500', 'text-white', 'rounded-full', 'w-8', 'h-8', 'flex', 'items-center', 'justify-center', 'text-xl', 'font-bold', 'hover:bg-red-600', 'transition-colors', 'shadow-lg');
    deleteButton.addEventListener('click', function(e) {
        e.preventDefault();
        this.parentElement.remove();
    });
    return deleteButton;
}

// 移除重複的表單提交監聽器，只保留一個
const postForm = document.getElementById('postForm');
if (postForm) {
    postForm.removeEventListener('submit', handleSubmit);
    postForm.addEventListener('submit', handleSubmit);
}

// 1. 添加本地存儲緩存
const CACHE_KEY = 'postsCache';
const cache = {
    approvedPosts: [],
    lastFetch: null,
    CACHE_DURATION: 5 * 60 * 1000,  // 5分鐘的緩存時間
    totalPosts: 0,
    lastPostCountUpdate: null
};

// 2. 從本地存儲加載緩存
function loadCacheFromStorage() {
    const savedCache = localStorage.getItem(CACHE_KEY);
    if (savedCache) {
        const parsedCache = JSON.parse(savedCache);
        Object.assign(cache, parsedCache);
    }
}

// 3. 保存緩存到本地存儲
function saveCacheToStorage() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// 4. 優化載入已核准的貼文函數
async function loadApprovedPosts() {
    try {
        // 檢查內存緩存
        if (cache.approvedPosts.length > 0 && 
            cache.lastFetch && 
            (Date.now() - cache.lastFetch < cache.CACHE_DURATION)) {
            updatePostSelector(cache.approvedPosts);
            return;
        }

        // 使用複合查詢並限制數量
        const snapshot = await db.collection('posts')
            .where('approved', '==', true)
            .where('isReply', '==', false)
            .orderBy('postNumber', 'desc')
            .limit(50)
            .get();

        const posts = [];
        snapshot.forEach(doc => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // 更新緩存
        cache.approvedPosts = posts;
        cache.lastFetch = Date.now();
        saveCacheToStorage();

        updatePostSelector(posts);

    } catch (error) {
        console.error('載入貼文錯誤:', error);
        alert('載入貼文失敗，請稍後再試');
    }
}

// 5. 優化貼文計數功能
async function updatePostCount() {
    if (!postCount) return;

    // 檢查緩存
    if (cache.totalPosts && 
        cache.lastPostCountUpdate && 
        (Date.now() - cache.lastPostCountUpdate < cache.CACHE_DURATION)) {
        postCount.textContent = `目前貼文數量：${cache.totalPosts}`;
        return;
    }

    try {
        // 使用聚合查詢來獲取計數
        const snapshot = await db.collection('posts')
            .where('approved', '==', true)
            .count()
            .get();
        
        const count = snapshot.data().count;
        cache.totalPosts = count;
        cache.lastPostCountUpdate = Date.now();
        saveCacheToStorage();

        postCount.textContent = `目前貼文數量：${count}`;
    } catch (error) {
        console.error('更新貼文計數錯誤:', error);
    }
}

// 6. 初始化時加載緩存
window.addEventListener('load', () => {
    loadCacheFromStorage();
    updatePostCount();
});

// 3. 分離 UI 更新邏輯
function updatePostSelector(posts) {
    postSelector.innerHTML = '<option value="">請選擇要回覆的貼文...</option>';
    posts.forEach(post => {
        const option = document.createElement('option');
        option.value = post.id;
        option.textContent = `#${post.postNumber} - ${post.content.substring(0, 30)}${post.content.length > 30 ? '...' : ''}`;
        postSelector.appendChild(option);
    });
}

// 在文件頂部添加 batch 初始化
const batch = db.batch();

// 添加標籤相關變量
let selectedTag = '';
const tagButtons = document.querySelectorAll('.tag-button');

// 添加標籤選擇邏輯
tagButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault(); // 防止表單提交
        
        // 移除其他按鈕的選中狀態
        tagButtons.forEach(btn => {
            btn.classList.remove('bg-violet-500', 'text-white');
            btn.classList.add('text-violet-600');
        });
        
        // 設置當前按鈕的選中狀態
        button.classList.remove('text-violet-600');
        button.classList.add('bg-violet-500', 'text-white');
        selectedTag = button.dataset.tag;
        
        console.log('選擇的標籤:', selectedTag); // 用於調試
    });
});

// 修改提交函數
async function handleSubmit(e) {
    if (e) e.preventDefault();
    
    // 獲取提交按鈕
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) {
        console.error('找不到提交按鈕');
        return;
    }
    
    const content = postContent.value.trim();
    
    if (!selectedTag) {
        alert('請選擇一個標籤');
        return;
    }
    
    if (content.length < 3) {
        alert('請輸入至少3個字');
        return;
    }
    
    // 禁用按鈕並顯示加載狀態
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="spinner mx-auto"></div>';
    
    try {
        // 創建新的批次
        const newBatch = db.batch();
        
        // 獲取 IP 地址
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ipAddress = ipData.ip;
        
        // 處理媒體文件上傳
        const mediaUrls = [];
        if (postMedia.files.length > 0) {
            const file = postMedia.files[0];
            const storageRef = storage.ref('media/' + Date.now() + '_' + file.name);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            mediaUrls.push({
                url: url,
                type: 'image'
            });
        }

        if (isReplyMode) {
            // 回覆模式的處理
            const selectedPostId = postSelector.value;
            if (!selectedPostId) {
                alert('請選擇要回覆的貼文');
                submitButton.disabled = false;
                return;
            }

            const originalPost = cache.approvedPosts.find(post => post.id === selectedPostId);
            if (!originalPost) {
                throw new Error('找不到原始貼文');
            }

            const replyRef = db.collection('postsrea').doc();
            newBatch.set(replyRef, {
                originalPost: {
                    id: selectedPostId,
                    content: originalPost.content,
                    postNumber: originalPost.postNumber,
                    createdAt: originalPost.createdAt,
                    mediaUrls: originalPost.mediaUrls || []
                },
                replyContent: content,
                replyMediaUrls: mediaUrls,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress,
                status: 'pending',
                createdDate: new Date().toISOString(),
                tag: selectedTag
            });

            const originalPostRef = db.collection('posts').doc(selectedPostId);
            newBatch.update(originalPostRef, {
                replyCount: firebase.firestore.FieldValue.increment(1)
            });

        } else {
            // 修改發新文模式的處理，獲取最新的貼文編號
            const postNumberQuery = await db.collection('posts')
                .where('approved', '==', true)
                .orderBy('postNumber', 'desc')
                .limit(1)
                .get();

            let nextPostNumber = 1;
            if (!postNumberQuery.empty) {
                nextPostNumber = postNumberQuery.docs[0].data().postNumber + 1;
            }

            const postRef = db.collection('posts').doc();
            newBatch.set(postRef, {
                content: content,
                mediaUrls: mediaUrls,
                postNumber: nextPostNumber,  // 使用新獲取的編號
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress,
                status: 'pending',
                createdDate: new Date().toISOString(),
                replyCount: 0,
                isReply: false,
                approved: false,
                tag: selectedTag
            });
        }

        // 執行批次寫入
        await newBatch.commit();
        
        // 重置表單
        resetForm();
        
    } catch (error) {
        handleSubmitError(error, submitButton);
    }
}

// 5. 分離表單重置邏輯
function resetForm() {
    postContent.value = '';
    mediaPreview.innerHTML = '';
    charCount.textContent = '已輸入 0 字';
    if (isReplyMode) {
        postSelector.value = '';
    }

    submitButton.innerHTML = `
        <span>發布成功</span>
        <svg class="h-8 w-8 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
    `;

    setTimeout(() => {
        submitButton.innerHTML = `
            <span>發布貼文</span>
            <svg class="h-8 w-8 ml-3" fill="none" stroke="currentColor" viewBox="0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
        `;
        submitButton.disabled = false;
    }, 2000);

    // 重置標籤選擇
    selectedTag = '';
    tagButtons.forEach(btn => {
        btn.classList.remove('bg-violet-500', 'text-white');
        btn.classList.add('text-violet-600');
    });
}


let isReplyMode = false;
const togglePostType = document.getElementById('togglePostType');
const replySection = document.getElementById('replySection');
const currentMode = document.getElementById('currentMode');
const postSelector = document.getElementById('postSelector');

// 切換發文/回覆模式
togglePostType.addEventListener('click', function() {
    isReplyMode = !isReplyMode;
    togglePostType.classList.toggle('active');
    
    if (isReplyMode) {
        replySection.classList.remove('hidden');
        currentMode.textContent = '目前模式：回覆文';
        loadApprovedPosts();
    } else {
        replySection.classList.add('hidden');
        currentMode.textContent = '目前模式：發新文';
        postSelector.value = '';
    }
});

// 修改錯誤處理函數
function handleSubmitError(error, submitButton) {
    console.error('提交錯誤:', error);
    alert('提交失敗，請稍後重試');
    
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = `
            發布貼文
            <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
        `;
    }
}

// 修改 DOMContentLoaded 事件監聽器
document.addEventListener('DOMContentLoaded', () => {
    loadCacheFromStorage();
    updatePostCount();
    
    // 初始化所有事件監聽器
    initializeEventListeners();
});

// 新增事件監聽器初始化函數
function initializeEventListeners() {
    // 表單提交事件
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleSubmit();
        });
    }
    
    // 文本輸入事件
    const postContent = document.getElementById('postContent');
    if (postContent) {
        postContent.addEventListener('input', updateCharCount);
        postContent.addEventListener('change', updateCharCount);
        postContent.addEventListener('keyup', updateCharCount);
    }
    
    // 媒體上傳事件
    const postMedia = document.getElementById('postMedia');
    if (postMedia) {
        postMedia.addEventListener('change', (e) => {
            handleMediaFiles(e.target.files);
        });
    }
}

// 修改 CSS 樣式
const style = document.createElement('style');
style.textContent = `
    .star {
        position: absolute;
        background: #6366f1;
        border-radius: 50%;
        opacity: 0;
        animation: twinkle var(--duration) infinite;
    }

    @keyframes twinkle {
        0%, 100% { opacity: 0; }
        50% { opacity: 0.8; }
    }

    .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #6366f1;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
