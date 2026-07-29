const SUPABASE_URL = 'https://sdmasacnexafratkhmtf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_htxck2VwTwPXORz5qiIhBg_wXMuU0X8';

async function sbGet(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function sbDelete(table, filter) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, otp } = JSON.parse(event.body);

    if (!email || !otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email et code requis' })
      };
    }

    // Récupérer OTP en attente
    const pending = await sbGet('otp_pending', `email=eq.${encodeURIComponent(email)}&select=*`);

    if (!pending || pending.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Code introuvable. Recommencez l\'inscription.' })
      };
    }

    const record = pending[0];

    // Vérifier expiration
    if (new Date(record.expires) < new Date()) {
      await sbDelete('otp_pending', `email=eq.${encodeURIComponent(email)}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Code expiré. Recommencez l\'inscription.' })
      };
    }

    // Vérifier le code
    if (record.otp !== otp.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Code incorrect. Vérifiez votre email.' })
      };
    }

    // Créer le compte utilisateur
    const newUser = await sbPost('users', {
      email: record.email,
      name: record.name,
      phone: record.phone || '',
      plan: record.plan || 'starter',
      verified: true,
      active: true
    });

    // Créer un abonnement de base
    if (newUser && newUser[0]) {
      const planLabels = {
        'admin': 'Admin Pack',
        'lan': 'LAN Pack',
        'starter': 'Starter',
        'business': 'Business'
      };
      await sbPost('subscriptions', {
        user_id: newUser[0].id,
        plan: record.plan || 'starter',
        label: planLabels[record.plan] || 'Starter',
        status: 'pending',
        tokens_total: record.plan === 'lan' ? 30 : 0
      });
    }

    // Supprimer l'OTP utilisé
    await sbDelete('otp_pending', `email=eq.${encodeURIComponent(email)}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        user: newUser && newUser[0] ? {
          id: newUser[0].id,
          name: newUser[0].name,
          email: newUser[0].email,
          phone: newUser[0].phone,
          plan: newUser[0].plan,
          created_at: newUser[0].created_at
        } : null
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
