const SUPABASE_URL = "https://eebtkvrvbuaxvkzfbtfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_flbM2x1ZS30nzV3fqs_qTw_rpbphb72";

let artworks = [];
let artworkIds = [];
let currentArtworkId = null;
let imageCounterHandler = null;

const PAGE_SIZE = 20;
const FAVORITE_SVG = `
<svg class="favorite-svg" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" d="M11.403 18.989q-.286-.106-.503-.324L9.752 17.63q-2.67-2.425-4.71-4.717Q3 10.622 3 8.15q0-1.908 1.296-3.204T7.5 3.65q1.094 0 2.279.553T12 6.289q1.037-1.533 2.221-2.086T16.5 3.65q1.908 0 3.204 1.296T21 8.15q0 2.529-2.125 4.862t-4.652 4.622l-1.142 1.031q-.218.218-.513.323t-.587.106t-.578-.106"/>
</svg>`;

let currentOffset = 0;
let isLoading = false;
let hasMore = true;

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

function safeGtag(...args) {
    window.dataLayer = window.dataLayer || [];
    if (typeof gtag === 'function') {
        gtag(...args);
    } else {
        // gtag未ロード時はdataLayerに直接積む
        window.dataLayer.push(arguments);
    }
}

function trackArtworkView(artId, title) {
    safeGtag('event', 'view_artwork', {
        artwork_id: artId,
        artwork_title: title
    });
}

function getJsTime() {
    // 1. ユーザーが世界のどこにいても「日本時間の現在時刻」の文字列を生成
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return formatter.format(now).replace(' ', 'T'); // 例: "2026-06-18T08:30:00"
}

function hasLiked(artId) {
    return localStorage.getItem(`liked_${artId}`) === 'true';
}

function saveLiked(artId) {
    localStorage.setItem(`liked_${artId}`, 'true');
}

async function getLikeCount(artId) {
    const { data, error } =
        await supabaseClient
            .from('artwork_like_counts')
            .select('likes')
            .eq('artwork_id', artId)
            .single();

    if (error) {
        return 0;
    }

    return data.likes;
}

async function getLikeCounts() {

    const { data, error } = await supabaseClient
        .from('artwork_like_counts')
        .select('*');

    if (error) {
        console.error(error);
        return {};
    }

    const result = {};

    data.forEach(row => {
        result[row.artwork_id] = row.likes;
    });

    return result;
}

async function loadArtworkIds() {
    const { data, error } = await supabaseClient
        .from('artworks')
        .select('id')
        .lte('published_at', getJsTime())
        .order('published_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    artworkIds = data.map(a => a.id);
}

async function getArtworkById(id) {
    const loaded = artworks.find(a => a.id === id);

    if (loaded) {
        return loaded;
    }

    const { data, error } = await supabaseClient
        .from('artworks')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error(error);
        return null;
    }

    artworks.push(data);

    return data;
}

////////////////////////////////////////////////////////////////////////////////
// loadArtworks
async function loadArtworks(autoOpen = false) {
    if (isLoading || !hasMore) {
        return;
    }
    isLoading = true;

    const { data, error } = await supabaseClient
    .from('artworks')
    .select('*')
    .lte('published_at', getJsTime())
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .range(
        currentOffset,
        currentOffset + PAGE_SIZE - 1
    );

    if (error) {
        console.error(error);
        isLoading = false;
        return;
    }

    if (data.length < PAGE_SIZE) {
        hasMore = false;
    }
    currentOffset += data.length;

    const likeCounts = await getLikeCounts();

    artworks.push(...data);

    const gallery = document.getElementById('gallery');

    data.forEach(art => {
        const card = document.createElement('div');
        card.className = 'card loading';
        card.dataset.artId = art.id;

        card.innerHTML = `
            <img src="images/thumbnails/${art.thumbnail_filename}">
            <div class="overlay">
            <span>${art.title}</span>
            <span class="card-like">${FAVORITE_SVG} ${likeCounts[art.id] || 0}</span>
            </div>
        `;

        const img = card.querySelector('img');
        img.addEventListener('load', () => {
            img.classList.add('loaded');
            card.classList.remove('loading');
        });

        card.addEventListener('click', async () => {
            await openArtwork(art);
        });

        gallery.appendChild(card);
    });

    const params = new URLSearchParams(window.location.search);
    const artId = params.get('art');

    if (autoOpen && artId) {
        console.log("URL art:", artId);
        const target = await getArtworkById(artId);
        console.log("target:", target);
        if (target) {
            await openArtwork(target);
        }
    }

    isLoading = false;
}

