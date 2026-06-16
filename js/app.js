const SUPABASE_URL = "https://eebtkvrvbuaxvkzfbtfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_flbM2x1ZS30nzV3fqs_qTw_rpbphb72";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

async function loadArtworks() {
    const { data, error } = await supabaseClient
        .from('artworks')
        .select('*')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending:false });

    if (error) {
        console.error(error);
        return;
    }

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
}

async function openArtwork(art) {
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

    let imageHtml = '';
    images.forEach(image => {
        imageHtml += `
            <img
                class="artwork-image"
                src="images/originals/${image.image_filename}"
                alt="${art.title}"
                loading="lazy"
            >
        `;
    });

    modalBody.innerHTML = `
        <h2>${art.title}</h2>
        <div class="artwork-images">
            ${imageHtml}
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.getElementById('modal').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') {
        e.currentTarget.classList.add('hidden');
        document.body.style.overflow = '';
    }
});

loadArtworks();