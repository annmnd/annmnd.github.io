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

        card.addEventListener('click', () => {
            openArtwork(art);
        });

        gallery.appendChild(card);
    });
}

function openArtwork(art) {
    const modal = document.getElementById('modal');

    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <h2>${art.title}</h2>
        <p>
            artwork id:
            ${art.id}
        </p>
    `;

    modal.classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
});

loadArtworks();