function getArtworkNavigation(artId) {
    const currentIndex = artworkIds.indexOf(artId);

    return {
        prev:
            currentIndex > 0
                ? artworkIds[currentIndex - 1]
                : null,
        current:
            artId,
        next:
            currentIndex < artworkIds.length - 1
                ? artworkIds[currentIndex + 1]
                : null
    };
}

function createNavThumbnail(art, isCurrent = false) {
    if (!art) {
        return `
            <div class="nav-thumb empty"></div>
        `;
    }

    const currentClass =
        isCurrent
            ? ' current'
            : '';

    return `
        <div
            class="nav-thumb${currentClass}"
            data-art-id="${art.id}"
        >
            <img
                src="images/thumbnails/${art.thumbnail_filename}"
                loading="lazy"
                alt="${art.title}"
            >
            <span class="nav-title">
                ${art.title}
            </span>
        </div>
    `;
}

function setupImageCounter(imagesCount) {
    const counter = document.getElementById('imageCounter');
    const modal = document.getElementById('modal');
    const imageElements = modal.querySelectorAll('.artwork-image');

    if (imageCounterHandler) {
        modal.removeEventListener('scroll', imageCounterHandler);
    }

    counter.textContent = `1 / ${imagesCount}`;

    function updateCounter() {
        let currentImage = null;
        let smallestTop = Infinity;

        const modal = document.getElementById('modal');
        
        // スクロール開始前は常に1枚目
        if (modal.scrollTop === 0) {
            counter.textContent = `1 / ${imagesCount}`;
            return;
        }

        if (modal.scrollTop + modal.clientHeight >= modal.scrollHeight - 10) {
            counter.textContent = `${imagesCount} / ${imagesCount}`;
            return;
        }

        imageElements.forEach(img => {
            const rect = img.getBoundingClientRect();
            const distance = Math.abs(rect.top);
            if (distance < smallestTop) {
                smallestTop = distance;
                currentImage = img;
            }
        });

        if (currentImage) {
            counter.textContent = `${currentImage.dataset.index} / ${imagesCount}`;
        }
    }

    counter.textContent = `1 / ${imagesCount}`;
    requestAnimationFrame(() => {
        updateCounter();
    });

    imageCounterHandler = updateCounter;
    modal.addEventListener('scroll', imageCounterHandler);
}

