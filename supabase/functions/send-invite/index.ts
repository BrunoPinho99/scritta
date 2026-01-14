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
        // AQUI ESTÁ A MUDANÇA PRINCIPAL:
        from: 'Equipe Littera <contato@littera.app.br>', 
        to: [email],
        subject: `Convite: Junte-se ao ${schoolName} no Littera`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4F46E5;">Você foi convidado!</h1>
            <p>A instituição <strong>${schoolName}</strong> convidou você para acessar a plataforma <strong>Littera</strong> como <strong>${role === 'student' ? 'Aluno' : 'Professor'}</strong>.</p>
            <br/>
            <p>Clique no botão abaixo para criar sua senha e começar:</p>
            <a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Aceitar Convite e Entrar
            </a>
            <br/><br/>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">Se o botão não funcionar, copie este link:<br/> ${inviteLink}</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    
    // Verifica se o Resend retornou erro mesmo com status 200 (acontece às vezes)
    if (data.error) {
       throw new Error(data.message || 'Erro no envio do Resend');
    }

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