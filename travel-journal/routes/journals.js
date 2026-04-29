const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const userId = req.session?.userId || req.query.user_id;
    let query = supabase
      .from('journals')
      .select('*, profiles(username, avatar_url), entries(count)')
      .order('updated_at', { ascending: false });

    query = userId ? query.eq('user_id', userId) : query.eq('is_public', true);

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
      .from('journals')
      .select('*, profiles(username, avatar_url, bio), entries(*, photos(*), entry_tags(tags(name)))')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Journal not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, cover_image, is_public, user_id } = req.body;
    const ownerId = user_id || req.session?.userId;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const { data, error } = await supabase
      .from('journals')
      .insert([{ title, description, cover_image, is_public: !!is_public, user_id: ownerId }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, cover_image, is_public } = req.body;
    const { data, error } = await supabase
      .from('journals')
      .update({ title, description, cover_image, is_public })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('journals').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, data: null, message: 'Journal deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

