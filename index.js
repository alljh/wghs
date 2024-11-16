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
          const currentLength = postContent.value.length;
          charCount.textContent = `已輸入 ${currentLength} 字`;
          
          if (currentLength < 3) {
              charCount.classList.add('text-red-400');
          } else {
              charCount.classList.remove('text-red-400');
          }
      }
  
      postContent.addEventListener('input', updateCharCount);
  
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
          // 移除所有現有的提交事件監聽器
          const newPostForm = postForm.cloneNode(true);
          postForm.parentNode.replaceChild(newPostForm, postForm);
          
          // 添加新的提交事件監聽器
          newPostForm.addEventListener('submit', async function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              try {
                  await handleSubmit(e);
              } catch (error) {
                  handleSubmitError(error);
              }
              
              return false;
          });
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
          createStars();
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

      // 修改提交函數
      async function handleSubmit(e) {
          if (e) {
              e.preventDefault();
              e.stopPropagation();
          }
          
          // 檢查是否已經在提交中
          if (submitButton.disabled) {
              return;
          }
          
          const content = postContent.value;
          
          if (content.trim().length < 3) {
              alert('請輸入至少3個字');
              return;
          }
          
          // 禁用提交按鈕
          submitButton.disabled = true;
          submitButton.innerHTML = '<div class="spinner mx-auto"></div>';
          
          try {
              // 創建新的批次
              const newBatch = db.batch();
              
              // 獲取 IP 地址
              let ipAddress = '';
              try {
                  const ipResponse = await fetch('https://api.ipify.org?format=json');
                  const ipData = await ipResponse.json();
                  ipAddress = ipData.ip;
              } catch (error) {
                  console.error('獲取 IP 地址失敗:', error);
                  ipAddress = 'unknown';
              }
              
              // 處理媒體文件上傳
              const mediaUrls = [];
              if (postMedia.files.length > 0) {
                  const file = postMedia.files[0];
                  try {
                      const storageRef = storage.ref('media/' + Date.now() + '_' + file.name);
                      await storageRef.put(file);
                      const url = await storageRef.getDownloadURL();
                      mediaUrls.push({
                          url: url,
                          type: 'image'
                      });
                  } catch (error) {
                      console.error('上傳媒體文件失敗:', error);
                      throw new Error('上傳媒體文件失敗');
                  }
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
                      createdDate: new Date().toISOString()
                  });

                  const originalPostRef = db.collection('posts').doc(selectedPostId);
                  newBatch.update(originalPostRef, {
                      replyCount: firebase.firestore.FieldValue.increment(1)
                  });

              } else {
                  // 發新文模式的處理
                  const maxPostNumber = cache.approvedPosts.length > 0 
                      ? Math.max(...cache.approvedPosts.map(p => p.postNumber || 0))
                      : 0;

                  const postRef = db.collection('posts').doc();
                  newBatch.set(postRef, {
                      content: content,
                      mediaUrls: mediaUrls,
                      postNumber: maxPostNumber + 1,
                      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                      ipAddress: ipAddress,
                      status: 'pending',
                      createdDate: new Date().toISOString(),
                      replyCount: 0,
                      isReply: false,
                      approved: false
                  });
              }

              // 執行批次寫入
              await newBatch.commit();
              
              // 重置表單
              resetForm();
              
          } catch (error) {
              console.error('提交失敗:', error);
              handleSubmitError(error);
              throw error;
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
                  <svg class="h-8 w-8 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
              `;
              submitButton.disabled = false;
          }, 2000);
      }

      // 生成星星的函數
      function createStars() {
          const container = document.getElementById('starsContainer');
          const starCount = 150; // 增加星星數量
  
          for (let i = 0; i < starCount; i++) {
              const star = document.createElement('div');
              star.className = 'star';
              
              const left = Math.random() * 100;
              star.style.left = `${left}%`;
              
              const size = Math.random() * 4;
              star.style.width = `${size}px`;
              star.style.height = `${size}px`;
              
              const duration = 4 + Math.random() * 8;
              star.style.setProperty('--duration', `${duration}s`);
              
              const delay = Math.random() * 5;
              star.style.animationDelay = `${delay}s`;
              
              container.appendChild(star);
          }
      }
  
      window.addEventListener('load', createStars);
  
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

      // 添加錯誤處理函數
      function handleSubmitError(error) {
          console.error('提交錯誤:', error);
          alert('提交失敗，請稍後重試\n' + (error.message || '未知錯誤'));
          submitButton.disabled = false;
          submitButton.innerHTML = `
              <span>發布貼文</span>
              <svg class="h-8 w-8 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
          `;
      }