////////////////////////////////////////////////////////////////////////////////
// openArtwork
async function openArtwork(art, updateHistory = true) {
    currentArtworkId = art.id;
    trackArtworkView(art.id, art.title);

    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');

    const { data: images, error } = await supabaseClient
        .from('artwork_images')
        .select('*')
        .eq('artwork_id', art.id)
        .order('display_order');

    if (error) {
        console.error(error);
        return;
    }

    if (images.length === 0) {
        modalBody.innerHTML = `
            <h2>${art.title}</h2>
            <p>No images</p>
        `;

        modal.classList.remove('hidden');
        return;
    }

    const nav = getArtworkNavigation(art.id);
    const prevArt = nav.prev ? await getArtworkById(nav.prev) : null;
    const currentArt = await getArtworkById(nav.current);
    const nextArt = nav.next ? await getArtworkById(nav.next) : null;
    const likeCount = await getLikeCount(art.id);

    let imageHtml = '';
    images.forEach((image, index) => {
        imageHtml += `
            <img
                class="artwork-image"
                data-index="${index + 1}"
                src="images/originals/${image.image_filename}"
                alt="${art.title}"
                loading="lazy"
            >
        `;
    });

    const shareUrl = `https://annmnd.github.io/?art=${art.id}`;
    const shareText = `${art.title} | annmnd`;
    const shareLink = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    modalBody.innerHTML = `
        <div class="artwork-nav">
            ${createNavThumbnail(prevArt)}
            ${createNavThumbnail(currentArt, true)}
            ${createNavThumbnail(nextArt)}
        </div>
        <div class="artwork-header">
            <h2>${art.title}</h2>
            <div class="artwork-actions">
                <button id="likeButton" class="like-button">${FAVORITE_SVG} ${likeCount}</button>
                <a class="share-button" href="${shareLink}" target="_blank" rel="noopener">𝕏 Share</a>
            </div>
        </div>
        <div id="imageCounter">1 / ${images.length}</div>
        <div class="artwork-images">
            ${imageHtml}
        </div>
    `;

    modalBody
    .querySelectorAll('.artwork-image')
    .forEach(img => {
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', () => {
                img.classList.add('loaded');
            });
        }
    });

    const likeButton = document.getElementById('likeButton');
    if (hasLiked(art.id)) {
        likeButton.classList.add('liked');
        likeButton.disabled = true;
    }

    // いいねボタン
    likeButton.addEventListener('click', async () => {
        if (hasLiked(art.id)) {
            return;
        }

        const { error } = await supabaseClient
            .from('artwork_likes')
            .insert({
                artwork_id: art.id
            });

        if (error) {
            console.error(error);
            return;
        }

        saveLiked(art.id);
        safeGtag('event', 'like_artwork', {
            artwork_id: art.id,
            artwork_title: art.title
        });
        
        const newLikeCount = await getLikeCount(art.id);

        likeButton.classList.add('liked');
        likeButton.disabled = true;
        likeButton.innerHTML = `${FAVORITE_SVG} ${newLikeCount}`;

        const cardLike = document.querySelector(`[data-art-id="${art.id}"] .card-like`);

        if (cardLike) {
            cardLike.innerHTML = `${FAVORITE_SVG} ${newLikeCount}`;
        }
    });

    modalBody
    .querySelectorAll('.nav-thumb[data-art-id]')
    .forEach(el => {
        el.addEventListener('click', async () => {
            const targetId = el.dataset.artId;
            const targetArt = artworks.find(a => a.id === targetId);

            if (targetArt) {
                await openArtwork(targetArt);
            }
        });
    });

    if (updateHistory) {
        history.pushState(
            { artId: art.id },
            '',
            `?art=${art.id}`
        );
    }

    modal.classList.remove('hidden');
    modal.scrollTop = 0;
    setupImageCounter(images.length);
    document.body.style.overflow = 'hidden';
}

////////////////////////////////////////////////////////////////////////////////
// closeModal
function closeModal() {
    const modal = document.getElementById('modal');

    if (imageCounterHandler) {
        modal.removeEventListener('scroll', imageCounterHandler);
        imageCounterHandler = null;
    }

    modal.scrollTop = 0;

    document.getElementById('modal').classList.add('hidden');

    document.body.style.overflow = '';

    const targetId = currentArtworkId;
    currentArtworkId = null;

    if (targetId) {
        const card = document.querySelector(`[data-art-id="${targetId}"]`);
        if (card) {
            requestAnimationFrame(() => {
                card.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            });
        }
    }
}

function closeModalAndResetUrl() {
    history.replaceState(
        {},
        '',
        window.location.pathname
    );

    closeModal();
}

// close button for modal
document.getElementById('closeModal').addEventListener('click', closeModalAndResetUrl);

// close modal for esc key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModalAndResetUrl();
    }
});

// close when clicking background
document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') {
        closeModalAndResetUrl();
    }
});

window.addEventListener('popstate',async () => {
    const params = new URLSearchParams(window.location.search);
    const artId = params.get('art');

    if (!artId) {
        closeModal();
        return;
    }

    const target = await getArtworkById(artId);

    if (target) {
        await openArtwork(target, false);
    }
});

const observer = new IntersectionObserver(
    async entries => {
        if (entries[0].isIntersecting) {
            await loadArtworks();
        }
    },
    {
        rootMargin: '300px'
    }
);

(async () => {
    await loadArtworkIds();
    await loadArtworks(true);
    observer.observe(
        document.getElementById('loadTrigger')
    );
})();