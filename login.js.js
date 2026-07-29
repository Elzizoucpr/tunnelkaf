const SUPABASE_URL = 'https://sdmasacnexafratkhmtf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_htxck2VwTwPXORz5qiIhBg_wXMuU0X8';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email et mot de passe requis' })
      };
    }

    // Récupérer l'utilisateur
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const users = await res.json();

    if (!users || users.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Email ou mot de passe incorrect' })
      };
    }

    const user = users[0];

    if (!user.verified) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Compte non vérifié. Vérifiez votre email.' })
      };
    }

    if (!user.active) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Compte désactivé. Contactez le support.' })
      };
    }

    // Récupérer les abonnements
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const subs = await subRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          plan: user.plan,
          created_at: user.created_at
        },
        subscriptions: subs || []
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
