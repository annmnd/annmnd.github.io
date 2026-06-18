const SUPABASE_URL = "https://eebtkvrvbuaxvkzfbtfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_flbM2x1ZS30nzV3fqs_qTw_rpbphb72";

let artworks = [];
let currentArtworkId = null;
let imageCounterHandler = null;

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

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

async function loadArtworks() {
    const { data, error } = await supabaseClient
        .from('artworks')
        .select('*')
        .lte('published_at', getJsTime())
        .order('published_at', { ascending:false });

    if (error) {
        console.error(error);
        return;
    }

    artworks = data;

    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    data.forEach(art => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
            <img src="images/thumbnails/${art.thumbnail_filename}">
            <div class="overlay">
            <span>${art.title}</span>
            <span>❤️ ${art.likes}</span>
            </div>
        `;

        card.addEventListener('click', async () => {
            await openArtwork(art);
        });

        gallery.appendChild(card);
    });

    const params = new URLSearchParams(window.location.search);
    const artId = params.get('art');

    if (artId) {
        const target = artworks.find(a => a.id === artId);
        if (target) {
            await openArtwork(target);
        }
    }
}

function getArtworkNavigation(artId) {
    const currentIndex = artworks.findIndex(a => a.id === artId);

    return {
        prev:
            currentIndex > 0
                ? artworks[currentIndex - 1]
                : null,
        current:
            artworks[currentIndex],
        next:
            currentIndex < artworks.length - 1
                ? artworks[currentIndex + 1]
                : null
    };
}

function createNavThumbnail(art, label) {
    if (!art) {
        return `
            <div class="nav-thumb empty"></div>
        `;
    }

    const currentClass =
        label === '現在'
            ? ' current'
            : '';

    return `
        <div
            class="nav-thumb${currentClass}"
            data-art-id="${art.id}"
        >
            <img
                src="images/thumbnails/${art.thumbnail_filename}"
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

    updateCounter();

    imageCounterHandler = updateCounter;
    modal.addEventListener('scroll', imageCounterHandler);
}

async function openArtwork(art, updateHistory = true) {
    currentArtworkId = art.id;
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
            <p>画像が登録されていません</p>
        `;

        modal.classList.remove('hidden');
        return;
    }

    const nav = getArtworkNavigation(art.id);

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

    modalBody.innerHTML = `
        <div class="artwork-nav">
            ${createNavThumbnail(
                nav.prev,
                art.title
            )}
            ${createNavThumbnail(
                nav.current,
                art.title
            )}
            ${createNavThumbnail(
                nav.next,
                art.title
            )}
        </div>
        <h2>${art.title}</h2>
        <div id="imageCounter">
            1 / ${images.length}
        </div>
        <div class="artwork-images">
            ${imageHtml}
        </div>
    `;

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

    setupImageCounter(images.length);

    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('modal');

    if (imageCounterHandler) {
        modal.removeEventListener('scroll', imageCounterHandler);
        imageCounterHandler = null;
    }

    document.getElementById('modal').classList.add('hidden');

    document.body.style.overflow = '';
    currentArtworkId = null;
}

// close button for modal
document.getElementById('closeModal').addEventListener('click', closeModal);

// close modal for esc key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// 背景クリック
document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') {
        closeModal();
    }
});

window.addEventListener('popstate',async () => {
    const params = new URLSearchParams(window.location.search);
    const artId = params.get('art');

    if (!artId) {
        closeModal();
        return;
    }

    const target = artworks.find(a => a.id === artId);

    if (target) {
        await openArtwork(target, false);
    }
});

loadArtworks();