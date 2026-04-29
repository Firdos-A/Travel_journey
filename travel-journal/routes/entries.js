const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

async function syncTags(entryId, tags = []) {
  await supabase.from('entry_tags').delete().eq('entry_id', entryId);
  const cleanTags = [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))];
  if (!cleanTags.length) return;

  const { data: tagData, error } = await supabase
    .from('tags')
    .upsert(cleanTags.map(name => ({ name })), { onConflict: 'name' })
    .select();

  if (error) throw error;
  if (tagData?.length) {
    const { error: joinError } = await supabase
      .from('entry_tags')
      .insert(tagData.map(tag => ({ entry_id: entryId, tag_id: tag.id })));
    if (joinError) throw joinError;
  }
}

async function syncPhotos(entryId, photos = []) {
  if (photos === undefined) return;
  await supabase.from('photos').delete().eq('entry_id', entryId);
  const rows = photos
    .map(photo => ({
      entry_id: entryId,
      url: typeof photo === 'string' ? photo : (photo.url || photo.image_url),
      caption: typeof photo === 'string' ? null : photo.caption
    }))
    .filter(photo => photo.url);

  if (rows.length) {
    const { error } = await supabase.from('photos').insert(rows);
    if (error) throw error;
  }
}

router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.query.user_id || req.session?.userId;
    let query = supabase.from('entries').select('country, mood, travel_date');
    if (userId) query = query.eq('user_id', userId);

    const { data: entries, error } = await query;
    if (error) throw error;

    const countries = [...new Set((entries || []).map(e => e.country).filter(Boolean))];
    const moodBreakdown = (entries || []).reduce((acc, entry) => {
      if (entry.mood) acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalEntries: entries?.length || 0,
        countriesVisited: countries.length,
        countries,
        moodBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { journal_id, country, mood, search } = req.query;
    const userId = req.query.user_id || req.session?.userId;

    let query = supabase
      .from('entries')
      .select('*, photos(*), entry_tags(tags(name)), journals(title)')
      .order('travel_date', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (journal_id) query = query.eq('journal_id', journal_id);
    if (country) query = query.ilike('country', `%${country}%`);
    if (mood) query = query.eq('mood', mood);
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,location.ilike.%${search}%,country.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('*, photos(*), entry_tags(tags(name)), journals(title, user_id)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Entry not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      journal_id, user_id, title, content, location, country,
      latitude, longitude, mood, weather, cover_image, travel_date, tags = [], photos = []
    } = req.body;

    const ownerId = user_id || req.session?.userId;
    if (!title || !country) {
      return res.status(400).json({ success: false, error: 'Title and country are required' });
    }

    const normalizedPhotos = photos.length ? photos : (cover_image ? [cover_image] : []);
    const firstPhoto = cover_image || normalizedPhotos[0] || null;

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert([{
        journal_id: journal_id || null,
        user_id: ownerId,
        title,
        content,
        location,
        country,
        latitude,
        longitude,
        mood,
        weather,
        cover_image: firstPhoto,
        travel_date: travel_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (entryError) throw entryError;
    await syncTags(entry.id, tags);
    await syncPhotos(entry.id, normalizedPhotos);

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      title, content, location, country, latitude, longitude,
      mood, weather, cover_image, travel_date, tags, photos
    } = req.body;

    const normalizedPhotos = photos?.length ? photos : (cover_image ? [cover_image] : []);
    const firstPhoto = cover_image || normalizedPhotos[0] || null;

    const { data, error } = await supabase
      .from('entries')
      .update({ title, content, location, country, latitude, longitude, mood, weather, cover_image: firstPhoto, travel_date })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (tags !== undefined) await syncTags(req.params.id, tags);
    if (photos !== undefined || cover_image !== undefined) await syncPhotos(req.params.id, normalizedPhotos);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('entries').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, data: null, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

