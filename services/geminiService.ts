import { GoogleGenAI, Type, Schema } from "@google/genai"; // Certifique-se de importar Schema se necessário, ou use Type
import { CorrectionResult, EssayInput, Topic } from "../types";

// Função auxiliar para limpar JSON (mantida)
const cleanJsonString = (str: string) => {
  if (!str) return "{}";
  let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

// Configuração centralizada do modelo para facilitar trocas futuras
// Recomendação: Use 'gemini-1.5-flash' para maior estabilidade e performance
const MODEL_NAME = "gemini-1.5-flash"; 

export const generateCustomTopic = async (userInterest: string): Promise<Topic> => {
  // Inicializa o cliente. O novo SDK aceita { apiKey } diretamente.
  const apiKey = process.env.API_KEY;
  
  // Debug: verificar se a API key está sendo carregada
  console.log('🔑 API Key presente?', apiKey ? 'SIM' : 'NÃO');
  
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing in process.env");
    throw new Error('Chave de API do Gemini não configurada. Verifique o arquivo .env e reinicie o servidor.');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `Tema solicitado: ${userInterest}` }] }], // Estrutura mais robusta
      config: {
        systemInstruction: "Aja como gerador instantâneo de temas ENEM. Forneça um título e 2 textos de apoio curtos com dados. Saída: JSON estrito.",
        responseMimeType: "application/json",
        temperature: 0.3,
        // thinkingConfig removido para evitar conflitos se o modelo não suportar ou se o budget 0 for inválido
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            supportTexts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  icon: { type: Type.STRING }
                },
                required: ["id", "title", "content", "icon"]
              }
            }
          },
          required: ["title", "supportTexts"]
        }
      }
    });

    // Verificação de segurança para resposta nula
    const responseText = response.text;
    if (!responseText) throw new Error("Resposta vazia da IA");

    const result = JSON.parse(cleanJsonString(responseText));
    return {
      id: crypto.randomUUID(),
      title: result.title,
      supportTexts: result.supportTexts
    };
  } catch (error: any) {
    console.error("Erro generateCustomTopic:", error);
    throw new Error("Erro ao gerar tema rápido.");
  }
};

export const generateAssignmentTheme = async (teacherPrompt: string): Promise<Topic> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `Criar tema de redação ENEM sobre: ${teacherPrompt}` }] }],
      config: {
        systemInstruction: `Você é um especialista em criar temas de redação para o ENEM.

TAREFA: Gerar um tema de redação completo baseado no interesse fornecido pelo professor.

REQUISITOS:
1. Título do tema: Deve ser claro, objetivo e no formato ENEM (geralmente uma frase que apresenta o problema/questão)
2. Exatamente 2 textos de apoio curtos (150-200 palavras cada):
   - Texto 1: Contexto histórico, dados estatísticos ou definição do problema
   - Texto 2: Perspectiva atual, exemplos concretos ou impactos sociais
3. Cada texto deve ter um título descritivo
4. Use ícones apropriados: "article", "analytics", "public", "school", "science", "gavel", "eco", "health_and_safety"

FORMATO: JSON estrito conforme o schema.`,
        responseMimeType: "application/json",
        temperature: 0.3,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            supportTexts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  icon: { type: Type.STRING }
                },
                required: ["id", "title", "content", "icon"]
              }
            }
          },
          required: ["title", "supportTexts"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("Resposta vazia da IA");

    const result = JSON.parse(cleanJsonString(responseText));
    return {
      id: crypto.randomUUID(),
      title: result.title,
      supportTexts: result.supportTexts
    };
  } catch (error: any) {
    console.error("Erro ao gerar tema de atividade:", error);
    throw new Error("Erro ao gerar tema. Tente novamente.");
  }
};


export const correctEssay = async (topicTitle: string, input: EssayInput): Promise<CorrectionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Você é a banca examinadora oficial do ENEM, extremamente rigorosa quanto à autoria.

  TAREFA CRÍTICA 1: DETECÇÃO DE I.A. (ANTI-PLÁGIO)
  Analise o texto procurando padrões de LLMs (como ChatGPT, Claude, etc):
  1. Perfeição sintática robótica sem a "voz" natural ou pequenos deslizes de um estudante.
  2. Uso excessivo e mecânico de conectivos de transição ("Ademais", "Em suma", "Nesse viés").
  3. Estrutura de parágrafos excessivamente simétrica e previsível.
  4. Vocabulário polido, genérico e sem marcas de oralidade ou personalidade.

  SE DETECTAR I.A. (Probabilidade > 80%):
  - PARE A AVALIAÇÃO IMEDIATAMENTE.
  - Defina "totalScore": 0.
  - Defina "aiDetected": true.
  - Defina "aiJustification": "ANULAÇÃO POR AUTORIA: O texto apresenta padrões sintáticos e estruturais característicos de Inteligência Artificial Generativa. A redação foi zerada por violação da política de autoria própria exigida no exame."
  - Nas "competencies", atribua nota 0 para todas e no feedback coloque: "Anulado por uso de IA".
  - "generalComment": "Texto anulado."

  SE FOR HUMANO:
  - Avalie as 5 competências do ENEM (0-200 pontos cada) com rigor técnico.
  - "aiDetected": false.
  - Calcule o totalScore (soma das 5 competências).

  Retorne estritamente o JSON conforme o schema.`;
  
  let parts: any[] = [];
  if (input.type === 'text') {
    parts = [{ text: `TEXTO DO ALUNO (Tema: ${topicTitle}):\n${input.content}` }];
  } else {
    parts = [
      { text: `Analise a imagem da redação manuscrita sobre o tema: ${topicTitle}` },
      // Estrutura inlineData correta para o novo SDK
      { 
        inlineData: { 
          mimeType: input.mimeType, 
          data: input.base64 
        } 
      }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, // Usando modelo estável
      // AQUI ESTAVA O ERRO PRINCIPAL: contents deve ser um array de objetos Content
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2000,
        // thinkingConfig removido para garantir JSON estrito sem interferência
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalScore: { type: Type.NUMBER },
            aiDetected: { type: Type.BOOLEAN },
            aiJustification: { type: Type.STRING },
            competencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING }
                },
                required: ["name", "score", "feedback"]
              }
            },
            generalComment: { type: Type.STRING }
          },
          required: ["totalScore", "competencies", "generalComment", "aiDetected"]
        }
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error("Resposta vazia da IA");

    return JSON.parse(cleanJsonString(responseText)) as CorrectionResult;

  } catch (error: any) {
    console.error("Erro na apuração:", error); // Log do erro real para debug
    throw new Error("Falha ao gerar apuração. Tente novamente.");
  }
};