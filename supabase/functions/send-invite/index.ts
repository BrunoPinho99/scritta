import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  role: string;
  schoolName: string;
  inviteLink: string;
}

serve(async (req) => {
  // Tratamento de CORS para permitir requisições do seu front-end
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, role, schoolName, inviteLink }: InviteRequest = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error('Chave do Resend não configurada no Supabase');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Scritta App <onboarding@resend.dev>', // Use este remetente para testes
        to: [email],
        subject: `Convite: Junte-se ao ${schoolName} no Scritta`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #4F46E5;">Você foi convidado!</h1>
            <p>A instituição <strong>${schoolName}</strong> convidou você para acessar a plataforma como <strong>${role === 'student' ? 'Aluno' : 'Professor'}</strong>.</p>
            <br/>
            <a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Aceitar Convite
            </a>
            <br/><br/>
            <p style="font-size: 12px; color: #666;">Ou copie este link: ${inviteLink}</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});