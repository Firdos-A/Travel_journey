const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');
const router = express.Router();
const supabase = require('../config/supabase');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

function setSession(req, profile) {
  req.session.userId = profile.id;
  req.session.username = profile.username;
  req.session.email = profile.email;
}

async function registerProfile(req, res) {
  const { username, email, password, avatar_url, bio } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ username, email, password_hash, avatar_url, bio }])
    .select('id, username, email, avatar_url, bio, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'That username or email is already in use' });
    }
    throw error;
  }

  setSession(req, data);
  return res.status(201).json({ success: true, data });
}

router.get('/session/me', (req, res) => {
  if (!req.session?.userId) return res.json({ success: true, data: null });
  res.json({
    success: true,
    data: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email
    }
  });
});

router.post('/session/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, bio, password_hash')
      .eq('email', email)
      .single();

    if (error || !profile) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValid = await verifyPassword(password, profile.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    setSession(req, profile);
    const { password_hash, ...safeProfile } = profile;
    res.json({ success: true, data: safeProfile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/session/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, data: null, message: 'Logged out' });
  });
});

router.post('/password/reset', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const password_hash = await hashPassword(password);
    const { data, error } = await supabase
      .from('profiles')
      .update({ password_hash })
      .eq('email', email)
      .select('id, email')
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'No account found for that email' });
    }

    res.json({ success: true, data: null, message: 'Password reset' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    return await registerProfile(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, bio, created_at')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Profile not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    return await registerProfile(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { username, avatar_url, bio } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .update({ username, avatar_url, bio })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

