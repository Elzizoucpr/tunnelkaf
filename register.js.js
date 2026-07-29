const SUPABASE_URL = 'https://sdmasacnexafratkhmtf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_htxck2VwTwPXORz5qiIhBg_wXMuU0X8';

async function supabase(table, method, body, filter) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;
  const res = await fetch(url, {
    method: method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, name, phone, plan } = JSON.parse(event.body);

    if (!email || !name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email et nom requis' })
      };
    }

    // Vérifier si email déjà utilisé
    const existing = await supabase('users', 'GET', null, `email=eq.${email}&select=id`);
    if (existing && existing.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cet email est déjà utilisé' })
      };
    }

    // Générer OTP 6 chiffres
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Supprimer ancien OTP si existe
    await fetch(`${SUPABASE_URL}/rest/v1/otp_pending?email=eq.${email}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    // Sauvegarder OTP
    await supabase('otp_pending', 'POST', {
      email, name, phone: phone || '', plan: plan || 'starter', otp, expires
    });

    // Envoyer email via Brevo
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'TUNNELKAF', email: 'no-reply@tunnelkaf.bf' },
          to: [{ email, name }],
          subject: 'Votre code de vérification TUNNELKAF',
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px">
              <div style="background:#f97316;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
                <h1 style="color:#fff;margin:0;font-size:24px">TUNNELKAF</h1>
                <p style="color:#fff;opacity:.85;margin:4px 0 0;font-size:13px">VPN Pro — Accès MikroTik sécurisé</p>
              </div>
              <h2 style="color:#111827">Bienvenue, ${name} !</h2>
              <p style="color:#6b7280">Merci de créer votre compte TUNNELKAF. Voici votre code de vérification :</p>
              <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
                <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#f97316;font-family:monospace">
                  ${otp}
                </div>
                <p style="color:#92400e;font-size:12px;margin:8px 0 0">⏱ Ce code expire dans 10 minutes</p>
              </div>
              <p style="color:#6b7280;font-size:13px">
                Si vous n'avez pas créé de compte TUNNELKAF, ignorez cet email.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
              <p style="color:#9ca3af;font-size:11px;text-align:center">
                TUNNELKAF — VPN Pro Burkina Faso<br>
                contact@tunnelkaf.bf
              </p>
            </div>
          `
        })
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'Code envoyé sur ' + email })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
